import re

with open("app/ops/faturacao/contas-corrente/ContasCorrenteClient.tsx", "r") as f:
    content = f.read()

# 1. Update clientDataMap
# from:
#     // Só mostramos clientes que tenham pelo menos 1 envio após filtro de data
#     return Array.from(map.values())
#       .filter(x => x.shipments.length > 0)
#       .sort((a, b) => b.totalValue - a.totalValue)
new_client_map = """
    // Mostramos clientes que tenham envios pendentes ou extratos por pagar
    return Array.from(map.values())
      .filter(x => {
        const hasShipments = x.shipments.length > 0
        const hasUnpaid = statements.some(s => 
          (s.client_name === x.client.legal_name || s.client_name === x.client.short_name) && 
          s.status !== 'paid'
        )
        return hasShipments || hasUnpaid
      })
      .sort((a, b) => b.totalValue - a.totalValue)
"""
content = re.sub(
    r"// Só mostramos clientes que tenham pelo menos 1 envio após filtro de data\s*return Array\.from\(map\.values\(\)\)\s*\.filter\(x => x\.shipments\.length > 0\)\s*\.sort\(\(a, b\) => b\.totalValue - a\.totalValue\)",
    new_client_map.strip(),
    content
)

# 2. Update the Extratos Histórico title and filter
# from:
#       {/* Histórico de Extratos Emitidos */}
#       {statements && statements.length > 0 && (
# to filter by paid
new_history = """
      {/* Histórico de Extratos Emitidos */}
      {statements && statements.filter((s: any) => s.status === 'paid').length > 0 && (
"""
content = content.replace("{statements && statements.length > 0 && (", new_history.strip() + " (", 1)

# also replace statements.map in the history to use the filtered list
# Wait, let's just make a variable `const paidStatements = statements?.filter((s: any) => s.status === 'paid') || []`
