import * as React from "react"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'neutral' | 'info'
}

export function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  let variantStyles = ''
  
  switch (variant) {
    case 'success':
      variantStyles = 'bg-green-100 text-green-700 border-transparent'
      break
    case 'warning':
      variantStyles = 'bg-orange-100 text-orange-700 border-transparent'
      break
    case 'info':
      variantStyles = 'bg-blue-100 text-blue-700 border-transparent'
      break
    case 'danger':
      variantStyles = 'bg-rose-100 text-rose-700 border-transparent'
      break
    case 'neutral':
      variantStyles = 'bg-slate-100 text-slate-700 border-transparent'
      break
    case 'default':
    default:
      variantStyles = 'bg-slate-100 text-slate-800 border-transparent'
      break
  }

  return (
    <div
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${variantStyles} ${className}`}
      {...props}
    />
  )
}
