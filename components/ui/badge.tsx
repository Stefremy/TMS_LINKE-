import * as React from "react"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'purple'
}

export function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  let variantStyles = ''
  
  switch (variant) {
    case 'success':
      variantStyles = 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
      break
    case 'warning':
      variantStyles = 'bg-amber-50 text-amber-700 border-amber-200/80'
      break
    case 'info':
      variantStyles = 'bg-blue-50 text-blue-700 border-blue-200/80'
      break
    case 'purple':
      variantStyles = 'bg-purple-50 text-purple-700 border-purple-200/80'
      break
    case 'danger':
      variantStyles = 'bg-rose-50 text-rose-700 border-rose-200/80'
      break
    case 'neutral':
      variantStyles = 'bg-slate-100 text-slate-700 border-slate-200'
      break
    case 'default':
    default:
      variantStyles = 'bg-slate-100 text-slate-800 border-slate-200'
      break
  }

  return (
    <div
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${variantStyles} ${className}`}
      {...props}
    />
  )
}
