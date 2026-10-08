import { NextRequest, NextResponse } from "next/server"
import YahooFinance from "yahoo-finance2"

export const runtime = "nodejs"

// In-memory cache for 60 seconds to avoid spamming Yahoo Finance
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL_MS = 60 * 1000

const DEFAULT_SYMBOLS = [
  "^GSPC",   // S&P 500
  "^IXIC",   // NASDAQ
  "^DJI",    // Dow Jones
  "NVDA",    // Nvidia
  "AAPL",    // Apple
  "TSLA",    // Tesla
  "MSFT",    // Microsoft
  "BTC-USD", // Bitcoin
  "CTT.LS",  // CTT Portugal
]

const SYMBOL_LABELS: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^IXIC": "NASDAQ",
  "^DJI": "DOW JONES",
  "NVDA": "NVDA",
  "AAPL": "AAPL",
  "TSLA": "TSLA",
  "MSFT": "MSFT",
  "BTC-USD": "BITCOIN",
  "CTT.LS": "CTT",
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const customSymbols = searchParams.get("symbols")
    
    const requestedSymbols = customSymbols 
      ? Array.from(new Set([...customSymbols.split(",").map(s => s.trim().toUpperCase()).filter(Boolean)]))
      : DEFAULT_SYMBOLS

    const cacheKey = requestedSymbols.sort().join(",")
    const cached = cache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return NextResponse.json(cached.data, {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" }
      })
    }

    const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] })

    const quotes = await Promise.all(
      requestedSymbols.map(async (symbol) => {
        try {
          const q: any = await yf.quote(symbol)
          if (!q || (!q.regularMarketPrice && q.regularMarketPrice !== 0)) return null

          const label = SYMBOL_LABELS[symbol] || q.shortName || symbol
          const changePercent = typeof q.regularMarketChangePercent === "number" 
            ? Number(q.regularMarketChangePercent.toFixed(2)) 
            : 0

          return {
            symbol: q.symbol,
            label,
            price: q.regularMarketPrice,
            changePercent,
            currency: q.currency || "USD",
          }
        } catch (err: any) {
          console.warn(`[market-data] Failed to quote ${symbol}:`, err?.message || err)
          return null
        }
      })
    )

    const validQuotes = quotes.filter(Boolean)

    // Save to cache
    const responseData = {
      quotes: validQuotes,
      updatedAt: new Date().toISOString()
    }
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() })

    return NextResponse.json(responseData, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" }
    })
  } catch (error: any) {
    console.error("[market-data] API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch stock market data", quotes: [] },
      { status: 500 }
    )
  }
}
