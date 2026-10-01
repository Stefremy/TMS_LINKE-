import fs from "fs"
import path from "path"
import { PDFDocument, rgb } from "pdf-lib"

let cachedLogoBytes: Buffer | null = null

function getLogoBytes(): Buffer | null {
  if (cachedLogoBytes) return cachedLogoBytes
  try {
    const logoPath = path.join(process.cwd(), "public/linkelabel.png")
    if (fs.existsSync(logoPath)) {
      cachedLogoBytes = fs.readFileSync(logoPath)
      return cachedLogoBytes
    }
  } catch (err) {
    console.warn("Unable to load public/linkelabel.png:", err)
  }
  return null
}

function normalizeBase64(raw: string): string {
  let s = raw.trim()
  if (s.includes(";base64,")) {
    s = s.split(";base64,")[1]
  }
  s = s.replace(/\s+/g, "")
  s = s.replace(/-/g, "+").replace(/_/g, "/")
  const pad = s.length % 4
  if (pad === 2) s += "=="
  else if (pad === 3) s += "="
  return s
}

/**
 * Checks if a given base64 string looks like a Correos Express shipping label PDF
 * (landscape ~424 x 282 pt).
 */
export async function isCorreosPdfLabel(base64Data: string): Promise<boolean> {
  if (!base64Data || typeof base64Data !== "string") return false
  try {
    const cleanB64 = normalizeBase64(base64Data)
    const pdfBytes = Buffer.from(cleanB64, "base64")
    if (pdfBytes.subarray(0, 4).toString() !== "%PDF") return false

    const doc = await PDFDocument.load(pdfBytes)
    const page = doc.getPages()[0]
    if (!page) return false
    const { width, height } = page.getSize()

    // Correos thermal landscape format is typically ~424x282 (ratio ~ 1.5)
    return Math.abs(width - 424) < 10 && Math.abs(height - 282) < 10
  } catch {
    return false
  }
}

/**
 * Overlays the official Linke logo (public/linkelabel.png) over the carrier logo
 * on Correos Express shipping labels.
 * 
 * - Cleans and whitens the original carrier logo bounding area next to the barcode.
 * - Leaves all recipient info, routing codes (e.g. 4800, subzones), and barcodes intact and scannable.
 * - Supports single-page and multi-page (multi-collo) label PDFs.
 */
export async function applyLinkeLogoToCorreosLabel(base64Pdf: string): Promise<string> {
  if (!base64Pdf || typeof base64Pdf !== "string") return base64Pdf
  try {
    const cleanB64 = normalizeBase64(base64Pdf)
    const pdfBytes = Buffer.from(cleanB64, "base64")

    // Must be a valid PDF
    if (pdfBytes.subarray(0, 4).toString() !== "%PDF") {
      return base64Pdf
    }

    const logoBytes = getLogoBytes()
    if (!logoBytes) {
      console.warn("applyLinkeLogoToCorreosLabel: public/linkelabel.png not found, returning raw label.")
      return base64Pdf
    }

    const doc = await PDFDocument.load(pdfBytes)
    const logo = await doc.embedPng(logoBytes)
    const pages = doc.getPages()

    for (const page of pages) {
      const { width, height } = page.getSize()

      // Calculate scale factor relative to standard 424x282 label size
      const scaleX = width / 424
      const scaleY = height / 282

      // Cover the original Correos Express logo area with an opaque white rectangle
      // The carrier logo resides in the column between x: ~254 and the right edge, below the middle dividing line
      page.drawRectangle({
        x: 254 * scaleX,
        y: 20 * scaleY,
        width: 165 * scaleX,
        height: 105 * scaleY,
        color: rgb(1, 1, 1),
      })

      // Target sizing for Linke logo (aspect ratio preserved ~2.285)
      const targetHeight = 52 * scaleY
      const targetWidth = targetHeight * (logo.width / logo.height)

      // Center horizontally in the available right-hand space (x: 254 to 419)
      const centerX = 336.5 * scaleX
      const centerY = 72.5 * scaleY

      const x = centerX - (targetWidth / 2)
      const y = centerY - (targetHeight / 2)

      page.drawImage(logo, {
        x,
        y,
        width: targetWidth,
        height: targetHeight,
      })
    }

    const modifiedPdfBytes = await doc.save()
    return Buffer.from(modifiedPdfBytes).toString("base64")
  } catch (err: any) {
    console.error("applyLinkeLogoToCorreosLabel: Error customizing label:", err?.message || err)
    return base64Pdf
  }
}
