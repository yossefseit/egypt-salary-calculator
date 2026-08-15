import { describe, expect, it } from 'vitest'
import {
  calculateAnnualIncomeTax,
  calculateMonthlyAutomaticInsurance,
  calculateSalary,
  floorAnnualTaxableIncome,
  type InsuranceSelection,
  type SalaryBreakdown,
  type SalaryPeriod,
} from './salaryCalculator'

const automaticInsurance = { mode: 'automatic' } as const

function calculateGrossToNet(
  salary: number,
  period: SalaryPeriod = 'monthly',
  insurance: InsuranceSelection = automaticInsurance,
) {
  return calculateSalary({
    direction: 'gross-to-net',
    period,
    salary,
    insurance,
  })
}

function expectBreakdownToMatch(
  actual: SalaryBreakdown,
  expected: SalaryBreakdown,
): void {
  expect(actual.gross).toBeCloseTo(expected.gross, 10)
  expect(actual.insurance).toBeCloseTo(expected.insurance, 10)
  expect(actual.incomeTax).toBeCloseTo(expected.incomeTax, 10)
  expect(actual.martyrsFundDeduction).toBeCloseTo(
    expected.martyrsFundDeduction,
    10,
  )
  expect(actual.net).toBeCloseTo(expected.net, 10)
}

describe('automatic social insurance', () => {
  it('applies the minimum monthly insurable wage', () => {
    expect(calculateMonthlyAutomaticInsurance(1_000)).toEqual({
      insurableWage: 2_700,
      employeeContribution: 297,
    })

    const result = calculateGrossToNet(2_000)
    expect(result.monthlyInsurableWage).toBe(2_700)
    expect(result.monthly.insurance).toBe(297)
  })

  it('uses gross salary between the insurance limits', () => {
    expect(calculateMonthlyAutomaticInsurance(2_700)).toEqual({
      insurableWage: 2_700,
      employeeContribution: 297,
    })
    expect(calculateMonthlyAutomaticInsurance(10_000)).toEqual({
      insurableWage: 10_000,
      employeeContribution: 1_100,
    })
  })

  it('applies the maximum monthly insurable wage', () => {
    expect(calculateMonthlyAutomaticInsurance(16_700)).toEqual({
      insurableWage: 16_700,
      employeeContribution: 1_837,
    })

    const result = calculateGrossToNet(20_000)
    expect(result.monthlyInsurableWage).toBe(16_700)
    expect(result.monthly.insurance).toBe(1_837)
  })
})

describe('annual income tax', () => {
  it.each([
    [0, 0],
    [40_000, 0],
    [40_010, 1],
    [55_000, 1_500],
    [55_010, 1_501.5],
    [70_000, 3_750],
    [70_010, 3_752],
    [200_000, 29_750],
    [200_010, 29_752.25],
    [400_000, 74_750],
    [400_010, 74_752.5],
    [600_000, 124_750],
  ])('taxes the standard bracket boundary at EGP %s', (income, tax) => {
    expect(calculateAnnualIncomeTax(income)).toBeCloseTo(tax, 10)
  })

  it.each([
    [600_010, 128_752.5],
    [700_000, 153_750],
    [700_010, 156_502.5],
    [800_000, 181_500],
    [800_010, 185_002.5],
    [900_000, 210_000],
    [900_010, 215_002.5],
    [1_200_000, 290_000],
    [1_200_010, 300_002.75],
  ])('applies the high-income adjustment at EGP %s', (income, tax) => {
    expect(calculateAnnualIncomeTax(income)).toBeCloseTo(tax, 10)
  })

  it('floors annual taxable income to the nearest EGP 10', () => {
    expect(floorAnnualTaxableIncome(40_009.99)).toBe(40_000)
    expect(calculateAnnualIncomeTax(40_009.99)).toBe(0)
    expect(floorAnnualTaxableIncome(86_809.99)).toBe(86_800)
    expect(calculateAnnualIncomeTax(86_809.99)).toBe(7_110)
    expect(floorAnnualTaxableIncome(99.99999999999999)).toBe(90)
    expect(floorAnnualTaxableIncome(600_009.9999999999)).toBe(600_000)
    expect(calculateAnnualIncomeTax(600_009.9999999999)).toBe(124_750)
  })
})

