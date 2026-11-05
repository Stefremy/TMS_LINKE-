import { convertZplToPdfBase64 } from "@/lib/label-utils"

export type CarrierLabel = { data: string; format: "pdf" | "zpl" }

/** Preserve every carrier page; never manufacture copies of a parcel's barcode. */
export async function combineCarrierLabels(labels: CarrierLabel[]): Promise<CarrierLabel | null> {
  if (!labels.length) return null
  if (labels.length === 1) return labels[0]
  if (labels.every(label => label.format === "zpl")) {
    return { data: labels.map(label => label.data).join("\n"), format: "zpl" }
  }
  const { PDFDocument } = await import("pdf-lib")
  const output = await PDFDocument.create()
  for (const label of labels) {
    const data = label.format === "zpl" ? await convertZplToPdfBase64(label.data) : label.data
    const source = await PDFDocument.load(Buffer.from(data, "base64"), { updateMetadata: false })
    for (const page of await output.copyPages(source, source.getPageIndices())) output.addPage(page)
  }
  return { data: Buffer.from(await output.save()).toString("base64"), format: "pdf" }
}
