import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Building2, Mail, Phone, MapPin } from "lucide-react"
import { createCliente } from "@/app/actions/clientes"
import { SubmitButton } from "./submit-button"

export default function NovoClientePage() {
  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 mt-6">
        <form action={createCliente} className="space-y-8">
          
          {/* Header embedded in form to keep button together */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
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
              <SubmitButton />
            </div>
          </div>

          {/* Informações da Empresa */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-green-600" />
              Informações da Empresa
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Nome da Empresa *</label>
                <input type="text" name="name" placeholder="Ex.: Cacto Lda." className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">NIF *</label>
                <input type="text" name="nif" placeholder="Ex.: 501234567" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
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
                  <input type="email" name="email" placeholder="geral@empresa.pt" className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Telefone</label>
                <div className="relative">
                  <input type="text" name="phone" placeholder="+351 210 000 000" className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
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
                <input type="text" name="address" placeholder="Rua, número, andar, porta..." className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Código Postal</label>
                  <input type="text" name="postal_code" placeholder="1000-001" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700">Localidade</label>
                  <input type="text" name="city" placeholder="Lisboa" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
            </div>
          </div>

        </form>
      </div>

    </div>
  )
}
