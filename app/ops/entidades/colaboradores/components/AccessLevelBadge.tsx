import { Shield, ShieldCheck } from "lucide-react"

interface AccessLevelBadgeProps {
  level: string
  className?: string
}

export function AccessLevelBadge({ level, className = "" }: AccessLevelBadgeProps) {
  const isAdmin = level === "Administrador"
  const Icon = isAdmin ? ShieldCheck : Shield

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none ${
        isAdmin
          ? "border-[#263F63] bg-[#263F63] text-white"
          : "border-[#C7D4DC] bg-[#EDF1F3] text-[#376C8A]"
      } ${className}`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {level}
    </span>
  )
}
