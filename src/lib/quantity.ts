export type UnitOfMeasureValue = "UNIT" | "ML" | "G" | "KG" | "LT" | "OTHER"

const FRACTIONAL_UNITS = new Set<UnitOfMeasureValue>(["ML", "G", "KG", "LT"])
export const QUANTITY_DECIMALS = 3

export function roundQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * 10 ** QUANTITY_DECIMALS) / 10 ** QUANTITY_DECIMALS
}

export function formatQuantity(value: number) {
  const rounded = roundQuantity(value)
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(QUANTITY_DECIMALS).replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/g, "")
}

export function getQuantityStep(unitOfMeasure?: UnitOfMeasureValue | null) {
  return unitOfMeasure && FRACTIONAL_UNITS.has(unitOfMeasure) ? 0.001 : 1
}

export function getUnitLabel(unitOfMeasure?: UnitOfMeasureValue | null, customUnitName?: string | null) {
  if (unitOfMeasure === "OTHER") {
    return customUnitName || "unidad"
  }

  const labels: Record<Exclude<UnitOfMeasureValue, "OTHER">, string> = {
    UNIT: "unidad",
    ML: "ml",
    G: "g",
    KG: "kg",
    LT: "lt",
  }

  return unitOfMeasure ? labels[unitOfMeasure as Exclude<UnitOfMeasureValue, "OTHER">] : "unidad"
}
