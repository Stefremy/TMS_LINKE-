"use client"

import * as React from "react"

export function StoreAvatar({ name, logoUrl }: {
  name: string
  logoUrl?: string | null
  color?: string | null
}) {
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null)
  const source = logoUrl?.trim()
  const showLogo = source && source !== failedUrl

  return (
    <span
      aria-hidden="true"
      className="w-10 h-10 shrink-0 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-bg)] flex items-center justify-center "
    >
      {showLogo ? (
        // Uploaded store avatars may be embedded data URLs or use tenant-specific hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source} alt="" loading="lazy" decoding="async" width={40} height={40}
          className="w-full h-full object-contain bg-white"
          onError={() => setFailedUrl(source)} />
      ) : (
        <span className="text-xs font-bold uppercase text-[var(--text-primary)]">
          {name.trim().slice(0, 2).toLocaleUpperCase("pt-PT") || "—"}
        </span>
      )}
    </span>
  )
}
