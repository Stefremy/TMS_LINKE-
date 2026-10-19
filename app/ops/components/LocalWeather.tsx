"use client"

import { useEffect, useState, type FormEvent } from "react"
import { ChevronDown, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, MapPin, Moon, Search, Sun, Thermometer, X } from "lucide-react"
import styles from "./LocalWeather.module.css"

type WeatherLocation = {
  id?: number
  name: string
  admin1: string
  country: string
  countryCode: string
  latitude: number
  longitude: number
}

type ForecastHour = { time: string; temperature: number; symbolCode: string }

type LocalWeatherData = {
  location: string
  temperature: number
  symbolCode: string
  observedAt: string
  nextHours: ForecastHour[]
}

const DEFAULT_LOCATION: WeatherLocation = {
  name: "Felgueiras",
  admin1: "Porto",
  country: "Portugal",
  countryCode: "PT",
  latitude: 41.367,
  longitude: -8.199,
}
const LOCATION_STORAGE_KEY = "tms_ops_weather_location"
const WEATHER_REFRESH_MS = 15 * 60 * 1000

function getWeatherDescription(code: string) {
  const night = code.endsWith("_night")
  if (code.includes("thunder")) return { label: "Trovoada", Icon: CloudLightning, kind: "storm", night }
  if (code.includes("snow") || code.includes("sleet")) return { label: "Neve", Icon: CloudSnow, kind: "snow", night }
  if (code.includes("rain") || code.includes("shower")) return { label: "Chuva", Icon: CloudRain, kind: "rain", night }
  if (code.startsWith("fog")) return { label: "Nevoeiro", Icon: CloudFog, kind: "fog", night }
  if (code.startsWith("cloudy")) return { label: "Nublado", Icon: Cloud, kind: "cloudy", night }
  if (code.startsWith("fair") || code.startsWith("partlycloudy")) return { label: code.startsWith("fair") ? "Pouco nublado" : "Parcialmente nublado", Icon: night ? Moon : CloudSun, kind: "partial", night }
  if (code.startsWith("clearsky")) return { label: "Céu limpo", Icon: night ? Moon : Sun, kind: "clear", night }
  return { label: "Condições atuais", Icon: Thermometer, kind: "unknown", night }
}

function WeatherScene({ kind, night }: { kind: string; night: boolean }) {
  const clouds = ["cloudy", "partial", "rain", "snow", "storm", "fog"].includes(kind)
  return <svg className={styles.scene} viewBox="0 0 112 82" fill="none" aria-hidden="true" focusable="false">
    {(kind === "clear" || kind === "partial") && (night
      ? <g><path d="M70 10a20 20 0 1 0 25 26A21 21 0 0 1 70 10Z" fill="#f4e5b7" /><circle cx="42" cy="16" r="1.5" fill="white" /><circle cx="101" cy="12" r="1" fill="white" /></g>
      : <g className={styles.sun}><circle cx="72" cy="29" r="14" fill="#efb940" /><path d="M72 6v-3m0 52v-3M49 29h-3m52 0h-3M56 13l-3-3m38 38-3-3M56 45l-3 3m38-38-3 3" stroke="#e5a72a" strokeWidth="2.5" strokeLinecap="round" /></g>)}
    {clouds && <g className={styles.cloud}><path d="M30 44a10 10 0 0 1 1-20 15 15 0 0 1 28-3 11 11 0 1 1 8 23Z" fill="#adbfcf" opacity=".7" /><path d="M39 52a13 13 0 0 1-2-26 18 18 0 0 1 34 0 13 13 0 1 1 7 26Z" fill="#f3f6f8" stroke="#d8e1e8" strokeWidth="1" /></g>}
    {(kind === "rain" || kind === "storm") && <g className={styles.rain} stroke="#76b7e0" strokeWidth="2.5" strokeLinecap="round">{[35, 47, 59, 71, 83].map((x, i) => <path key={x} d={`M${x} 58l-3 7`} style={{ animationDelay: `${i * -0.23}s` }} />)}</g>}
    {kind === "snow" && <g className={styles.snow} fill="#fff">{[36, 49, 62, 76].map((x, i) => <circle key={x} cx={x} cy="62" r="2" style={{ animationDelay: `${i * -0.6}s` }} />)}</g>}
    {kind === "storm" && <path d="m64 43-9 16h8l-4 13 17-21h-10l5-8Z" fill="#edbd4c" stroke="#b3821e" strokeWidth=".7" />}
    {kind === "fog" && <g className={styles.fog} stroke="#d8e2e9" strokeWidth="3" strokeLinecap="round"><path d="M24 60h58m-49 8h61M22 76h48" /></g>}
    {kind === "unknown" && <Thermometer x={40} y={24} width={32} height={32} strokeWidth={1.5} />}
  </svg>
}

