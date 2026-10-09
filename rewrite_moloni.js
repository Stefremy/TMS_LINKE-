const fs = require('fs');
let code = fs.readFileSync('app/actions/moloni.ts', 'utf8');

const actionStartStr = `export async function emitInvoiceAction(clientId: string, shipmentIds: string[], skipMoloni: boolean = false, groupShipments: boolean = false, isProForma: boolean = false) {`;
const startIdx = code.indexOf(actionStartStr);
if (startIdx === -1) throw new Error("Could not find emitInvoiceAction");

// Replace emitInvoiceAction with internalEmitInvoice
let newCode = code.slice(0, startIdx) + 
`export async function internalEmitInvoice(client: any, shipments: any[], skipMoloni: boolean = false, groupShipments: boolean = false, isProForma: boolean = false) {
  const supabase = createAdminClient()
  if (!client) throw new Error("Cliente não encontrado.")
  if (!shipments || shipments.length === 0) throw new Error("Envios não encontrados.")
` + code.slice(startIdx + actionStartStr.length);

// Remove the `await requireEmployee()` and `getClientesAction` and `getShipmentsAction` fetching from internalEmitInvoice
newCode = newCode.replace(/await requireEmployee\(\)[\s\S]*?const shipments = dbShipments \|\| \[\]/, '');

// Now append emitInvoiceAction at the bottom
newCode += `

/**
 * Criação da Fatura no Moloni (Action para ser chamada a partir da UI)
 */
export async function emitInvoiceAction(clientId: string, shipmentIds: string[], skipMoloni: boolean = false, groupShipments: boolean = false, isProForma: boolean = false) {
  await requireEmployee()
  try {
    const supabase = createAdminClient()
    
    // 1. Obter Cliente do TMS
    const allClients = await getClientesAction(clientId)
    const client = allClients[0]
      
    if (!client) {
      throw new Error("Cliente não encontrado.")
    }

    // 2. Obter Envios do TMS
    const { data: dbShipments } = await supabase.from("shipments").select("*").in("id", shipmentIds)
    const shipments = dbShipments || []

    return await internalEmitInvoice(client, shipments, skipMoloni, groupShipments, isProForma)
  } catch (err: any) {
    console.error("Emit Invoice Error:", err)
    return { success: false, error: err?.message || "Failed to emit invoice" }
  }
}
`;

fs.writeFileSync('app/actions/moloni.ts', newCode);
console.log("Rewrote moloni.ts successfully");
