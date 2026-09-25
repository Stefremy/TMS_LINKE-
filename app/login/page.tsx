import Image from 'next/image'
import { login } from './actions'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--canvas-bg)] p-4">
      <div className="max-w-sm w-full bg-[var(--surface-bg)] rounded-lg border border-[var(--border-subtle)] p-8" style={{ boxShadow: 'var(--shadow-layer)' }}>
        <div className="text-center mb-8">
          <Image src="/Linke-logo.png" alt="Linke Logistics" width={120} height={36} className="object-contain mx-auto mb-4" priority />
          <p className="text-[var(--text-tertiary)] text-sm">Aceda à sua conta</p>
        </div>

        <form className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider" htmlFor="email">
              Email
            </label>
            <input
              className="w-full px-3 py-2 bg-[var(--surface-bg)] border border-[var(--border-strong)] rounded-md text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-active)] focus:ring-1 focus:ring-[var(--accent-active)] transition-colors"
              id="email"
              name="email"
              type="email"
              required
              placeholder="email@empresa.pt"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider" htmlFor="password">
              Password
            </label>
            <input
              className="w-full px-3 py-2 bg-[var(--surface-bg)] border border-[var(--border-strong)] rounded-md text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-active)] focus:ring-1 focus:ring-[var(--accent-active)] transition-colors"
              id="password"
              name="password"
              type="password"
              required
            />
          </div>

          <button
            formAction={login}
            className="w-full flex justify-center py-2.5 px-4 rounded-md text-sm font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-active)] focus:ring-offset-1 transition-colors"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  )
}
