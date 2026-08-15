/**
 * Egyptian private-sector payroll rules used by this calculator.
 * Rule effective date: 2026-08-15.
 *
 * Sources:
 * - https://eta.gov.eg/sites/default/files/2024-03/law_no.7-2024.pdf
 * - https://eta.gov.eg/ar/payroll-forms
 * - https://www.nosi.gov.eg/ar/News/Pages/2025-11-30.aspx
 * - https://taxsummaries.pwc.com/egypt/individual/other-taxes
 */

export type CalculationDirection = 'gross-to-net' | 'net-to-gross'
export type SalaryPeriod = 'monthly' | 'yearly'

export type InsuranceSelection =
  | { readonly mode: 'automatic' }
  | { readonly mode: 'manual'; readonly amount: number }

export interface SalaryCalculationRequest {
  readonly direction: CalculationDirection
  readonly period: SalaryPeriod
  readonly salary: number
  readonly insurance: InsuranceSelection
}

export interface SalaryBreakdown {
  readonly gross: number
  readonly insurance: number
  readonly incomeTax: number
  readonly martyrsFundDeduction: number
  readonly net: number
}

export interface SalaryCalculationResult {
  readonly monthly: SalaryBreakdown
  readonly annual: SalaryBreakdown
  readonly monthlyInsurableWage?: number
}

export interface AutomaticInsuranceResult {
  readonly insurableWage: number
  readonly employeeContribution: number
}

export const SALARY_RULES = {
  monthsPerYear: 12,
  employeeInsuranceRate: 0.11,
  minimumMonthlyInsurableWage: 2_700,
  maximumMonthlyInsurableWage: 16_700,
  annualPersonalExemption: 20_000,
  martyrsFundRate: 0.0005,
  annualTaxableIncomeRoundingUnit: 10,
} as const

interface TaxBracket {
  readonly upperLimit: number
  readonly rate: number
}

interface NormalizedInsurance {
  readonly mode: InsuranceSelection['mode']
  readonly monthlyAmount?: number
}

interface MonthlyCalculation extends SalaryBreakdown {
  readonly monthlyInsurableWage?: number
}

const STANDARD_TAX_BRACKETS: readonly TaxBracket[] = [
  { upperLimit: 40_000, rate: 0 },
  { upperLimit: 55_000, rate: 0.1 },
  { upperLimit: 70_000, rate: 0.15 },
  { upperLimit: 200_000, rate: 0.2 },
  { upperLimit: 400_000, rate: 0.225 },
  { upperLimit: Number.POSITIVE_INFINITY, rate: 0.25 },
]

const TAX_BRACKETS_OVER_600K: readonly TaxBracket[] = [
  { upperLimit: 55_000, rate: 0.1 },
  { upperLimit: 70_000, rate: 0.15 },
  { upperLimit: 200_000, rate: 0.2 },
  { upperLimit: 400_000, rate: 0.225 },
  { upperLimit: Number.POSITIVE_INFINITY, rate: 0.25 },
]

const TAX_BRACKETS_OVER_700K: readonly TaxBracket[] = [
  { upperLimit: 70_000, rate: 0.15 },
  { upperLimit: 200_000, rate: 0.2 },
  { upperLimit: 400_000, rate: 0.225 },
  { upperLimit: Number.POSITIVE_INFINITY, rate: 0.25 },
]

const TAX_BRACKETS_OVER_800K: readonly TaxBracket[] = [
  { upperLimit: 200_000, rate: 0.2 },
  { upperLimit: 400_000, rate: 0.225 },
  { upperLimit: Number.POSITIVE_INFINITY, rate: 0.25 },
]

const TAX_BRACKETS_OVER_900K: readonly TaxBracket[] = [
  { upperLimit: 400_000, rate: 0.225 },
  { upperLimit: Number.POSITIVE_INFINITY, rate: 0.25 },
]

const TAX_BRACKETS_OVER_1_2M: readonly TaxBracket[] = [
  { upperLimit: 1_200_000, rate: 0.25 },
  { upperLimit: Number.POSITIVE_INFINITY, rate: 0.275 },
]

