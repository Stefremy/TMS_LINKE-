import * as React from "react"
import Link from "next/link"
import { Search, Plus, MoreVertical, Building2, UserCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getClientes } from "@/app/actions/clientes"

export default async function ClientesPage() {
  const clientes = await getClientes()

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Pesquisar por NIF, Nome..." 
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-64 bg-white"
            />
          </div>
          <Link href="/ops/clientes/novo" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Novo Cliente
          </Link>
        </div>
      </div>

      {/* Clientes Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-4 py-3 font-semibold text-slate-500 rounded-tl-xl">Empresa</th>
                <th className="px-4 py-3 font-semibold text-slate-500">NIF</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Contacto</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Plano</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Estado</th>
                <th className="px-4 py-3 font-semibold text-slate-500 rounded-tr-xl">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              ) : (
                clientes.map((cliente: any) => (
                  <tr key={cliente.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-slate-700">{cliente.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600 font-medium">{cliente.nif || "-"}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <UserCircle2 className="w-4 h-4 text-slate-400" />
                        {cliente.email || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{cliente.plan_type || "Starter"}</td>
                    <td className="px-4 py-4">
                      <Badge variant={cliente.is_active !== false ? 'success' : 'neutral'}>
                        {cliente.is_active !== false ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <Link href={`/app`} className="px-4 py-1.5 bg-green-50 text-green-700 rounded-md text-xs font-bold hover:bg-green-100 transition-colors">
                          Aceder Dashboard
                        </Link>
                        <button className="text-slate-400 hover:text-slate-600">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  )
}
