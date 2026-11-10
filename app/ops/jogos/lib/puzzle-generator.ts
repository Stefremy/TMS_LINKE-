export interface GridCoord {
  r: number
  c: number
}

export interface GeneratedFlowLevel {
  levelNumber: number
  size: number
  title: string
  pairCount: number
  endpoints: Record<number, [[number, number], [number, number]]>
  solutionPaths: Record<number, [number, number][]>
}

export interface OneStrokeVertex {
  id: number
  x: number
  y: number
}

export interface OneStrokeEdge {
  u: number
  v: number
}

export interface GeneratedOneStrokeLevel {
  levelNumber: number
  title: string
  description: string
  vertices: OneStrokeVertex[]
  edges: OneStrokeEdge[]
  oddVertexIds: number[]
  solutionPath: number[]
}

export interface GeneratedNumberPathLevel {
  levelNumber: number
  size: number
  title: string
  description: string
  waypoints: Record<string, number>
  totalCells: number
  solutionPath: string[]
}

export function getLisbonDateKey(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Lisbon",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

export function formatPtDateFromKey(dateKey: string): string {
  const parts = dateKey.split("-")
  if (parts.length !== 3) return dateKey
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function createRng(seedInput: string | number): () => number {
  let state = typeof seedInput === "number" ? seedInput >>> 0 : hashSeed(seedInput)
  if (state === 0) state = 0x6d2b79f5
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randInt(rng: () => number, minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(rng() * (maxInclusive - minInclusive + 1))
}

export function shuffleArray<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = copy[i]
    copy[i] = copy[j]
    copy[j] = tmp
  }
  return copy
}

function applyDihedralTransform(
  r: number,
  c: number,
  size: number,
  sym: number
): [number, number] {
  let nr = r
  let nc = c
  const rot = sym & 3
  for (let i = 0; i < rot; i++) {
    const prevR = nr
    nr = nc
    nc = size - 1 - prevR
  }
  if (sym & 4) {
    nc = size - 1 - nc
  }
  return [nr, nc]
}

/**
 * Generates a randomized orthogonal Hamiltonian path covering every cell of a size x size grid
 * using the ergodic backbite (endpoint-rewiring) algorithm.
 */
export function generateHamiltonianGridPath(size: number, rng: () => number): [number, number][] {
  const total = size * size
  const path: [number, number][] = []

  for (let r = 0; r < size; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c < size; c++) path.push([r, c])
    } else {
      for (let c = size - 1; c >= 0; c--) path.push([r, c])
    }
  }

  const pos = new Int32Array(total)
  for (let i = 0; i < total; i++) {
    pos[path[i][0] * size + path[i][1]] = i
  }

  const dirs: readonly [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]

  const iterations = Math.max(250, size * size * 45)
  for (let step = 0; step < iterations; step++) {
    if (rng() < 0.5) {
      path.reverse()
      for (let i = 0; i < total; i++) {
        pos[path[i][0] * size + path[i][1]] = i
      }
    }

    const [tr, tc] = path[total - 1]
    const [pr, pc] = path[total - 2]

    const candidates: number[] = []
    for (const [dr, dc] of dirs) {
      const nr = tr + dr
      const nc = tc + dc
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue
      if (nr === pr && nc === pc) continue
      const idx = pos[nr * size + nc]
      if (idx >= 0 && idx < total - 2) {
        candidates.push(idx)
      }
    }

    if (candidates.length === 0) continue
    const j = candidates[Math.floor(rng() * candidates.length)]

    // Reverse slice [j + 1 .. total - 1]
    let left = j + 1
    let right = total - 1
    while (left < right) {
      const tmp = path[left]
      path[left] = path[right]
      path[right] = tmp
      pos[path[left][0] * size + path[left][1]] = left
      pos[path[right][0] * size + path[right][1]] = right
      left++
      right--
    }
  }

  const sym = Math.floor(rng() * 8)
  return path.map(([r, c]) => applyDihedralTransform(r, c, size, sym))
}

function manhattan(a: [number, number], b: [number, number]): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
}

function countTurns(path: [number, number][]): number {
  let turns = 0
  for (let i = 1; i < path.length - 1; i++) {
    const dr1 = path[i][0] - path[i - 1][0]
    const dc1 = path[i][1] - path[i - 1][1]
    const dr2 = path[i + 1][0] - path[i][0]
    const dc2 = path[i + 1][1] - path[i][1]
    if (dr1 !== dr2 || dc1 !== dc2) turns++
  }
  return turns
}

function randomPartitionLengths(
  totalCells: number,
  parts: number,
  minLen: number,
  maxLen: number,
  rng: () => number
): number[] {
  const lengths = new Array<number>(parts).fill(minLen)
  let remaining = totalCells - parts * minLen
  let guard = 0
  while (remaining > 0 && guard < 1000) {
    guard++
    const idx = Math.floor(rng() * parts)
    if (lengths[idx] < maxLen) {
      lengths[idx]++
      remaining--
    }
  }
  if (remaining > 0) {
    for (let i = 0; i < parts && remaining > 0; i++) {
      lengths[i] += remaining
      remaining = 0
    }
  }
  return shuffleArray(lengths, rng)
}

