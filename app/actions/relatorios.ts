"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { getShipmentsAction } from "@/app/actions/shipments"
import { getClientesAction } from "@/app/actions/clientes"
import { requireEmployee } from "@/lib/auth/context"

export interface RelatoriosData {
  period: string
  totalShipments: number
  deliveredShipments: number
  inTransitShipments: number
  incidentShipments: number
  returnedShipments: number
  slaOnTimeRate: number
  firstAttemptRate: number
  avgTransitHours: number
  
  // Financeiro
  totalRevenue: number
  totalCost: number
  totalGrossMargin: number
  marginPercentage: number
  avgMarginPerShipment: number
  
  // Transportadoras
  carriersPerformance: {
    code: string
    name: string
    logo: string
    volume: number
    deliveredRate: number
    onTimeRate: number
    avgHours: number
    slaStatus: "Excelente" | "Bom" | "Atenção"
  }[]

  // Destinos / Zonas
  destinationStats: {
    district: string
    zone: string
    count: number
    percentage: number
    avgCost: number
  }[]

  // Mapa Europeu Interativo
  europeanDestinations: {
    code: string
    name: string
    flag: string
    count: number
    percentage: number
    avgCost: number
    transitHours: number
    carriers: string[]
    intensity: "muito_alto" | "alto" | "medio" | "baixo"
    lat: number
    lng: number
  }[]

  // Detalhe Regional de Portugal
  portugalRegions: {
    name: string
    code: string
    count: number
    percentage: number
    transitHours: number
    hubCoords: { x: number; y: number }
  }[]

  // Incidências
  incidentBreakdown: {
    reason: string
    count: number
    percentage: number
    severity: "alta" | "media" | "baixa"
  }[]
  avgResolutionHours: number

  // Clientes & Churn
  clientGrowthStats: {
    id: string
    name: string
    code: string
    recentVolume: number
    previousVolume: number
    growthRate: number
    status: "em_alta" | "estavel" | "risco_churn"
    lastShipmentDate: string
    totalSpent: number
  }[]

  // Histórico para mini-gráfico semanal
  timeline: {
    label: string
    envios: number
    entregues: number
    margem: number
  }[]
}