const MAX_NET_DIFFERENCE = 0.01
const NET_SEARCH_TOLERANCE = 0.000_001
const MAX_BOUND_EXPANSIONS = 1_024
const MAX_BINARY_SEARCH_ITERATIONS = 256

export function floorAnnualTaxableIncome(annualTaxableIncome: number): number {
  assertFiniteNumber(annualTaxableIncome, 'Annual taxable income')

  if (annualTaxableIncome <= 0) {
    return 0
  }

  const unit = SALARY_RULES.annualTaxableIncomeRoundingUnit

  return Math.floor(annualTaxableIncome / unit) * unit
}

export function calculateAnnualIncomeTax(annualTaxableIncome: number): number {
  const taxableIncome = floorAnnualTaxableIncome(annualTaxableIncome)
  const brackets = selectTaxBrackets(taxableIncome)

  let tax = 0
  let lowerLimit = 0

  for (const bracket of brackets) {
    const taxableInBracket =
      Math.min(taxableIncome, bracket.upperLimit) - lowerLimit

    if (taxableInBracket > 0) {
      tax += taxableInBracket * bracket.rate
    }

    if (taxableIncome <= bracket.upperLimit) {
      break
    }

    lowerLimit = bracket.upperLimit
  }

  return tax
}

export function calculateMonthlyAutomaticInsurance(
  monthlyGross: number,
): AutomaticInsuranceResult {
  assertPositiveFiniteNumber(monthlyGross, 'Monthly gross salary')

  const insurableWage = Math.min(
    SALARY_RULES.maximumMonthlyInsurableWage,
    Math.max(SALARY_RULES.minimumMonthlyInsurableWage, monthlyGross),
  )

  return {
    insurableWage,
    employeeContribution:
      insurableWage * SALARY_RULES.employeeInsuranceRate,
  }
}

export function calculateSalary(
  request: SalaryCalculationRequest,
): SalaryCalculationResult {
  validateDirection(request.direction)
  validatePeriod(request.period)
  assertPositiveFiniteNumber(request.salary, 'Salary')

  const monthlySalary = normalizeToMonthly(request.salary, request.period)
  assertPositiveFiniteNumber(monthlySalary, 'Normalized monthly salary')
  assertCanAnnualize(monthlySalary, 'Salary')

  const insurance = normalizeInsurance(request.insurance, request.period)

  if (request.direction === 'gross-to-net') {
    const calculation = calculateMonthlyFromGross(monthlySalary, insurance)
    validateForwardCalculation(calculation, insurance.mode)

    return toCalculationResult(calculation)
  }

  return grossUpNetSalary(monthlySalary, insurance, request.period)
}

function selectTaxBrackets(
  annualTaxableIncome: number,
): readonly TaxBracket[] {
  if (annualTaxableIncome <= 600_000) {
    return STANDARD_TAX_BRACKETS
  }

  if (annualTaxableIncome <= 700_000) {
    return TAX_BRACKETS_OVER_600K
  }

  if (annualTaxableIncome <= 800_000) {
    return TAX_BRACKETS_OVER_700K
  }

  if (annualTaxableIncome <= 900_000) {
    return TAX_BRACKETS_OVER_800K
  }

  if (annualTaxableIncome <= 1_200_000) {
    return TAX_BRACKETS_OVER_900K
  }

  return TAX_BRACKETS_OVER_1_2M
}

function normalizeInsurance(
  insurance: InsuranceSelection,
  period: SalaryPeriod,
): NormalizedInsurance {
  if (insurance.mode === 'automatic') {
    return { mode: 'automatic' }
  }

  if (insurance.mode !== 'manual') {
    throw new TypeError('Insurance mode must be automatic or manual')
  }

  assertFiniteNumber(insurance.amount, 'Manual insurance')

  if (insurance.amount < 0) {
    throw new RangeError('Manual insurance cannot be negative')
  }

  const monthlyAmount = normalizeToMonthly(insurance.amount, period)
  assertFiniteNumber(monthlyAmount, 'Normalized monthly manual insurance')
  assertCanAnnualize(monthlyAmount, 'Manual insurance')

  return { mode: 'manual', monthlyAmount }
}

