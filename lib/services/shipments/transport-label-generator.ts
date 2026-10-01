import { convertZplToPdfBase64 } from "@/lib/label-utils"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import { formatOrGenerateCttObjectId, isCorreosShipment } from "./shipment-utils"

export interface ShipmentLabelData {
  id?: string
  tracking_number?: string
  reference?: string
  carrier_tracking_number?: string
  ctt_object_id?: string
  carrier_object_id?: string
  carrier_code?: string
  carrier_name?: string
  service_type?: string
  serviceName?: string
  sender_name?: string
  sender_address?: string
  sender_zip3?: string
  sender_zip4?: string
  sender_city?: string
  sender_phone?: string
  recipient_name?: string
  recipient_address?: string
  recipient_zip3?: string
  recipient_zip4?: string
  recipient_city?: string
  recipient_phone?: string
  weight_kg?: number | string
  volumes_count?: number | string
  created_at?: string
}

/**
 * Generates an offline PDF label using pdf-lib in case Labelary is unavailable.
 */
async function generateOfflinePdfLabel(data: ShipmentLabelData, barcode: string, serviceTitle: string): Promise<string> {
  const doc = await PDFDocument.create()
  // 100mm x 150mm at 72dpi (~283 x 425 pt)
  const page = doc.addPage([283.46, 425.20])
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontReg = await doc.embedFont(StandardFonts.Helvetica)

  const sName = (data.sender_name || "Linke Logistics").slice(0, 35)
  const sAddr = (data.sender_address || "Sede Linke").slice(0, 40)
  const sZip = `${data.sender_zip4 || "1000"}-${data.sender_zip3 || "001"} ${data.sender_city || "Lisboa"}`
  const rName = (data.recipient_name || "Destinatário").slice(0, 35)
  const rAddr = (data.recipient_address || "Morada de Entrega").slice(0, 40)
  const rZip = `${data.recipient_zip4 || "1000"}-${data.recipient_zip3 || "001"} ${data.recipient_city || "Portugal"}`
  const ref = data.reference || data.tracking_number || "LTK"
  const weight = data.weight_kg ? `${Number(data.weight_kg).toFixed(2)} kg` : "1.00 kg"
  const volumes = data.volumes_count ? `${data.volumes_count} Vol.` : "1 Vol."

  // Header Box
  page.drawRectangle({
    x: 15,
    y: 370,
    width: 253.46,
    height: 42,
    color: rgb(0.96, 0.98, 0.96),
    borderColor: rgb(0.1, 0.5, 0.3),
    borderWidth: 1.5,
  })
  page.drawText("LINKE LOGISTICS", { x: 22, y: 395, size: 14, font: fontBold, color: rgb(0.08, 0.45, 0.28) })
  page.drawText(serviceTitle, { x: 22, y: 380, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) })
  page.drawText(`${volumes} | ${weight}`, { x: 200, y: 380, size: 8.5, font: fontReg, color: rgb(0.3, 0.3, 0.3) })

  // Sender Block
  page.drawText("REMETENTE:", { x: 20, y: 350, size: 7.5, font: fontBold, color: rgb(0.4, 0.4, 0.4) })
  page.drawText(sName, { x: 20, y: 338, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
  page.drawText(sAddr, { x: 20, y: 326, size: 8, font: fontReg, color: rgb(0.2, 0.2, 0.2) })
  page.drawText(sZip, { x: 20, y: 314, size: 8, font: fontReg, color: rgb(0.2, 0.2, 0.2) })

  // Divider
  page.drawLine({ start: { x: 15, y: 300 }, end: { x: 268, y: 300 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) })

  // Recipient Block
  page.drawText("DESTINATÁRIO:", { x: 20, y: 284, size: 7.5, font: fontBold, color: rgb(0.4, 0.4, 0.4) })
  page.drawText(rName, { x: 20, y: 270, size: 11, font: fontBold, color: rgb(0.05, 0.05, 0.05) })
  page.drawText(rAddr, { x: 20, y: 256, size: 9, font: fontReg, color: rgb(0.15, 0.15, 0.15) })
  page.drawText(rZip, { x: 20, y: 242, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
  if (data.recipient_phone) {
    page.drawText(`Tel: ${data.recipient_phone}`, { x: 20, y: 228, size: 8, font: fontReg, color: rgb(0.3, 0.3, 0.3) })
  }

  // Barcode Area Box
  page.drawRectangle({
    x: 15,
    y: 90,
    width: 253.46,
    height: 120,
    color: rgb(0.98, 0.98, 0.98),
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
  })

  // Simulated Barcode Bars
  const barStartY = 135
  const barHeight = 55
  let curX = 35
  const seed = barcode.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  for (let i = 0; i < 48; i++) {
    const isThick = ((seed * (i + 3)) % 5) === 0
    const w = isThick ? 3.2 : 1.6
    page.drawRectangle({
      x: curX,
      y: barStartY,
      width: w,
      height: barHeight,
      color: rgb(0, 0, 0)
    })
    curX += w + 2.4
  }

  // Barcode text
  page.drawText(barcode, { x: 80, y: 115, size: 12, font: fontBold, color: rgb(0, 0, 0) })
  page.drawText(`Ref: ${ref}`, { x: 85, y: 98, size: 8.5, font: fontReg, color: rgb(0.3, 0.3, 0.3) })

  // Footer
  page.drawLine({ start: { x: 15, y: 70 }, end: { x: 268, y: 70 }, thickness: 1, color: rgb(0.85, 0.85, 0.85) })
  page.drawText("Linke Logistics TMS • Transporte Autorizado", { x: 45, y: 55, size: 7.5, font: fontReg, color: rgb(0.5, 0.5, 0.5) })
  const dateStr = data.created_at ? new Date(data.created_at).toLocaleDateString("pt-PT") : new Date().toLocaleDateString("pt-PT")
  page.drawText(`Emissão: ${dateStr}`, { x: 110, y: 42, size: 7, font: fontReg, color: rgb(0.6, 0.6, 0.6) })

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes).toString("base64")
}

/**
 * Generates a full Base64 PDF transport label for any shipment in the Linke system.
 * Uses thermal ZPL format rendered to PDF via Labelary, with automatic fallback to pdf-lib.
 */
export async function generateTransportLabelPdfBase64(data: ShipmentLabelData): Promise<string> {
  const isCorreos = isCorreosShipment(data)
  
  const barcode = (
    data.carrier_tracking_number?.trim() ||
    data.carrier_object_id?.trim() ||
    data.ctt_object_id?.trim() ||
    (isCorreos ? "" : formatOrGenerateCttObjectId(data)) ||
    data.tracking_number?.trim() ||
    "LTK1000001"
  )

  const service = data.service_type || data.serviceName || (isCorreos ? "Linke Correos Express 24h" : "CTT Expresso 24H")
  const ref = data.reference || data.tracking_number || barcode
  const sName = (data.sender_name || "Linke Logistics").replace(/[^a-zA-Z0-9\s.,-]/g, "")
  const sAddr = (data.sender_address || "Sede Linke").replace(/[^a-zA-Z0-9\s.,-]/g, "")
  const sZip = `${data.sender_zip4 || "1000"}-${data.sender_zip3 || "001"} ${data.sender_city || "Lisboa"}`.replace(/[^a-zA-Z0-9\s.,-]/g, "")
  const rName = (data.recipient_name || "Destinatario").replace(/[^a-zA-Z0-9\s.,-]/g, "")
  const rAddr = (data.recipient_address || "Morada de Entrega").replace(/[^a-zA-Z0-9\s.,-]/g, "")
  const rZip = `${data.recipient_zip4 || "1000"}-${data.recipient_zip3 || "001"} ${data.recipient_city || "Portugal"}`.replace(/[^a-zA-Z0-9\s.,-]/g, "")
  const weight = data.weight_kg ? `${Number(data.weight_kg).toFixed(2)} kg` : "1.00 kg"
  const volumes = data.volumes_count ? `${data.volumes_count} Vol.` : "1 Vol."
  const dateStr = data.created_at ? new Date(data.created_at).toLocaleDateString("pt-PT") : new Date().toLocaleDateString("pt-PT")

  const headerTitle = isCorreos ? "LINKE LOGISTICS - CORREOS EXPRESS" : "LINKE LOGISTICS - CTT EXPRESSO"

  const zpl = `^XA
^PW812
^LL1218
^FO50,40^A0N,34,34^FD${headerTitle}^FS
^FO50,85^GB712,3,3^FS
^FO50,105^A0N,28,28^FDServico: ${service}^FS
^FO520,105^A0N,28,28^FD${volumes} | ${weight}^FS
^FO50,150^GB712,1,1^FS
^FO50,170^A0N,22,22^FDREMETENTE:^FS
^FO50,200^A0N,28,28^FD${sName}^FS
^FO50,235^A0N,24,24^FD${sAddr}^FS
^FO50,265^A0N,24,24^FD${sZip}^FS
^FO50,305^GB712,1,1^FS
^FO50,325^A0N,22,22^FDDESTINATARIO:^FS
^FO50,355^A0N,32,32^FD${rName}^FS
^FO50,395^A0N,26,26^FD${rAddr}^FS
^FO50,430^A0N,26,26^FD${rZip}^FS
^FO50,480^GB712,3,3^FS
^FO120,530^BY3,3,130^BCN,130,Y,N,N^FD${barcode}^FS
^FO50,720^GB712,1,1^FS
^FO50,740^A0N,24,24^FDRef: ${ref}^FS
^FO320,740^A0N,24,24^FDData: ${dateStr}^FS
^FO540,740^A0N,24,24^FDObjeto: ${barcode}^FS
^FO50,780^GB712,3,3^FS
^FO50,805^A0N,20,20^FDTransporte efetuado ao abrigo das condicoes gerais Linke TMS.^FS
^XZ`

  try {
    const pdfBase64 = await convertZplToPdfBase64(zpl)
    if (pdfBase64 && !pdfBase64.startsWith("^XA")) {
      return pdfBase64
    }
  } catch (err) {
    console.warn("ZPL conversion to PDF via Labelary failed, falling back to pdf-lib:", err)
  }

  // Fallback to offline pdf-lib generator
  return generateOfflinePdfLabel(data, barcode, service)
}
