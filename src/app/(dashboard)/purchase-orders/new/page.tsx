"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, PackagePlus, Plus, ShoppingBag } from "lucide-react"

import { createProductForPurchaseOrder } from "@/app/actions/products"
import { PageHeader } from "@/components/dashboard/page-primitives"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatQuantity, getQuantityStep, getUnitLabel, type UnitOfMeasureValue } from "@/lib/quantity"

interface Supplier { id: string; name: string }
interface Location { id: string; name: string }
interface Product { id: string; name: string; productNumber: number; unitOfMeasure: UnitOfMeasureValue; customUnitName: string | null; cost?: number | null; price?: number | null }
interface OrderItem {
  productId: string
  productName: string
  unitOfMeasure: UnitOfMeasureValue
  customUnitName: string | null
  quantity: number
  unitCost: number
  subtotal: number
}

type QuickProductForm = {
  name: string
  cost: string
  price: string
  barcode: string
  unitOfMeasure: UnitOfMeasureValue
  customUnitName: string
}

const emptyQuickProductForm: QuickProductForm = {
  name: "",
  cost: "",
  price: "",
  barcode: "",
  unitOfMeasure: "UNIT",
  customUnitName: "",
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [quickProductOpen, setQuickProductOpen] = useState(false)
  const [quickProductSubmitting, setQuickProductSubmitting] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState("")
  const [selectedLocation, setSelectedLocation] = useState("")
  const [expectedDate, setExpectedDate] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<OrderItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [unitCost, setUnitCost] = useState(0)
  const [quickProduct, setQuickProduct] = useState<QuickProductForm>(emptyQuickProductForm)

  useEffect(() => {
    Promise.all([
      fetch("/api/suppliers").then((response) => response.ok ? response.json() : []),
      fetch("/api/locations").then((response) => response.ok ? response.json() : []),
      fetch("/api/products?limit=100").then((response) => response.ok ? response.json() : { products: [] }),
    ]).then(([suppliersData, locationsData, productsData]) => {
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : [])
      setLocations(Array.isArray(locationsData) ? locationsData : [])
      setProducts(Array.isArray(productsData) ? productsData : (productsData.products || []))
    }).catch(() => {
      setSuppliers([])
      setLocations([])
      setProducts([])
    }).finally(() => {
      setBootstrapping(false)
    })
  }, [])

  function addItem() {
    if (!selectedProduct || quantity <= 0 || unitCost <= 0) return
    const product = products.find((entry) => entry.id === selectedProduct)
    if (!product) return

    const existingIndex = items.findIndex((item) => item.productId === selectedProduct)
    if (existingIndex >= 0) {
      const updatedItems = [...items]
      updatedItems[existingIndex].quantity += quantity
      updatedItems[existingIndex].subtotal = updatedItems[existingIndex].quantity * updatedItems[existingIndex].unitCost
      setItems(updatedItems)
    } else {
      setItems((current) => [...current, {
        productId: selectedProduct,
        productName: product.name,
        unitOfMeasure: product.unitOfMeasure,
        customUnitName: product.customUnitName,
        quantity,
        unitCost,
        subtotal: quantity * unitCost,
      }])
    }

    setSelectedProduct("")
    setQuantity(1)
    setUnitCost(0)
  }

  function removeItem(productId: string) {
    setItems(items.filter((item) => item.productId !== productId))
  }

  async function handleCreateQuickProduct() {
    if (quickProductSubmitting) return
    setQuickProductSubmitting(true)

    const result = await createProductForPurchaseOrder({
      name: quickProduct.name,
      cost: Number(quickProduct.cost),
      price: quickProduct.price ? Number(quickProduct.price) : undefined,
      barcode: quickProduct.barcode || undefined,
      unitOfMeasure: quickProduct.unitOfMeasure,
      customUnitName: quickProduct.unitOfMeasure === "OTHER" ? quickProduct.customUnitName : undefined,
      supplierId: selectedSupplier || undefined,
    })

    if (!result.success || !result.data) {
      alert(result.error || "No se pudo crear el producto")
      setQuickProductSubmitting(false)
      return
    }

    const createdProduct = {
      id: result.data.id,
      name: result.data.name,
      productNumber: result.data.productNumber,
      unitOfMeasure: result.data.unitOfMeasure,
      customUnitName: result.data.customUnitName,
      cost: result.data.cost,
      price: result.data.price,
    }

    setProducts((current) => [createdProduct, ...current].sort((a, b) => a.name.localeCompare(b.name)))
    setSelectedProduct(createdProduct.id)
    setUnitCost(createdProduct.cost || Number(quickProduct.cost) || 0)
    setQuickProduct(emptyQuickProductForm)
    setQuickProductOpen(false)
    setQuickProductSubmitting(false)
  }

  async function handleSubmit() {
    if (!selectedSupplier || !selectedLocation || items.length === 0) return
    setLoading(true)
    try {
      const response = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: selectedSupplier,
          locationId: selectedLocation,
          expectedDate: expectedDate || undefined,
          notes: notes || undefined,
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity, unitCost: item.unitCost })),
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "No se pudo crear la orden")
      }

      router.push("/purchase-orders")
    } catch (error: any) {
      alert(error.message || "No se pudo crear la orden")
    } finally {
      setLoading(false)
    }
  }

  const selectedProductMeta = products.find((product) => product.id === selectedProduct)

  const summary = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
    const tax = subtotal * 0.21
    const total = subtotal + tax
    return { subtotal, tax, total }
  }, [items])

  if (bootstrapping) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Nueva orden de compra"
          description="Armá la compra sin cortar el flujo: elegí proveedor, cargá costos y, si falta algo, creá el producto en el momento."
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Datos de la orden</CardTitle>
                <CardDescription>La orden no mueve stock todavía. El ingreso real sucede recién cuando registrás la recepción.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <select className="h-11 w-full rounded-md border border-input bg-background px-3" value={selectedSupplier} onChange={(event) => setSelectedSupplier(event.target.value)}>
                    <option value="">Seleccionar proveedor</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Sucursal</Label>
                  <select className="h-11 w-full rounded-md border border-input bg-background px-3" value={selectedLocation} onChange={(event) => setSelectedLocation(event.target.value)}>
                    <option value="">Seleccionar sucursal</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>{location.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Fecha esperada</Label>
                  <Input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Notas</Label>
                  <textarea
                    className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Ej: entrega parcial, condición acordada, faltantes esperados"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Productos</CardTitle>
                  <CardDescription>Sumá items con costo confirmado. Si el producto no existe todavía, lo podés dar de alta acá mismo.</CardDescription>
                </div>
                <Button variant="outline" type="button" className="gap-2" onClick={() => setQuickProductOpen(true)}>
                  <PackagePlus className="h-4 w-4" />
                  Crear producto onsite
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_110px_140px_120px]">
                  <div className="space-y-2">
                    <Label>Producto</Label>
                    <select className="h-11 w-full rounded-md border border-input bg-background px-3" value={selectedProduct} onChange={(event) => {
                      const nextProductId = event.target.value
                      setSelectedProduct(nextProductId)
                      const nextProduct = products.find((product) => product.id === nextProductId)
                      if (nextProduct?.cost) {
                        setUnitCost(Number(nextProduct.cost))
                      }
                    }}>
                      <option value="">Seleccionar producto</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>{product.name} (ID {product.productNumber}) · {getUnitLabel(product.unitOfMeasure, product.customUnitName)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cantidad</Label>
                    <Input
                      type="number"
                      min={String(selectedProductMeta ? getQuantityStep(selectedProductMeta.unitOfMeasure) : 1)}
                      step={String(selectedProductMeta ? getQuantityStep(selectedProductMeta.unitOfMeasure) : 1)}
                      value={quantity}
                      onChange={(event) => setQuantity(parseFloat(event.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Costo unitario</Label>
                    <Input type="number" min="0" step="0.01" value={unitCost || ""} onChange={(event) => setUnitCost(parseFloat(event.target.value) || 0)} />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" className="w-full gap-2" onClick={addItem}>
                      <Plus className="h-4 w-4" />
                      Agregar
                    </Button>
                  </div>
                </div>

                {items.length === 0 ? (
                  <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/15 text-center">
                    <ShoppingBag className="mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="font-medium text-foreground">Todavía no agregaste productos</p>
                    <p className="text-sm text-muted-foreground">Cargá cantidades y costos para armar la orden.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-[760px] w-full">
                      <thead>
                        <tr className="border-b text-left text-sm text-muted-foreground">
                          <th className="py-2">Producto</th>
                          <th className="py-2 w-28">Cantidad</th>
                          <th className="py-2 w-36">Costo unit.</th>
                          <th className="py-2 w-32">Subtotal</th>
                          <th className="py-2 w-24 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.productId} className="border-b align-top">
                            <td className="py-3">
                              <p className="font-medium text-foreground">{item.productName}</p>
                              <p className="text-xs text-muted-foreground">{getUnitLabel(item.unitOfMeasure, item.customUnitName)}</p>
                            </td>
                            <td className="py-3">
                              <Input
                                type="number"
                                min={String(getQuantityStep(item.unitOfMeasure))}
                                step={String(getQuantityStep(item.unitOfMeasure))}
                                value={item.quantity}
                                onChange={(event) => {
                                  const nextQuantity = parseFloat(event.target.value) || getQuantityStep(item.unitOfMeasure)
                                  setItems((current) => current.map((entry) =>
                                    entry.productId === item.productId
                                      ? { ...entry, quantity: nextQuantity, subtotal: nextQuantity * entry.unitCost }
                                      : entry
                                  ))
                                }}
                              />
                            </td>
                            <td className="py-3">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitCost}
                                onChange={(event) => {
                                  const nextCost = parseFloat(event.target.value) || 0
                                  setItems((current) => current.map((entry) =>
                                    entry.productId === item.productId
                                      ? { ...entry, unitCost: nextCost, subtotal: entry.quantity * nextCost }
                                      : entry
                                  ))
                                }}
                              />
                            </td>
                            <td className="py-3 text-sm">
                              <p className="font-medium text-foreground">{formatCurrency(item.subtotal)}</p>
                              <p className="text-xs text-muted-foreground">{formatQuantity(item.quantity)}</p>
                            </td>
                            <td className="py-3 text-right">
                              <Button type="button" variant="outline" onClick={() => removeItem(item.productId)}>
                                Quitar
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Resumen</CardTitle>
                <CardDescription>La orden queda registrada, pero el stock espera a la recepción.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span>Items</span><span>{items.length}</span></div>
                <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(summary.subtotal)}</span></div>
                <div className="flex justify-between"><span>IVA (21%)</span><span>{formatCurrency(summary.tax)}</span></div>
                <div className="border-t border-border/70 pt-3 flex justify-between text-base font-semibold"><span>Total</span><span>{formatCurrency(summary.total)}</span></div>
              </CardContent>
            </Card>

            <Button onClick={handleSubmit} disabled={loading || !selectedSupplier || !selectedLocation || items.length === 0} className="min-h-12 w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear orden"}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={quickProductOpen} onOpenChange={(open) => {
        setQuickProductOpen(open)
        if (!open) {
          setQuickProduct(emptyQuickProductForm)
        }
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Crear producto para esta compra</DialogTitle>
            <DialogDescription>
              Guardá el producto sin sumar stock. El costo es obligatorio; el precio de venta puede quedar para después.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Nombre</Label>
              <Input value={quickProduct.name} onChange={(event) => setQuickProduct((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Costo obligatorio</Label>
              <Input type="number" min="0" step="0.01" value={quickProduct.cost} onChange={(event) => setQuickProduct((current) => ({ ...current, cost: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Precio de venta opcional</Label>
              <Input type="number" min="0" step="0.01" value={quickProduct.price} onChange={(event) => setQuickProduct((current) => ({ ...current, price: event.target.value }))} placeholder="Podés definirlo después" />
            </div>
            <div className="space-y-2">
              <Label>Unidad</Label>
              <select className="h-11 w-full rounded-md border border-input bg-background px-3" value={quickProduct.unitOfMeasure} onChange={(event) => setQuickProduct((current) => ({ ...current, unitOfMeasure: event.target.value as UnitOfMeasureValue }))}>
                <option value="UNIT">Unidad</option>
                <option value="ML">Mililitros</option>
                <option value="G">Gramos</option>
                <option value="KG">Kilogramos</option>
                <option value="LT">Litros</option>
                <option value="OTHER">Otra</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Código de barras</Label>
              <Input value={quickProduct.barcode} onChange={(event) => setQuickProduct((current) => ({ ...current, barcode: event.target.value }))} />
            </div>
            {quickProduct.unitOfMeasure === "OTHER" ? (
              <div className="space-y-2 md:col-span-2">
                <Label>Unidad personalizada</Label>
                <Input value={quickProduct.customUnitName} onChange={(event) => setQuickProduct((current) => ({ ...current, customUnitName: event.target.value }))} placeholder="Ej: pack, docena, caja" />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickProductOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateQuickProduct} disabled={quickProductSubmitting || !quickProduct.name || !quickProduct.cost}>
              {quickProductSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