function normalizeToMonthly(value: number, period: SalaryPeriod): number {
  return period === 'yearly' ? value / SALARY_RULES.monthsPerYear : value
}

function calculateMonthlyFromGross(
  monthlyGross: number,
  insurance: NormalizedInsurance,
): MonthlyCalculation {
  assertFiniteNumber(monthlyGross, 'Monthly gross salary')
  assertCanAnnualize(monthlyGross, 'Gross salary')

  const automaticInsurance =
    insurance.mode === 'automatic'
      ? calculateAutomaticInsuranceUnchecked(monthlyGross)
      : undefined
  const monthlyInsurance =
    automaticInsurance?.employeeContribution ?? insurance.monthlyAmount ?? 0

  const annualTaxableIncome = Math.max(
    0,
    monthlyGross * SALARY_RULES.monthsPerYear -
      monthlyInsurance * SALARY_RULES.monthsPerYear -
      SALARY_RULES.annualPersonalExemption,
  )
  const annualIncomeTax = calculateAnnualIncomeTax(annualTaxableIncome)
  const monthlyIncomeTax = annualIncomeTax / SALARY_RULES.monthsPerYear
  const martyrsFundDeduction =
    monthlyGross * SALARY_RULES.martyrsFundRate
  const monthlyNet =
    monthlyGross -
    monthlyInsurance -
    monthlyIncomeTax -
    martyrsFundDeduction

  const breakdown: MonthlyCalculation = {
    gross: monthlyGross,
    insurance: monthlyInsurance,
    incomeTax: monthlyIncomeTax,
    martyrsFundDeduction,
    net: monthlyNet,
  }

  return automaticInsurance === undefined
    ? breakdown
    : { ...breakdown, monthlyInsurableWage: automaticInsurance.insurableWage }
}

function calculateAutomaticInsuranceUnchecked(
  monthlyGross: number,
): AutomaticInsuranceResult {
  const insurableWage = Math.min(
    SALARY_RULES.maximumMonthlyInsurableWage,
    Math.max(SALARY_RULES.minimumMonthlyInsurableWage, monthlyGross),
  )

  return {
    insurableWage,
    employeeContribution:
      insurableWage * SALARY_RULES.employeeInsuranceRate,
  }
}

function grossUpNetSalary(
  targetMonthlyNet: number,
  insurance: NormalizedInsurance,
  period: SalaryPeriod,
): SalaryCalculationResult {
  const periodMultiplier =
    period === 'yearly' ? SALARY_RULES.monthsPerYear : 1
  const monthlySearchTolerance = NET_SEARCH_TOLERANCE / periodMultiplier
  const maximumMonthlyDifference = MAX_NET_DIFFERENCE / periodMultiplier

  let lowerGross = 0
  let lowerCalculation = calculateMonthlyFromGross(lowerGross, insurance)
  let upperGross = Math.max(targetMonthlyNet * 2, 1)
  assertSearchGrossIsUsable(upperGross)
  let upperCalculation = calculateMonthlyFromGross(upperGross, insurance)
  let expansionCount = 0

  while (upperCalculation.net < targetMonthlyNet) {
    lowerGross = upperGross
    lowerCalculation = upperCalculation
    upperGross *= 2
    expansionCount += 1

    if (expansionCount > MAX_BOUND_EXPANSIONS) {
      throw new RangeError('Unable to find a finite gross salary upper bound')
    }

    assertSearchGrossIsUsable(upperGross)
    upperCalculation = calculateMonthlyFromGross(upperGross, insurance)
  }

  let bestCalculation = closerCalculation(
    lowerCalculation,
    upperCalculation,
    targetMonthlyNet,
  )

  for (let iteration = 0; iteration < MAX_BINARY_SEARCH_ITERATIONS; iteration += 1) {
    const middleGross = lowerGross + (upperGross - lowerGross) / 2

    if (middleGross === lowerGross || middleGross === upperGross) {
      break
    }

    const middleCalculation = calculateMonthlyFromGross(middleGross, insurance)
    bestCalculation = closerCalculation(
      bestCalculation,
      middleCalculation,
      targetMonthlyNet,
    )

    const difference = Math.abs(middleCalculation.net - targetMonthlyNet)

    if (difference <= monthlySearchTolerance) {
      return toCalculationResult(middleCalculation)
    }

    if (middleCalculation.net < targetMonthlyNet) {
      lowerGross = middleGross
      lowerCalculation = middleCalculation
    } else {
      upperGross = middleGross
      upperCalculation = middleCalculation
    }
  }

  bestCalculation = closerCalculation(
    bestCalculation,
    closerCalculation(lowerCalculation, upperCalculation, targetMonthlyNet),
    targetMonthlyNet,
  )

  if (
    Math.abs(bestCalculation.net - targetMonthlyNet) > maximumMonthlyDifference
  ) {
    throw new RangeError('Unable to reproduce the requested net salary')
  }

  return toCalculationResult(bestCalculation)
}

