export interface UsdEgpRate {
  readonly baseCurrency: 'USD'
  readonly quoteCurrency: 'EGP'
  readonly rate: number
  readonly date: string
  readonly source: string
}

const REFERENCE_RATE_URL = 'https://api.frankfurter.dev/v2/rate/USD/EGP'
const REQUEST_TIMEOUT_MS = 8_000

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const timestamp = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}

function isUsdEgpRate(value: unknown): value is UsdEgpRate {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    candidate.baseCurrency === 'USD' &&
    candidate.quoteCurrency === 'EGP' &&
    typeof candidate.rate === 'number' &&
    Number.isFinite(candidate.rate) &&
    candidate.rate > 0 &&
    isIsoDate(candidate.date) &&
    typeof candidate.source === 'string' &&
    candidate.source.trim().length > 0
  )
}

export async function getUsdEgpRate(signal?: AbortSignal): Promise<UsdEgpRate> {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
  const usesFunction = apiBaseUrl.length > 0
  const url = usesFunction ? `${apiBaseUrl}/api/GetUsdEgpRate` : REFERENCE_RATE_URL
  const controller = new AbortController()
  const abortRequest = () => controller.abort(signal?.reason)

  if (signal?.aborted) {
    abortRequest()
  } else {
    signal?.addEventListener('abort', abortRequest, { once: true })
  }

  const timeout = setTimeout(() => {
    controller.abort(new DOMException('Exchange-rate request timed out.', 'TimeoutError'))
  }, REQUEST_TIMEOUT_MS)

  try {
    controller.signal.throwIfAborted()
    // This fixed GET contains no salary input, cookies, API key or request body.
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Exchange-rate API returned HTTP ${response.status}.`)
    }

    const data: unknown = await response.json()
    controller.signal.throwIfAborted()
    const rate = !usesFunction && typeof data === 'object' && data !== null
      ? {
          baseCurrency: (data as Record<string, unknown>).base,
          quoteCurrency: (data as Record<string, unknown>).quote,
          rate: (data as Record<string, unknown>).rate,
          date: (data as Record<string, unknown>).date,
          source: 'Frankfurter blended reference rate',
        }
      : data

    if (!isUsdEgpRate(rate)) {
      throw new Error('Exchange-rate API returned invalid data.')
    }

    return rate
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abortRequest)
  }
}
