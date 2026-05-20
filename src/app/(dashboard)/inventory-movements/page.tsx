"use client"

import { useEffect, useMemo, useState } from "react"

import { getInventoryMovements } from "@/app/actions/inventory"
import { getLocations } from "@/app/actions/locations"
import { PageHeader } from "@/components/dashboard/page-primitives"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type Location = {
  id: string
  name: string
  isActive: boolean
}

type InventoryMovement = {
  id: string
  type: string
  quantityDelta: number
  quantityBefore: number
  quantityAfter: number
  notes?: string | null
  createdAt: string | Date
  product: {
    id: string
    productNumber: number
    name: string
    unitOfMeasure: string
    customUnitName?: string | null
  }
  location: {
    id: string
    name: string
  }
  user?: {
    name?: string | null
    email?: string | null
  } | null
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
}

export default function InventoryMovementsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState("")
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [search, setSearch] = useState("")

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
    getInventoryMovements(selectedLocationId || undefined).then((result) => {
      setMovements(result as InventoryMovement[])
    })
  }, [selectedLocationId])

  const filteredMovements = useMemo(
    () => movements.filter((movement) =>
      movement.product.name.toLowerCase().includes(search.toLowerCase()) ||
      String(movement.product.productNumber).includes(search) ||
      movement.type.toLowerCase().includes(search.toLowerCase())
    ),
    [movements, search]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entradas y salidas"
        description="Ledger operativo de inventario con stock inicial, ventas, compras y ajustes registrados por movimiento."
      />

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Elegí sucursal y buscá por producto, ID o tipo de movimiento.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <select value={selectedLocationId} onChange={(event) => setSelectedLocationId(event.target.value)} className="h-11 rounded-md border border-input bg-background px-3">
            <option value="">Todas las sucursales</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por producto, ID o tipo..." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos recientes</CardTitle>
          <CardDescription>{filteredMovements.length} registros visibles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredMovements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay movimientos para mostrar.</p>
          ) : filteredMovements.map((movement) => (
            <div key={movement.id} className="rounded-2xl border border-border/70 p-4 text-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-medium text-foreground">ID {movement.product.productNumber} · {movement.product.name}</p>
                  <p className="text-muted-foreground">{movement.location.name} · {movement.type}</p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${movement.quantityDelta >= 0 ? "text-success-foreground" : "text-destructive"}`}>
                    {movement.quantityDelta >= 0 ? "+" : ""}{movement.quantityDelta}
                  </p>
                  <p className="text-muted-foreground">{formatDate(movement.createdAt)}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3 text-muted-foreground">
                <p>Antes: {movement.quantityBefore}</p>
                <p>Después: {movement.quantityAfter}</p>
                <p>Usuario: {movement.user?.name || movement.user?.email || "Sistema"}</p>
              </div>
              {movement.notes ? <p className="mt-3 text-muted-foreground">{movement.notes}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
