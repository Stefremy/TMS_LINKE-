'use client'

import type { CTTDocumentData } from '@/lib/services/ctt/ctt-types'

/** Additional certificates: CTT can return one PDF for each product in the batch. */
export function ManifestDocuments({ documents = [] }: { documents?: CTTDocumentData[] }) {
  if (documents.length < 2) return null
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {documents.slice(1).map((document, index) => (
        <a key={index} href={`data:application/pdf;base64,${document.File}`}
          download={`Certificado_CTT_${index + 2}.pdf`}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-800">
          Descarregar certificado {index + 2}
        </a>
      ))}
    </div>
  )
}