const FLOW_LEVEL_SPECS = [
  { levelNumber: 1, size: 5, pairCount: 4, minLen: 4, maxLen: 9, name: "Fluxo Inicial" },
  { levelNumber: 2, size: 5, pairCount: 5, minLen: 3, maxLen: 8, name: "Malha Densa" },
  { levelNumber: 3, size: 6, pairCount: 5, minLen: 4, maxLen: 11, name: "Expansão Logística" },
  { levelNumber: 4, size: 6, pairCount: 6, minLen: 4, maxLen: 9, name: "Cruzamento Seguro" },
  { levelNumber: 5, size: 7, pairCount: 7, minLen: 4, maxLen: 11, name: "Mestre das Rotas" },
] as const

/**
 * Generates a guaranteed 100%-solvable Flow Lines puzzle by partitioning a randomized
 * full-grid Hamiltonian path into disjoint non-adjacent-endpoint segments.
 */
export function generateFlowLevel(
  levelNumber: number,
  dailyKey: string = getLisbonDateKey(),
  variant: number = 0
): GeneratedFlowLevel {
  const spec = FLOW_LEVEL_SPECS[Math.max(0, Math.min(FLOW_LEVEL_SPECS.length - 1, levelNumber - 1))]
  const rng = createRng(`${dailyKey}|flow|L${spec.levelNumber}|v${variant}`)
  const totalCells = spec.size * spec.size

  let bestSegments: [number, number][][] | null = null
  let bestScore = -Infinity

  for (let attempt = 0; attempt < 48; attempt++) {
    const hamPath = generateHamiltonianGridPath(spec.size, rng)
    const lengths = randomPartitionLengths(totalCells, spec.pairCount, spec.minLen, spec.maxLen, rng)

    const segments: [number, number][][] = []
    let cursor = 0
    let validNonTrivial = true
    let distSum = 0
    let turnTotal = 0

    for (const len of lengths) {
      const seg = hamPath.slice(cursor, cursor + len)
      cursor += len
      const d = manhattan(seg[0], seg[seg.length - 1])
      if (d < 2) {
        validNonTrivial = false
        break
      }
      distSum += d
      turnTotal += countTurns(seg)
      segments.push(seg)
    }

    if (!validNonTrivial) continue

    const score = distSum * 10 + turnTotal * 3
    if (score > bestScore) {
      bestScore = score
      bestSegments = segments
    }
    if (attempt >= 16 && bestSegments) break
  }

  // Fallback with relaxed min dist >= 1 (still 100% full-board valid partition)
  if (!bestSegments) {
    const hamPath = generateHamiltonianGridPath(spec.size, rng)
    const lengths = randomPartitionLengths(totalCells, spec.pairCount, spec.minLen, spec.maxLen, rng)
    bestSegments = []
    let cursor = 0
    for (const len of lengths) {
      bestSegments.push(hamPath.slice(cursor, cursor + len))
      cursor += len
    }
  }

  // Permute color IDs so colors shift daily as well
  const colorIds = shuffleArray(
    Array.from({ length: spec.pairCount }, (_, i) => i + 1),
    rng
  )

  const endpoints: Record<number, [[number, number], [number, number]]> = {}
  const solutionPaths: Record<number, [number, number][]> = {}

  for (let i = 0; i < bestSegments.length; i++) {
    const seg = bestSegments[i]
    const colorId = colorIds[i]
    const flipEnds = rng() < 0.5
    const orderedSeg = flipEnds ? [...seg].reverse() : seg
    solutionPaths[colorId] = orderedSeg
    endpoints[colorId] = [orderedSeg[0], orderedSeg[orderedSeg.length - 1]]
  }

  return {
    levelNumber: spec.levelNumber,
    size: spec.size,
    pairCount: spec.pairCount,
    title: `Nível ${spec.levelNumber} - ${spec.name} (${spec.size}x${spec.size})`,
    endpoints,
    solutionPaths,
  }
}

// ---------------------------------------------------------------------------
// ONE STROKE (EULERIAN TRAIL / CIRCUIT) PROCEDURAL GENERATOR
// ---------------------------------------------------------------------------

export function getEdgeKey(u: number, v: number): string {
  return u < v ? `${u}-${v}` : `${v}-${u}`
}

function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const projX = ax + t * dx
  const projY = ay + t * dy
  return Math.hypot(px - projX, py - projY)
}

function edgeAvoidsOtherVertices(
  uId: number,
  vId: number,
  vertices: OneStrokeVertex[],
  minClearance = 19
): boolean {
  const u = vertices.find(v => v.id === uId)
  const v = vertices.find(item => item.id === vId)
  if (!u || !v) return false
  for (const w of vertices) {
    if (w.id === uId || w.id === vId) continue
    if (pointToSegmentDistance(w.x, w.y, u.x, u.y, v.x, v.y) < minClearance) {
      return false
    }
  }
  return true
}

export function getOddDegreeVertices(
  vertexIds: number[],
  edges: OneStrokeEdge[]
): number[] {
  const deg = new Map<number, number>()
  for (const id of vertexIds) deg.set(id, 0)
  for (const e of edges) {
    deg.set(e.u, (deg.get(e.u) || 0) + 1)
    deg.set(e.v, (deg.get(e.v) || 0) + 1)
  }
  return vertexIds.filter(id => (deg.get(id) || 0) % 2 === 1)
}

