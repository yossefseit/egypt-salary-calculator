import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getUsdEgpRate } from './exchangeRate'

const reference = { base: 'USD', quote: 'EGP', rate: 51.115, date: '2026-09-09' }
const fetchMock = vi.fn()

function respond(data: unknown = reference) {
  fetchMock.mockResolvedValue({ ok: true, json: async () => data })
}

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', '')
  vi.stubGlobal('fetch', fetchMock)
  respond()
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('USD/EGP reference-rate client', () => {
  it('uses the public browser endpoint without salary data, cookies or an API key', async () => {
    await expect(getUsdEgpRate()).resolves.toEqual({
      baseCurrency: 'USD', quoteCurrency: 'EGP', rate: 51.115, date: '2026-09-09',
      source: 'Frankfurter blended reference rate',
    })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      'https://api.frankfurter.dev/v2/rate/USD/EGP',
      { headers: { Accept: 'application/json' }, credentials: 'omit', signal: expect.any(AbortSignal) },
    )
  })

  it('preserves an explicit Function origin and its response contract', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ' https://rates.example.test/// ')
    const data = {
      baseCurrency: 'USD', quoteCurrency: 'EGP', rate: 51, date: '2026-09-08',
      source: 'Configured reference provider',
    }
    respond(data)
    await expect(getUsdEgpRate()).resolves.toEqual(data)
    expect(fetchMock.mock.calls[0][0]).toBe('https://rates.example.test/api/GetUsdEgpRate')
  })

  it.each([
    ['wrong base currency', { ...reference, base: 'EUR' }],
    ['wrong quote currency', { ...reference, quote: 'GBP' }],
    ['zero rate', { ...reference, rate: 0 }],
    ['negative rate', { ...reference, rate: -1 }],
    ['infinite rate', { ...reference, rate: Infinity }],
    ['NaN rate', { ...reference, rate: NaN }],
    ['string rate', { ...reference, rate: '51.115' }],
    ['missing date', { ...reference, date: undefined }],
    ['non-ISO date', { ...reference, date: 'September 9, 2026' }],
    ['impossible date', { ...reference, date: '2026-02-30' }],
    ['non-object response', null],
  ])('rejects %s', async (_label, data) => {
    respond(data)
    await expect(getUsdEgpRate()).rejects.toThrow('invalid data')
  })

  it('rejects invalid currency data from the optional Function too', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://rates.example.test')
    respond({ baseCurrency: 'USD', quoteCurrency: 'EUR', rate: 51, date: '2026-09-09', source: 'Reference' })
    await expect(getUsdEgpRate()).rejects.toThrow('invalid data')
  })

  it('rejects unsuccessful HTTP responses', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 })
    await expect(getUsdEgpRate()).rejects.toThrow('HTTP 503')
  })

  it('propagates network errors for the recoverable unavailable UI', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(getUsdEgpRate()).rejects.toThrow('Failed to fetch')
  })

  it('rejects malformed JSON', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON') } })
    await expect(getUsdEgpRate()).rejects.toThrow('Invalid JSON')
  })

  it('aborts a pending request after eight seconds', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(options.signal?.reason))
    }))
    const pending = expect(getUsdEgpRate()).rejects.toMatchObject({ name: 'TimeoutError' })
    await vi.advanceTimersByTimeAsync(8_000)
    await pending
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels an in-flight request when the caller aborts', async () => {
    const controller = new AbortController()
    fetchMock.mockImplementation((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(options.signal?.reason))
    }))
    const pending = expect(getUsdEgpRate(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await pending
  })

  it('does not fetch for an already-aborted caller', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(getUsdEgpRate(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('clears the timeout after success', async () => {
    vi.useFakeTimers()
    await getUsdEgpRate()
    expect(vi.getTimerCount()).toBe(0)
  })
})
