"use client"

import { useEffect, useMemo, useState } from "react"

import { createGeneralCashMovement, getCashSessions, getGeneralCashMovements } from "@/app/actions/cash"
import { getLocations } from "@/app/actions/locations"
import { PageHeader, StatCard } from "@/components/dashboard/page-primitives"
import { EditSaleDialog } from "@/components/dashboard/edit-sale-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CASH_BILL_DENOMINATIONS, hasCashBillBreakdown, type CashBillBreakdown } from "@/lib/cash-bill-breakdown"
import { exportCashSessionPDF } from "@/lib/reports/pdf-export"
import { Banknote, FileDown, Loader2, Pencil, Receipt, Scale, Wallet } from "lucide-react"

type Location = {
  id: string
  name: string
  isActive: boolean
}

type CashMovement = {
  id: string
  locationId?: string
  locationName?: string
  type: string
  category: string
  paymentMethod: string
  amount: number
  description: string
  createdAt: string | Date
  user?: { name?: string | null; email?: string | null } | null
}

type CashDifferenceMeta = {
  label: string
  helper: string
  badgeVariant: "outline" | "success" | "warning" | "destructive"
}

type CashSessionSummary = {
  id: string
  locationId: string
  locationName: string
  registerLabel: string
  shiftLabel: string
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
  salesCount: number
  totalRaised: number
  salesBreakdown: Record<"CASH" | "CARD" | "TRANSFER" | "OTHER", number>
  movementBreakdown: Record<"CASH" | "CARD" | "TRANSFER" | "OTHER", { income: number; expense: number }>
  externalCashIncome: number
  externalCashExpense: number
  sales: Array<{ id: string; invoiceNumber: string; paymentMethod: string; total: number; createdAt: string | Date }>
  movements: CashMovement[]
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
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
      helper: "La caja cerró exacta, sin diferencias.",
      badgeVariant: "success",
    }
  }

  if (difference > 0) {
    return {
      label: `Sobrante ${formatCurrency(difference)}`,
      helper: "Se registró más efectivo del esperado en el cierre.",
      badgeVariant: "warning",
    }
  }

  return {
    label: `Faltante ${formatCurrency(Math.abs(difference))}`,
    helper: "Se registró menos efectivo del esperado en el cierre.",
    badgeVariant: "destructive",
  }
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
      <CardContent className="space-y-1">
        {CASH_BILL_DENOMINATIONS.map((denomination) => {
          const count = persistedBreakdown[String(denomination) as keyof CashBillBreakdown]

          return (
            <div key={denomination} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-1.5 text-sm">
              <span className="text-muted-foreground">{formatCurrency(denomination)}</span>
              <span className="font-medium text-foreground">{count} u. <span className="text-muted-foreground">= {formatCurrency(denomination * count)}</span></span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export default function CashMovementsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState("")
  const [status, setStatus] = useState<"OPEN" | "CLOSED">("OPEN")
  const [sessions, setSessions] = useState<CashSessionSummary[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState("")
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null)
  const [generalMovements, setGeneralMovements] = useState<CashMovement[]>([])
  const [loadingGeneralMovements, setLoadingGeneralMovements] = useState(false)
  const [submittingGeneralMovement, setSubmittingGeneralMovement] = useState(false)
  const [generalMovementType, setGeneralMovementType] = useState<"INCOME" | "EXPENSE">("EXPENSE")
  const [generalMovementCategory, setGeneralMovementCategory] = useState("RETIRO")
  const [generalMovementMethod, setGeneralMovementMethod] = useState<"CASH" | "CARD" | "TRANSFER" | "OTHER">("CASH")
  const [generalMovementAmount, setGeneralMovementAmount] = useState("")
  const [generalMovementDescription, setGeneralMovementDescription] = useState("")

  useEffect(() => {
    getLocations().then((result) => {
      if (result.success && result.data) {
        const activeLocations = (result.data as Location[]).filter((location) => location.isActive)
        setLocations(activeLocations)
        setSelectedLocationId(activeLocations[0]?.id || "")
      }
    })
  }, [])

  useEffect(() => {
    if (!selectedLocationId) {
      setSessions([])
      setSelectedSessionId("")
      return
    }

    getCashSessions(selectedLocationId, status).then((result) => {
      const normalized = result as CashSessionSummary[]
      setSessions(normalized)
      setSelectedSessionId((current) => normalized.some((session) => session.id === current) ? current : (normalized[0]?.id || ""))
    })
  }, [selectedLocationId, status])

  useEffect(() => {
    if (!selectedLocationId) {
      setGeneralMovements([])
      return
    }

    setLoadingGeneralMovements(true)
    getGeneralCashMovements(selectedLocationId)
      .then((result) => {
        setGeneralMovements(result as CashMovement[])
      })
      .finally(() => setLoadingGeneralMovements(false))
  }, [selectedLocationId])

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) || null,
    [sessions, selectedSessionId]
  )
  const selectedDifferenceMeta = getCashDifferenceMeta(selectedSession?.differenceAmount)

  async function refreshGeneralMovements() {
    if (!selectedLocationId) return

    setLoadingGeneralMovements(true)
    const result = await getGeneralCashMovements(selectedLocationId)
    setGeneralMovements(result as CashMovement[])
    setLoadingGeneralMovements(false)
  }

  async function handleCreateGeneralMovement() {
    if (!selectedLocationId) return

    setSubmittingGeneralMovement(true)
    const result = await createGeneralCashMovement({
      locationId: selectedLocationId,
      type: generalMovementType,
      category: generalMovementCategory as any,
      paymentMethod: generalMovementMethod,
      amount: Number(generalMovementAmount),
      description: generalMovementDescription,
    })
    setSubmittingGeneralMovement(false)

    if (!result.success) {
      alert(result.error || "Error al registrar movimiento general")
      return
    }

    setGeneralMovementAmount("")
    setGeneralMovementDescription("")
    await refreshGeneralMovements()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movimientos de caja"
        description="Reporte por sesión de caja con arqueo, ingresos, egresos y detalle de ventas asociadas."
      />

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Elegí sucursal y si querés revisar cajas abiertas o cierres históricos. Los movimientos generales se registran por sucursal y no alteran el arqueo de una caja puntual.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[280px_220px]">
          <select value={selectedLocationId} onChange={(event) => setSelectedLocationId(event.target.value)} className="h-11 rounded-md border border-input bg-background px-3">
            <option value="">Seleccionar sucursal</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>

          <select value={status} onChange={(event) => setStatus(event.target.value as any)} className="h-11 rounded-md border border-input bg-background px-3">
            <option value="OPEN">Cajas abiertas</option>
            <option value="CLOSED">Cajas cerradas</option>
          </select>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Movimiento externo general</CardTitle>
            <CardDescription>Registrá ingresos o egresos por sucursal aunque no haya una caja abierta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <select value={generalMovementType} onChange={(event) => setGeneralMovementType(event.target.value as any)} className="h-11 w-full rounded-md border border-input bg-background px-3">
                  <option value="INCOME">Ingreso</option>
                  <option value="EXPENSE">Egreso</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <select value={generalMovementCategory} onChange={(event) => setGeneralMovementCategory(event.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3">
                  <option value="INGRESO_MANUAL">Ingreso manual</option>
                  <option value="EGRESO_MANUAL">Egreso manual</option>
                  <option value="RETIRO">Retiro</option>
                  <option value="GASTO">Gasto</option>
                  <option value="PAGO_PROVEEDOR">Pago proveedor</option>
                  <option value="AJUSTE">Ajuste</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <div className="space-y-2">
                <Label>Medio</Label>
                <select value={generalMovementMethod} onChange={(event) => setGeneralMovementMethod(event.target.value as any)} className="h-11 w-full rounded-md border border-input bg-background px-3">
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input type="number" min="0" step="0.01" value={generalMovementAmount} onChange={(event) => setGeneralMovementAmount(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Detalle</Label>
              <textarea value={generalMovementDescription} onChange={(event) => setGeneralMovementDescription(event.target.value)} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2" />
            </div>
            <Button className="w-full" onClick={handleCreateGeneralMovement} disabled={submittingGeneralMovement || !selectedLocationId || !generalMovementAmount || !generalMovementDescription}>
              {submittingGeneralMovement ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar movimiento general"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial general por sucursal</CardTitle>
            <CardDescription>Últimos movimientos externos sin caja asociada en la sucursal seleccionada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingGeneralMovements ? (
              <div className="flex min-h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : generalMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay movimientos generales registrados para esta sucursal.</p>
            ) : generalMovements.map((movement) => (
              <div key={movement.id} className="rounded-xl border border-border/70 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{movement.category}</p>
                    <p className="text-muted-foreground">{movement.description}</p>
                  </div>
                  <div className="text-right">
                    <p className={movement.type === "INCOME" ? "font-semibold text-success-foreground" : "font-semibold text-destructive"}>
                      {movement.type === "INCOME" ? "+" : "-"}{formatCurrency(movement.amount)}
                    </p>
                    <p className="text-muted-foreground">{movement.paymentMethod}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(movement.createdAt)} · {movement.user?.name || movement.user?.email || "Usuario"}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Sesiones</CardTitle>
            <CardDescription>{sessions.length} sesiones encontradas para el filtro actual.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay sesiones para mostrar.</p>
            ) : sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedSessionId(session.id)}
                className={`w-full rounded-2xl border p-4 text-left transition-colors ${selectedSessionId === session.id ? "border-primary bg-primary/5" : "border-border/70 bg-muted/10 hover:bg-secondary/22"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{session.registerLabel}</p>
                    <p className="text-sm text-muted-foreground">{session.locationName} · {session.shiftLabel.toLowerCase()}</p>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs">{session.status === "OPEN" ? "Abierta" : "Cerrada"}</span>
                </div>
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <p>Fecha operativa: {formatDate(session.businessDate)}</p>
                  <p>Apertura: {formatCurrency(session.openingCashAmount)}</p>
                  <p>Ventas: {session.salesCount}</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {selectedSession ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Efectivo esperado" value={formatCurrency(selectedSession.expectedCashAmount)} helper="Caja teórica del turno" icon={Wallet} iconClassName="text-primary" />
              <StatCard label="Efectivo contado" value={formatCurrency(selectedSession.countedCashAmount || 0)} helper={selectedSession.status === "CLOSED" ? "Arqueo declarado" : "Pendiente de cierre"} icon={Banknote} iconClassName="text-success-foreground" />
              <StatCard label="Diferencia" value={selectedSession.differenceAmount == null ? "Pendiente" : formatCurrency(selectedSession.differenceAmount)} helper={selectedDifferenceMeta.helper} icon={Scale} iconClassName="text-warning" />
              <StatCard label="Ventas del turno" value={formatCurrency(selectedSession.totalRaised)} helper={`${selectedSession.salesCount} operaciones`} icon={Receipt} iconClassName="text-secondary-foreground" />
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>Resumen de la sesión</CardTitle>
                    <CardDescription>
                      {selectedSession.registerLabel} · abierta {formatDate(selectedSession.openedAt)} · cerrada {formatDate(selectedSession.closedAt)}
                    </CardDescription>
                  </div>
                  <Badge variant={selectedDifferenceMeta.badgeVariant}>{selectedDifferenceMeta.label}</Badge>
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
                </div>
              </CardHeader>
              <CardContent className="grid gap-6 xl:grid-cols-2">
                <div className="space-y-3 text-sm">
                  <p><span className="font-medium text-foreground">Sucursal:</span> {selectedSession.locationName}</p>
                  <p><span className="font-medium text-foreground">Turno:</span> {selectedSession.shiftLabel.toLowerCase()}</p>
                  <p><span className="font-medium text-foreground">Fecha operativa:</span> {formatDate(selectedSession.businessDate)}</p>
                  <p><span className="font-medium text-foreground">Apertura:</span> {formatCurrency(selectedSession.openingCashAmount)}</p>
                  <p><span className="font-medium text-foreground">Ingresos externos efectivo:</span> {formatCurrency(selectedSession.externalCashIncome)}</p>
                  <p><span className="font-medium text-foreground">Egresos externos efectivo:</span> {formatCurrency(selectedSession.externalCashExpense)}</p>
                </div>

                <div className="space-y-3 text-sm">
                  <p className="font-medium text-foreground">Ventas por medio</p>
                  <div className="flex justify-between"><span>Efectivo</span><span>{formatCurrency(selectedSession.salesBreakdown.CASH)}</span></div>
                  <div className="flex justify-between"><span>Tarjeta</span><span>{formatCurrency(selectedSession.salesBreakdown.CARD)}</span></div>
                  <div className="flex justify-between"><span>Transferencia</span><span>{formatCurrency(selectedSession.salesBreakdown.TRANSFER)}</span></div>
                  <div className="flex justify-between"><span>Otros</span><span>{formatCurrency(selectedSession.salesBreakdown.OTHER)}</span></div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
              <CashBillBreakdownSummary breakdown={selectedSession.openingCashBreakdown} title="Apertura por billete" />
              <CashBillBreakdownSummary breakdown={selectedSession.closingCashBreakdown} title="Cierre por billete" />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Ingresos y egresos</CardTitle>
                  <CardDescription>Detalle de movimientos externos del turno.</CardDescription>
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
                        <div className="text-right">
                          <p className={movement.type === "INCOME" ? "text-success-foreground font-semibold" : "text-destructive font-semibold"}>
                            {movement.type === "INCOME" ? "+" : "-"}{formatCurrency(movement.amount)}
                          </p>
                          <p className="text-muted-foreground">{movement.paymentMethod}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{formatDate(movement.createdAt)} · {movement.user?.name || movement.user?.email || "Usuario"}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ventas vinculadas</CardTitle>
                  <CardDescription>Detalle de ventas registradas durante la sesión.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedSession.sales.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay ventas asociadas.</p>
                  ) : selectedSession.sales.map((sale) => (
                    <div key={sale.id} className="rounded-xl border border-border/70 p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">Factura {sale.invoiceNumber.slice(0, 8)}</p>
                          <p className="text-muted-foreground">{formatDate(sale.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-3 text-right">
                          <div>
                            <p className="font-semibold text-foreground">{formatCurrency(sale.total)}</p>
                            <p className="text-muted-foreground">{sale.paymentMethod}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => setEditingSaleId(sale.id)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Seleccioná una sesión</CardTitle>
              <CardDescription>Elegí una caja para ver su arqueo, ingresos, egresos y ventas vinculadas.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      {editingSaleId ? (
        <EditSaleDialog
          saleId={editingSaleId}
          open={!!editingSaleId}
          onOpenChange={(open) => {
            if (!open) setEditingSaleId(null)
          }}
          onSaved={() => {
            // Reload sessions to reflect changes
            if (selectedLocationId) {
              getCashSessions(selectedLocationId, status).then((result) => {
                const normalized = result as CashSessionSummary[]
                setSessions(normalized)
              })
            }
          }}
        />
      ) : null}
    </div>
  )
}