export function isGraphConnected(vertexIds: number[], edges: OneStrokeEdge[]): boolean {
  const adj = new Map<number, number[]>()
  const active = new Set<number>()
  for (const e of edges) {
    active.add(e.u)
    active.add(e.v)
    if (!adj.has(e.u)) adj.set(e.u, [])
    if (!adj.has(e.v)) adj.set(e.v, [])
    adj.get(e.u)!.push(e.v)
    adj.get(e.v)!.push(e.u)
  }
  for (const id of vertexIds) active.add(id)
  if (active.size === 0) return false

  const start = active.values().next().value as number
  const visited = new Set<number>([start])
  const queue = [start]
  while (queue.length > 0) {
    const cur = queue.shift()!
    for (const nxt of adj.get(cur) || []) {
      if (!visited.has(nxt)) {
        visited.add(nxt)
        queue.push(nxt)
      }
    }
  }
  return visited.size === active.size
}

/**
 * Hierholzer's algorithm to construct a valid Eulerian trail over `edges`,
 * optionally constrained to start from `preferredStart`.
 */
export function findEulerianTrail(
  vertexIds: number[],
  edges: OneStrokeEdge[],
  preferredStart?: number
): number[] | null {
  if (edges.length === 0) return null

  const deg = new Map<number, number>()
  const active = new Set<number>()
  const adj = new Map<number, { to: number; edgeIdx: number }[]>()

  edges.forEach((e, idx) => {
    active.add(e.u)
    active.add(e.v)
    deg.set(e.u, (deg.get(e.u) || 0) + 1)
    deg.set(e.v, (deg.get(e.v) || 0) + 1)
    if (!adj.has(e.u)) adj.set(e.u, [])
    if (!adj.has(e.v)) adj.set(e.v, [])
    adj.get(e.u)!.push({ to: e.v, edgeIdx: idx })
    adj.get(e.v)!.push({ to: e.u, edgeIdx: idx })
  })

  for (const id of vertexIds) {
    if (!active.has(id) && (deg.get(id) || 0) === 0) {
      // Isolated vertices are not allowed in playable graphs
      return null
    }
  }

  const odd = [...active].filter(id => (deg.get(id) || 0) % 2 === 1)
  if (odd.length !== 0 && odd.length !== 2) return null

  let start = preferredStart
  if (odd.length === 2) {
    if (start === undefined || !odd.includes(start)) {
      start = odd[0]
    }
  } else if (start === undefined || !active.has(start)) {
    start = [...active][0]
  }

  const used = new Uint8Array(edges.length)
  const ptr = new Map<number, number>()
  const stack: number[] = [start]
  const trail: number[] = []

  while (stack.length > 0) {
    const v = stack[stack.length - 1]
    const list = adj.get(v) || []
    let i = ptr.get(v) || 0
    while (i < list.length && used[list[i].edgeIdx]) {
      i++
    }
    ptr.set(v, i)
    if (i < list.length) {
      const edge = list[i]
      used[edge.edgeIdx] = 1
      stack.push(edge.to)
    } else {
      trail.push(stack.pop()!)
    }
  }

  if (trail.length !== edges.length + 1) return null
  return trail.reverse()
}

/**
 * Checks in O(V + E) time whether the remaining untraversed edges can be completed
 * from `currentVertexId` into a valid Eulerian continuation, and returns the next vertex hint.
 */
export function evaluateOneStrokeRemainingState(
  edges: OneStrokeEdge[],
  traversedEdgeKeys: Set<string>,
  currentVertexId: number | null
): {
  canFinish: boolean
  nextHintVertexId: number | null
  oddRemainingVertices: number[]
} {
  const remainingEdges = edges.filter(e => !traversedEdgeKeys.has(getEdgeKey(e.u, e.v)))
  if (remainingEdges.length === 0) {
    return { canFinish: true, nextHintVertexId: null, oddRemainingVertices: [] }
  }

  const remVertices = Array.from(
    new Set(remainingEdges.flatMap(e => [e.u, e.v]))
  )

  if (currentVertexId === null) {
    const trail = findEulerianTrail(remVertices, remainingEdges)
    return {
      canFinish: trail !== null,
      nextHintVertexId: trail ? trail[0] : null,
      oddRemainingVertices: getOddDegreeVertices(remVertices, remainingEdges),
    }
  }

  if (!remVertices.includes(currentVertexId)) {
    return { canFinish: false, nextHintVertexId: null, oddRemainingVertices: [] }
  }

  if (!isGraphConnected(remVertices, remainingEdges)) {
    return {
      canFinish: false,
      nextHintVertexId: null,
      oddRemainingVertices: getOddDegreeVertices(remVertices, remainingEdges),
    }
  }

  const odd = getOddDegreeVertices(remVertices, remainingEdges)
  if (odd.length === 0 || (odd.length === 2 && odd.includes(currentVertexId))) {
    const trail = findEulerianTrail(remVertices, remainingEdges, currentVertexId)
    return {
      canFinish: trail !== null,
      nextHintVertexId: trail && trail.length > 1 ? trail[1] : null,
      oddRemainingVertices: odd,
    }
  }

  return {
    canFinish: false,
    nextHintVertexId: null,
    oddRemainingVertices: odd,
  }
}

