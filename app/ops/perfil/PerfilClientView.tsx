"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Camera, 
  Save, 
  Lock, 
  ShieldCheck,
  Check,
  Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export function PerfilClient({ user }: { user: any }) {
  const router = useRouter()
  const supabase = createClient()
  const [isSaving, setIsSaving] = React.useState(false)
  const [showSuccess, setShowSuccess] = React.useState(false)
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(user?.user_metadata?.avatar || null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Default values from user_metadata
  const meta = user?.user_metadata || {}
  const [formData, setFormData] = React.useState({
    name: meta.full_name || meta.name || user?.email?.split('@')[0] || "",
    email: user?.email || "",
    phone: meta.phone || "",
    department: meta.role === "ops" ? "Operações" : meta.role || "Geral",
    location: meta.location || "Porto, PT"
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Resize image to max 200x200 to keep base64 small for user_metadata
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const MAX_SIZE = 200
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width
            width = MAX_SIZE
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height
            height = MAX_SIZE
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        ctx?.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8)
        setAvatarPreview(dataUrl)
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  // Helper to convert base64 to Blob
  const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',')
    const mime = arr[0].match(/:(.*?);/)?.[1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new Blob([u8arr], { type: mime })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    
    try {
      let finalAvatarUrl = avatarPreview

      // If avatarPreview is a base64 string, upload it to Storage
      if (finalAvatarUrl && finalAvatarUrl.startsWith("data:image")) {
        const blob = dataURLtoBlob(finalAvatarUrl)
        const fileName = `${user.id}-${Date.now()}.jpg`
        
        const { error: uploadError } = await supabase
          .storage
          .from("avatars")
          .upload(fileName, blob, {
            cacheControl: "3600",
            upsert: true
          })
          
        if (uploadError) {
          throw new Error("Falha no upload da imagem: " + uploadError.message)
        }
        
        const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(fileName)
        finalAvatarUrl = publicUrlData.publicUrl
      }

      const { error } = await supabase.auth.updateUser({
        data: {
          name: formData.name,
          phone: formData.phone,
          role: formData.department,
          location: formData.location,
          avatar: finalAvatarUrl
        }
      })

      if (error) throw error

      setShowSuccess(true)
      router.refresh()
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (err: any) {
      alert("Erro ao guardar perfil: " + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--canvas-bg)] overflow-y-auto">
      <div className="max-w-4xl w-full mx-auto p-6 md:p-8 space-y-8 pb-20">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">O Meu Perfil</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Gerir as tuas informações pessoais, contactos e segurança.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Avatar & Quick Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl p-6 shadow-2xs flex flex-col items-center text-center">
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleAvatarChange} 
              />
              <div 
                className="relative group cursor-pointer mb-4" 
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-28 h-28 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shadow-md overflow-hidden relative">
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12" />
                  )}
                </div>
                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-8 h-8 text-white" />
                </div>
                <div className="absolute bottom-0 right-0 w-8 h-8 bg-white border border-[var(--border-subtle)] rounded-full flex items-center justify-center shadow-sm z-10 hover:bg-slate-50">
                  <Camera className="w-4 h-4 text-[var(--text-secondary)]" />
                </div>
              </div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] capitalize">{formData.name}</h2>
              <p className="text-xs font-semibold text-[var(--accent)] mt-1 uppercase tracking-wider">{formData.department}</p>
              
              <div className="w-full h-px bg-[var(--border-subtle)] my-5"></div>
              
              <div className="w-full space-y-3 text-left">
                <div className="flex items-center text-sm text-[var(--text-secondary)]">
                  <Mail className="w-4 h-4 mr-3 text-[var(--text-tertiary)]" />
                  <span className="truncate">{formData.email}</span>
                </div>
                <div className="flex items-center text-sm text-[var(--text-secondary)]">
                  <MapPin className="w-4 h-4 mr-3 text-[var(--text-tertiary)]" />
                  <span>{formData.location}</span>
                </div>
                <div className="flex items-center text-sm text-[var(--text-secondary)]">
                  <ShieldCheck className="w-4 h-4 mr-3 text-[var(--status-success)]" />
                  <span className="text-[var(--status-success)] font-medium">Conta Verificada</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Form */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSave} className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl p-6 shadow-2xs space-y-6">
              
              <div className="border-b border-[var(--border-subtle)] pb-4">
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Informações Pessoais</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">Nome Completo</label>
                  <input 
                    type="text" 
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">Departamento / Cargo</label>
                  <input 
                    type="text" 
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">Email de Contacto</label>
                  <input 
                    type="email" 
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled
                    className="w-full px-3 py-2 bg-[var(--canvas-bg)] border border-[var(--border-subtle)] rounded-md text-sm text-[var(--text-tertiary)] opacity-70 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-[var(--text-tertiary)]">O email está associado ao login e não pode ser alterado aqui.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">Telemóvel</label>
                  <input 
                    type="tel" 
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+351 910 000 000"
                    className="w-full px-3 py-2 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
                  />
                </div>
              </div>

              <div className="border-b border-[var(--border-subtle)] pb-4 pt-4">
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Segurança</h3>
              </div>

              <div className="flex items-center justify-between p-4 bg-[var(--surface-muted)] rounded-lg border border-[var(--border-subtle)]">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white border border-[var(--border-subtle)] flex items-center justify-center shrink-0 shadow-sm">
                    <Lock className="w-5 h-5 text-[var(--text-secondary)]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[var(--text-primary)]">Palavra-passe</h4>
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Atualizada há 2 meses</p>
                  </div>
                </div>
                <Button variant="outline" type="button" className="text-xs font-semibold h-8 bg-white shadow-2xs border-[var(--border-strong)]">
                  Alterar
                </Button>
              </div>

              <div className="pt-6 flex items-center justify-end gap-3">
                <Button variant="outline" type="button" onClick={() => router.back()} className="text-xs font-semibold h-9 shadow-2xs border-[var(--border-strong)]">
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSaving}
                  className={`text-xs font-bold h-9 shadow-xs transition-colors ${showSuccess ? 'bg-[var(--status-success)] hover:bg-[var(--status-success)] text-white' : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white'}`}
                >
                  {isSaving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> A Guardar...</> : showSuccess ? <><Check className="w-4 h-4 mr-1.5" /> Guardado</> : <><Save className="w-4 h-4 mr-1.5" /> Guardar Alterações</>}
                </Button>
              </div>
            </form>
          </div>
          
        </div>
      </div>
    </div>
  )
}
