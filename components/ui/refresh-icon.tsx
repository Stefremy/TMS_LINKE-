import { RotateCw, type LucideProps } from "lucide-react"

/** A simple, legible refresh glyph shared by OPS and the client portal. */
export function RefreshIcon({ size = 16, strokeWidth = 2, className = "", ...props }: LucideProps) {
  return <RotateCw aria-hidden="true" size={size} strokeWidth={strokeWidth} className={`shrink-0 motion-reduce:animate-none ${className}`} {...props} />
}
