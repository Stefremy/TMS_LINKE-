import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Save, Building2, Mail, Phone, MapPin } from "lucide-react"

export default function NovoClientePage() {
  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/ops/clientes" className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">Novo Cliente</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/ops/clientes" className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
            Cancelar
          </Link>
          <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2">
            <Save className="w-4 h-4" />
            Guardar Cliente
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <form className="space-y-8">
          
          {/* Informações da Empresa */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-green-600" />
              Informações da Empresa
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Nome da Empresa *</label>
                <input type="text" placeholder="Ex.: Cacto Lda." className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">NIF *</label>
                <input type="text" placeholder="Ex.: 501234567" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Contactos */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Mail className="w-5 h-5 text-green-600" />
              Contactos
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Email Principal *</label>
                <div className="relative">
                  <input type="email" placeholder="geral@empresa.pt" className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Telefone</label>
                <div className="relative">
                  <input type="text" placeholder="+351 210 000 000" className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Morada de Faturação / Principal */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-600" />
              Morada Sede
            </h2>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Morada</label>
                <input type="text" placeholder="Rua, número, andar, porta..." className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Código Postal</label>
                  <input type="text" placeholder="1000-001" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700">Localidade</label>
                  <input type="text" placeholder="Lisboa" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
            </div>
          </div>

        </form>
      </div>

    </div>
  )
}
