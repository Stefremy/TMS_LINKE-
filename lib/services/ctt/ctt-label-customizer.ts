import "server-only"

const BRANDING_KEY = "LinkeCttEqBranding"
const CTT_LOGO_SHA256 = "e4e695e5cbe003919182891e5d7d8b4bb35b6a4b8b2c0027e05c18689d9690a1"
const CTT_LOGO_DRAW = "q\n0.3547 0 0 0.3547 10.6404 20.2167 cm\nq\n88 0 0 131 0 0 cm\n/Im1 Do\nQ\nQ\n"
let cachedLogo: Uint8Array | undefined

/**
 * Brand the verified EQ / Labelary 4x6 layout with Linke, removing its known CTT logo.
 * Page size, codes, carrier identification and address content remain intact.
 * Other products/layouts are returned unchanged until their free space is verified.
 */
export async function applyLinkeLogoToCttLabel(base64Pdf: string, trackingNumber?: string): Promise<string> {
  if (!/^EQ\d{9}PT$/i.test(trackingNumber?.trim() || "")) return base64Pdf
  const clean = base64Pdf.trim().replace(/^data:application\/pdf;base64,/i, "").replace(/\s/g, "")
  const bytes = Buffer.from(clean, "base64")
  if (bytes.subarray(0, 4).toString() !== "%PDF") return base64Pdf
  try {
    const { PDFDocument, PDFName, PDFDict, PDFRawStream, PDFNumber, PDFRef, decodePDFRawStream, degrees } = await import("pdf-lib")
    const doc = await PDFDocument.load(bytes, { updateMetadata: false })
    const branding = doc.catalog.get(PDFName.of(BRANDING_KEY))
    if (branding?.toString() === "/v2") return base64Pdf
    const pages = doc.getPages()
    if (!doc.getCreator()?.startsWith("Labelary") || pages.length === 0 || pages.some(page => {
      const { width, height } = page.getSize()
      return Math.abs(width - 288) > 0.1 || Math.abs(height - 432) > 0.1 || page.getRotation().angle !== 0
    })) return base64Pdf

    const { createHash } = await import("node:crypto")
    let removedLogo = false
    for (const page of pages) {
      const objects = page.node.Resources()?.lookupMaybe(PDFName.of("XObject"), PDFDict)
      const formName = PDFName.of("Form1")
      const form = objects?.lookup(formName)
      if (!(form instanceof PDFRawStream)) continue
      const resources = form.dict.lookupMaybe(PDFName.of("Resources"), PDFDict)
      const images = resources?.lookupMaybe(PDFName.of("XObject"), PDFDict)
      const image = images?.lookup(PDFName.of("Im1"))
      if (!resources || !images || !(image instanceof PDFRawStream)
        || image.dict.lookupMaybe(PDFName.of("Width"), PDFNumber)?.asNumber() !== 88
        || image.dict.lookupMaybe(PDFName.of("Height"), PDFNumber)?.asNumber() !== 131
        || createHash("sha256").update(decodePDFRawStream(image).decode()).digest("hex") !== CTT_LOGO_SHA256) continue
      const content = Buffer.from(decodePDFRawStream(form).decode()).toString("latin1")
      if (!content.includes(CTT_LOGO_DRAW) || content.split("/Im1 Do").length !== 2) continue

      // Remove only the fingerprinted logo invocation and its resource. All text,
      // vector barcodes and other images in the carrier form remain byte-identical.
      const replacement = doc.context.flateStream(Buffer.from(content.replace(CTT_LOGO_DRAW, ""), "latin1"))
      for (const [key, value] of form.dict.entries()) {
        if (!["/Length", "/Filter", "/DecodeParms"].includes(key.toString())) replacement.dict.set(key, value)
      }
      const nextResources = resources.clone(doc.context)
      const nextImages = images.clone(doc.context)
      nextImages.delete(PDFName.of("Im1"))
      nextResources.set(PDFName.of("XObject"), nextImages)
      replacement.dict.set(PDFName.of("Resources"), nextResources)
      const ref = objects!.get(formName)
      if (ref instanceof PDFRef) doc.context.assign(ref, replacement)
      else objects!.set(formName, replacement)
      removedLogo = true
    }

    // Previously branded downloads already contain Linke; upgrade them without
    // inserting a second logo. Unknown CTT graphics are never removed.
    if (branding && !removedLogo) return base64Pdf
    if (!branding && !cachedLogo) {
      const { readFile } = await import("node:fs/promises")
      const path = await import("node:path")
      cachedLogo = await readFile(path.join(process.cwd(), "public/linkelabel.png"))
    }
    if (!branding) {
      const logo = await doc.embedPng(cachedLogo!)
      const width = 80
      const height = width * logo.height / logo.width
      for (const page of pages) {
        // EQ content reads landscape on portrait paper; retain the Linke header slot.
        page.drawImage(logo, { x: 8 + height, y: 91, width, height, rotate: degrees(90) })
      }
    }
    doc.catalog.set(PDFName.of(BRANDING_KEY), PDFName.of("v2"))
    return Buffer.from(await doc.save()).toString("base64")
  } catch (error) {
    console.warn("CTT label branding unavailable; keeping the carrier label.", error instanceof Error ? error.message : String(error))
    return base64Pdf
  }
}
