import * as React from "react"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'purple'
}

export function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  let variantStyles = ''
  
  switch (variant) {
    case 'success':
      variantStyles = 'bg-[var(--status-success-soft)] text-[var(--status-success)] border-[rgba(18,138,71,0.2)]'
      break
    case 'warning':
      variantStyles = 'bg-[var(--status-warning-soft)] text-[var(--status-warning)] border-[rgba(217,119,6,0.2)]'
      break
    case 'info':
      variantStyles = 'bg-[var(--status-info-soft)] text-[var(--status-info)] border-[rgba(37,99,235,0.2)]'
      break
    case 'purple':
      variantStyles = 'bg-purple-50 text-purple-700 border-purple-200/80'
      break
    case 'danger':
      variantStyles = 'bg-[var(--status-critical-soft)] text-[var(--status-critical)] border-[rgba(220,38,38,0.2)]'
      break
    case 'neutral':
      variantStyles = 'bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
      break
    case 'default':
    default:
      variantStyles = 'bg-[var(--surface-muted)] text-[var(--text-primary)] border-[var(--border-subtle)]'
      break
  }

  return (
    <div
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border tracking-wide ${variantStyles} ${className}`}
      {...props}
    />
  )
}