interface OneStrokeMeshTemplate {
  name: string
  minTier: number
  maxTier: number
  vertices: OneStrokeVertex[]
  allowedEdges?: [number, number][]
}

function buildPolygonMesh(
  name: string,
  sides: number,
  withCenter: boolean,
  minTier: number,
  maxTier: number
): OneStrokeMeshTemplate {
  const cx = 150
  const cy = 150
  const r = 105
  const vertices: OneStrokeVertex[] = []
  for (let i = 0; i < sides; i++) {
    const angle = (-Math.PI / 2) + (2 * Math.PI * i) / sides
    vertices.push({
      id: i,
      x: Math.round(cx + r * Math.cos(angle)),
      y: Math.round(cy + r * Math.sin(angle)),
    })
  }
  if (withCenter) {
    vertices.push({ id: sides, x: cx, y: cy })
  }
  return { name, minTier, maxTier, vertices }
}

const ONE_STROKE_TEMPLATES: OneStrokeMeshTemplate[] = [
  // Pentágono / Casa clássica (5 vértices sem passar pelo centro)
  {
    name: "Casa Geométrica",
    minTier: 1,
    maxTier: 2,
    vertices: [
      { id: 0, x: 150, y: 42 },
      { id: 1, x: 58, y: 122 },
      { id: 2, x: 242, y: 122 },
      { id: 3, x: 64, y: 245 },
      { id: 4, x: 236, y: 245 },
    ],
  },
  // Pentágono regular + estrela
  buildPolygonMesh("Estrela Pentagonal", 5, false, 1, 3),
  // Hexágono sem centro (evita colinearidade de diâmetros ao não usar centro, ou com centro filtramos diâmetros!)
  buildPolygonMesh("Hexágono Cristalino", 6, false, 1, 3),
  // Hexágono com centro (edgeAvoidsOtherVertices impede diâmetros colineares pelo centro, mantém raios!)
  buildPolygonMesh("Flor Hexagonal", 6, true, 2, 4),
  // Ampulheta facetada (6 vértices sem centro colinear)
  {
    name: "Ampulheta Dupla",
    minTier: 2,
    maxTier: 4,
    vertices: [
      { id: 0, x: 68, y: 48 },
      { id: 1, x: 232, y: 48 },
      { id: 2, x: 150, y: 150 },
      { id: 3, x: 68, y: 252 },
      { id: 4, x: 232, y: 252 },
      { id: 5, x: 150, y: 88 },
      { id: 6, x: 150, y: 212 },
    ],
  },
  // Diamante geminado limpo
  {
    name: "Diamante Geminado",
    minTier: 2,
    maxTier: 5,
    vertices: [
      { id: 0, x: 150, y: 36 },
      { id: 1, x: 50, y: 118 },
      { id: 2, x: 150, y: 138 },
      { id: 3, x: 250, y: 118 },
      { id: 4, x: 85, y: 228 },
      { id: 5, x: 215, y: 228 },
      { id: 6, x: 150, y: 266 },
    ],
  },
  // Grelha 3x3 arredondada (ligações curtas limpas, sem passar por vértices intermédios)
  {
    name: "Malha Operacional",
    minTier: 3,
    maxTier: 5,
    vertices: [
      { id: 0, x: 60, y: 60 },
      { id: 1, x: 150, y: 48 },
      { id: 2, x: 240, y: 60 },
      { id: 3, x: 48, y: 150 },
      { id: 4, x: 150, y: 150 },
      { id: 5, x: 252, y: 150 },
      { id: 6, x: 60, y: 240 },
      { id: 7, x: 150, y: 252 },
      { id: 8, x: 240, y: 240 },
    ],
  },
  // Heptágono radial
  buildPolygonMesh("Heptágono Orbital", 7, true, 3, 5),
  // Octógono sem centro / Mandala
  buildPolygonMesh("Octógono Mandala", 8, false, 4, 5),
  // Anel Duplo Concêntrico (4 externos + 4 internos rodados 45°)
  {
    name: "Coroa Dupla",
    minTier: 3,
    maxTier: 5,
    vertices: [
      { id: 0, x: 150, y: 36 },
      { id: 1, x: 264, y: 150 },
      { id: 2, x: 150, y: 264 },
      { id: 3, x: 36, y: 150 },
      { id: 4, x: 105, y: 105 },
      { id: 5, x: 195, y: 105 },
      { id: 6, x: 195, y: 195 },
      { id: 7, x: 105, y: 195 },
    ],
  },
]

const ONE_STROKE_TIER_SPECS = [
  { levelNumber: 1, minEdges: 7, maxEdges: 9, minActiveVerts: 5 },
  { levelNumber: 2, minEdges: 9, maxEdges: 11, minActiveVerts: 5 },
  { levelNumber: 3, minEdges: 11, maxEdges: 14, minActiveVerts: 6 },
  { levelNumber: 4, minEdges: 13, maxEdges: 16, minActiveVerts: 7 },
  { levelNumber: 5, minEdges: 15, maxEdges: 19, minActiveVerts: 7 },
] as const

