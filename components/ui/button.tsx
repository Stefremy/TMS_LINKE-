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
        variantStyles = 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] border border-transparent'
        break
      case 'secondary':
        variantStyles = 'bg-[var(--surface-muted)] text-[var(--text-primary)] hover:bg-[var(--surface-dim)] border border-transparent'
        break
      case 'outline':
        variantStyles = 'bg-[var(--surface-bg)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)] border border-[var(--border-strong)]'
        break
      case 'ghost':
        variantStyles = 'bg-transparent text-[var(--text-secondary)] hover:bg-[rgba(20,23,20,0.04)] hover:text-[var(--text-primary)] border border-transparent'
        break
      case 'danger':
        variantStyles = 'bg-[var(--status-critical)] text-white hover:bg-red-700 border border-transparent'
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
        sizeStyles = 'px-5 py-2.5 text-sm'
        break
      case 'icon':
        sizeStyles = 'p-2'
        break
    }

    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-active)] focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none rounded-md ${variantStyles} ${sizeStyles} ${className}`}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
