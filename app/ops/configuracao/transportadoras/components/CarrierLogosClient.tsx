"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { 
  Package, 
  Upload, 
  Save, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Tag, 
  Palette, 
  Search,
  Check
} from "lucide-react"
import { 
  saveCarrierLogosSettingsAction,
  uploadCarrierLogoAction
} from "@/app/actions/carrier-logos"
import { 
  type CarrierLogosSettings, 
  type CarrierConfigItem 
} from "@/app/actions/carrier-logos-types"

interface CarrierLogosClientProps {
  initialSettings: CarrierLogosSettings
  availableLogos: string[]
}

export function CarrierLogosClient({ initialSettings, availableLogos }: CarrierLogosClientProps) {
  const router = useRouter()
  const [settings, setSettings] = React.useState<CarrierLogosSettings>(initialSettings)
  const [hasChanges, setHasChanges] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [uploadingForId, setUploadingForId] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [feedback, setFeedback] = React.useState<{ message: string; type: "success" | "error" } | null>(null)
  const [newAliasInputs, setNewAliasInputs] = React.useState<Record<string, string>>({})

  const updateCarrier = (id: string, updates: Partial<CarrierConfigItem>) => {
    setSettings(prev => ({
      ...prev,
      carriers: prev.carriers.map(c => c.id === id ? { ...c, ...updates } : c)
    }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      const res = await saveCarrierLogosSettingsAction(settings)
      if (res.success) {
        setHasChanges(false)
        setFeedback({ message: "Configurações de transportadoras e logótipos gravadas com sucesso!", type: "success" })
        router.refresh()
      } else {
        setFeedback({ message: res.error || "Falha ao gravar configurações.", type: "error" })
      }
    } catch (err: any) {
      setFeedback({ message: err?.message || "Erro inesperado ao gravar.", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = async (carrierId: string, e: React.ChangeEvent<HTMLInputElement>, isLabelLogo: boolean = false) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingForId(carrierId)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await uploadCarrierLogoAction(formData)
      if (res.success && res.url) {
        if (isLabelLogo) {
          updateCarrier(carrierId, { labelLogoUrl: res.url, useCustomLabelLogo: true })
        } else {
          updateCarrier(carrierId, { logoUrl: res.url })
        }
        setFeedback({ message: `Logótipo carregado com sucesso (${file.name})!`, type: "success" })
      } else {
        setFeedback({ message: res.error || "Falha no upload.", type: "error" })
      }
    } catch (err: any) {
      setFeedback({ message: err?.message || "Erro ao fazer upload.", type: "error" })
    } finally {
      setUploadingForId(null)
    }
  }

  const handleAddAlias = (carrierId: string) => {
    const input = (newAliasInputs[carrierId] || "").trim().toLowerCase()
    if (!input) return

    const carrier = settings.carriers.find(c => c.id === carrierId)
    if (!carrier) return

    if (!carrier.aliases.includes(input)) {
      updateCarrier(carrierId, { aliases: [...carrier.aliases, input] })
    }

    setNewAliasInputs(prev => ({ ...prev, [carrierId]: "" }))
  }

  const handleRemoveAlias = (carrierId: string, aliasToRemove: string) => {
    const carrier = settings.carriers.find(c => c.id === carrierId)
    if (!carrier) return

    updateCarrier(carrierId, { aliases: carrier.aliases.filter(a => a !== aliasToRemove) })
  }

  const handleAddNewCarrier = () => {
    const newId = `carrier_${Date.now()}`
    const newCarrier: CarrierConfigItem = {
      id: newId,
      name: "Nova Transportadora",
      code: `custom_${Date.now().toString().slice(-4)}`,
      logoUrl: "/logo_transportadoras/ctt_express_logo.svg",
      labelLogoUrl: "/linkelabel.png",
      useCustomLabelLogo: false,
      aliases: ["nova"],
      accentColor: "#10b981"
    }

    setSettings(prev => ({
      ...prev,
      carriers: [...prev.carriers, newCarrier]
    }))
    setHasChanges(true)
  }

  const handleDeleteCarrier = (carrierId: string) => {
    if (!confirm("Tem a certeza que deseja remover esta transportadora das configurações?")) return
    setSettings(prev => ({
      ...prev,
      carriers: prev.carriers.filter(c => c.id !== carrierId)
    }))
    setHasChanges(true)
  }

  const filteredCarriers = settings.carriers.filter(c => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.aliases.some(a => a.toLowerCase().includes(q))
    )
  })

  return (
    <div className="flex flex-col bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
      
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shadow-2xs">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Transportadoras & Logótipos</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Gestão independente dos logótipos das transportadoras parceiras, mapeamento e personalização de etiquetas
            </p>
          </div>
        </div>

        <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
          <span>Configuração</span>
          <span>&gt;</span>
          <span className="text-slate-600 font-semibold">Transportadoras & Logótipos</span>
        </div>
      </div>

      {/* Toolbar / Action Bar */}
      <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 text-[13px]">
        {/* Left: Novo Carrier */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddNewCarrier}
            className="bg-[#10b981] hover:bg-[#059669] active:scale-[0.99] text-white font-bold px-3.5 py-1.5 rounded text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            <span>Adicionar Transportadora</span>
          </button>
        </div>

        {/* Right: Save Button */}
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-xs font-medium text-amber-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Alterações por guardar
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-[#10b981] hover:bg-[#059669] active:scale-[0.99] text-white font-bold px-4 py-1.5 rounded text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "A Guardar..." : hasChanges ? "Guardar Alterações" : "Configurações Guardadas"}</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div className={`px-6 py-2.5 border-b text-xs font-semibold flex items-center justify-between ${
          feedback.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100 cursor-pointer font-bold">×</button>
        </div>
      )}

      {/* Main Content Body */}
      <div className="p-6 bg-slate-50/40 space-y-6">

        {/* Global Shipping Labels Customization Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-700" />
              <h2 className="text-sm font-bold text-slate-800">Personalização de Etiquetas de Envio (Labels)</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">PDF & Térmica</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-8 space-y-2">
              <label className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-50/70 border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={settings.globalReplaceCorreosLabelLogo}
                  onChange={(e) => {
                    setSettings(prev => ({ ...prev, globalReplaceCorreosLabelLogo: e.target.checked }))
                    setHasChanges(true)
                  }}
                  className="w-4 h-4 mt-0.5 rounded text-slate-900 accent-slate-900 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800">
                    Substituir logótipo nas etiquetas Correos pelo logótipo oficial da Linke
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Sobrepõe automaticamente o logótipo oficial da Linke (<code className="text-xs font-mono text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">{settings.globalLabelLogoUrl || "/linkelabel.png"}</code>) sobre o cabeçalho das etiquetas térmicas e PDF.
                  </p>
                </div>
              </label>
            </div>

            <div className="md:col-span-4 flex items-center justify-center p-3 rounded-lg bg-slate-900 border border-slate-800 shadow-2xs">
              <div className="text-center space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Logótipo na Etiqueta</span>
                <div className="h-12 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={settings.globalLabelLogoUrl || "/linkelabel.png"} 
                    alt="Linke Label" 
                    className="max-h-10 max-w-full object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar por nome, código ou alias..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 shadow-2xs"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Total: <strong>{filteredCarriers.length}</strong> transportadoras configuradas
          </div>
        </div>

        {/* Carriers List */}
        <div className="space-y-4">
          {filteredCarriers.map((carrier) => (
            <div 
              key={carrier.id} 
              className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <span 
                    className="w-3.5 h-3.5 rounded-full shrink-0" 
                    style={{ backgroundColor: carrier.accentColor || "#10b981" }}
                  />
                  <div>
                    <input
                      type="text"
                      value={carrier.name}
                      onChange={(e) => updateCarrier(carrier.id, { name: e.target.value })}
                      className="text-sm font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-800 focus:outline-none"
                    />
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-400 font-mono">Código:</span>
                      <input
                        type="text"
                        value={carrier.code}
                        onChange={(e) => updateCarrier(carrier.id, { code: e.target.value.toLowerCase() })}
                        className="text-[11px] font-mono font-bold text-slate-600 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Right actions: color & delete */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Palette className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="color"
                      value={carrier.accentColor || "#10b981"}
                      onChange={(e) => updateCarrier(carrier.id, { accentColor: e.target.value })}
                      className="w-6 h-6 rounded border border-slate-300 cursor-pointer bg-transparent"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteCarrier(carrier.id)}
                    className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                    title="Eliminar transportadora"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Grid with Logo Display & Settings */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Logo Preview Boxes (4 cols) */}
                <div className="md:col-span-4 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Logótipo Principal
                  </label>

                  {/* Previews in Light and Dark background */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-lg bg-white border border-slate-200 flex flex-col items-center justify-center min-h-[70px]">
                      <span className="text-[9px] text-slate-400 font-bold uppercase mb-1">Fundo Claro</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={carrier.logoUrl}
                        alt={carrier.name}
                        className="max-h-8 max-w-full object-contain"
                      />
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col items-center justify-center min-h-[70px]">
                      <span className="text-[9px] text-slate-500 font-bold uppercase mb-1">Fundo Escuro</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={carrier.logoUrl}
                        alt={carrier.name}
                        className="max-h-8 max-w-full object-contain"
                      />
                    </div>
                  </div>

                  {/* Change/Upload Logo */}
                  <div className="flex items-center gap-2 pt-1">
                    <select
                      value={carrier.logoUrl}
                      onChange={(e) => updateCarrier(carrier.id, { logoUrl: e.target.value })}
                      className="flex-1 text-[11px] px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 shadow-2xs truncate"
                    >
                      {availableLogos.map((logoPath) => (
                        <option key={logoPath} value={logoPath}>
                          {logoPath.split("/").pop()}
                        </option>
                      ))}
                    </select>

                    <label className="p-1.5 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 shadow-2xs transition-colors cursor-pointer shrink-0" title="Carregar imagem">
                      <Upload className="w-3.5 h-3.5 text-slate-600" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(carrier.id, e, false)}
                      />
                    </label>
                  </div>
                </div>

                {/* Aliases / Match Terms (5 cols) */}
                <div className="md:col-span-5 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Aliases & Mapeamento Automático
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Termos que associam automaticamente este logótipo quando o envio tem este serviço ou fornecedor.
                  </p>

                  {/* Aliases Tags */}
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-slate-50/70 border border-slate-200 min-h-[60px] items-center">
                    {carrier.aliases.map((alias) => (
                      <span 
                        key={alias} 
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-white border border-slate-300 text-slate-800 shadow-2xs"
                      >
                        <span>{alias}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAlias(carrier.id, alias)}
                          className="text-slate-400 hover:text-red-600 font-bold ml-0.5 cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))}

                    <div className="inline-flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="+ alias"
                        value={newAliasInputs[carrier.id] || ""}
                        onChange={(e) => setNewAliasInputs(prev => ({ ...prev, [carrier.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleAddAlias(carrier.id)
                          }
                        }}
                        className="w-20 px-1.5 py-0.5 text-[10px] font-mono bg-transparent border-b border-slate-300 focus:border-slate-800 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddAlias(carrier.id)}
                        className="text-[10px] font-bold text-slate-900 hover:opacity-80 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Label Logo Special (3 cols) */}
                <div className="md:col-span-3 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Logótipo da Etiqueta
                  </label>
                  
                  <div className="p-3 rounded-lg bg-slate-50/70 border border-slate-200 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={carrier.useCustomLabelLogo || false}
                        onChange={(e) => updateCarrier(carrier.id, { useCustomLabelLogo: e.target.checked })}
                        className="w-3.5 h-3.5 rounded text-slate-900 accent-slate-900 cursor-pointer"
                      />
                      <span className="text-[11px] font-medium text-slate-800">
                        Logo Próprio
                      </span>
                    </label>

                    {carrier.useCustomLabelLogo && (
                      <div className="pt-1 space-y-1.5">
                        <select
                          value={carrier.labelLogoUrl || "/linkelabel.png"}
                          onChange={(e) => updateCarrier(carrier.id, { labelLogoUrl: e.target.value })}
                          className="w-full text-[10px] px-2 py-1 bg-white border border-slate-300 rounded text-slate-800 truncate shadow-2xs"
                        >
                          {availableLogos.map((p) => (
                            <option key={p} value={p}>{p.split("/").pop()}</option>
                          ))}
                        </select>

                        <div className="h-8 flex items-center justify-center bg-slate-900 rounded border border-slate-800 p-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={carrier.labelLogoUrl || "/linkelabel.png"} 
                            alt="Label preview" 
                            className="max-h-6 max-w-full object-contain"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