function transformVertices(
  vertices: OneStrokeVertex[],
  rng: () => number
): OneStrokeVertex[] {
  const sym = Math.floor(rng() * 8)
  const rot = sym & 3
  const flip = (sym & 4) !== 0
  return vertices.map(v => {
    let x = v.x - 150
    let y = v.y - 150
    for (let i = 0; i < rot; i++) {
      const px = x
      x = -y
      y = px
    }
    if (flip) x = -x
    return {
      id: v.id,
      x: Math.round(150 + x),
      y: Math.round(150 + y),
    }
  })
}

function findUnusedShortestPath(
  start: number,
  goal: number,
  candidateEdges: OneStrokeEdge[],
  activeEdgeKeys: Set<string>,
  rng: () => number
): OneStrokeEdge[] | null {
  const adj = new Map<number, { to: number; edge: OneStrokeEdge }[]>()
  for (const e of candidateEdges) {
    if (activeEdgeKeys.has(getEdgeKey(e.u, e.v))) continue
    if (!adj.has(e.u)) adj.set(e.u, [])
    if (!adj.has(e.v)) adj.set(e.v, [])
    adj.get(e.u)!.push({ to: e.v, edge: e })
    adj.get(e.v)!.push({ to: e.u, edge: e })
  }

  const prev = new Map<number, { from: number; edge: OneStrokeEdge }>()
  const visited = new Set<number>([start])
  const queue = [start]

  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur === goal) break
    const neighbors = shuffleArray(adj.get(cur) || [], rng)
    for (const item of neighbors) {
      if (!visited.has(item.to)) {
        visited.add(item.to)
        prev.set(item.to, { from: cur, edge: item.edge })
        queue.push(item.to)
      }
    }
  }

  if (!visited.has(goal)) return null
  const result: OneStrokeEdge[] = []
  let curr = goal
  while (curr !== start) {
    const step = prev.get(curr)
    if (!step) return null
    result.push(step.edge)
    curr = step.from
  }
  return result
}

function findAnyTogglePath(
  start: number,
  goal: number,
  candidateEdges: OneStrokeEdge[],
  rng: () => number
): OneStrokeEdge[] | null {
  const adj = new Map<number, { to: number; edge: OneStrokeEdge }[]>()
  for (const e of candidateEdges) {
    if (!adj.has(e.u)) adj.set(e.u, [])
    if (!adj.has(e.v)) adj.set(e.v, [])
    adj.get(e.u)!.push({ to: e.v, edge: e })
    adj.get(e.v)!.push({ to: e.u, edge: e })
  }
  const prev = new Map<number, { from: number; edge: OneStrokeEdge }>()
  const visited = new Set<number>([start])
  const queue = [start]
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur === goal) break
    const neighbors = shuffleArray(adj.get(cur) || [], rng)
    for (const item of neighbors) {
      if (!visited.has(item.to)) {
        visited.add(item.to)
        prev.set(item.to, { from: cur, edge: item.edge })
        queue.push(item.to)
      }
    }
  }
  if (!visited.has(goal)) return null
  const result: OneStrokeEdge[] = []
  let curr = goal
  while (curr !== start) {
    const step = prev.get(curr)
    if (!step) return null
    result.push(step.edge)
    curr = step.from
  }
  return result
}

/**
 * Generates a guaranteed 100%-solvable Eulerian Graph (0 or 2 odd-degree vertices, connected,
 * no collinear edge-vertex overlaps) for OneStrokeGame.
 */
