import * as React from "react"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', ...props }, ref) => {
    let variantStyles = ''
    switch (variant) {
      case 'primary':
        variantStyles = 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm border border-transparent'
        break
      case 'secondary':
        variantStyles = 'bg-slate-100 text-slate-900 hover:bg-slate-200 border border-transparent'
        break
      case 'outline':
        variantStyles = 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
        break
      case 'ghost':
        variantStyles = 'bg-transparent text-slate-700 hover:bg-slate-100 border border-transparent'
        break
      case 'danger':
        variantStyles = 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm border border-transparent'
        break
    }

    let sizeStyles = ''
    switch (size) {
      case 'sm':
        sizeStyles = 'px-3 py-1.5 text-xs'
        break
      case 'md':
        sizeStyles = 'px-4 py-2 text-sm'
        break
      case 'lg':
        sizeStyles = 'px-6 py-3 text-base'
        break
      case 'icon':
        sizeStyles = 'p-2'
        break
    }

    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-md ${variantStyles} ${sizeStyles} ${className}`}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
