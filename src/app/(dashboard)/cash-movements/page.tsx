"use client"

import { useEffect, useMemo, useState } from "react"

import { getCashSessions } from "@/app/actions/cash"
import { getLocations } from "@/app/actions/locations"
import { PageHeader } from "@/components/dashboard/page-primitives"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Location = {
  id: string
  name: string
  isActive: boolean
}

type CashMovement = {
  id: string
  type: string
  category: string
  paymentMethod: string
  amount: number
  description: string
  createdAt: string | Date
  user?: { name?: string | null; email?: string | null } | null
}

type CashSessionSummary = {
  id: string
  locationId: string
  locationName: string
  registerLabel: string
  shiftLabel: string
  movements: CashMovement[]
}

function formatDate(value: string | Date) {
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

export default function CashMovementsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState("")
  const [sessions, setSessions] = useState<CashSessionSummary[]>([])

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
      return
    }

    getCashSessions(selectedLocationId, "OPEN").then((result) => {
      setSessions(result as CashSessionSummary[])
    })
  }, [selectedLocationId])

  const movements = useMemo(
    () => sessions.flatMap((session) =>
      session.movements.map((movement) => ({
        ...movement,
        sessionId: session.id,
        registerLabel: session.registerLabel,
        shiftLabel: session.shiftLabel,
        locationName: session.locationName,
      }))
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [sessions]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movimientos de caja"
        description="Detalle consolidado de ingresos, egresos, retiros, gastos y ajustes de las cajas abiertas."
      />

      <Card>
        <CardHeader>
          <CardTitle>Sucursal</CardTitle>
          <CardDescription>Filtrá los movimientos por sucursal activa.</CardDescription>
        </CardHeader>
        <CardContent>
          <select value={selectedLocationId} onChange={(event) => setSelectedLocationId(event.target.value)} className="h-11 rounded-md border border-input bg-background px-3 min-w-72">
            <option value="">Seleccionar sucursal</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos registrados</CardTitle>
          <CardDescription>{movements.length} registros en cajas abiertas para esta sucursal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay movimientos registrados en las cajas abiertas.</p>
          ) : movements.map((movement) => (
            <div key={movement.id} className="rounded-2xl border border-border/70 p-4 text-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-medium text-foreground">{movement.category} · {movement.registerLabel}</p>
                  <p className="text-muted-foreground">{movement.locationName} · turno {movement.shiftLabel.toLowerCase()} · {movement.paymentMethod}</p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${movement.type === "INCOME" ? "text-success-foreground" : "text-destructive"}`}>
                    {movement.type === "INCOME" ? "+" : "-"}{formatCurrency(movement.amount)}
                  </p>
                  <p className="text-muted-foreground">{formatDate(movement.createdAt)}</p>
                </div>
              </div>
              <p className="mt-3 text-muted-foreground">{movement.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">Registró: {movement.user?.name || movement.user?.email || "Usuario"}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