export function generateOneStrokeLevel(
  levelNumber: number,
  dailyKey: string = getLisbonDateKey(),
  variant: number = 0
): GeneratedOneStrokeLevel {
  const tier = ONE_STROKE_TIER_SPECS[Math.max(0, Math.min(ONE_STROKE_TIER_SPECS.length - 1, levelNumber - 1))]
  const rng = createRng(`${dailyKey}|one_stroke|L${tier.levelNumber}|v${variant}`)

  const matchingTemplates = shuffleArray(
    ONE_STROKE_TEMPLATES.filter(
      t => tier.levelNumber >= t.minTier && tier.levelNumber <= t.maxTier
    ),
    rng
  )

  for (let attempt = 0; attempt < 80; attempt++) {
    const template = matchingTemplates[attempt % matchingTemplates.length]
    const transformed = transformVertices(template.vertices, rng)

    // Pick candidate clean edges where edge does not cut closely across another vertex
    const candidateEdges: OneStrokeEdge[] = []
    for (let i = 0; i < transformed.length; i++) {
      for (let j = i + 1; j < transformed.length; j++) {
        const u = transformed[i]
        const v = transformed[j]
        if (edgeAvoidsOtherVertices(u.id, v.id, transformed, 19)) {
          // Skip overly tiny edges or excessively clustered overlaps
          const len = Math.hypot(u.x - v.x, u.y - v.y)
          if (len >= 55 && len <= 228) {
            candidateEdges.push({ u: u.id, v: v.id })
          }
        }
      }
    }

    if (candidateEdges.length < tier.minEdges) continue

    // Build connected graph: start with a random spanning tree over transformed vertices
    const activeSetSize =
      transformed.length > tier.minActiveVerts && rng() < 0.35
        ? transformed.length - 1
        : transformed.length
    const chosenVertexIds = shuffleArray(
      transformed.map(v => v.id),
      rng
    ).slice(0, activeSetSize)
    const chosenSet = new Set(chosenVertexIds)

    const validPool = shuffleArray(
      candidateEdges.filter(e => chosenSet.has(e.u) && chosenSet.has(e.v)),
      rng
    )

    const parent = new Map<number, number>()
    for (const id of chosenVertexIds) parent.set(id, id)
    const findRoot = (x: number): number => {
      let r = x
      while (parent.get(r)! !== r) r = parent.get(r)!
      return r
    }

    const edgeMap = new Map<string, OneStrokeEdge>()
    for (const e of validPool) {
      const ru = findRoot(e.u)
      const rv = findRoot(e.v)
      if (ru !== rv) {
        parent.set(ru, rv)
        edgeMap.set(getEdgeKey(e.u, e.v), e)
      }
    }

    if (!isGraphConnected(chosenVertexIds, [...edgeMap.values()])) continue

    // Add extra candidate edges up to random target
    const targetInitialEdges = randInt(rng, Math.max(chosenVertexIds.length, tier.minEdges - 1), tier.maxEdges - 1)
    for (const e of validPool) {
      if (edgeMap.size >= targetInitialEdges) break
      const key = getEdgeKey(e.u, e.v)
      if (!edgeMap.has(key)) edgeMap.set(key, e)
    }

    // Repair vertex parities so odd-degree count is 0 or 2
    const targetOddCount = rng() < 0.5 ? 2 : 0
    let parityGuard = 0
    while (parityGuard < 24) {
      parityGuard++
      const activeIds = chosenVertexIds.filter(id =>
        [...edgeMap.values()].some(e => e.u === id || e.v === id)
      )
      const odd = getOddDegreeVertices(activeIds, [...edgeMap.values()])
      if (odd.length === 0 || (odd.length === 2 && (targetOddCount === 2 || parityGuard > 8))) {
        break
      }

      const shuffledOdd = shuffleArray(odd, rng)
      const a = shuffledOdd[0]
      const b = shuffledOdd[1]
      const activeKeys = new Set(edgeMap.keys())

      let pathEdges = findUnusedShortestPath(a, b, validPool, activeKeys, rng)
      if (pathEdges && edgeMap.size + pathEdges.length <= tier.maxEdges + 1) {
        for (const pe of pathEdges) {
          edgeMap.set(getEdgeKey(pe.u, pe.v), pe)
        }
        continue
      }

      // Otherwise symmetric-difference toggle along a path connecting (a, b)
      pathEdges = findAnyTogglePath(a, b, validPool, rng)
      if (!pathEdges) break
      for (const pe of pathEdges) {
        const k = getEdgeKey(pe.u, pe.v)
        if (edgeMap.has(k)) edgeMap.delete(k)
        else edgeMap.set(k, pe)
      }
    }

    const finalEdges = [...edgeMap.values()]
    if (finalEdges.length < tier.minEdges || finalEdges.length > tier.maxEdges) continue

    const usedVertIds = Array.from(new Set(finalEdges.flatMap(e => [e.u, e.v])))
    if (usedVertIds.length < tier.minActiveVerts) continue

    // Keep clean degree >= 2 when possible (avoids trivial leaf sticks except if small)
    const degMap = new Map<number, number>()
    for (const e of finalEdges) {
      degMap.set(e.u, (degMap.get(e.u) || 0) + 1)
      degMap.set(e.v, (degMap.get(e.v) || 0) + 1)
    }
    if ([...degMap.values()].some(d => d < 2)) continue

    const activeVertices = transformed.filter(v => usedVertIds.includes(v.id))
    // Re-check edge clearance against active vertices
    const allClear = finalEdges.every(e => edgeAvoidsOtherVertices(e.u, e.v, activeVertices, 18))
    if (!allClear) continue

    if (!isGraphConnected(usedVertIds, finalEdges)) continue

    const oddVertexIds = getOddDegreeVertices(usedVertIds, finalEdges)
    if (oddVertexIds.length !== 0 && oddVertexIds.length !== 2) continue

    const solutionPath = findEulerianTrail(
      usedVertIds,
      finalEdges,
      oddVertexIds.length === 2 ? oddVertexIds[0] : usedVertIds[0]
    )
    if (!solutionPath) continue

    // Reindex vertices cleanly 0..M-1 and normalize bounding box nicely in 300x300
    const idRemap = new Map<number, number>()
    activeVertices.forEach((v, idx) => idRemap.set(v.id, idx))

    const xs = activeVertices.map(v => v.x)
    const ys = activeVertices.map(v => v.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const span = Math.max(1, maxX - minX, maxY - minY)
    const targetSpan = 210
    const offsetX = 150 - ((minX + maxX) / 2 - minX) * (targetSpan / span) - 0
    void offsetX
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const scale = Math.min(1.12, Math.max(0.85, targetSpan / span))

    const normalizedVertices: OneStrokeVertex[] = activeVertices.map((v, idx) => ({
      id: idx,
      x: Math.round(150 + (v.x - centerX) * scale),
      y: Math.round(150 + (v.y - centerY) * scale),
    }))
    const normalizedEdges: OneStrokeEdge[] = finalEdges.map(e => ({
      u: idRemap.get(e.u)!,
      v: idRemap.get(e.v)!,
    }))
    const normalizedOdd = oddVertexIds.map(id => idRemap.get(id)!)
    const normalizedSolution = solutionPath.map(id => idRemap.get(id)!)

    return {
      levelNumber: tier.levelNumber,
      title: `Nível ${tier.levelNumber} - ${template.name}`,
      description:
        normalizedOdd.length === 2
          ? `Comece num dos 2 pontos dourados para percorrer as ${normalizedEdges.length} arestas sem repetir.`
          : `Circuito fechado (${normalizedEdges.length} arestas): pode começar em qualquer ponto!`,
      vertices: normalizedVertices,
      edges: normalizedEdges,
      oddVertexIds: normalizedOdd,
      solutionPath: normalizedSolution,
    }
  }

  // Deterministic guaranteed fallback (House / Pentagram Eulerian verified)
  const fallbackVertices: OneStrokeVertex[] = [
    { id: 0, x: 150, y: 42 },
    { id: 1, x: 60, y: 120 },
    { id: 2, x: 240, y: 120 },
    { id: 3, x: 60, y: 245 },
    { id: 4, x: 240, y: 245 },
  ]
  const fallbackEdges: OneStrokeEdge[] = [
    { u: 0, v: 1 },
    { u: 0, v: 2 },
    { u: 1, v: 2 },
    { u: 1, v: 3 },
    { u: 2, v: 4 },
    { u: 3, v: 4 },
    { u: 1, v: 4 },
    { u: 2, v: 3 },
  ]
  const fallbackTrail = findEulerianTrail([0, 1, 2, 3, 4], fallbackEdges, 3) || [3, 4]
  return {
    levelNumber: tier.levelNumber,
    title: `Nível ${tier.levelNumber} - Casa Clássica`,
    description: "Inicie num dos 2 pontos dourados para percorrer as 8 arestas.",
    vertices: fallbackVertices,
    edges: fallbackEdges,
    oddVertexIds: [3, 4],
    solutionPath: fallbackTrail,
  }
}

// ---------------------------------------------------------------------------
// NUMBER PATH (ZIP) PROCEDURAL GENERATOR
// ---------------------------------------------------------------------------

const NUMBER_PATH_SPECS = [
  { levelNumber: 1, size: 4, waypointCount: 5, name: "Circuito Expresso" },
  { levelNumber: 2, size: 5, waypointCount: 6, name: "Trilha Logística" },
  { levelNumber: 3, size: 5, waypointCount: 7, name: "Rota Otimizada" },
  { levelNumber: 4, size: 6, waypointCount: 8, name: "Grande Trânsito" },
  { levelNumber: 5, size: 6, waypointCount: 9, name: "Malha Total" },
] as const

/**
 * Generates a guaranteed solvable Number Path puzzle by sampling a full-grid
 * Hamiltonian path first and placing ascending waypoints 1..K along that path.
 */
export function generateNumberPathLevel(
  levelNumber: number,
  dailyKey: string = getLisbonDateKey(),
  variant: number = 0
): GeneratedNumberPathLevel {
  const spec = NUMBER_PATH_SPECS[Math.max(0, Math.min(NUMBER_PATH_SPECS.length - 1, levelNumber - 1))]
  const rng = createRng(`${dailyKey}|number_path|L${spec.levelNumber}|v${variant}`)
  const totalCells = spec.size * spec.size

  let chosenHam: [number, number][] = []
  let chosenIndices: number[] = []
  let bestScore = -Infinity

  for (let attempt = 0; attempt < 24; attempt++) {
    const ham = generateHamiltonianGridPath(spec.size, rng)
    const k = spec.waypointCount

    // Place 1 at start (0), K near/at end (totalCells - 1 or -2), evenly spread interior with jitter
    const indices: number[] = [0]
    const span = totalCells - 1
    for (let i = 1; i < k - 1; i++) {
      const ideal = Math.round((i * span) / (k - 1))
      const prevIdx = indices[i - 1]
      const minAllow = prevIdx + 2
      const maxAllow = span - (k - 1 - i) * 2
      const low = Math.max(minAllow, ideal - 1)
      const high = Math.min(maxAllow, ideal + 1)
      const picked = low <= high ? randInt(rng, low, high) : minAllow
      indices.push(Math.min(span - (k - 1 - i), picked))
    }
    indices.push(totalCells - 1)

    let consecutiveManhattanSum = 0
    let adjacentPenalty = 0
    for (let i = 0; i < indices.length - 1; i++) {
      const d = manhattan(ham[indices[i]], ham[indices[i + 1]])
      consecutiveManhattanSum += d
      if (d <= 1) adjacentPenalty += 20
    }

    const score = consecutiveManhattanSum + countTurns(ham) * 2 - adjacentPenalty
    if (score > bestScore) {
      bestScore = score
      chosenHam = ham
      chosenIndices = indices
    }
  }

  const waypoints: Record<string, number> = {}
  chosenIndices.forEach((cellIdx, wpIdx) => {
    const [r, c] = chosenHam[cellIdx]
    waypoints[`${r},${c}`] = wpIdx + 1
  })

  const solutionPath = chosenHam.map(([r, c]) => `${r},${c}`)

  return {
    levelNumber: spec.levelNumber,
    size: spec.size,
    totalCells,
    title: `Nível ${spec.levelNumber} - ${spec.name} (${spec.size}x${spec.size})`,
    description: `Ligue os marcos de 1 a ${spec.waypointCount} sem cruzar casas já percorridas.`,
    waypoints,
    solutionPath,
  }
}

/**
 * Checks whether `nextWaypoint` is still reachable from `headKey` through unvisited cells
 * (avoiding cells reserved for higher waypoints). Returns the shortest valid step sequence or null.
 */
export function findNextWaypointBfs(
  size: number,
  currentPath: string[],
  waypoints: Record<string, number>,
  nextNeededWaypoint: number,
  maxWaypoint: number
): string[] | null {
  if (currentPath.length === 0 || nextNeededWaypoint > maxWaypoint) return null
  const headKey = currentPath[currentPath.length - 1]
  const visited = new Set(currentPath)

  const targetKey = Object.entries(waypoints).find(([, wp]) => wp === nextNeededWaypoint)?.[0]
  if (!targetKey) return null

  const queue: string[] = [headKey]
  const seen = new Set<string>([headKey])
  const parent = new Map<string, string>()

  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]

  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur === targetKey) {
      const seq: string[] = []
      let step = cur
      while (step !== headKey) {
        seq.push(step)
        step = parent.get(step)!
      }
      return seq.reverse()
    }

    const [r, c] = cur.split(",").map(Number)
    for (const [dr, dc] of dirs) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue
      const nk = `${nr},${nc}`
      if (seen.has(nk) || visited.has(nk)) continue
      const wp = waypoints[nk]
      if (wp !== undefined && wp !== nextNeededWaypoint) continue
      seen.add(nk)
      parent.set(nk, cur)
      queue.push(nk)
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// SPEED MATH PROCEDURAL QUESTION GENERATOR
// ---------------------------------------------------------------------------

