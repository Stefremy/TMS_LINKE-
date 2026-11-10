const test = require("node:test")
const assert = require("node:assert/strict")
const { createLoader } = require("./helpers/load-typescript.cjs")

const load = createLoader({})
const gen = load("app/ops/jogos/lib/puzzle-generator.ts")

function manhattan(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
}

test("FlowLines generator produces 100% disjoint, full-grid, non-adjacent-endpoint solvable puzzles across dates and variants", () => {
  const seenSignatures = new Set()
  const dates = ["2026-11-10", "2026-11-11", "2026-11-12", "2026-12-01", "2027-01-15"]

  for (const dateKey of dates) {
    for (let level = 1; level <= 5; level++) {
      for (let variant = 0; variant < 4; variant++) {
        const puzzle = gen.generateFlowLevel(level, dateKey, variant)
        const totalCells = puzzle.size * puzzle.size
        const covered = new Set()
        const pairKeys = Object.keys(puzzle.endpoints).map(Number)

        assert.equal(pairKeys.length, puzzle.pairCount)

        for (const colorId of pairKeys) {
          const path = puzzle.solutionPaths[colorId]
          const eps = puzzle.endpoints[colorId]
          assert.ok(Array.isArray(path) && path.length >= 3, `L${level} color ${colorId} path too short`)

          // Endpoints match path ends and are non-adjacent
          assert.deepEqual(path[0], eps[0])
          assert.deepEqual(path[path.length - 1], eps[1])
          assert.ok(manhattan(eps[0], eps[1]) >= 2, `L${level} color ${colorId} endpoints too close`)

          // Orthogonal adjacency along entire solution path
          for (let i = 0; i < path.length - 1; i++) {
            assert.equal(manhattan(path[i], path[i + 1]), 1, "Non-orthogonal step in solutionPath")
          }

          // No overlapping cells between colors
          for (const [r, c] of path) {
            assert.ok(r >= 0 && r < puzzle.size && c >= 0 && c < puzzle.size)
            const key = `${r},${c}`
            assert.equal(covered.has(key), false, `Overlapping cell ${key}`)
            covered.add(key)
          }
        }

        // Full board coverage guaranteed
        assert.equal(covered.size, totalCells, `L${level} did not cover 100% of grid`)

        if (variant === 0 && level === 2) {
          seenSignatures.add(JSON.stringify(puzzle.endpoints))
        }
      }
    }
  }

  // Different days must generate distinct puzzles
  assert.ok(seenSignatures.size >= 4, `Expected daily variety, got ${seenSignatures.size} unique puzzles`)
})

test("OneStroke generator guarantees connected Eulerian graphs (0 or 2 odd vertices) with verified Hierholzer trails", () => {
  const seenSignatures = new Set()
  const dates = ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"]

  for (const dateKey of dates) {
    for (let level = 1; level <= 5; level++) {
      for (let variant = 0; variant < 5; variant++) {
        const puzzle = gen.generateOneStrokeLevel(level, dateKey, variant)
        const vIds = puzzle.vertices.map(v => v.id)
        const edges = puzzle.edges

        assert.ok(edges.length >= 7, `Too few edges (${edges.length}) on L${level}`)
        assert.equal(gen.isGraphConnected(vIds, edges), true, `Graph disconnected on ${dateKey} L${level} v${variant}`)

        // Euler's Theorem: 0 or 2 odd vertices
        const odd = gen.getOddDegreeVertices(vIds, edges)
        assert.ok(
          odd.length === 0 || odd.length === 2,
          `Invalid Eulerian odd count (${odd.length}) on ${dateKey} L${level} v${variant}`
        )
        assert.deepEqual([...odd].sort((a, b) => a - b), [...puzzle.oddVertexIds].sort((a, b) => a - b))

        // Verify solutionPath traverses EVERY edge exactly once
        const sol = puzzle.solutionPath
        assert.equal(sol.length, edges.length + 1, "Solution trail length mismatch")
        if (odd.length === 2) {
          assert.ok(odd.includes(sol[0]), "Open Eulerian trail must start at an odd vertex")
          assert.ok(odd.includes(sol[sol.length - 1]), "Open Eulerian trail must end at the other odd vertex")
        }

        const expectedEdgeKeys = new Set(edges.map(e => gen.getEdgeKey(e.u, e.v)))
        assert.equal(expectedEdgeKeys.size, edges.length, "Duplicate edges detected")
        const traversedKeys = new Set()
        for (let i = 0; i < sol.length - 1; i++) {
          const k = gen.getEdgeKey(sol[i], sol[i + 1])
          assert.ok(expectedEdgeKeys.has(k), `Trail used non-existent edge ${k}`)
          assert.equal(traversedKeys.has(k), false, `Trail repeated edge ${k}`)
          traversedKeys.add(k)
        }
        assert.equal(traversedKeys.size, edges.length)

        // Check partial-state solver works mid-trail
        const midIdx = Math.min(3, sol.length - 2)
        const partialKeys = new Set()
        for (let i = 0; i < midIdx; i++) {
          partialKeys.add(gen.getEdgeKey(sol[i], sol[i + 1]))
        }
        const evalRes = gen.evaluateOneStrokeRemainingState(edges, partialKeys, sol[midIdx])
        assert.equal(evalRes.canFinish, true, "Valid partial trail must evaluate as finishable")
        assert.ok(evalRes.nextHintVertexId !== null)

        if (variant === 0 && level === 3) {
          seenSignatures.add(JSON.stringify({ v: puzzle.vertices, e: puzzle.edges }))
        }
      }
    }
  }

  assert.ok(seenSignatures.size >= 4, `Expected daily variety for OneStroke, got ${seenSignatures.size}`)
})

