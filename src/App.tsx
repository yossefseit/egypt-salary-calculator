import { useEffect, useMemo, useState } from 'react'
import {
  calculateSalary,
  type CalculationDirection,
  type InsuranceSelection,
  type SalaryBreakdown,
  type SalaryCalculationResult,
  type SalaryPeriod,
} from './domain/salaryCalculator'
import './App.css'

type Theme = 'light' | 'dark'
type ValidationField = 'salary' | 'manual-insurance' | 'calculation'

type CalculationViewState =
  | { readonly status: 'empty' }
  | {
      readonly status: 'error'
      readonly field: ValidationField
      readonly message: string
    }
  | { readonly status: 'success'; readonly result: SalaryCalculationResult }

interface ToggleOption<T extends string> {
  readonly value: T
  readonly label: string
}

interface SegmentedControlProps<T extends string> {
  readonly legend: string
  readonly name: string
  readonly value: T
  readonly options: readonly ToggleOption<T>[]
  readonly onChange: (value: T) => void
}

interface SummaryCardProps {
  readonly title: string
  readonly breakdown: SalaryBreakdown
  readonly highlightedField: 'gross' | 'net'
  readonly insurableWage?: number
}

const THEME_STORAGE_KEY = 'egypt-salary-calculator-theme'

const directionOptions: readonly ToggleOption<CalculationDirection>[] = [
  { value: 'gross-to-net', label: 'من الإجمالي إلى الصافي' },
  { value: 'net-to-gross', label: 'من الصافي إلى الإجمالي' },
]

const periodOptions: readonly ToggleOption<SalaryPeriod>[] = [
  { value: 'monthly', label: 'شهري' },
  { value: 'yearly', label: 'سنوي' },
]

const insuranceOptions: readonly ToggleOption<InsuranceSelection['mode']>[] = [
  { value: 'automatic', label: 'تلقائي' },
  { value: 'manual', label: 'يدوي' },
]

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
})

