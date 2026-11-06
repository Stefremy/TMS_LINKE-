const mimeByExtension: Record<string, string[]> = {
  jpg: ["image/jpeg"], jpeg: ["image/jpeg"], png: ["image/png"], gif: ["image/gif"], webp: ["image/webp"],
  pdf: ["application/pdf"], txt: ["text/plain"], csv: ["text/csv", "application/vnd.ms-excel", "text/plain"],
  doc: ["application/msword"], xls: ["application/vnd.ms-excel"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  zip: ["application/zip", "application/x-zip-compressed"],
}

/** Match the extension, declared MIME and binary signature before accepting an upload. */
export function chatFileType(name: string, declared: string, bytes: Uint8Array): string | null {
  const ext = name.split(".").pop()?.toLowerCase() || ""
  const allowed = mimeByExtension[ext]
  if (!allowed || !allowed.includes(declared.toLowerCase())) return null
  const starts = (...values: number[]) => values.every((value, i) => bytes[i] === value)
  const ascii = (start: number, length: number) => new TextDecoder().decode(bytes.slice(start, start + length))
  if (["jpg", "jpeg"].includes(ext) && !starts(0xff, 0xd8, 0xff)) return null
  if (ext === "png" && !starts(137, 80, 78, 71, 13, 10, 26, 10)) return null
  if (ext === "gif" && !["GIF87a", "GIF89a"].includes(ascii(0, 6))) return null
  if (ext === "webp" && !(ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP")) return null
  if (ext === "pdf" && ascii(0, 5) !== "%PDF-") return null
  if (["zip", "docx", "xlsx"].includes(ext) && !starts(0x50, 0x4b, 3, 4)) return null
  if (["doc", "xls"].includes(ext) && !starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) return null
  if (["txt", "csv"].includes(ext)) {
    try { new TextDecoder("utf-8", { fatal: true }).decode(bytes) } catch { return null }
    if (bytes.includes(0)) return null
  }
  return ext === "csv" ? "text/csv" : allowed[0]
}
