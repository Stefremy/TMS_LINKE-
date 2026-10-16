type NominatimResult = {
  place_id: number
  name?: string
  display_name: string
  lat: string
  lon: string
  address?: Record<string, string>
}

let lastSearchAt = 0

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() || ""
  if (query.length < 2 || query.length > 100) {
    return Response.json({ locations: [] })
  }

  if (Date.now() - lastSearchAt < 1000) {
    return Response.json({ error: "Aguarda um instante antes de pesquisar novamente." }, { status: 429 })
  }
  lastSearchAt = Date.now()

  try {
    const geocodingService = process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org"
    const url = new URL("/search", geocodingService)
    url.searchParams.set("q", query)
    url.searchParams.set("format", "jsonv2")
    url.searchParams.set("addressdetails", "1")
    url.searchParams.set("limit", "5")

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.7",
        "User-Agent": "TMS LINKE/2.8 (https://ops.toke.pt)",
      },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) return Response.json({ locations: [] }, { status: 502 })

    const data = await response.json()
    const locations = (Array.isArray(data) ? data : [])
      .filter((place: NominatimResult) =>
        typeof place.display_name === "string" &&
        Number.isFinite(Number(place.lat)) &&
        Number.isFinite(Number(place.lon))
      )
      .map((place: NominatimResult) => {
        const address = place.address || {}
        const name = place.name || address.city || address.town || address.village || address.municipality || address.county || place.display_name.split(",")[0]
        return {
          id: place.place_id,
          name,
          admin1: address.state || address.county || "",
          country: address.country || "",
          countryCode: address.country_code?.toUpperCase() || "",
          latitude: Number(place.lat),
          longitude: Number(place.lon),
        }
      })

    return Response.json(
      { locations },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    )
  } catch {
    return Response.json({ locations: [] }, { status: 502 })
  }
}
