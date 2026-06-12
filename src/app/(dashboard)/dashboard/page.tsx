"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Banknote,
  CreditCard,
  FileDown,
  Loader2,
  Plus,
  Receipt,
  Store,
  Wallet,
} from "lucide-react"

import { getDashboardMetrics } from "@/app/actions/dashboard"
import { createCashMovement, getCashSessions, openCashSession, closeCashSession } from "@/app/actions/cash"
import { getLocations } from "@/app/actions/locations"
import { PageHeader, StatCard } from "@/components/dashboard/page-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  calculateCashBillBreakdownTotal,
  CASH_BILL_DENOMINATIONS,
  createEmptyCashBillBreakdown,
  hasCashBillBreakdown,
  type CashBillBreakdown,
  type CashBillDenomination,
} from "@/lib/cash-bill-breakdown"
import { exportCashSessionPDF } from "@/lib/reports/pdf-export"

type DashboardMetrics = {
  todaySales: number
  todaySalesCount: number
  lowStockProducts: number
  pendingTransfers: number
  topProducts: Array<{ name: string; totalSold: number }>
}

type Location = {
  id: string
  name: string
  isActive: boolean
}

type CashSessionSummary = {
  id: string
  locationId: string
  locationName: string
  registerLabel: string
  shiftLabel: "MANANA" | "TARDE" | "OTRO"
  status: "OPEN" | "CLOSED"
  businessDate: string | Date
  openedAt: string | Date
  closedAt?: string | Date | null
  openingCashAmount: number
  openingCashBreakdown: CashBillBreakdown | null
  countedCashAmount: number | null
  closingCashBreakdown: CashBillBreakdown | null
  expectedCashAmount: number
  differenceAmount: number | null
  openingNotes?: string | null
  closingNotes?: string | null
  salesCount: number
  totalRaised: number
  salesBreakdown: Record<"CASH" | "CARD" | "TRANSFER" | "OTHER", number>
  movementBreakdown: Record<"CASH" | "CARD" | "TRANSFER" | "OTHER", { income: number; expense: number }>
  externalCashIncome: number
  externalCashExpense: number
  sales: Array<{ id: string; invoiceNumber: string; paymentMethod: string; total: number; createdAt: string | Date }>
  movements: Array<{ id: string; type: string; category: string; paymentMethod: string; amount: number; description: string; createdAt: string | Date; user?: { name?: string | null; email?: string | null } | null }>
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

function getTodayDateInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, "0")
  const day = `${now.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseBillCount(value: string) {
  if (!value) return 0

  const normalized = Math.floor(Number(value))
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0
}

type CashBillBreakdownEditorProps = {
  breakdown: CashBillBreakdown
  total: number
  idPrefix: string
  title: string
  description: string
  onChange: (denomination: CashBillDenomination, value: number) => void
}

type CashDifferenceMeta = {
  label: string
  helper: string
  badgeVariant: "outline" | "success" | "warning" | "destructive"
}

function getCashDifferenceMeta(difference: number | null | undefined): CashDifferenceMeta {
  if (difference === null || difference === undefined) {
    return {
      label: "Arqueo pendiente",
      helper: "Todavía no se declaró el conteo final de la caja.",
      badgeVariant: "outline",
    }
  }

  if (difference === 0) {
    return {
      label: "Arqueo en 0",
      helper: "La caja cuadra exacta, sin sobrantes ni faltantes.",
      badgeVariant: "success",
    }
  }

  if (difference > 0) {
    return {
      label: `Sobrante ${formatCurrency(difference)}`,
      helper: "Se contó más efectivo del esperado para esta caja.",
      badgeVariant: "warning",
    }
  }

  return {
    label: `Faltante ${formatCurrency(Math.abs(difference))}`,
    helper: "Se contó menos efectivo del esperado para esta caja.",
    badgeVariant: "destructive",
  }
}

function CashBillBreakdownEditor({ breakdown, total, idPrefix, title, description, onChange }: CashBillBreakdownEditorProps) {
  return (
    <div className="space-y-2">
      {title && <p className="text-xs font-medium text-foreground">{title}</p>}
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="grid gap-2 grid-cols-4">
        {CASH_BILL_DENOMINATIONS.map((denomination) => {
          const key = String(denomination) as keyof CashBillBreakdown
          const inputId = `${idPrefix}-${denomination}`

          return (
            <div key={denomination} className="space-y-1.5 rounded-lg border border-border/70 p-2">
              <Label htmlFor={inputId} className="text-xs">$ {formatCurrency(denomination).replace("$", "")}</Label>
              <Input
                id={inputId}
                type="number"
                min="0"
                step="1"
                className="h-8 text-sm"
                value={breakdown[key]}
                onChange={(event) => onChange(denomination, parseBillCount(event.target.value))}
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{breakdown[key]} x {formatCurrency(denomination)}</span>
                <span>{formatCurrency(denomination * breakdown[key])}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs">
        <div className="flex justify-between font-medium text-foreground">
          <span>Total contado</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  )
}

function CashBillBreakdownSummary({ breakdown, title }: { breakdown: CashBillBreakdown | null; title: string }) {
  if (!hasCashBillBreakdown(breakdown)) {
    return null
  }

  const persistedBreakdown = breakdown as CashBillBreakdown

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Conteo guardado por denominación.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CASH_BILL_DENOMINATIONS.map((denomination) => {
          const count = persistedBreakdown[String(denomination) as keyof CashBillBreakdown]

          return (
            <div key={denomination} className="rounded-xl border border-border/70 p-3 text-sm">
              <p className="text-muted-foreground">{formatCurrency(denomination)}</p>
              <p className="mt-1 font-semibold text-foreground">{count} billete{count === 1 ? "" : "s"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Subtotal: {formatCurrency(denomination * count)}</p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState("")
  const [sessions, setSessions] = useState<CashSessionSummary[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState("")
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [openDialog, setOpenDialog] = useState(false)
  const [registerLabel, setRegisterLabel] = useState("")
  const [shiftLabel, setShiftLabel] = useState<"MANANA" | "TARDE" | "OTRO">("MANANA")
  const [businessDate, setBusinessDate] = useState(getTodayDateInputValue())
  const [openingCashBreakdown, setOpeningCashBreakdown] = useState<CashBillBreakdown>(() => createEmptyCashBillBreakdown())
  const [openingNotes, setOpeningNotes] = useState("")

  const [closeDialog, setCloseDialog] = useState(false)
  const [closingCashBreakdown, setClosingCashBreakdown] = useState<CashBillBreakdown>(() => createEmptyCashBillBreakdown())
  const [closingNotes, setClosingNotes] = useState("")

  const [movementDialog, setMovementDialog] = useState(false)
  const [movementType, setMovementType] = useState<"INCOME" | "EXPENSE">("EXPENSE")
  const [movementCategory, setMovementCategory] = useState("RETIRO")
  const [movementMethod, setMovementMethod] = useState<"CASH" | "CARD" | "TRANSFER" | "OTHER">("CASH")
  const [movementAmount, setMovementAmount] = useState("")
  const [movementDescription, setMovementDescription] = useState("")

  useEffect(() => {
    setLoading(true)
    Promise.all([getLocations(), getDashboardMetrics()])
      .then(([locationsResult, dashboardMetrics]) => {
        if (locationsResult.success && locationsResult.data) {
          const activeLocations = (locationsResult.data as Location[]).filter((location) => location.isActive)
          setLocations(activeLocations)
          setSelectedLocationId((current) => current || activeLocations[0]?.id || "")
        }

        setMetrics(dashboardMetrics as DashboardMetrics)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedLocationId) {
      setSessions([])
      setSelectedSessionId("")
      return
    }

    setLoadingSessions(true)
    getCashSessions(selectedLocationId, "OPEN")
      .then((result) => {
        const normalized = result as CashSessionSummary[]
        setSessions(normalized)
        setSelectedSessionId((current) => (
          normalized.some((session) => session.id === current)
            ? current
            : (normalized[0]?.id || "")
        ))
      })
      .finally(() => setLoadingSessions(false))
  }, [selectedLocationId])

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) || null,
    [sessions, selectedSessionId]
  )
  const openingCashAmount = calculateCashBillBreakdownTotal(openingCashBreakdown)
  const countedCashAmount = calculateCashBillBreakdownTotal(closingCashBreakdown)
  const closingDifferenceAmount = selectedSession ? countedCashAmount - selectedSession.expectedCashAmount : null
  const closingDifferenceMeta = getCashDifferenceMeta(closingDifferenceAmount)

  function updateOpeningCashBreakdown(denomination: CashBillDenomination, value: number) {
    setOpeningCashBreakdown((current) => ({
      ...current,
      [String(denomination)]: value,
    }))
  }

  function updateClosingCashBreakdown(denomination: CashBillDenomination, value: number) {
    setClosingCashBreakdown((current) => ({
      ...current,
      [String(denomination)]: value,
    }))
  }

  async function refreshSessions() {
    if (!selectedLocationId) return
    setLoadingSessions(true)
    const result = await getCashSessions(selectedLocationId, "OPEN")
    const normalized = result as CashSessionSummary[]
    setSessions(normalized)
    setSelectedSessionId((current) => (
      normalized.some((session) => session.id === current)
        ? current
        : (normalized[0]?.id || "")
    ))
    setLoadingSessions(false)
  }

  async function handleOpenCashSession() {
    if (!selectedLocationId) return
    setSubmitting(true)
    const result = await openCashSession({
      locationId: selectedLocationId,
      registerLabel,
      shiftLabel,
      businessDate,
      openingCashBreakdown,
      openingNotes,
    })
    setSubmitting(false)

    if (!result.success) {
      alert(result.error || "Error al abrir caja")
      return
    }

    setOpenDialog(false)
    setRegisterLabel("")
    setOpeningCashBreakdown(createEmptyCashBillBreakdown())
    setOpeningNotes("")
    await refreshSessions()
  }

  async function handleCloseCashSession() {
    if (!selectedSession) return
    setSubmitting(true)
    const result = await closeCashSession({
      cashSessionId: selectedSession.id,
      closingCashBreakdown,
      closingNotes,
    })
    setSubmitting(false)

    if (!result.success) {
      alert(result.error || "Error al cerrar caja")
      return
    }

    setCloseDialog(false)
    setClosingCashBreakdown(createEmptyCashBillBreakdown())
    setClosingNotes("")
    await refreshSessions()
  }

  async function handleCreateMovement() {
    if (!selectedSession) return
    setSubmitting(true)
    const result = await createCashMovement({
      cashSessionId: selectedSession.id,
      type: movementType,
      category: movementCategory as any,
      paymentMethod: movementMethod,
      amount: Number(movementAmount),
      description: movementDescription,
    })
    setSubmitting(false)

    if (!result.success) {
      alert(result.error || "Error al registrar movimiento")
      return
    }

    setMovementDialog(false)
    setMovementAmount("")
    setMovementDescription("")
    await refreshSessions()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caja"
        description="Centro operativo para apertura, cierre, arqueo y control del turno activo por sucursal."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info" className="min-h-9 px-3">{sessions.length} cajas abiertas</Badge>
            <Button onClick={() => setOpenDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Abrir caja
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ventas de hoy" value={formatCurrency(metrics?.todaySales || 0)} helper={`${metrics?.todaySalesCount || 0} transacciones`} icon={Receipt} iconClassName="text-primary" />
        <StatCard label="Alertas de stock" value={metrics?.lowStockProducts || 0} helper="Productos bajo mínimo" icon={AlertTriangle} iconClassName="text-warning" />
        <StatCard label="Transferencias pendientes" value={metrics?.pendingTransfers || 0} helper="Movimientos por revisar" icon={CreditCard} iconClassName="text-secondary-foreground" />
        <StatCard label="Cajas abiertas" value={sessions.length} helper="Sesiones activas en la sucursal" icon={Store} iconClassName="text-success-foreground" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sucursal operativa</CardTitle>
          <CardDescription>Seleccioná la sucursal para gestionar las cajas activas y abrir nuevas sesiones.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <select
            value={selectedLocationId}
            onChange={(event) => setSelectedLocationId(event.target.value)}
            className="h-11 rounded-md border border-input bg-background px-3 lg:min-w-72"
          >
            <option value="">Seleccionar sucursal</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>

          {selectedSession ? (
            <Link
              href={`/pos?locationId=${selectedSession.locationId}&cashSessionId=${selectedSession.id}`}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Ir a nueva venta con {selectedSession.registerLabel}
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Cajas abiertas</CardTitle>
            <CardDescription>Puede haber más de una caja por sucursal; elegí cuál querés revisar o cerrar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading || loadingSessions ? (
              <div className="flex min-h-48 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                No hay cajas abiertas en esta sucursal.
              </div>
            ) : (
              sessions.map((session) => {
                const selected = session.id === selectedSessionId
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition-colors ${selected ? "border-primary bg-primary/5" : "border-border/70 bg-muted/10 hover:bg-secondary/22"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{session.registerLabel}</p>
                        <p className="text-sm text-muted-foreground">{session.locationName} · {session.shiftLabel.toLowerCase()}</p>
                      </div>
                      <Badge variant="success">Abierta</Badge>
                    </div>
                    <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
                      <p>Apertura: {formatCurrency(session.openingCashAmount)}</p>
                      <p>Abierta: {formatDate(session.openedAt)}</p>
                      <p>Ventas: {session.salesCount}</p>
                    </div>
                  </button>
                )
              })
            )}
          </CardContent>
        </Card>

        {selectedSession ? (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>{selectedSession.registerLabel}</CardTitle>
                  <CardDescription>
                    {selectedSession.locationName} · turno {selectedSession.shiftLabel.toLowerCase()} · abierta {formatDate(selectedSession.openedAt)}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => exportCashSessionPDF({
                      registerLabel: selectedSession.registerLabel,
                      locationName: selectedSession.locationName,
                      shiftLabel: selectedSession.shiftLabel,
                      status: selectedSession.status,
                      businessDate: formatDate(selectedSession.businessDate),
                      openedAt: formatDate(selectedSession.openedAt),
                      closedAt: selectedSession.closedAt ? formatDate(selectedSession.closedAt) : null,
                      openingCashAmount: selectedSession.openingCashAmount,
                      openingCashBreakdown: selectedSession.openingCashBreakdown,
                      expectedCashAmount: selectedSession.expectedCashAmount,
                      countedCashAmount: selectedSession.countedCashAmount,
                      closingCashBreakdown: selectedSession.closingCashBreakdown,
                      differenceAmount: selectedSession.differenceAmount,
                      totalRaised: selectedSession.totalRaised,
                      salesCount: selectedSession.salesCount,
                      externalCashIncome: selectedSession.externalCashIncome,
                      externalCashExpense: selectedSession.externalCashExpense,
                      salesBreakdown: selectedSession.salesBreakdown,
                      movementBreakdown: selectedSession.movementBreakdown,
                      sales: selectedSession.sales.map((sale) => ({
                        ...sale,
                        createdAt: formatDate(sale.createdAt),
                      })),
                      movements: selectedSession.movements.map((movement) => ({
                        ...movement,
                        createdAt: formatDate(movement.createdAt),
                      })),
                    })}
                  >
                    <FileDown className="h-4 w-4" />
                    PDF
                  </Button>
                  <Button variant="outline" onClick={() => setMovementDialog(true)}>Registrar movimiento</Button>
                  <Button onClick={() => {
                    setClosingCashBreakdown(createEmptyCashBillBreakdown())
                    setCloseDialog(true)
                  }}>
                    Cerrar caja
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Efectivo esperado" value={formatCurrency(selectedSession.expectedCashAmount)} helper="Apertura + ventas efectivo + ingresos - egresos" icon={Wallet} />
                <StatCard label="Ventas en efectivo" value={formatCurrency(selectedSession.salesBreakdown.CASH)} helper="Solo ventas asociadas a esta caja" icon={Banknote} iconClassName="text-primary" />
                <StatCard label="Ingresos externos" value={formatCurrency(selectedSession.externalCashIncome)} helper="Entradas manuales de efectivo" icon={Plus} iconClassName="text-success-foreground" />
                <StatCard label="Egresos externos" value={formatCurrency(selectedSession.externalCashExpense)} helper="Retiros, gastos y pagos" icon={AlertTriangle} iconClassName="text-warning" />
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Resumen recaudado</CardTitle>
                  <CardDescription>Detalle por medio de pago del turno actual.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span>Efectivo</span><span>{formatCurrency(selectedSession.salesBreakdown.CASH)}</span></div>
                  <div className="flex justify-between"><span>Tarjeta</span><span>{formatCurrency(selectedSession.salesBreakdown.CARD)}</span></div>
                  <div className="flex justify-between"><span>Transferencia</span><span>{formatCurrency(selectedSession.salesBreakdown.TRANSFER)}</span></div>
                  <div className="flex justify-between"><span>Otros</span><span>{formatCurrency(selectedSession.salesBreakdown.OTHER)}</span></div>
                  <div className="border-t border-border/70 pt-3 flex justify-between font-semibold text-base">
                    <span>Total recaudado</span>
                    <span>{formatCurrency(selectedSession.totalRaised)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Movimiento por medios</CardTitle>
                  <CardDescription>Entradas y salidas externas registradas en la caja activa.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {(["CASH", "CARD", "TRANSFER", "OTHER"] as const).map((method) => (
                    <div key={method} className="rounded-xl border border-border/70 p-3">
                      <p className="font-medium text-foreground">{method}</p>
                      <div className="mt-2 flex justify-between text-muted-foreground"><span>Ingresos</span><span>{formatCurrency(selectedSession.movementBreakdown[method].income)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Egresos</span><span>{formatCurrency(selectedSession.movementBreakdown[method].expense)}</span></div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <CashBillBreakdownSummary breakdown={selectedSession.openingCashBreakdown} title="Fondo inicial por billete" />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Movimientos de caja</CardTitle>
                  <CardDescription>Retiros, gastos, ajustes e ingresos externos del turno.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedSession.movements.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay movimientos registrados.</p>
                  ) : selectedSession.movements.map((movement) => (
                    <div key={movement.id} className="rounded-xl border border-border/70 p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{movement.category}</p>
                          <p className="text-muted-foreground">{movement.description}</p>
                        </div>
                        <Badge variant={movement.type === "INCOME" ? "success" : "outline"}>{movement.paymentMethod}</Badge>
                      </div>
                      <div className="mt-2 flex justify-between text-muted-foreground">
                        <span>{formatDate(movement.createdAt)}</span>
                        <span>{movement.type === "INCOME" ? "+" : "-"}{formatCurrency(movement.amount)}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ventas del turno</CardTitle>
                  <CardDescription>Últimas ventas asociadas a esta caja.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedSession.sales.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Todavía no hay ventas vinculadas a esta caja.</p>
                  ) : selectedSession.sales.map((sale) => (
                    <div key={sale.id} className="rounded-xl border border-border/70 p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">Factura {sale.invoiceNumber.slice(0, 8)}</p>
                          <p className="text-muted-foreground">{formatDate(sale.createdAt)}</p>
                        </div>
                        <Badge variant="secondary">{sale.paymentMethod}</Badge>
                      </div>
                      <p className="mt-2 font-semibold text-foreground">{formatCurrency(sale.total)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Sin caja seleccionada</CardTitle>
              <CardDescription>Abrí una caja nueva o elegí una caja abierta para ver el arqueo y operar ventas.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abrir caja</DialogTitle>
            <DialogDescription>Turno, fecha, nombre y billetes del fondo inicial.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre de caja</Label>
                <Input value={registerLabel} onChange={(event) => setRegisterLabel(event.target.value)} placeholder="Ej: Caja Mostrador" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Turno</Label>
                <select value={shiftLabel} onChange={(event) => setShiftLabel(event.target.value as any)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
                  <option value="MANANA">Mañana</option>
                  <option value="TARDE">Tarde</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha operativa</Label>
              <Input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} className="h-8 text-sm" />
            </div>
            <CashBillBreakdownEditor
              breakdown={openingCashBreakdown}
              total={openingCashAmount}
              idPrefix="opening-bill"
              title=""
              description=""
              onChange={updateOpeningCashBreakdown}
            />
            <div className="space-y-1.5">
              <Label className="text-xs">Observaciones</Label>
              <textarea value={openingNotes} onChange={(event) => setOpeningNotes(event.target.value)} className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
            </div>
            <Button className="w-full h-8 text-sm" onClick={handleOpenCashSession} disabled={submitting || !selectedLocationId || !registerLabel}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Abrir caja"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cerrar caja</DialogTitle>
            <DialogDescription>
              Contá los billetes reales. Si hay diferencia, se guarda igual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs">
              <div className="flex justify-between"><span>Efectivo esperado</span><span>{formatCurrency(selectedSession?.expectedCashAmount || 0)}</span></div>
              <div className="mt-1.5 flex justify-between"><span>Efectivo contado</span><span className="font-medium">{formatCurrency(countedCashAmount)}</span></div>
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-border/40 pt-2">
                <span className="text-muted-foreground">Estado</span>
                <Badge variant={closingDifferenceMeta.badgeVariant} className="text-[10px]">{closingDifferenceMeta.label}</Badge>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">{closingDifferenceMeta.helper}</p>
            </div>
            <CashBillBreakdownEditor
              breakdown={closingCashBreakdown}
              total={countedCashAmount}
              idPrefix="closing-bill"
              title=""
              description=""
              onChange={updateClosingCashBreakdown}
            />
            <div className="space-y-1.5">
              <Label className="text-xs">Observaciones</Label>
              <textarea value={closingNotes} onChange={(event) => setClosingNotes(event.target.value)} className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
            </div>
            <Button className="w-full h-8 text-sm" onClick={handleCloseCashSession} disabled={submitting || !selectedSession}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cerrar caja"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={movementDialog} onOpenChange={setMovementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar movimiento</DialogTitle>
            <DialogDescription>Guardá ingresos, egresos, retiros, gastos o ajustes externos del turno.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <select value={movementType} onChange={(event) => setMovementType(event.target.value as any)} className="w-full h-11 rounded-md border border-input bg-background px-3">
                  <option value="INCOME">Ingreso</option>
                  <option value="EXPENSE">Egreso</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <select value={movementCategory} onChange={(event) => setMovementCategory(event.target.value)} className="w-full h-11 rounded-md border border-input bg-background px-3">
                  <option value="INGRESO_MANUAL">Ingreso manual</option>
                  <option value="EGRESO_MANUAL">Egreso manual</option>
                  <option value="RETIRO">Retiro</option>
                  <option value="GASTO">Gasto</option>
                  <option value="PAGO_PROVEEDOR">Pago proveedor</option>
                  <option value="AJUSTE">Ajuste</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Medio</Label>
                <select value={movementMethod} onChange={(event) => setMovementMethod(event.target.value as any)} className="w-full h-11 rounded-md border border-input bg-background px-3">
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input type="number" min="0" step="0.01" value={movementAmount} onChange={(event) => setMovementAmount(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Detalle</Label>
              <textarea value={movementDescription} onChange={(event) => setMovementDescription(event.target.value)} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2" />
            </div>
            <Button className="w-full" onClick={handleCreateMovement} disabled={submitting || !selectedSession || !movementAmount || !movementDescription}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar movimiento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
