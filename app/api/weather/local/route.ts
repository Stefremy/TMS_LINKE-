const DEFAULT_LOCATION = {
  name: "Felgueiras",
  latitude: 41.367,
  longitude: -8.199,
}
const MET_WEATHER_USER_AGENT = "TMS LINKE/2.8 (https://ops.toke.pt)"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const latitudeParam = searchParams.get("latitude")
  const longitudeParam = searchParams.get("longitude")
  const locationParam = searchParams.get("location")?.trim()
  const latitude = latitudeParam === null ? DEFAULT_LOCATION.latitude : Number(latitudeParam)
  const longitude = longitudeParam === null ? DEFAULT_LOCATION.longitude : Number(longitudeParam)

  if (
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 ||
    (latitudeParam === null) !== (longitudeParam === null)
  ) {
    return Response.json({ error: "Localidade inválida." }, { status: 400 })
  }

  const url = new URL("https://api.met.no/weatherapi/locationforecast/2.0/compact")
  url.searchParams.set("lat", latitude.toFixed(4))
  url.searchParams.set("lon", longitude.toFixed(4))

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/geo+json",
        "User-Agent": MET_WEATHER_USER_AGENT,
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      return Response.json({ error: "Não foi possível obter a previsão." }, { status: 502 })
    }

    const data = await response.json()
    const timeseries = data?.properties?.timeseries
    if (!Array.isArray(timeseries) || timeseries.length === 0) {
      return Response.json({ error: "A resposta meteorológica é inválida." }, { status: 502 })
    }

    const current = timeseries[0]
    const temperature = current?.data?.instant?.details?.air_temperature
    const symbolCode = current?.data?.next_1_hours?.summary?.symbol_code ||
      current?.data?.next_6_hours?.summary?.symbol_code || "cloudy"
    const observedAt = current?.time

    if (typeof temperature !== "number" || typeof observedAt !== "string") {
      return Response.json({ error: "A resposta meteorológica é inválida." }, { status: 502 })
    }

    const nextHours = timeseries
      .slice(1)
      .filter((entry: { time?: unknown; data?: unknown }) => {
        const time = entry?.time
        const nextData = entry?.data as { instant?: { details?: { air_temperature?: unknown } }; next_1_hours?: { summary?: { symbol_code?: unknown } }; next_6_hours?: { summary?: { symbol_code?: unknown } } } | undefined
        return typeof time === "string" &&
          typeof nextData?.instant?.details?.air_temperature === "number"
      })
      .slice(0, 6)
      .map((entry: { time: string; data: { instant: { details: { air_temperature: number } }; next_1_hours?: { summary?: { symbol_code?: string } }; next_6_hours?: { summary?: { symbol_code?: string } } } }) => ({
        time: entry.time,
        temperature: entry.data.instant.details.air_temperature,
        symbolCode: entry.data.next_1_hours?.summary?.symbol_code ||
          entry.data.next_6_hours?.summary?.symbol_code || "cloudy",
      }))

    return Response.json(
      {
        location: locationParam?.slice(0, 80) || DEFAULT_LOCATION.name,
        temperature,
        symbolCode,
        observedAt,
        nextHours,
      },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } },
    )
  } catch {
    return Response.json({ error: "Não foi possível obter a previsão." }, { status: 502 })
  }
}
