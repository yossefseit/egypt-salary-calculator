// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const THEME_STORAGE_KEY = 'egypt-salary-calculator-theme'

function stubSystemTheme(prefersDark: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' && prefersDark,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

beforeEach(() => {
  window.localStorage.clear()
  delete document.documentElement.dataset.theme
  stubSystemTheme(false)
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  delete document.documentElement.dataset.theme
  vi.restoreAllMocks()
})

describe('salary calculator UI', () => {
  it('shows the reference net for EGP 10,000 monthly gross', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByRole('textbox', { name: 'قيمة المرتب الإجمالي' }),
      '10000',
    )

    expect(screen.getByText('المرتب الصافي المحسوب')).toBeTruthy()
    expect(screen.getByTestId('highlight-value').textContent).toBe(
      'EGP 8,302.50',
    )
  })

  it('accepts plain and comma-formatted salary amounts', async () => {
    const user = userEvent.setup()
    render(<App />)

    const salaryInput = screen.getByRole('textbox', {
      name: 'قيمة المرتب الإجمالي',
    })

    await user.type(salaryInput, '347475')
    const expectedResult = screen.getByTestId('highlight-value').textContent

    await user.clear(salaryInput)
    await user.type(salaryInput, '347,475')
    expect(screen.getByTestId('highlight-value').textContent).toBe(
      expectedResult,
    )

    await user.clear(salaryInput)
    await user.type(salaryInput, '347,475.00')
    expect(screen.getByTestId('highlight-value').textContent).toBe(
      expectedResult,
    )
  })

  it('converts salary and manual insurance between monthly and yearly', async () => {
    const user = userEvent.setup()
    render(<App />)

    const salaryInput = screen.getByRole('textbox', {
      name: 'قيمة المرتب الإجمالي',
    }) as HTMLInputElement
    await user.type(salaryInput, '10000')
    await user.click(screen.getByRole('radio', { name: 'يدوي' }))

    const manualInsuranceInput = screen.getByRole('textbox', {
      name: 'قيمة التأمين الاجتماعي اليدوي',
    }) as HTMLInputElement
    await user.type(manualInsuranceInput, '1100')
    await user.click(screen.getByRole('radio', { name: 'سنوي' }))

    expect(salaryInput.value).toBe('120000')
    expect(manualInsuranceInput.value).toBe('13200')

    await user.click(screen.getByRole('radio', { name: 'شهري' }))

    expect(salaryInput.value).toBe('10000')
    expect(manualInsuranceInput.value).toBe('1100')
  })

  it('switches from gross-to-net to net-to-gross calculation', async () => {
    const user = userEvent.setup()
    render(<App />)

    const salaryInput = screen.getByRole('textbox', {
      name: 'قيمة المرتب الإجمالي',
    })
    await user.type(salaryInput, '8302.5')
    await user.click(
      screen.getByRole('radio', { name: 'من الصافي إلى الإجمالي' }),
    )

    expect(
      screen.getByRole('textbox', { name: 'قيمة المرتب الصافي' }),
    ).toBeTruthy()
    expect(screen.getByText('المرتب الإجمالي المحسوب')).toBeTruthy()
    expect((salaryInput as HTMLInputElement).value).toBe('8302.5')

    const highlightedGross = Number(
      screen
        .getByTestId('highlight-value')
        .textContent?.replace('EGP ', '')
        .replaceAll(',', ''),
    )
    expect(highlightedGross).toBeGreaterThan(8_302.5)
    expect(
      screen.getAllByText('EGP 8,302.50').some((element) =>
        element.closest('.summary-card'),
      ),
    ).toBe(true)
  })

  it('uses the system theme and persists an explicit selection', async () => {
    stubSystemTheme(true)
    const user = userEvent.setup()
    const firstRender = render(<App />)

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark')
    })
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'التبديل إلى الوضع الفاتح' }),
    )

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')

    firstRender.unmount()
    document.documentElement.dataset.theme = 'dark'
    render(<App />)

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('light')
    })
  })

  it('shows an Arabic validation error for a non-positive salary', async () => {
    const user = userEvent.setup()
    render(<App />)

    const salaryInput = screen.getByRole('textbox', {
      name: 'قيمة المرتب الإجمالي',
    })
    await user.type(salaryInput, '-100')

    expect(screen.getByRole('alert').textContent).toContain(
      'أدخل مرتبًا أكبر من صفر.',
    )

    await user.clear(salaryInput)

    expect(screen.getByRole('status').textContent).toContain(
      'أدخل قيمة المرتب لعرض النتيجة',
    )
  })

  it('rejects manual insurance that exhausts the net salary', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByRole('textbox', { name: 'قيمة المرتب الإجمالي' }),
      '1000',
    )
    await user.click(screen.getByRole('radio', { name: 'يدوي' }))
    await user.type(
      screen.getByRole('textbox', {
        name: 'قيمة التأمين الاجتماعي اليدوي',
      }),
      '999.5',
    )

    expect(screen.getByRole('alert').textContent).toContain(
      'قيمة التأمين اليدوي لا تسمح بحساب مرتب صافٍ موجب.',
    )
  })

  it('provides an accessible empty state before salary entry', () => {
    render(<App />)

    expect(screen.getByRole('status').textContent).toContain(
      'أدخل قيمة المرتب لعرض النتيجة',
    )
  })
})
