import * as React from "react"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'purple'
}

export function Badge({ className = '', variant = 'default', children, ...props }: BadgeProps) {
  let variantStyles = ''
  
  switch (variant) {
    case 'success':
      variantStyles = 'bg-emerald-50 text-emerald-800 border-emerald-200/80 font-medium'
      break
    case 'warning':
      variantStyles = 'bg-amber-50 text-amber-900 border-amber-200/80 font-medium'
      break
    case 'info':
      variantStyles = 'bg-blue-50 text-blue-900 border-blue-200/80 font-medium'
      break
    case 'purple':
      variantStyles = 'bg-violet-50 text-violet-900 border-violet-200/80 font-medium'
      break
    case 'danger':
      variantStyles = 'bg-rose-50 text-rose-900 border-rose-200/80 font-medium'
      break
    case 'neutral':
      variantStyles = 'bg-slate-100 text-slate-700 border-slate-200 font-medium'
      break
    case 'default':
    default:
      variantStyles = 'bg-slate-100 text-slate-800 border-slate-200 font-medium'
      break
  }

  return (
    <div
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] border shadow-2xs transition-colors ${variantStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
