"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { resolveSessionUserId } from "@/lib/auth/session-user"
import {
  calculateCashBillBreakdownTotal,
  CASH_BILL_DENOMINATIONS,
  parseCashBillBreakdown,
  type CashBillBreakdown,
} from "@/lib/cash-bill-breakdown"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const db = prisma as any

const cashBillBreakdownSchema = z.object(
  Object.fromEntries(
    CASH_BILL_DENOMINATIONS.map((denomination) => [
      String(denomination),
      z.coerce.number().int().min(0, "Cantidad inválida").default(0),
    ])
  ) as Record<string, z.ZodTypeAny>
)

const openCashSessionSchema = z.object({
  locationId: z.string().min(1, "Sucursal requerida"),
  registerLabel: z.string().min(1, "Nombre de caja requerido").max(80),
  shiftLabel: z.enum(["MANANA", "TARDE", "OTRO"]),
  businessDate: z.string().optional(),
  openingCashBreakdown: cashBillBreakdownSchema,
  openingNotes: z.string().optional(),
})

const closeCashSessionSchema = z.object({
  cashSessionId: z.string().min(1),
  closingCashBreakdown: cashBillBreakdownSchema,
  closingNotes: z.string().optional(),
})

const cashMovementBaseSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.enum(["INGRESO_MANUAL", "EGRESO_MANUAL", "RETIRO", "GASTO", "PAGO_PROVEEDOR", "AJUSTE"]),
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]),
  amount: z.coerce.number().positive("Monto inválido"),
  description: z.string().min(1, "Detalle requerido").max(300),
  purchaseOrderId: z.string().optional(),
})

const cashMovementSchema = cashMovementBaseSchema.extend({
  cashSessionId: z.string().min(1),
})

const generalCashMovementSchema = cashMovementBaseSchema.extend({
  locationId: z.string().min(1, "Sucursal requerida"),
})

