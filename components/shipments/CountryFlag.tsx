/**
 * Small country flag drawn as SVG. Flag emojis (🇵🇹) are not rendered on Windows, where they show
 * up as plain letters, so the lists use this instead to look the same on every computer.
 */
export function CountryFlag({ code, className = "" }: { code?: string | null; className?: string }) {
  const isPT = (code || "PT").toUpperCase() === "PT"
  return (
    <svg
      viewBox="0 0 15 10"
      width="14"
      height="10"
      role="img"
      aria-label={isPT ? "Portugal" : "Espanha"}
      className={`inline-block shrink-0 rounded-[1.5px] align-[-1px] ring-1 ring-black/10 ${className}`}
    >
      {isPT ? (
        <>
          <rect width="6" height="10" fill="#046a38" />
          <rect x="6" width="9" height="10" fill="#da291c" />
          <circle cx="6" cy="5" r="2" fill="#ffe900" />
          <circle cx="6" cy="5" r="1.2" fill="#da291c" />
          <rect x="5.45" y="4.2" width="1.1" height="1.5" rx="0.3" fill="#fff" />
        </>
      ) : (
        <>
          <rect width="15" height="10" fill="#aa151b" />
          <rect y="2.5" width="15" height="5" fill="#f1bf00" />
        </>
      )}
    </svg>
  )
}
