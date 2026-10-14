import type { OperationalReport } from "./operational-reports"

/** Quoted UTF-8 CSV; neutralize formulas in client/service names opened in Excel. */
export function reportCsv(report: OperationalReport): string {
  const rows: (string | number)[][] = [
    ["Relatório operacional Linke", "Valor", "Nota"],
    ["Atualizado em", report.updatedAt, "Europe/Lisbon"],
    ["Início", report.range.start, "Data de criação do envio"],
    ["Fim", report.range.end, "Estado atual guardado"],
    ["Cliente", report.filters.clientId || "Todos", ""],
    ["Transportadora", report.filters.carrier || "Todas", ""],
    ["Serviço", report.filters.service || "Todos", ""],
    ["Envios", report.totals.volume, "Exclui rascunhos e anulados/cancelados"],
    ["Entregues", report.totals.delivered, "Não mede entregas no prazo"],
    ["Em trânsito", report.totals.inTransit, ""],
    ["Pendentes", report.totals.pending, ""],
    ["Em incidência", report.totals.incidents, ""],
    ["Devolvidos", report.totals.returned, ""],
    ["Valor de venda dos envios", report.totals.revenue, "Soma dos preços válidos; não confirma faturação nem recebimento"],
    ["Custo previsto guardado", report.totals.cost, "Soma dos custos válidos; ainda por reconciliar"],
    ["Margem estimada", report.totals.pricedCount ? report.totals.margin : "Sem dados", `${report.totals.pricedCount} de ${report.totals.volume} envios com venda e custo válidos`],
    ["Sem custo válido", report.totals.missingCostCount, ""],
    ["Sem preço de venda válido", report.totals.missingSellCount, ""],
    ["Base anterior início", report.range.previousStart, "Mesma duração, limitada ao fim do período anterior"],
    ["Base anterior fim", report.range.previousEnd, "Fim exclusivo"],
  ]
  for (const [label, groups] of [["Clientes", report.clients], ["Transportadoras", report.carriers], ["Serviços", report.services]] as const) {
    rows.push([], [label, "Envios", "Anterior", "Entregues", "Em incidência", "Valor de venda", "Custo previsto", "Margem estimada", "Envios com ambos os preços"])
    for (const group of groups) rows.push([group.name, group.volume, group.previousVolume, group.delivered, group.incidents, group.revenue, group.cost, group.pricedCount ? group.margin : "Sem dados", group.pricedCount])
  }
  rows.push([], ["Dia", "Envios", "Margem estimada", "Envios com ambos os preços"])
  for (const day of report.timeline) rows.push([day.date, day.volume, day.pricedCount ? day.margin : "Sem dados", day.pricedCount])
  const cell = (value: string | number) => {
    const text = typeof value === "number" ? String(value).replace(".", ",") : (/^[\s]*[=+\-@]/.test(value) ? `'${value}` : value)
    return `"${text.replace(/"/g, '""')}"`
  }
  return rows.map(row => row.map(cell).join(";")).join("\r\n")
}
