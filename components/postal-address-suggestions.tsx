"use client"

import type { PostalLookupInfo } from "@/lib/hooks/usePostalCodeLookup"

export function PostalAddressSuggestions({ info, onCity, onStreet }: {
  info: PostalLookupInfo | null
  onCity: (city: string) => void
  onStreet: (street: string) => void
}) {
  return (
    <div className="space-y-2 text-xs">
      {info?.cities && info.cities.length > 1 && (
        <label className="block space-y-1">
          <span>Este código postal abrange várias localidades. Escolha a correta:</span>
          <select value="" onChange={event => onCity(event.target.value)} className="block w-full rounded-md border border-slate-300 bg-white p-2 text-slate-900">
            <option value="" disabled>Selecionar localidade</option>
            {info.cities.map(city => <option key={city} value={city}>{city}</option>)}
          </select>
        </label>
      )}
      {info?.streets && info.streets.length > 1 && (
        <label className="block space-y-1">
          <span>Ruas deste código postal:</span>
          <select value="" onChange={event => onStreet(event.target.value)} className="block w-full rounded-md border border-slate-300 bg-white p-2 text-slate-900">
            <option value="" disabled>Selecionar rua</option>
            {info.streets.map(street => <option key={street} value={street}>{street}</option>)}
          </select>
        </label>
      )}
      <p className="text-slate-500">A pesquisa depende da cobertura do país. Confirme a rua e acrescente o número da porta; pode preencher a morada manualmente.</p>
    </div>
  )
}