function isWeatherLocation(value: unknown): value is WeatherLocation {
  if (!value || typeof value !== "object") return false
  const location = value as Partial<WeatherLocation>
  return typeof location.name === "string" &&
    typeof location.latitude === "number" && Number.isFinite(location.latitude) &&
    typeof location.longitude === "number" && Number.isFinite(location.longitude) &&
    location.latitude >= -90 && location.latitude <= 90 &&
    location.longitude >= -180 && location.longitude <= 180
}

export function LocalWeather() {
  const [location, setLocation] = useState<WeatherLocation>(DEFAULT_LOCATION)
  const [weather, setWeather] = useState<LocalWeatherData | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<WeatherLocation[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchComplete, setSearchComplete] = useState(false)
  const [searchMessage, setSearchMessage] = useState("")

  useEffect(() => {
    const savedLocation = window.localStorage.getItem(LOCATION_STORAGE_KEY)
    if (!savedLocation) return

    try {
      const parsed: unknown = JSON.parse(savedLocation)
      if (isWeatherLocation(parsed)) {
        window.setTimeout(() => setLocation(parsed), 0)
      }
    } catch {
      window.localStorage.removeItem(LOCATION_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    let active = true
    const loadWeather = async () => {
      const params = new URLSearchParams({
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        location: location.name,
      })

      try {
        const response = await fetch(`/api/weather/local?${params}`, { cache: "no-store" })
        if (!response.ok) return
        const data = (await response.json()) as LocalWeatherData
        if (active && Number.isFinite(data.temperature) && typeof data.symbolCode === "string") {
          setWeather(data)
        }
      } catch {
        // Keep the dashboard usable when the weather service is unavailable.
      }
    }

    void loadWeather()
    const interval = window.setInterval(loadWeather, WEATHER_REFRESH_MS)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [location])

  const condition = weather ? getWeatherDescription(weather.symbolCode) : null
  const WeatherIcon = condition?.Icon || Thermometer
  const sky = { "data-weather": condition?.kind || "unknown", "data-night": condition?.night || false }

  const chooseLocation = (nextLocation: WeatherLocation) => {
    setLocation(nextLocation)
    window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(nextLocation))
    setQuery("")
    setResults([])
    setSearchComplete(false)
    setSearchMessage("")
    setIsOpen(false)
  }

  const searchLocations = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedQuery = query.trim()
    if (normalizedQuery.length < 2 || isSearching) return

    setIsSearching(true)
    setSearchComplete(false)
    setSearchMessage("")
    try {
      const response = await fetch(`/api/weather/locations?q=${encodeURIComponent(normalizedQuery)}`)
      const data = await response.json()
      if (!response.ok) {
        setResults([])
        setSearchMessage(response.status === 429 ? "Aguarda um segundo antes de pesquisar novamente." : "A pesquisa está temporariamente indisponível.")
      } else {
        setResults(Array.isArray(data.locations) ? data.locations : [])
      }
    } catch {
      setResults([])
      setSearchMessage("A pesquisa está temporariamente indisponível.")
    } finally {
      setIsSearching(false)
      setSearchComplete(true)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={weather ? `${weather.location}: ${Math.round(weather.temperature)} graus, ${condition?.label}. Ver previsão e mudar localidade.` : "Ver previsão e mudar localidade"}
        onClick={() => setIsOpen((open) => !open)}
        className={styles.weatherButton}
        {...sky}
      >
        <WeatherScene kind={condition?.kind || "unknown"} night={condition?.night || false} />
        <span className={styles.reading}>
          <span className={styles.temperature}>
            {weather ? `${Math.round(weather.temperature)}°C` : "--°C"}
          </span>
          <span className={styles.location}>{weather?.location || location.name}</span>
          <span className={styles.condition}>{condition?.label || "A obter tempo…"}</span>
        </span>
        <ChevronDown className={`${styles.chevron} ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[min(360px,calc(100vw-2rem))] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 shadow-lg">
          <div className={styles.forecastHeader} {...sky}>
            <WeatherScene kind={condition?.kind || "unknown"} night={condition?.night || false} />
            <div className="relative flex items-center gap-2.5">
              <WeatherIcon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
              <div>
                <div className="text-sm font-semibold">{weather?.location || location.name}</div>
                <div className="mt-1 text-xs">
                  {weather ? `${condition?.label} · ${Math.round(weather.temperature)}°C agora` : "A carregar condições atuais…"}
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Fechar previsão" className="relative rounded p-1 hover:bg-white/15">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
            <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Próximas horas <span className="font-normal text-[var(--text-tertiary)]">· hora local deste dispositivo</span></div>
            {weather?.nextHours.length ? (
              <div className="grid grid-cols-6 gap-1">
                {weather.nextHours.map((hour) => {
                  const forecast = getWeatherDescription(hour.symbolCode)
                  const ForecastIcon = forecast.Icon
                  return (
                    <div key={hour.time} className="flex flex-col items-center gap-1 rounded-md bg-[var(--surface-muted)]/60 px-1 py-2 text-center">
                      <span className="text-[10px] tabular-nums text-[var(--text-tertiary)]">{new Date(hour.time).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</span>
                      <ForecastIcon className={`${styles.forecastIcon} h-3.5 w-3.5`} data-weather={forecast.kind} data-night={forecast.night} strokeWidth={1.75} aria-hidden="true" />
                      <span className="text-xs font-medium tabular-nums text-[var(--text-primary)]">{Math.round(hour.temperature)}°</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-tertiary)]">Previsão horária indisponível de momento.</p>
            )}
          </div>

          <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
            <label htmlFor="weather-location-search" className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">Mudar localidade</label>
            <form onSubmit={searchLocations} className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] px-2.5 focus-within:border-[var(--border-strong)]">
              <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" aria-hidden="true" />
              <input
                id="weather-location-search"
                value={query}
                onChange={(event) => {
                  const value = event.target.value
                  setQuery(value)
                  if (value.trim().length < 2) {
                    setResults([])
                    setSearchComplete(false)
                    setSearchMessage("")
                  }
                }}
                placeholder="Pesquisar cidade ou código postal"
                autoComplete="off"
                className="h-9 min-w-0 flex-1 bg-transparent text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
              />
              <button type="submit" disabled={isSearching || query.trim().length < 2} className="rounded px-2 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:text-[var(--text-tertiary)]">
                Procurar
              </button>
            </form>

            {(isSearching || results.length > 0 || searchMessage || (searchComplete && query.trim().length >= 2)) && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-[var(--border-subtle)]">
                {isSearching ? (
                  <div className="px-3 py-2 text-xs text-[var(--text-tertiary)]">A procurar localidades…</div>
                ) : searchMessage ? (
                  <div className="px-3 py-2 text-xs text-[var(--text-tertiary)]">{searchMessage}</div>
                ) : results.length ? (
                  results.map((result) => (
                    <button
                      key={`${result.id}-${result.latitude}-${result.longitude}`}
                      type="button"
                      onClick={() => chooseLocation(result)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-[var(--surface-muted)]"
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.75} aria-hidden="true" />
                      <span>
                        <span className="block text-xs font-medium text-[var(--text-primary)]">{result.name}</span>
                        <span className="block text-[10px] text-[var(--text-tertiary)]">{[result.admin1, result.country].filter(Boolean).join(", ")}</span>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-[var(--text-tertiary)]">Não encontrei essa localidade.</div>
                )}
              </div>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-tertiary)]">
              A escolha fica guardada neste browser. Previsão: <a href="https://www.met.no/en" target="_blank" rel="noreferrer" className="underline underline-offset-2">MET Norway</a> · localidades: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline underline-offset-2">OpenStreetMap</a>. Temperaturas em °C, arredondadas · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="underline underline-offset-2">CC BY 4.0</a>.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