test("NumberPath generator guarantees valid contiguous simple path visiting waypoints 1..K in order", () => {
  const seenSignatures = new Set()
  const dates = ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"]

  for (const dateKey of dates) {
    for (let level = 1; level <= 5; level++) {
      for (let variant = 0; variant < 4; variant++) {
        const puzzle = gen.generateNumberPathLevel(level, dateKey, variant)
        const sol = puzzle.solutionPath
        const wpEntries = Object.entries(puzzle.waypoints)
        const maxWp = Math.max(...wpEntries.map(([, n]) => n))

        assert.equal(sol.length, puzzle.totalCells)
        assert.equal(new Set(sol).size, puzzle.totalCells)
        assert.equal(puzzle.waypoints[sol[0]], 1, "Must start at waypoint 1")
        assert.equal(puzzle.waypoints[sol[sol.length - 1]], maxWp, "Must end at max waypoint")

        let currentWp = 1
        for (let i = 0; i < sol.length; i++) {
          if (i > 0) {
            const prev = sol[i - 1].split(",").map(Number)
            const cur = sol[i].split(",").map(Number)
            assert.equal(manhattan(prev, cur), 1, "Solution step must be orthogonal")
          }
          const wp = puzzle.waypoints[sol[i]]
          if (wp !== undefined && i > 0) {
            assert.equal(wp, currentWp + 1, `Out-of-order waypoint ${wp} after ${currentWp}`)
            currentWp = wp
          }
        }
        assert.equal(currentWp, maxWp)

        // Check BFS helper from start finds valid step sequence to #2
        const bfsSteps = gen.findNextWaypointBfs(puzzle.size, [sol[0]], puzzle.waypoints, 2, maxWp)
        assert.ok(Array.isArray(bfsSteps) && bfsSteps.length >= 1)

        if (variant === 0 && level === 3) {
          seenSignatures.add(JSON.stringify(puzzle.waypoints))
        }
      }
    }
  }

  assert.ok(seenSignatures.size >= 4, `Expected daily variety for NumberPath, got ${seenSignatures.size}`)
})

test("SpeedMath generator creates varied valid questions with 4 distinct options including the answer", () => {
  const rngA = gen.createRng("2026-11-10|math")
  const rngB = gen.createRng("2026-11-11|math")
  const promptsA = []
  const promptsB = []

  for (let i = 0; i < 20; i++) {
    const qA = gen.generateSpeedMathQuestion(rngA, i)
    const qB = gen.generateSpeedMathQuestion(rngB, i)
    promptsA.push(qA.prompt)
    promptsB.push(qB.prompt)

    assert.equal(qA.options.length, 4)
    assert.equal(new Set(qA.options).size, 4)
    assert.ok(qA.options.includes(qA.correct))
    assert.ok(qA.correct >= 1)
  }

  assert.notDeepEqual(promptsA, promptsB)
})
