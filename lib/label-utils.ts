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
  const trimmed = (zpl || "").trim()
  if (!trimmed.startsWith("^XA")) {
    return trimmed
  }
  try {
    const res = await fetch("https://api.labelary.com/v1/printers/8dpmm/labels/4x6/0/", {
      method: "POST",
      headers: { Accept: "application/pdf" },
      body: trimmed,
    })
    if (res.ok) {
      const arrayBuf = await res.arrayBuffer()
      return Buffer.from(arrayBuf).toString("base64")
    }
  } catch (err: any) {
    console.warn("Falha ao converter ZPL para PDF via Labelary:", err?.message)
  }
  return trimmed
}

/**
 * Descarrega o PDF da etiqueta CTT usando uma data URL (abordagem mais fiável).
 * Não precisa de atob, Blob ou chamadas de rede.
 */
export function downloadCttLabel(
  labelBase64?: string | null,
  filename: string = "etiqueta_ctt.pdf"
): boolean {
  if (!labelBase64) {
    console.warn("downloadCttLabel: Sem etiqueta disponível.")
    return false
  }

  const clean = normalizeBase64(labelBase64)

  if (!isLikelyBase64(clean)) {
    console.warn("downloadCttLabel: O string não parece ser Base64 válido. Primeiros 100 chars:", clean.slice(0, 100))
    return false
  }

  try {
    const dataUrl = `data:application/pdf;base64,${clean}`
    const fname = filename.endsWith(".pdf") ? filename : `${filename}.pdf`

    const link = document.createElement("a")
    link.href = dataUrl
    link.download = fname
    link.style.display = "none"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    return true
  } catch (err) {
    console.error("downloadCttLabel: Erro ao descarregar:", err)
    return false
  }
}

/**
 * Abre o PDF da etiqueta CTT numa nova aba para impressão.
 * Se não houver etiqueta válida, NÃO imprime a página.
 * Se o popup for bloqueado, faz download como fallback.
 */
export function printCttLabel(labelBase64?: string | null): boolean {
  if (!labelBase64) {
    console.warn("printCttLabel: Sem etiqueta disponível.")
    return false
  }

  const clean = normalizeBase64(labelBase64)

  if (!isLikelyBase64(clean)) {
    console.warn("printCttLabel: O string não parece ser Base64 válido.")
    return false
  }

  try {
    const dataUrl = `data:application/pdf;base64,${clean}`
    const printWindow = window.open(dataUrl, "_blank")
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