function getInitialTheme(): Theme {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)

    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme
    }
  } catch {
    // A blocked localStorage should not prevent the calculator from working.
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function formatEgp(value: number): string {
  const normalizedValue = Object.is(value, -0) ? 0 : value

  return `EGP ${numberFormatter.format(normalizedValue)}`
}

function parseMoneyInput(value: string): number | null {
  const trimmedValue = value.trim()

  if (trimmedValue === '') {
    return null
  }

  const moneyPattern = /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?$/

  if (!moneyPattern.test(trimmedValue)) {
    return null
  }

  const numericValue = Number(trimmedValue.replaceAll(',', ''))

  return Number.isFinite(numericValue) ? numericValue : null
}

function convertPeriodValue(value: string, multiplier: number): string {
  if (value.trim() === '') {
    return value
  }

  const numericValue = parseMoneyInput(value)

  if (numericValue === null) {
    return value
  }

  const convertedValue = numericValue * multiplier

  if (!Number.isFinite(convertedValue)) {
    return value
  }

  return Number.parseFloat(convertedValue.toPrecision(15)).toString()
}

function getCalculationState(
  direction: CalculationDirection,
  period: SalaryPeriod,
  salaryInput: string,
  insuranceMode: InsuranceSelection['mode'],
  manualInsuranceInput: string,
): CalculationViewState {
  if (salaryInput.trim() === '') {
    return { status: 'empty' }
  }

  const salary = parseMoneyInput(salaryInput)

  if (salary === null) {
    return {
      status: 'error',
      field: 'salary',
      message: 'أدخل قيمة صحيحة للمرتب.',
    }
  }

  if (salary <= 0) {
    return {
      status: 'error',
      field: 'salary',
      message: 'أدخل مرتبًا أكبر من صفر.',
    }
  }

  let insurance: InsuranceSelection = { mode: 'automatic' }

  if (insuranceMode === 'manual') {
    if (manualInsuranceInput.trim() === '') {
      return {
        status: 'error',
        field: 'manual-insurance',
        message: 'أدخل قيمة التأمين الاجتماعي اليدوي.',
      }
    }

    const manualInsurance = parseMoneyInput(manualInsuranceInput)

    if (manualInsurance === null) {
      return {
        status: 'error',
        field: 'manual-insurance',
        message: 'أدخل قيمة صحيحة للتأمين الاجتماعي.',
      }
    }

    if (manualInsurance < 0) {
      return {
        status: 'error',
        field: 'manual-insurance',
        message: 'لا يمكن أن تكون قيمة التأمين سالبة.',
      }
    }

    insurance = { mode: 'manual', amount: manualInsurance }
  }

  try {
    return {
      status: 'success',
      result: calculateSalary({ direction, period, salary, insurance }),
    }
  } catch {
    return insuranceMode === 'manual'
      ? {
          status: 'error',
          field: 'manual-insurance',
          message: 'قيمة التأمين اليدوي لا تسمح بحساب مرتب صافٍ موجب.',
        }
      : {
          status: 'error',
          field: 'calculation',
          message: 'تعذر حساب المرتب بهذه القيمة. راجع البيانات وحاول مرة أخرى.',
        }
  }
}

function SegmentedControl<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <fieldset className="control-group">
      <legend>{legend}</legend>
      <div className="segmented-control">
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function SummaryCard({
  title,
  breakdown,
  highlightedField,
  insurableWage,
}: SummaryCardProps) {
  const rows: Array<{
    key: string
    label: string
    value: number
    highlighted?: boolean
  }> = [
    {
      key: 'gross',
      label: 'المرتب الإجمالي',
      value: breakdown.gross,
      highlighted: highlightedField === 'gross',
    },
    ...(insurableWage === undefined
      ? []
      : [
          {
            key: 'insurable-wage',
            label: 'الأجر التأميني',
            value: insurableWage,
          },
        ]),
    {
      key: 'insurance',
      label: 'تأمينات الموظف الاجتماعية',
      value: breakdown.insurance,
    },
    { key: 'tax', label: 'ضريبة الدخل', value: breakdown.incomeTax },
    {
      key: 'martyrs-fund',
      label: 'خصم صندوق تكريم الشهداء',
      value: breakdown.martyrsFundDeduction,
    },
    {
      key: 'net',
      label: 'المرتب الصافي',
      value: breakdown.net,
      highlighted: highlightedField === 'net',
    },
  ]

  return (
    <article className="summary-card">
      <h3>{title}</h3>
      <dl>
        {rows.map((row) => (
          <div
            className={
              row.highlighted
                ? 'summary-row summary-row--highlighted'
                : 'summary-row'
            }
            key={row.key}
          >
            <dt>{row.label}</dt>
            <dd lang="en" dir="ltr">
              {formatEgp(row.value)}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

function App() {
  const [direction, setDirection] =
    useState<CalculationDirection>('gross-to-net')
  const [period, setPeriod] = useState<SalaryPeriod>('monthly')
  const [salaryInput, setSalaryInput] = useState('')
  const [insuranceMode, setInsuranceMode] =
    useState<InsuranceSelection['mode']>('automatic')
  const [manualInsuranceInput, setManualInsuranceInput] = useState('')
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const calculationState = useMemo(
    () =>
      getCalculationState(
        direction,
        period,
        salaryInput,
        insuranceMode,
        manualInsuranceInput,
      ),
    [
      direction,
      period,
      salaryInput,
      insuranceMode,
      manualInsuranceInput,
    ],
  )

  const handlePeriodChange = (nextPeriod: SalaryPeriod) => {
    if (nextPeriod === period) {
      return
    }

    const multiplier = nextPeriod === 'yearly' ? 12 : 1 / 12
    setSalaryInput((currentValue) =>
      convertPeriodValue(currentValue, multiplier),
    )
    setManualInsuranceInput((currentValue) =>
      convertPeriodValue(currentValue, multiplier),
    )
    setPeriod(nextPeriod)
  }

  const handleThemeToggle = () => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === 'light' ? 'dark' : 'light'

      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
      } catch {
        // The selected theme still applies for this session if storage is blocked.
      }

      return nextTheme
    })
  }

  const salaryHasError =
    calculationState.status === 'error' &&
    calculationState.field === 'salary'
  const manualInsuranceHasError =
    calculationState.status === 'error' &&
    calculationState.field === 'manual-insurance'
  const salaryLabel =
    direction === 'gross-to-net'
      ? 'قيمة المرتب الإجمالي'
      : 'قيمة المرتب الصافي'

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-title">
          <h1>حاسبة المرتب في مصر</h1>
          <p lang="en" dir="ltr">
            Egypt Salary Calculator
          </p>
        </div>

        <button
          className="theme-toggle"
          type="button"
          aria-pressed={theme === 'dark'}
          aria-label={
            theme === 'dark'
              ? 'التبديل إلى الوضع الفاتح'
              : 'التبديل إلى الوضع الداكن'
          }
          onClick={handleThemeToggle}
        >
          <span className="theme-toggle__mark" aria-hidden="true" />
          <span>{theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
        </button>
      </header>

      <main>
        <div className="calculator-grid">
          <section className="panel input-panel" aria-labelledby="calculator-title">
            <div className="panel-heading">
              <p className="eyebrow">حساب فوري وخاص</p>
              <h2 id="calculator-title">بيانات المرتب</h2>
              <p>أدخل القيم التالية لعرض تقدير شهري وسنوي مباشرة.</p>
            </div>

            <form
              className="calculator-form"
              aria-label="بيانات حساب المرتب"
              onSubmit={(event) => event.preventDefault()}
            >
              <SegmentedControl
                legend="طريقة الحساب"
                name="direction"
                value={direction}
                options={directionOptions}
                onChange={setDirection}
              />

              <SegmentedControl
                legend="الفترة"
                name="period"
                value={period}
                options={periodOptions}
                onChange={handlePeriodChange}
              />

              <div className="input-group">
                <label htmlFor="salary-amount">{salaryLabel}</label>
                <div
                  className={
                    salaryHasError
                      ? 'amount-control amount-control--error'
                      : 'amount-control'
                  }
                  dir="ltr"
                >
                  <span lang="en">EGP</span>
                  <input
                    id="salary-amount"
                    name="salary"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="10000"
                    value={salaryInput}
                    aria-invalid={salaryHasError}
                    aria-describedby={
                      salaryHasError ? 'salary-help calculation-error' : 'salary-help'
                    }
                    onChange={(event) => setSalaryInput(event.target.value)}
                  />
                </div>
                <p className="field-help" id="salary-help">
                  أدخل القيمة {period === 'monthly' ? 'الشهرية' : 'السنوية'}{' '}
                  {direction === 'gross-to-net' ? 'قبل' : 'بعد'} الخصومات.
                </p>
              </div>

              <SegmentedControl
                legend="التأمينات الاجتماعية"
                name="insurance-mode"
                value={insuranceMode}
                options={insuranceOptions}
                onChange={setInsuranceMode}
              />

              {insuranceMode === 'manual' && (
                <div className="input-group manual-insurance-field">
                  <label htmlFor="manual-insurance">
                    قيمة التأمين الاجتماعي اليدوي
                  </label>
                  <div
                    className={
                      manualInsuranceHasError
                        ? 'amount-control amount-control--error'
                        : 'amount-control'
                    }
                    dir="ltr"
                  >
                    <span lang="en">EGP</span>
                    <input
                      id="manual-insurance"
                      name="manual-insurance"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={period === 'monthly' ? '1100' : '13200'}
                      value={manualInsuranceInput}
                      aria-invalid={manualInsuranceHasError}
                      aria-describedby={
                        manualInsuranceHasError
                          ? 'manual-insurance-help calculation-error'
                          : 'manual-insurance-help'
                      }
                      onChange={(event) =>
                        setManualInsuranceInput(event.target.value)
                      }
                    />
                  </div>
                  <p className="field-help" id="manual-insurance-help">
                    أدخل إجمالي التأمين للفترة المختارة.
                  </p>
                </div>
              )}
            </form>
          </section>

          <section className="panel results-panel" aria-labelledby="results-title">
            <div className="panel-heading">
              <p className="eyebrow">النتيجة</p>
              <h2 id="results-title">ملخص الحساب</h2>
            </div>

            {calculationState.status === 'empty' && (
              <div className="state-message" role="status" aria-live="polite">
                <span className="state-message__mark" aria-hidden="true">
                  —
                </span>
                <h3>أدخل قيمة المرتب لعرض النتيجة</h3>
                <p>ستظهر هنا التفاصيل الشهرية والسنوية فورًا.</p>
              </div>
            )}

            {calculationState.status === 'error' && (
              <div
                className="state-message state-message--error"
                id="calculation-error"
                role="alert"
              >
                <span className="state-message__mark" aria-hidden="true">
                  !
                </span>
                <h3>راجع البيانات المدخلة</h3>
                <p>{calculationState.message}</p>
              </div>
            )}

            {calculationState.status === 'success' && (
              <div className="results-content">
                <div className="result-highlight">
                  <p>
                    {direction === 'gross-to-net'
                      ? 'المرتب الصافي المحسوب'
                      : 'المرتب الإجمالي المحسوب'}
                  </p>
                  <output
                    data-testid="highlight-value"
                    htmlFor="salary-amount"
                    lang="en"
                    dir="ltr"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {formatEgp(
                      calculationState.result[
                        period === 'monthly' ? 'monthly' : 'annual'
                      ][direction === 'gross-to-net' ? 'net' : 'gross'],
                    )}
                  </output>
                  <span>{period === 'monthly' ? 'شهريًا' : 'سنويًا'}</span>
                </div>

                <div className="summary-grid">
                  <SummaryCard
                    title="الملخص الشهري"
                    breakdown={calculationState.result.monthly}
                    highlightedField={
                      direction === 'gross-to-net' ? 'net' : 'gross'
                    }
                    insurableWage={
                      insuranceMode === 'automatic'
                        ? calculationState.result.monthlyInsurableWage
                        : undefined
                    }
                  />
                  <SummaryCard
                    title="الملخص السنوي"
                    breakdown={calculationState.result.annual}
                    highlightedField={
                      direction === 'gross-to-net' ? 'net' : 'gross'
                    }
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="trust-panel" aria-labelledby="trust-title">
          <div>
            <p className="eyebrow">الخصوصية والشفافية</p>
            <h2 id="trust-title">بيانات مرتبك تظل على جهازك</h2>
          </div>

          <ul>
            <li>
              تتم جميع الحسابات محليًا داخل المتصفح، ولا تُرسل أو تُخزن بيانات
              مرتبك.
            </li>
            <li>
              هذه حسبة استرشادية وليست بديلًا عن الاستشارة الضريبية أو القانونية.
            </li>
            <li>
              تفترض النتائج 12 شهرًا متساويًا من المرتب دون مكافآت أو إعفاءات
              خاصة.
            </li>
          </ul>

          <nav className="source-links" aria-label="مصادر قواعد الحساب">
            <a
              href="https://eta.gov.eg/sites/default/files/2024-03/law_no.7-2024.pdf"
            >
              قانون ضريبة الدخل رقم 7 لسنة 2024 — مصلحة الضرائب المصرية
            </a>
            <a
              href="https://eta.gov.eg/ar/payroll-forms"
            >
              نماذج احتساب ضريبة المرتبات — مصلحة الضرائب المصرية
            </a>
            <a
              href="https://www.nosi.gov.eg/ar/News/Pages/2025-11-30.aspx"
            >
              حدود أجر الاشتراك التأميني لعام 2026 — الهيئة القومية للتأمين
              الاجتماعي
            </a>
          </nav>
        </aside>
      </main>
    </div>
  )
}

export default App