describe('gross-to-net calculation', () => {
  it('matches the EGP 10,000 monthly reference result', () => {
    const result = calculateGrossToNet(10_000)

    expect(result.monthly).toEqual({
      gross: 10_000,
      insurance: 1_100,
      incomeTax: 592.5,
      martyrsFundDeduction: 5,
      net: 8_302.5,
    })
    expect(result.annual).toEqual({
      gross: 120_000,
      insurance: 13_200,
      incomeTax: 7_110,
      martyrsFundDeduction: 60,
      net: 99_630,
    })
    expect(result.monthlyInsurableWage).toBe(10_000)
  })

  it('returns equivalent results for monthly and yearly salary inputs', () => {
    const monthly = calculateGrossToNet(25_000, 'monthly')
    const yearly = calculateGrossToNet(300_000, 'yearly')

    expectBreakdownToMatch(yearly.monthly, monthly.monthly)
    expectBreakdownToMatch(yearly.annual, monthly.annual)
    expect(yearly.monthlyInsurableWage).toBe(monthly.monthlyInsurableWage)
  })

  it('normalizes manual insurance using the selected period', () => {
    const monthly = calculateGrossToNet(25_000, 'monthly', {
      mode: 'manual',
      amount: 1_500,
    })
    const yearly = calculateGrossToNet(300_000, 'yearly', {
      mode: 'manual',
      amount: 18_000,
    })

    expectBreakdownToMatch(yearly.monthly, monthly.monthly)
    expectBreakdownToMatch(yearly.annual, monthly.annual)
    expect(monthly.monthlyInsurableWage).toBeUndefined()
    expect(yearly.monthlyInsurableWage).toBeUndefined()
  })
})

describe('net-to-gross calculation', () => {
  it.each([3_000, 12_345, 20_000, 50_000, 80_000, 150_000])(
    'reproduces net pay after a round trip from EGP %s gross',
    (monthlyGross) => {
      const forward = calculateGrossToNet(monthlyGross)
      const reverse = calculateSalary({
        direction: 'net-to-gross',
        period: 'monthly',
        salary: forward.monthly.net,
        insurance: automaticInsurance,
      })

      expect(
        Math.abs(reverse.monthly.net - forward.monthly.net),
      ).toBeLessThanOrEqual(0.01)
      expect(reverse.monthly.gross).toBeCloseTo(monthlyGross, 2)
    },
  )

  it('reproduces a yearly requested net within EGP 0.01', () => {
    const forward = calculateGrossToNet(75_000, 'monthly')
    const reverse = calculateSalary({
      direction: 'net-to-gross',
      period: 'yearly',
      salary: forward.annual.net,
      insurance: automaticInsurance,
    })

    expect(Math.abs(reverse.annual.net - forward.annual.net)).toBeLessThanOrEqual(
      0.01,
    )
  })

  it('supports normalized manual insurance during gross-up', () => {
    const forward = calculateGrossToNet(40_000, 'monthly', {
      mode: 'manual',
      amount: 2_500,
    })
    const reverse = calculateSalary({
      direction: 'net-to-gross',
      period: 'yearly',
      salary: forward.annual.net,
      insurance: { mode: 'manual', amount: 30_000 },
    })

    expect(Math.abs(reverse.annual.net - forward.annual.net)).toBeLessThanOrEqual(
      0.01,
    )
    expect(reverse.monthly.insurance).toBe(2_500)
    expect(reverse.monthlyInsurableWage).toBeUndefined()
  })

  it('expands the upper bound for manual insurance larger than requested net', () => {
    const result = calculateSalary({
      direction: 'net-to-gross',
      period: 'monthly',
      salary: 1_000,
      insurance: { mode: 'manual', amount: 10_000 },
    })

    expect(Math.abs(result.monthly.net - 1_000)).toBeLessThanOrEqual(0.01)
    expect(result.monthly.gross).toBeGreaterThan(10_000)
  })
})

describe('input validation', () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite salary %s',
    (salary) => {
      expect(() => calculateGrossToNet(salary)).toThrow(/finite/)
    },
  )

  it.each([0, -1])('rejects non-positive salary %s', (salary) => {
    expect(() => calculateGrossToNet(salary)).toThrow(/greater than zero/)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite manual insurance %s',
    (amount) => {
      expect(() =>
        calculateGrossToNet(10_000, 'monthly', { mode: 'manual', amount }),
      ).toThrow(/finite/)
    },
  )

  it('rejects negative manual insurance', () => {
    expect(() =>
      calculateGrossToNet(10_000, 'monthly', {
        mode: 'manual',
        amount: -1,
      }),
    ).toThrow(/negative/)
  })

  it('rejects manual insurance that leaves no positive net salary', () => {
    expect(() =>
      calculateGrossToNet(1_000, 'monthly', {
        mode: 'manual',
        amount: 999.5,
      }),
    ).toThrow(/no positive net salary/)
  })

  it('rejects finite values that overflow during annualization', () => {
    expect(() => calculateGrossToNet(Number.MAX_VALUE)).toThrow(/annualize/)
  })
})
