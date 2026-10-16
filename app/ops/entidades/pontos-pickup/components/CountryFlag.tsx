type CountryFlagProps = {
  country: "PT" | "ES"
  className?: string
}

export function CountryFlag({ country, className = "" }: CountryFlagProps) {
  return (
    <svg
      aria-label={country === "PT" ? "Portugal" : "Espanha"}
      role="img"
      viewBox="0 0 30 20"
      className={`h-3.5 w-5 shrink-0 overflow-hidden rounded-[3px] border border-black/10 shadow-sm ${className}`}
    >
      {country === "PT" ? (
        <>
          <rect width="12" height="20" fill="#176B45" />
          <rect x="12" width="18" height="20" fill="#C8483D" />
          <circle cx="12" cy="10" r="3.4" fill="#E5B84D" stroke="#F8F3E6" strokeWidth="0.8" />
          <circle cx="12" cy="10" r="1.5" fill="#C8483D" />
        </>
      ) : (
        <>
          <rect width="30" height="5" fill="#AA3535" />
          <rect y="5" width="30" height="10" fill="#E0B849" />
          <rect y="15" width="30" height="5" fill="#AA3535" />
        </>
      )}
    </svg>
  )
}