function closerCalculation(
  first: MonthlyCalculation,
  second: MonthlyCalculation,
  targetMonthlyNet: number,
): MonthlyCalculation {
  return Math.abs(first.net - targetMonthlyNet) <=
    Math.abs(second.net - targetMonthlyNet)
    ? first
    : second
}

function toCalculationResult(
  calculation: MonthlyCalculation,
): SalaryCalculationResult {
  const monthly: SalaryBreakdown = {
    gross: calculation.gross,
    insurance: calculation.insurance,
    incomeTax: calculation.incomeTax,
    martyrsFundDeduction: calculation.martyrsFundDeduction,
    net: calculation.net,
  }
  const annual = multiplyBreakdown(monthly, SALARY_RULES.monthsPerYear)

  return calculation.monthlyInsurableWage === undefined
    ? { monthly, annual }
    : {
        monthly,
        annual,
        monthlyInsurableWage: calculation.monthlyInsurableWage,
      }
}

function multiplyBreakdown(
  breakdown: SalaryBreakdown,
  multiplier: number,
): SalaryBreakdown {
  return {
    gross: breakdown.gross * multiplier,
    insurance: breakdown.insurance * multiplier,
    incomeTax: breakdown.incomeTax * multiplier,
    martyrsFundDeduction: breakdown.martyrsFundDeduction * multiplier,
    net: breakdown.net * multiplier,
  }
}

function validateForwardCalculation(
  calculation: MonthlyCalculation,
  insuranceMode: InsuranceSelection['mode'],
): void {
  assertCalculationIsFinite(calculation)

  if (insuranceMode === 'manual' && calculation.net <= 0) {
    throw new RangeError(
      'Manual insurance leaves no positive net salary after deductions',
    )
  }
}

function assertCalculationIsFinite(calculation: MonthlyCalculation): void {
  const values = [
    calculation.gross,
    calculation.insurance,
    calculation.incomeTax,
    calculation.martyrsFundDeduction,
    calculation.net,
  ]

  if (!values.every(Number.isFinite)) {
    throw new RangeError('Salary calculation exceeds the supported number range')
  }
}

function assertSearchGrossIsUsable(gross: number): void {
  if (!Number.isFinite(gross) || !Number.isFinite(gross * SALARY_RULES.monthsPerYear)) {
    throw new RangeError('Unable to find a finite gross salary upper bound')
  }
}

function assertCanAnnualize(value: number, label: string): void {
  if (!Number.isFinite(value * SALARY_RULES.monthsPerYear)) {
    throw new RangeError(`${label} is too large to annualize safely`)
  }
}

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`)
  }
}

function assertPositiveFiniteNumber(value: number, label: string): void {
  assertFiniteNumber(value, label)

  if (value <= 0) {
    throw new RangeError(`${label} must be greater than zero`)
  }
}

function validateDirection(direction: CalculationDirection): void {
  if (direction !== 'gross-to-net' && direction !== 'net-to-gross') {
    throw new TypeError('Calculation direction is not supported')
  }
}

function validatePeriod(period: SalaryPeriod): void {
  if (period !== 'monthly' && period !== 'yearly') {
    throw new TypeError('Salary period must be monthly or yearly')
  }
}
