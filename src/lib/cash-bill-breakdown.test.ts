import { describe, expect, test } from "vitest"

import {
  calculateCashBillBreakdownTotal,
  createEmptyCashBillBreakdown,
  hasCashBillBreakdown,
  normalizeCashBillBreakdown,
  parseCashBillBreakdown,
} from "./cash-bill-breakdown"

describe("cash bill breakdown helpers", () => {
  test("creates an empty breakdown with all denominations", () => {
    expect(createEmptyCashBillBreakdown()).toEqual({
      "50": 0,
      "100": 0,
      "200": 0,
      "500": 0,
      "1000": 0,
      "2000": 0,
      "10000": 0,
      "20000": 0,
    })
  })

  test("normalizes invalid values to zero and floors decimal counts", () => {
    expect(normalizeCashBillBreakdown({
      "50": "2",
      "100": -1,
      "200": 1.9,
      "500": "nope",
      "1000": null,
      "2000": 3,
    })).toEqual({
      "50": 2,
      "100": 0,
      "200": 1,
      "500": 0,
      "1000": 0,
      "2000": 3,
      "10000": 0,
      "20000": 0,
    })
  })

  test("calculates the total amount from the breakdown", () => {
    expect(calculateCashBillBreakdownTotal({
      "50": 1,
      "100": 2,
      "200": 0,
      "500": 3,
      "1000": 0,
      "2000": 1,
      "10000": 0,
      "20000": 1,
    })).toBe(23750)
  })

  test("parses missing persisted values as null", () => {
    expect(parseCashBillBreakdown(null)).toBeNull()
    expect(parseCashBillBreakdown(undefined)).toBeNull()
  })

  test("detects whether there is at least one counted bill", () => {
    expect(hasCashBillBreakdown(createEmptyCashBillBreakdown())).toBe(false)
    expect(hasCashBillBreakdown(normalizeCashBillBreakdown({ "500": 1 }))).toBe(true)
  })
})
