"use client"

import { useId, useState } from "react"

export function CttCustomsFields({ destinationName }: { destinationName?: string }) {
  const id = useId()
  const [rows, setRows] = useState([0])
  const [nextId, setNextId] = useState(1)
  const inputClass = "mt-1 block w-full rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-900"
  return <fieldset data-ctt-customs-fields tabIndex={-1} className="mt-4 space-y-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-slate-900">
    <legend className="px-1 text-sm font-semibold">Declaração aduaneira obrigatória{destinationName ? ` — ${destinationName}` : ""}</legend>
    <input type="hidden" name="ctt_customs_present" value="1" />
    <p className="text-xs">Este destino exige dados aduaneiros. Descreva os artigos em inglês ou numa língua aceite no destino. Os valores devem somar o valor declarado; o peso dos artigos deve excluir a embalagem.</p>
    {rows.map((row, index) => <fieldset key={row} className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-3">
      <legend className="px-1 text-xs font-semibold">Artigo {index + 1}</legend>
      <label className="text-xs md:col-span-3">Descrição do artigo / conteúdo para a alfândega *
        <textarea name="ctt_customs_description" required maxLength={50} rows={3} placeholder="Ex.: 2 cotton T-shirts" className={`${inputClass} resize-y`} />
        <span className="mt-1 block text-xs text-slate-600">Até 50 caracteres por artigo. Preencha abaixo a quantidade, o valor, o peso, o código pautal e o país de origem.</span>
      </label>
      <label className="text-xs">Quantidade *<input name="ctt_customs_quantity" required type="number" min="1" step="1" className={inputClass} /></label>
      <label className="text-xs">Valor total desta linha (€) *<input name="ctt_customs_value" required type="number" min="0" step="0.01" className={inputClass} /></label>
      <label className="text-xs">Peso total desta linha (kg) *<input name="ctt_customs_weight" required type="number" min="0.001" step="0.001" className={inputClass} /></label>
      <label className="text-xs">Código pautal / HS *<input name="ctt_customs_hs" required inputMode="numeric" pattern="[0-9]{6}|[0-9]{8}|[0-9]{10}" placeholder="6, 8 ou 10 dígitos" className={inputClass} /></label>
      <label className="text-xs">País de origem do artigo (ISO) *<input name="ctt_customs_origin" required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" placeholder="Ex.: PT" className={inputClass} /></label>
      {rows.length > 1 && <button type="button" onClick={() => setRows(rows.filter(value => value !== row))} className="self-end p-2 text-xs text-red-700">Remover artigo</button>}
    </fieldset>)}
    {rows.length < 50 && <button type="button" onClick={() => { setRows([...rows, nextId]); setNextId(nextId + 1) }} className="rounded-md border border-slate-300 px-3 py-2 text-xs">Adicionar artigo</button>}
    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-xs">N.º da fatura comercial *<input name="ctt_customs_invoice" required maxLength={50} className={inputClass} /></label>
      <label className="text-xs">Data da fatura comercial *<input name="ctt_customs_invoice_date" type="date" required className={inputClass} /></label>
      <label className="text-xs">NIF do destinatário (quando aplicável)<input name="ctt_customs_tin" maxLength={50} className={inputClass} /></label>
      <label className="text-xs">Em caso de não entrega *<select name="ctt_customs_non_delivery" required defaultValue="" className={inputClass}><option value="" disabled>Selecionar…</option><option value="GiveBack">Devolver ao remetente</option><option value="ToAbandon">Abandonar o envio</option></select></label>
      {[["sachet", "Documentação colocada em saqueta no exterior"], ["vat_export", "Declaração para dedução de IVA"], ["vat_rate", "Tem taxa de IVA associada"]].map(([name, label]) => <label key={name} htmlFor={`${id}-${name}`} className="text-xs">{label} *<select id={`${id}-${name}`} name={`ctt_customs_${name}`} required defaultValue="" className={inputClass}><option value="" disabled>Selecionar…</option><option value="true">Sim</option><option value="false">Não</option></select></label>)}
    </div>
    <p className="text-xs">Junte a fatura ou declaração de valor e os documentos exigidos para o conteúdo e destino.</p>
  </fieldset>
}