export interface SpeedMathQuestion {
  prompt: string
  correct: number
  options: number[]
}

export function generateSpeedMathQuestion(
  rng: () => number,
  difficultyTier = 0
): SpeedMathQuestion {
  const types =
    difficultyTier >= 8
      ? ["add", "sub", "mul", "div", "logistics", "missing", "percent"]
      : ["add", "sub", "mul", "div", "logistics", "missing"]
  const type = types[Math.floor(rng() * types.length)]

  let prompt = ""
  let correct = 0

  if (type === "add") {
    const base = Math.min(80, difficultyTier * 4)
    const a = randInt(rng, 12 + base, 75 + base)
    const b = randInt(rng, 9, 65 + Math.floor(base / 2))
    prompt = `${a} + ${b} = ?`
    correct = a + b
  } else if (type === "sub") {
    const base = Math.min(70, difficultyTier * 4)
    const a = randInt(rng, 35 + base, 120 + base)
    const b = randInt(rng, 8, a - 9)
    prompt = `${a} - ${b} = ?`
    correct = a - b
  } else if (type === "mul") {
    const maxFactor = Math.min(16, 11 + Math.floor(difficultyTier / 3))
    const a = randInt(rng, 3, maxFactor)
    const b = randInt(rng, 4, 14)
    prompt = `${a} × ${b} = ?`
    correct = a * b
  } else if (type === "div") {
    const b = randInt(rng, 2, 11)
    const quot = randInt(rng, 3, 16 + Math.floor(difficultyTier / 2))
    const a = b * quot
    prompt = `${a} ÷ ${b} = ?`
    correct = quot
  } else if (type === "missing") {
    const x = randInt(rng, 8, 45)
    const a = randInt(rng, 12, 65)
    prompt = `${a} + ? = ${a + x}`
    correct = x
  } else if (type === "percent") {
    const percents = [10, 20, 25, 50]
    const p = percents[Math.floor(rng() * percents.length)]
    const mult = randInt(rng, 2, 18)
    const total = p === 25 ? mult * 4 : mult * 10
    prompt = `${p}% de ${total} kg = ?`
    correct = Math.round((p / 100) * total)
  } else {
    const units = ["caixas", "volumes", "paletes"]
    const unit = units[Math.floor(rng() * units.length)]
    const packages = randInt(rng, 2, 9)
    const kgEach = randInt(rng, 3, 15)
    prompt = `${packages} ${unit} × ${kgEach} kg = ?`
    correct = packages * kgEach
  }

  const setOpts = new Set<number>([correct])
  let guard = 0
  while (setOpts.size < 4 && guard < 40) {
    guard++
    const offsetChoices = [-10, -5, -3, -2, -1, 1, 2, 3, 5, 10]
    const delta = offsetChoices[Math.floor(rng() * offsetChoices.length)]
    const fake = Math.max(1, correct + delta)
    setOpts.add(fake)
  }
  while (setOpts.size < 4) {
    setOpts.add(correct + setOpts.size + 1)
  }

  const options = shuffleArray(Array.from(setOpts), rng)
  return { prompt, correct, options }
}