function normalizeBusinessDate(value?: string) {
  if (!value) {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }

  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

function amountMap() {
  return {
    CASH: 0,
    CARD: 0,
    TRANSFER: 0,
    OTHER: 0,
  }
}

async function requireCurrentUserId() {
  const session = await auth()
  if (!session?.user) {
    throw new Error("No autenticado")
  }

  const userId = await resolveSessionUserId(session)
  if (!userId) {
    throw new Error("Sesión inválida. Volvé a iniciar sesión.")
  }

  return userId
}

function normalizeCashMovement(movement: any) {
  return {
    ...movement,
    amount: Number(movement.amount),
  }
}

export async function getCashSessionSummary(cashSessionId: string) {
  const session = await db.cashSession.findUnique({
    where: { id: cashSessionId },
    include: {
      location: true,
      openedBy: { select: { id: true, name: true, email: true } },
      closedBy: { select: { id: true, name: true, email: true } },
    },
  })

  if (!session) {
    throw new Error("Caja no encontrada")
  }

  const [sales, movements] = await Promise.all([
    db.sale.findMany({
      where: {
        cashSessionId,
        status: "COMPLETED",
      },
      select: {
        id: true,
        invoiceNumber: true,
        paymentMethod: true,
        total: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.cashMovement.findMany({
      where: { cashSessionId },
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const salesBreakdown = amountMap()
  for (const sale of sales as any[]) {
    salesBreakdown[sale.paymentMethod as keyof typeof salesBreakdown] += Number(sale.total)
  }

  const movementBreakdown = {
    CASH: { income: 0, expense: 0 },
    CARD: { income: 0, expense: 0 },
    TRANSFER: { income: 0, expense: 0 },
    OTHER: { income: 0, expense: 0 },
  }

  for (const movement of movements as any[]) {
    const amount = Number(movement.amount)
    const bucket = movementBreakdown[movement.paymentMethod as keyof typeof movementBreakdown]
    if (movement.type === "INCOME") {
      bucket.income += amount
    } else {
      bucket.expense += amount
    }
  }

  const externalCashIncome = movements
    .filter((movement: any) => movement.paymentMethod === "CASH" && movement.type === "INCOME" && movement.category !== "APERTURA")
    .reduce((sum: number, movement: any) => sum + Number(movement.amount), 0)

  const externalCashExpense = movements
    .filter((movement: any) => movement.paymentMethod === "CASH" && movement.type === "EXPENSE")
    .reduce((sum: number, movement: any) => sum + Number(movement.amount), 0)

  const expectedCash = Number(session.openingCashAmount) + salesBreakdown.CASH + externalCashIncome - externalCashExpense
  const countedCash = session.countedCashAmount !== null && session.countedCashAmount !== undefined
    ? Number(session.countedCashAmount)
    : null
  const difference = countedCash !== null ? countedCash - expectedCash : null
  const totalRaised = Object.values(salesBreakdown).reduce((sum, amount) => sum + amount, 0)
  const openingCashBreakdown = parseCashBillBreakdown(session.openingCashBreakdown)
  const closingCashBreakdown = parseCashBillBreakdown(session.closingCashBreakdown)

  return {
    id: session.id,
    locationId: session.locationId,
    locationName: session.location.name,
    registerLabel: session.registerLabel,
    shiftLabel: session.shiftLabel,
    status: session.status,
    businessDate: session.businessDate,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    openingCashAmount: Number(session.openingCashAmount),
    countedCashAmount: countedCash,
    expectedCashAmount: expectedCash,
    differenceAmount: difference,
    openingCashBreakdown,
    closingCashBreakdown,
    openingNotes: session.openingNotes,
    closingNotes: session.closingNotes,
    openedBy: session.openedBy,
    closedBy: session.closedBy,
    salesCount: sales.length,
    totalRaised,
    salesBreakdown,
    movementBreakdown,
    externalCashIncome,
    externalCashExpense,
    sales: sales.map((sale: any) => ({
      ...sale,
      total: Number(sale.total),
    })),
    movements: movements.map(normalizeCashMovement),
  }
}

export async function getCashSessions(locationId?: string, status: "OPEN" | "CLOSED" = "OPEN") {
  const sessions = await db.cashSession.findMany({
    where: {
      status,
      ...(locationId ? { locationId } : {}),
    },
    orderBy: [{ openedAt: "desc" }],
    take: status === "OPEN" ? 20 : 10,
  })

  return Promise.all(sessions.map((session: any) => getCashSessionSummary(session.id)))
}

export async function openCashSession(input: z.infer<typeof openCashSessionSchema>) {
  try {
    const userId = await requireCurrentUserId()
    const parsed = openCashSessionSchema.parse(input)
    const businessDate = normalizeBusinessDate(parsed.businessDate)
    const openingCashAmount = calculateCashBillBreakdownTotal(parsed.openingCashBreakdown as CashBillBreakdown)

    const session = await prisma.$transaction(async (tx) => {
      const txDb = tx as any
      const created = await txDb.cashSession.create({
        data: {
          locationId: parsed.locationId,
          openedByUserId: userId,
          registerLabel: parsed.registerLabel,
          shiftLabel: parsed.shiftLabel,
          businessDate,
          openingCashAmount,
          openingCashBreakdown: parsed.openingCashBreakdown,
          openingNotes: parsed.openingNotes || null,
        },
      })

      await txDb.cashMovement.create({
        data: {
          cashSessionId: created.id,
          locationId: parsed.locationId,
          userId,
          type: "INCOME",
          category: "APERTURA",
          paymentMethod: "CASH",
          amount: openingCashAmount,
          description: parsed.openingNotes || "Apertura de caja",
        },
      })

      return created
    })

    revalidatePath("/dashboard")
    revalidatePath("/pos")
    return { success: true, data: await getCashSessionSummary(session.id) }
  } catch (error: any) {
    return { success: false, error: error.message || "Error al abrir caja" }
  }
}

export async function closeCashSession(input: z.infer<typeof closeCashSessionSchema>) {
  try {
    const userId = await requireCurrentUserId()
    const parsed = closeCashSessionSchema.parse(input)
    const summary = await getCashSessionSummary(parsed.cashSessionId)

    if (summary.status !== "OPEN") {
      return { success: false, error: "La caja ya está cerrada" }
    }

    const expectedCashAmount = summary.expectedCashAmount
    const countedCashAmount = calculateCashBillBreakdownTotal(parsed.closingCashBreakdown as CashBillBreakdown)
    const differenceAmount = countedCashAmount - expectedCashAmount

    await db.cashSession.update({
      where: { id: parsed.cashSessionId },
      data: {
        status: "CLOSED",
        closedByUserId: userId,
        closedAt: new Date(),
        countedCashAmount,
        closingCashBreakdown: parsed.closingCashBreakdown,
        expectedCashAmount,
        differenceAmount,
        closingNotes: parsed.closingNotes || null,
      },
    })

    revalidatePath("/dashboard")
    revalidatePath("/pos")
    revalidatePath("/reports")
    return { success: true, data: await getCashSessionSummary(parsed.cashSessionId) }
  } catch (error: any) {
    return { success: false, error: error.message || "Error al cerrar caja" }
  }
}

export async function createCashMovement(input: z.infer<typeof cashMovementSchema>) {
  try {
    const userId = await requireCurrentUserId()
    const parsed = cashMovementSchema.parse(input)

    const cashSession = await db.cashSession.findUnique({
      where: { id: parsed.cashSessionId },
      select: { id: true, locationId: true, status: true },
    })

    if (!cashSession) {
      return { success: false, error: "Caja no encontrada" }
    }

    if (cashSession.status !== "OPEN") {
      return { success: false, error: "Solo podés registrar movimientos en una caja abierta" }
    }

    await db.cashMovement.create({
      data: {
        cashSessionId: parsed.cashSessionId,
        locationId: cashSession.locationId,
        userId,
        type: parsed.type,
        category: parsed.category,
        paymentMethod: parsed.paymentMethod,
        amount: parsed.amount,
        description: parsed.description,
        purchaseOrderId: parsed.purchaseOrderId || null,
      },
    })

    revalidatePath("/dashboard")
    revalidatePath("/cash-movements")
    return { success: true, data: await getCashSessionSummary(parsed.cashSessionId) }
  } catch (error: any) {
    return { success: false, error: error.message || "Error al registrar movimiento" }
  }
}

export async function getGeneralCashMovements(locationId?: string) {
  const movements = await db.cashMovement.findMany({
    where: {
      cashSessionId: null,
      ...(locationId ? { locationId } : {}),
    },
    include: {
      location: { select: { id: true, name: true } },
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return movements.map((movement: any) => ({
    ...normalizeCashMovement(movement),
    locationName: movement.location.name,
  }))
}

export async function createGeneralCashMovement(input: z.infer<typeof generalCashMovementSchema>) {
  try {
    const userId = await requireCurrentUserId()
    const parsed = generalCashMovementSchema.parse(input)

    const location = await db.location.findUnique({
      where: { id: parsed.locationId },
      select: { id: true },
    })

    if (!location) {
      return { success: false, error: "Sucursal no encontrada" }
    }

    await db.cashMovement.create({
      data: {
        cashSessionId: null,
        locationId: parsed.locationId,
        userId,
        type: parsed.type,
        category: parsed.category,
        paymentMethod: parsed.paymentMethod,
        amount: parsed.amount,
        description: parsed.description,
        purchaseOrderId: parsed.purchaseOrderId || null,
      },
    })

    revalidatePath("/cash-movements")
    return { success: true, data: await getGeneralCashMovements(parsed.locationId) }
  } catch (error: any) {
    return { success: false, error: error.message || "Error al registrar movimiento general" }
  }
}
