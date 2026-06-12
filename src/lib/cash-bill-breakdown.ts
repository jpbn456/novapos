export const CASH_BILL_DENOMINATIONS = [50, 100, 200, 500, 1000, 2000, 10000, 20000] as const

export type CashBillDenomination = (typeof CASH_BILL_DENOMINATIONS)[number]
export type CashBillBreakdown = Record<`${CashBillDenomination}`, number>

export function createEmptyCashBillBreakdown(): CashBillBreakdown {
  return {
    "50": 0,
    "100": 0,
    "200": 0,
    "500": 0,
    "1000": 0,
    "2000": 0,
    "10000": 0,
    "20000": 0,
  }
}

export function normalizeCashBillBreakdown(value: unknown): CashBillBreakdown {
  const normalized = createEmptyCashBillBreakdown()

  if (!value || typeof value !== "object") {
    return normalized
  }

  for (const denomination of CASH_BILL_DENOMINATIONS) {
    const rawValue = (value as Record<string, unknown>)[String(denomination)]
    const count = Math.floor(Number(rawValue))

    normalized[String(denomination) as keyof CashBillBreakdown] = Number.isFinite(count) && count > 0 ? count : 0
  }

  return normalized
}

export function parseCashBillBreakdown(value: unknown): CashBillBreakdown | null {
  if (!value || typeof value !== "object") {
    return null
  }

  return normalizeCashBillBreakdown(value)
}

export function calculateCashBillBreakdownTotal(breakdown: CashBillBreakdown): number {
  return CASH_BILL_DENOMINATIONS.reduce((total, denomination) => {
    return total + denomination * breakdown[String(denomination) as keyof CashBillBreakdown]
  }, 0)
}

export function hasCashBillBreakdown(breakdown: CashBillBreakdown | null | undefined): boolean {
  if (!breakdown) {
    return false
  }

  return CASH_BILL_DENOMINATIONS.some((denomination) => breakdown[String(denomination) as keyof CashBillBreakdown] > 0)
}