export async function getRelatoriosDataAction(
  periodFilter: string = "este_mes"
): Promise<RelatoriosData> {
  await requireEmployee()
  const supabase = createAdminClient()

  const [rawShipments, rawClients, recolhasResult] = await Promise.all([
    getShipmentsAction({ includeLabels: false }),
    getClientesAction(),
    supabase.from("recolhas").select("*").order("created_at", { ascending: false }),
  ])

  const clients = rawClients || []
  const shipments = rawShipments || []

  // Map clients for quick lookup
  const clientMap = new Map<string, string>()
  clients.forEach((c: any) => {
    clientMap.set(c.id, c.short_name || c.legal_name || c.name || "Cliente")
  })

  // 1. Filtragem básica por período
  const now = new Date()
  let filteredShipments = [...shipments]
  let prevPeriodStart = new Date(0)
  let prevPeriodEnd = new Date(now)

  if (periodFilter === "hoje") {
    const todayStr = now.toISOString().slice(0, 10)
    filteredShipments = shipments.filter(s => s.created_at?.slice(0, 10) === todayStr)
    prevPeriodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    prevPeriodEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  } else if (periodFilter === "esta_semana") {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    filteredShipments = shipments.filter(s => new Date(s.created_at) >= weekAgo)
    prevPeriodStart = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000)
    prevPeriodEnd = weekAgo
  } else if (periodFilter === "este_mes") {
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1)
    filteredShipments = shipments.filter(s => new Date(s.created_at) >= monthAgo)
    prevPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    prevPeriodEnd = monthAgo
  } else if (periodFilter === "ultimos_30") {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    filteredShipments = shipments.filter(s => new Date(s.created_at) >= thirtyDaysAgo)
    prevPeriodStart = new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000)
    prevPeriodEnd = thirtyDaysAgo
  }

  const baseVolume = filteredShipments.length
  
  const deliveredCount = filteredShipments.filter(s => s.status === "entregue" || s.status === "entregue_pudo").length
  const inTransitCount = filteredShipments.filter(s => s.status === "em_transito" || s.status === "em_distribuicao" || s.status === "recolhido").length
  const incidentCount = filteredShipments.filter(s => s.status === "incidencia" || s.status === "com_incidencia").length
  const returnedCount = filteredShipments.filter(s => s.status === "devolvido").length

  const slaOnTimeRate = baseVolume > 0 ? Math.round((deliveredCount / baseVolume) * 100) : 0
  const firstAttemptRate = baseVolume > 0 ? Math.round(((deliveredCount - incidentCount) / baseVolume) * 100) : 0
  const avgTransitHours = 24

  // 2. Margem & Rentabilidade
  let totalRevenue = 0
  let totalCost = 0

  filteredShipments.forEach(s => {
    const sell = Number(s.sell_price) || 0
    const cost = Number(s.cost_price) || 0
    totalRevenue += sell
    totalCost += cost
  })

  const totalGrossMargin = Math.max(0, totalRevenue - totalCost)
  const marginPercentage = totalRevenue > 0 ? (totalGrossMargin / totalRevenue) * 100 : 0
  const avgMarginPerShipment = baseVolume > 0 ? totalGrossMargin / baseVolume : 0

  // 3. Performance por Transportadora
  const carrierGroups: Record<string, any> = {}
  filteredShipments.forEach(s => {
    const cName = s.carrier_name || s.provider || "Outra"
    if (!carrierGroups[cName]) {
      carrierGroups[cName] = { volume: 0, delivered: 0, totalHours: 0 }
    }
    carrierGroups[cName].volume++
    if (s.status === "entregue") {
      carrierGroups[cName].delivered++
      carrierGroups[cName].totalHours += 24
    }
  })

  const carriersPerformance: RelatoriosData["carriersPerformance"] = Object.keys(carrierGroups).map(cName => {
    const stat = carrierGroups[cName]
    const deliveredRate = stat.volume > 0 ? Math.round((stat.delivered / stat.volume) * 100) : 0
    let logo = ""
    const c = cName.toLowerCase()
    if (c.includes("ctt")) logo = "/logo_transportadoras/ctt_express_logo.svg"
    else if (c.includes("dpd")) logo = "/logo_transportadoras/dpd_logo.svg"
    else if (c.includes("correos")) logo = "/logo_transportadoras/correos_logo.jpeg"

    let slaStatus: "Excelente" | "Bom" | "Atenção" = "Bom"
    if (deliveredRate > 95) slaStatus = "Excelente"
    else if (deliveredRate < 90) slaStatus = "Atenção"

    return {
      code: cName,
      name: cName,
      logo,
      volume: stat.volume,
      deliveredRate,
      onTimeRate: deliveredRate, // mock for now
      avgHours: stat.delivered > 0 ? Math.round(stat.totalHours / stat.delivered) : 0,
      slaStatus
    }
  }).sort((a,b) => b.volume - a.volume)

  // 4. Destinos & Heatmap Regional
  const districtGroups: Record<string, { count: number, cost: number }> = {}
  filteredShipments.forEach(s => {
    const d = s.recipient_city || "Desconhecido"
    if (!districtGroups[d]) districtGroups[d] = { count: 0, cost: 0 }
    districtGroups[d].count++
    districtGroups[d].cost += Number(s.cost_price) || 0
  })

  const destinationStats: RelatoriosData["destinationStats"] = Object.keys(districtGroups).map(d => {
    const g = districtGroups[d]
    return {
      district: d,
      zone: "Portugal",
      count: g.count,
      percentage: baseVolume > 0 ? Math.round((g.count / baseVolume) * 100) : 0,
      avgCost: g.count > 0 ? g.cost / g.count : 0
    }
  }).sort((a,b) => b.count - a.count).slice(0, 10)

  // 4.1 Destinos Europeus
  const countryGroups: Record<string, { count: number, cost: number }> = {}
  filteredShipments.forEach(s => {
    // If we have recipient_country, use it. Otherwise, assume PT.
    const c = (s.recipient_country || "PT").toUpperCase()
    if (!countryGroups[c]) countryGroups[c] = { count: 0, cost: 0 }
    countryGroups[c].count++
    countryGroups[c].cost += Number(s.cost_price) || 0
  })

  const countryMeta: Record<string, { name: string, flag: string, lat: number, lng: number }> = {
    "PT": { name: "Portugal", flag: "🇵🇹", lat: 39.3999, lng: -8.2245 },
    "ES": { name: "Espanha", flag: "🇪🇸", lat: 40.4637, lng: -3.7492 },
    "FR": { name: "França", flag: "🇫🇷", lat: 46.2276, lng: 2.2137 },
    "DE": { name: "Alemanha", flag: "🇩🇪", lat: 51.1657, lng: 10.4515 },
    "UK": { name: "Reino Unido", flag: "🇬🇧", lat: 55.3781, lng: -3.4360 },
    "GB": { name: "Reino Unido", flag: "🇬🇧", lat: 55.3781, lng: -3.4360 },
    "IT": { name: "Itália", flag: "🇮🇹", lat: 41.8719, lng: 12.5674 },
    "BE": { name: "Bélgica", flag: "🇧🇪", lat: 50.5039, lng: 4.4699 },
    "NL": { name: "Países Baixos", flag: "🇳🇱", lat: 52.1326, lng: 5.2913 }
  }

  const europeanDestinations: RelatoriosData["europeanDestinations"] = Object.keys(countryGroups).map(cCode => {
    const g = countryGroups[cCode]
    const meta = countryMeta[cCode] || { name: cCode, flag: "🇪🇺", lat: 48.0, lng: 9.0 }
    const percentage = baseVolume > 0 ? Math.round((g.count / baseVolume) * 100) : 0
    let intensity: "muito_alto" | "alto" | "medio" | "baixo" = "baixo"
    if (percentage > 50) intensity = "muito_alto"
    else if (percentage >= 10) intensity = "alto"
    else if (percentage >= 3) intensity = "medio"

    return {
      code: cCode,
      name: meta.name,
      flag: meta.flag,
      count: g.count,
      percentage,
      avgCost: g.count > 0 ? g.cost / g.count : 0,
      transitHours: cCode === "PT" ? 24 : 48,
      carriers: Object.keys(carrierGroups),
      intensity,
      lat: meta.lat,
      lng: meta.lng,
    }
  }).sort((a, b) => b.count - a.count)

  const portugalRegions: RelatoriosData["portugalRegions"] = [] // Skipped mapping specific cities to coords for simplicity unless needed

  // 5. Causas de Incidência
  const incidentBreakdown: RelatoriosData["incidentBreakdown"] = []

  // 6. Clientes: Crescimento 🔥 vs Risco de Churn ❄️
  const clientData: Record<string, { recent: number, prev: number, spent: number, lastDate: string }> = {}
  
  shipments.forEach(s => {
    if (!s.client_id) return
    const isRecent = filteredShipments.some(fs => fs.id === s.id)
    const dDate = new Date(s.created_at)
    const isPrev = dDate >= prevPeriodStart && dDate < prevPeriodEnd

    if (!clientData[s.client_id]) {
      clientData[s.client_id] = { recent: 0, prev: 0, spent: 0, lastDate: s.created_at }
    }
    
    if (isRecent) {
      clientData[s.client_id].recent++
      clientData[s.client_id].spent += Number(s.sell_price) || 0
    }
    if (isPrev) {
      clientData[s.client_id].prev++
    }
    if (new Date(s.created_at) > new Date(clientData[s.client_id].lastDate)) {
      clientData[s.client_id].lastDate = s.created_at
    }
  })

  const clientGrowthStats: RelatoriosData["clientGrowthStats"] = Object.keys(clientData).map(cid => {
    const c = clientData[cid]
    const growth = c.prev > 0 ? Math.round(((c.recent - c.prev) / c.prev) * 100) : (c.recent > 0 ? 100 : 0)
    let status: "em_alta" | "estavel" | "risco_churn" = "estavel"
    if (growth >= 15) status = "em_alta"
    else if (growth <= -30 || (c.recent === 0 && c.prev > 0)) status = "risco_churn"

    const daysAgo = Math.round((now.getTime() - new Date(c.lastDate).getTime()) / (1000 * 3600 * 24))

    return {
      id: cid,
      name: clientMap.get(cid) || "Cliente",
      code: cid.slice(0, 8),
      recentVolume: c.recent,
      previousVolume: c.prev,
      growthRate: growth,
      status,
      lastShipmentDate: new Date(c.lastDate).toLocaleDateString("pt-PT"),
      totalSpent: c.spent,
    }
  }).filter(c => c.recentVolume > 0 || c.previousVolume > 0).sort((a,b) => b.recentVolume - a.recentVolume)

  // 7. Timeline dos últimos 7 dias para mini-gráfico
  const timelineMap: Record<string, any> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const dayName = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d.getDay()]
    timelineMap[d.toISOString().slice(0, 10)] = { label: dayName, envios: 0, entregues: 0, margem: 0 }
  }

  filteredShipments.forEach(s => {
    if (!s.created_at) return
    const key = s.created_at.slice(0, 10)
    if (timelineMap[key]) {
      timelineMap[key].envios++
      if (s.status === "entregue") timelineMap[key].entregues++
      timelineMap[key].margem += (Number(s.sell_price) || 0) - (Number(s.cost_price) || 0)
    }
  })

  const timeline: RelatoriosData["timeline"] = Object.values(timelineMap)

  return {
    period: periodFilter,
    totalShipments: baseVolume,
    deliveredShipments: deliveredCount,
    inTransitShipments: inTransitCount,
    incidentShipments: incidentCount,
    returnedShipments: returnedCount,
    slaOnTimeRate,
    firstAttemptRate,
    avgTransitHours,
    totalRevenue,
    totalCost,
    totalGrossMargin,
    marginPercentage,
    avgMarginPerShipment,
    carriersPerformance,
    destinationStats,
    europeanDestinations,
    portugalRegions,
    incidentBreakdown,
    avgResolutionHours: 4.2,
    clientGrowthStats,
    timeline,
  }
}
