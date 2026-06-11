"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type SaleItem = {
  id?: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
}

type Product = {
  id: string
  name: string
  productNumber: number
  price: number
  unitOfMeasure: string
  customUnitName: string | null
}

type EditSaleDialogProps = {
  saleId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(value)
}

export function EditSaleDialog({ saleId, open, onOpenChange, onSaved }: EditSaleDialogProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<SaleItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState("CASH")
  const [notes, setNotes] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState("")
  const [newItemQuantity, setNewItemQuantity] = useState(1)
  const [newItemPrice, setNewItemPrice] = useState(0)

  // Check if sale is editable (within 24h)
  const [createdAt, setCreatedAt] = useState<Date | null>(null)
  const isWithin24h = useMemo(() => {
    if (!createdAt) return false
    const now = new Date()
    const diff = now.getTime() - createdAt.getTime()
    return diff < 24 * 60 * 60 * 1000
  }, [createdAt])

  // Validate all items have positive quantities
  const isValid = useMemo(() => {
    return items.length > 0 && items.every((item) => item.quantity > 0 && item.unitPrice >= 0)
  }, [items])

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    return {
      subtotal,
      total: subtotal,
    }
  }, [items])

  const loadSale = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [saleRes, productsRes] = await Promise.all([
        fetch(`/api/sales/${saleId}`),
        fetch("/api/products?limit=200"),
      ])

      if (!saleRes.ok) {
        const payload = await saleRes.json().catch(() => null)
        throw new Error(payload?.error || "No se pudo cargar la venta")
      }

      const saleData = await saleRes.json()
      const productsData = productsRes.ok ? await productsRes.json() : { products: [] }
      const productList = Array.isArray(productsData) ? productsData : (productsData.products || [])

      setCreatedAt(new Date(saleData.createdAt))
      setPaymentMethod(saleData.paymentMethod || "CASH")
      setNotes(saleData.notes || "")
      setItems(
        saleData.items.map((item: any) => ({
          id: item.id,
          productId: item.productId,
          productName: item.product?.name || "Producto",
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        }))
      )
      setProducts(productList)
    } catch (err: any) {
      setError(err.message || "Error al cargar la venta")
    } finally {
      setLoading(false)
    }
  }, [saleId])

  useEffect(() => {
    if (open) {
      loadSale()
    }
  }, [open, loadSale])

  function addItem() {
    if (!selectedProductId || newItemQuantity <= 0 || newItemPrice < 0) return

    const product = products.find((p) => p.id === selectedProductId)
    if (!product) return

    const existingIndex = items.findIndex((item) => item.productId === selectedProductId)
    if (existingIndex >= 0) {
      setItems((current) =>
        current.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: item.quantity + newItemQuantity, unitPrice: newItemPrice }
            : item
        )
      )
    } else {
      setItems((current) => [
        ...current,
        {
          productId: product.id,
          productName: product.name,
          quantity: newItemQuantity,
          unitPrice: newItemPrice,
        },
      ])
    }

    setSelectedProductId("")
    setNewItemQuantity(1)
    setNewItemPrice(0)
  }

  function removeItem(productId: string) {
    setItems((current) => current.filter((item) => item.productId !== productId))
  }

  function updateItem(productId: string, field: "quantity" | "unitPrice", value: number) {
    setItems((current) =>
      current.map((item) =>
        item.productId === productId ? { ...item, [field]: value } : item
      )
    )
  }

  async function handleSave() {
    if (!isValid || saving) return

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/sales/${saleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          paymentMethod,
          notes: notes || null,
        }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error || "Error al guardar los cambios")
      }

      onSaved()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message || "Error al guardar los cambios")
    } finally {
      setSaving(false)
    }
  }

  const selectedProduct = products.find((p) => p.id === selectedProductId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar venta</DialogTitle>
          <DialogDescription>
            {isWithin24h
              ? "Modificá productos, cantidades y precios. El stock se ajusta automáticamente."
              : "Esta venta ya no se puede editar (pasaron más de 24 horas)."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error && items.length === 0 ? (
          <div className="py-8 text-center text-sm text-destructive">{error}</div>
        ) : (
          <div className="space-y-4">
            {!isWithin24h && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                Esta venta tiene más de 24 horas y no puede ser editada.
              </div>
            )}

            <div className="space-y-2">
              <Label>Método de pago</Label>
              <Select
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                disabled={!isWithin24h}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Efectivo</SelectItem>
                  <SelectItem value="CARD">Tarjeta</SelectItem>
                  <SelectItem value="TRANSFER">Transferencia</SelectItem>
                  <SelectItem value="OTHER">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <Label>Productos</Label>

              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No hay productos en esta venta.
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center gap-2 rounded-lg border border-border/70 p-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.productName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20">
                          <Input
                            type="number"
                            min="0.001"
                            step="1"
                            value={item.quantity}
                            disabled={!isWithin24h}
                            onChange={(event) =>
                              updateItem(item.productId, "quantity", parseFloat(event.target.value) || 0)
                            }
                            className="h-9 text-sm"
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">×</span>
                        <div className="w-28">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            disabled={!isWithin24h}
                            onChange={(event) =>
                              updateItem(item.productId, "unitPrice", parseFloat(event.target.value) || 0)
                            }
                            className="h-9 text-sm"
                          />
                        </div>
                        <span className="w-24 text-right text-sm font-medium">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </span>
                        {isWithin24h ? (
                          <button
                            type="button"
                            onClick={() => removeItem(item.productId)}
                            className="text-destructive hover:text-destructive/80"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add item */}
            {isWithin24h ? (
              <div className="grid grid-cols-[1fr_80px_100px_auto] gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Agregar producto</Label>
                  <select
                    value={selectedProductId}
                    onChange={(event) => {
                      const pid = event.target.value
                      setSelectedProductId(pid)
                      const product = products.find((p) => p.id === pid)
                      if (product) {
                        setNewItemPrice(Number(product.price))
                      }
                    }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Seleccionar...</option>
                    {products
                      .filter((p) => !items.some((item) => item.productId === p.id))
                      .map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cant.</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={newItemQuantity}
                    onChange={(event) => setNewItemQuantity(parseFloat(event.target.value) || 1)}
                    className="h-10 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Precio</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItemPrice || ""}
                    onChange={(event) => setNewItemPrice(parseFloat(event.target.value) || 0)}
                    className="h-10 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10"
                  disabled={!selectedProductId || newItemQuantity <= 0}
                  onClick={addItem}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : null}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notas</Label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={!isWithin24h}
                className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Notas opcionales..."
              />
            </div>

            {/* Totals */}
            <div className="border-t pt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>

            {error ? (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {isWithin24h ? (
            <Button onClick={handleSave} disabled={saving || !isValid || loading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
