export interface UsdEgpRate {
  readonly baseCurrency: 'USD'
  readonly quoteCurrency: 'EGP'
  readonly rate: number
  readonly date: string
  readonly source: string
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

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
    typeof candidate.date === 'string' &&
    candidate.date.length > 0 &&
    typeof candidate.source === 'string' &&
    candidate.source.length > 0
  )
}

export async function getUsdEgpRate(
  signal?: AbortSignal,
): Promise<UsdEgpRate> {
  const response = await fetch(`${apiBaseUrl}/api/GetUsdEgpRate`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw new Error(`Exchange-rate API returned HTTP ${response.status}.`)
  }

  const data: unknown = await response.json()

  if (!isUsdEgpRate(data)) {
    throw new Error('Exchange-rate API returned invalid data.')
  }

  return data
}
