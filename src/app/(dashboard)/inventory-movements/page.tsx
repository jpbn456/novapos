"use client"

import { useEffect, useMemo, useState } from "react"

import { createManualInventoryMovement, getInventoryMovements } from "@/app/actions/inventory"
import { getLocations } from "@/app/actions/locations"
import { getProducts } from "@/app/actions/products"
import { formatQuantity, getQuantityStep, getUnitLabel, type UnitOfMeasureValue } from "@/lib/quantity"
import { PageHeader } from "@/components/dashboard/page-primitives"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type Location = {
  id: string
  name: string
  isActive: boolean
}

type Product = {
  id: string
  productNumber: number
  name: string
  unitOfMeasure: UnitOfMeasureValue
  customUnitName: string | null
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
    unitOfMeasure: UnitOfMeasureValue
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
  const [products, setProducts] = useState<Product[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState("")
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [search, setSearch] = useState("")
  const [movementType, setMovementType] = useState<"MANUAL_IN" | "MANUAL_OUT">("MANUAL_IN")
  const [productId, setProductId] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function loadMovements(locationId?: string) {
    const result = await getInventoryMovements(locationId || undefined)
    setMovements(result as InventoryMovement[])
  }

  useEffect(() => {
    Promise.all([getLocations(), getProducts(1, 200)]).then(([locationsResult, productsResult]) => {
      if (locationsResult.success && locationsResult.data) {
        const activeLocations = (locationsResult.data as Location[]).filter((location) => location.isActive)
        setLocations(activeLocations)
        setSelectedLocationId(activeLocations[0]?.id || "")
      }

      if (productsResult.success && productsResult.data) {
        setProducts(productsResult.data.products.map((product) => ({
          id: product.id,
          productNumber: product.productNumber,
          name: product.name,
          unitOfMeasure: product.unitOfMeasure,
          customUnitName: product.customUnitName,
        })))
      }
    })
  }, [])

  useEffect(() => {
    loadMovements(selectedLocationId || undefined)
  }, [selectedLocationId])

  const filteredMovements = useMemo(
    () => movements.filter((movement) =>
      movement.product.name.toLowerCase().includes(search.toLowerCase()) ||
      String(movement.product.productNumber).includes(search) ||
      movement.type.toLowerCase().includes(search.toLowerCase())
    ),
    [movements, search]
  )

  const selectedProduct = products.find((product) => product.id === productId)

  async function handleSubmit() {
    if (!selectedLocationId) {
      alert("Seleccioná una sucursal para registrar el movimiento")
      return
    }

    setSubmitting(true)
    const result = await createManualInventoryMovement({
      productId,
      locationId: selectedLocationId,
      type: movementType,
      quantity: Number(quantity),
      notes,
    })

    if (!result.success) {
      alert(result.error || "No se pudo registrar el movimiento")
      setSubmitting(false)
      return
    }

    setProductId("")
    setQuantity("1")
    setNotes("")
    await loadMovements(selectedLocationId)
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entradas y salidas"
        description="Ledger operativo de inventario con stock inicial, ventas, compras y movimientos manuales auditados."
      />

      <Card>
        <CardHeader>
          <CardTitle>Registrar movimiento manual</CardTitle>
          <CardDescription>Usá este formulario para ingresar o sacar stock con motivo obligatorio.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[220px_220px_140px_140px_minmax(0,1fr)_160px]">
          <select value={selectedLocationId} onChange={(event) => setSelectedLocationId(event.target.value)} className="h-11 rounded-md border border-input bg-background px-3">
            <option value="">Seleccionar sucursal</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>

          <select value={productId} onChange={(event) => setProductId(event.target.value)} className="h-11 rounded-md border border-input bg-background px-3">
            <option value="">Seleccionar producto</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.name} (ID {product.productNumber}) · {getUnitLabel(product.unitOfMeasure, product.customUnitName)}</option>
            ))}
          </select>

          <select value={movementType} onChange={(event) => setMovementType(event.target.value as "MANUAL_IN" | "MANUAL_OUT")} className="h-11 rounded-md border border-input bg-background px-3">
            <option value="MANUAL_IN">Entrada</option>
            <option value="MANUAL_OUT">Salida</option>
          </select>

          <Input type="number" min={String(selectedProduct ? getQuantityStep(selectedProduct.unitOfMeasure) : 1)} step={String(selectedProduct ? getQuantityStep(selectedProduct.unitOfMeasure) : 1)} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Motivo del movimiento" />
          <Button onClick={handleSubmit} disabled={submitting || !productId || !notes.trim()}>
            {submitting ? "Guardando..." : "Registrar movimiento"}
          </Button>
        </CardContent>
      </Card>

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
                    {movement.quantityDelta >= 0 ? "+" : ""}{formatQuantity(movement.quantityDelta)} {getUnitLabel(movement.product.unitOfMeasure, movement.product.customUnitName)}
                  </p>
                  <p className="text-muted-foreground">{formatDate(movement.createdAt)}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-muted-foreground md:grid-cols-3">
                <p>Antes: {formatQuantity(movement.quantityBefore)} {getUnitLabel(movement.product.unitOfMeasure, movement.product.customUnitName)}</p>
                <p>Después: {formatQuantity(movement.quantityAfter)} {getUnitLabel(movement.product.unitOfMeasure, movement.product.customUnitName)}</p>
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
