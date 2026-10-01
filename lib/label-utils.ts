/**
 * Utilitários para manuseamento, impressão e download de etiquetas CTT (PDF/ZPL)
 *
 * ARQUITECTURA:
 * - A conversão ZPL→PDF acontece SEMPRE no servidor (Server Action em ctt.ts via Labelary).
 * - O que chega ao browser é Base64 de PDF (armazenado em ctt_label_base64 na BD).
 * - O browser NÃO faz chamadas à Labelary API (CORS bloquearia).
 * - Download usa data URL directamente — sem atob, sem Blob, sem falhas de CORS.
 */

/**
 * Normaliza um string Base64 para garantir que é decodificável:
 * - Remove prefixo data:...; base64, se existir
 * - Remove whitespace
 * - Converte URL-safe Base64 (-, _) para standard (+, /)
 * - Corrige padding em falta (=)
 */
function normalizeBase64(raw: string): string {
  let s = raw.trim()
  if (s.includes(";base64,")) {
    s = s.split(";base64,")[1]
  }
  s = s.replace(/\s+/g, "")
  // URL-safe → standard Base64
  s = s.replace(/-/g, "+").replace(/_/g, "/")
  // Fix padding
  const pad = s.length % 4
  if (pad === 2) s += "=="
  else if (pad === 3) s += "="
  return s
}

/**
 * Verifica se um string parece ser Base64 válido (heurística simples).
 */
function isLikelyBase64(s: string): boolean {
  return /^[A-Za-z0-9+/=]+$/.test(s) && s.length > 20
}

/**
 * Converte código ZPL (Zebra) para Base64 de PDF usando o serviço Labelary.
 * APENAS para uso em Server Actions (Node.js) — não chamar do browser.
 */
export async function convertZplToPdfBase64(zpl: string): Promise<string> {
  let trimmed = (zpl || "").trim()

  // Decodificar entidades XML que o parser possa não ter decodificado
  // (e.g. &#xD; → \r, &#xA; → \n, &amp; → &)
  trimmed = trimmed
    .replace(/&#xD;/gi, "\r")
    .replace(/&#xA;/gi, "\n")
    .replace(/&#x9;/gi, "\t")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")

  if (!trimmed.startsWith("^XA")) {
    return trimmed
  }
  try {
    const res = await fetch("https://api.labelary.com/v1/printers/8dpmm/labels/4x6/0/", {
      method: "POST",
      headers: {
        "Accept": "application/pdf",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: trimmed,
    })
    if (res.ok) {
      const arrayBuf = await res.arrayBuffer()
      return Buffer.from(arrayBuf).toString("base64")
    }
    console.warn("Labelary respondeu com erro:", res.status, res.statusText)
  } catch (err: any) {
    console.warn("Falha ao converter ZPL para PDF via Labelary:", err?.message)
  }
  return trimmed
}

/**
 * Converte Base64 para Blob para downloads 100% fiáveis em todos os browsers
 * (evita restrições e erros 'Check internet connection' do Chrome com data URIs).
 */
export function base64ToBlob(base64: string, mimeType = "application/pdf"): Blob {
  const clean = normalizeBase64(base64)
  const byteCharacters = atob(clean)
  const byteNumbers = new Uint8Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  return new Blob([byteNumbers], { type: mimeType })
}

/**
 * Descarrega o PDF da etiqueta usando Blob e URL.createObjectURL.
 * Se a etiqueta fornecida for ZPL cru (^XA...), converte automaticamente para PDF antes do download.
 */
export async function downloadCttLabel(
  labelInput?: string | null,
  filename: string = "etiqueta_ctt.pdf"
): Promise<boolean> {
  if (!labelInput) {
    console.warn("downloadCttLabel: Sem etiqueta disponível.")
    return false
  }

  let labelBase64 = labelInput.trim()

  // Se a etiqueta for ZPL cru (^XA...), converter para PDF via Server Action antes de descarregar
  if (labelBase64.startsWith("^XA")) {
    try {
      const { convertZplToPdfAction } = await import("@/app/actions/ctt")
      const conv = await convertZplToPdfAction(labelBase64)
      if (conv.success && conv.base64) {
        labelBase64 = conv.base64
      } else {
        console.error("downloadCttLabel: Falha na conversão ZPL:", conv.error)
        return false
      }
    } catch (e) {
      console.error("downloadCttLabel: Erro ao chamar conversão ZPL:", e)
      return false
    }
  }

  const clean = normalizeBase64(labelBase64)
  if (!isLikelyBase64(clean)) {
    console.warn("downloadCttLabel: O string não parece ser Base64 válido. Primeiros 100 chars:", clean.slice(0, 100))
    return false
  }

  try {
    const blob = base64ToBlob(clean, "application/pdf")
    const url = URL.createObjectURL(blob)
    const fname = filename.endsWith(".pdf") ? filename : `${filename}.pdf`

    const link = document.createElement("a")
    link.href = url
    link.download = fname
    link.style.display = "none"
    document.body.appendChild(link)
    link.click()

    setTimeout(() => {
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }, 2000)

    return true
  } catch (err) {
    console.error("downloadCttLabel: Erro ao descarregar Blob:", err)
    return false
  }
}

/**
 * Abre o PDF da etiqueta numa nova aba para impressão usando Blob URL.
 */
export async function printCttLabel(labelInput?: string | null): Promise<boolean> {
  if (!labelInput) {
    console.warn("printCttLabel: Sem etiqueta disponível.")
    return false
  }

  let labelBase64 = labelInput.trim()

  if (labelBase64.startsWith("^XA")) {
    try {
      const { convertZplToPdfAction } = await import("@/app/actions/ctt")
      const conv = await convertZplToPdfAction(labelBase64)
      if (conv.success && conv.base64) {
        labelBase64 = conv.base64
      }
    } catch {}
  }

  const clean = normalizeBase64(labelBase64)
  if (!isLikelyBase64(clean)) {
    console.warn("printCttLabel: O string não parece ser Base64 válido.")
    return false
  }

  try {
    const blob = base64ToBlob(clean, "application/pdf")
    const url = URL.createObjectURL(blob)
    const printWindow = window.open(url, "_blank")
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.focus()
        printWindow.print()
      }
      return true
    }
    // Popup bloqueado → fallback para download
    console.warn("printCttLabel: Popup bloqueado, a fazer download como alternativa.")
    return downloadCttLabel(labelBase64, "etiqueta_ctt.pdf")
  } catch (err) {
    console.error("printCttLabel: Erro:", err)
    return false
  }
}


