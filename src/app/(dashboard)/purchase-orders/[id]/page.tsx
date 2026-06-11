"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Download, FileDown, Loader2, PackagePlus, Plus, Trash2 } from "lucide-react"
import { formatQuantity, getQuantityStep, getUnitLabel, type UnitOfMeasureValue } from "@/lib/quantity"

import { createProductForPurchaseOrder } from "@/app/actions/products"
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
import { exportPurchaseOrderPDF } from "@/lib/reports/pdf-export"

type Product = {
  id: string
  productNumber: number
  name: string
  unitOfMeasure: UnitOfMeasureValue
  customUnitName: string | null
  cost?: number | null
  price?: number | null
}

type PurchaseOrderItem = {
  id: string
  productId: string
  quantity: number
  receivedQty: number
  unitCost: number
  subtotal: number
  product: Product
}

type PurchaseOrderExpense = {
  id: string
  description: string
  amount: number
}

type PurchaseOrderAttachment = {
  id: string
  name: string
  fileUrl: string
  type: "RECEIPT" | "BUDGET" | "OTHER"
  createdAt: string
}

type PurchaseOrder = {
  id: string
  orderNumber: string
  status: "PENDING" | "CONFIRMED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED"
  supplierId: string
  supplier: { name: string }
  location: { name: string }
  subtotal: number
  tax: number
  total: number
  includeTax: boolean
  expectedDate: string | null
  receivedDate: string | null
  notes: string | null
  createdAt: string
  items: PurchaseOrderItem[]
  expenses?: PurchaseOrderExpense[]
  attachments?: PurchaseOrderAttachment[]
}

type EditableItem = {
  id?: string
  productId: string
  productName: string
  productNumber: number
  unitOfMeasure: UnitOfMeasureValue
  customUnitName: string | null
  quantity: number
  receivedQty: number
  unitCost: number
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

const statusLabel: Record<PurchaseOrder["status"], string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  PARTIALLY_RECEIVED: "Recepción parcial",
  RECEIVED: "Recibido",
  CANCELLED: "Cancelado",
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount)
}

function formatDateInput(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10)
}

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [items, setItems] = useState<EditableItem[]>([])
  const [expectedDate, setExpectedDate] = useState("")
  const [notes, setNotes] = useState("")
  const [includeTax, setIncludeTax] = useState(true)
  const [selectedProductId, setSelectedProductId] = useState("")
  const [selectedQuantity, setSelectedQuantity] = useState(1)
  const [selectedUnitCost, setSelectedUnitCost] = useState(0)
  const [receiveNotes, setReceiveNotes] = useState("")
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, string>>({})
  const [expenses, setExpenses] = useState<PurchaseOrderExpense[]>([])
  const [newExpenseDesc, setNewExpenseDesc] = useState("")
  const [newExpenseAmount, setNewExpenseAmount] = useState(0)
  const [attachments, setAttachments] = useState<PurchaseOrderAttachment[]>([])
  const [attachmentType, setAttachmentType] = useState<"RECEIPT" | "BUDGET" | "OTHER">("RECEIPT")
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [quickProductOpen, setQuickProductOpen] = useState(false)
  const [quickProductSubmitting, setQuickProductSubmitting] = useState(false)
  const [quickProduct, setQuickProduct] = useState<QuickProductForm>(emptyQuickProductForm)

  const orderId = params?.id

  const canEdit = order ? !["RECEIVED", "CANCELLED"].includes(order.status) : false
  const canReceive = order ? ["CONFIRMED", "PARTIALLY_RECEIVED"].includes(order.status) : false
  const selectedProductMeta = products.find((product) => product.id === selectedProductId)

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
    const tax = includeTax ? subtotal * 0.21 : 0
    const expensesTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0)
    const total = subtotal + tax + expensesTotal

    return { subtotal, tax, expensesTotal, total }
  }, [items, includeTax, expenses])

  async function loadData() {
    if (!orderId) return

    setLoading(true)
    try {
      const [orderRes, productsRes] = await Promise.all([
        fetch(`/api/purchase-orders/${orderId}`),
        fetch("/api/products?limit=100"),
      ])

      if (!orderRes.ok) {
        const payload = await orderRes.json().catch(() => null)
        throw new Error(payload?.error || "No se pudo cargar la orden")
      }

      const orderData = await orderRes.json()
      const productsData = productsRes.ok ? await productsRes.json() : { products: [] }

      setOrder(orderData)
      setItems(
        orderData.items.map((item: PurchaseOrderItem) => ({
          id: item.id,
          productId: item.productId,
          productName: item.product.name,
          productNumber: item.product.productNumber,
          unitOfMeasure: item.product.unitOfMeasure,
          customUnitName: item.product.customUnitName,
          quantity: item.quantity,
          receivedQty: item.receivedQty,
          unitCost: item.unitCost,
        }))
      )
      setExpectedDate(formatDateInput(orderData.expectedDate))
      setNotes(orderData.notes || "")
      setIncludeTax(orderData.includeTax !== false)
      setExpenses(orderData.expenses || [])
      setAttachments(orderData.attachments || [])
      setProducts(Array.isArray(productsData.products) ? productsData.products : [])
      setReceiveQuantities({})
      setReceiveNotes("")
    } catch (error: any) {
      alert(error.message || "Error al cargar la orden")
      router.push("/purchase-orders")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [orderId])

  function addItem() {
    if (!selectedProductId || selectedQuantity <= 0 || selectedUnitCost <= 0) return

    const product = products.find((entry) => entry.id === selectedProductId)
    if (!product) return

    setItems((current) => {
      const existing = current.find((item) => item.productId === selectedProductId)

      if (existing) {
        return current.map((item) =>
          item.productId === selectedProductId
            ? { ...item, quantity: item.quantity + selectedQuantity, unitCost: selectedUnitCost }
            : item
        )
      }

      return [
        ...current,
        {
          productId: product.id,
          productName: product.name,
          productNumber: product.productNumber,
          unitOfMeasure: product.unitOfMeasure,
          customUnitName: product.customUnitName,
          quantity: selectedQuantity,
          receivedQty: 0,
          unitCost: selectedUnitCost,
        },
      ]
    })

    setSelectedProductId("")
    setSelectedQuantity(1)
    setSelectedUnitCost(0)
  }

  function removeItem(productId: string) {
    setItems((current) => current.filter((item) => item.productId !== productId))
  }

  async function handleCreateQuickProduct() {
    if (quickProductSubmitting) return
    if (!order) return

    setQuickProductSubmitting(true)

    const result = await createProductForPurchaseOrder({
      name: quickProduct.name,
      cost: Number(quickProduct.cost),
      price: quickProduct.price ? Number(quickProduct.price) : undefined,
      barcode: quickProduct.barcode || undefined,
      unitOfMeasure: quickProduct.unitOfMeasure,
      customUnitName: quickProduct.unitOfMeasure === "OTHER" ? quickProduct.customUnitName : undefined,
      supplierId: order.supplierId,
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
    setSelectedProductId(createdProduct.id)
    setSelectedUnitCost(createdProduct.cost || Number(quickProduct.cost) || 0)
    setQuickProduct(emptyQuickProductForm)
    setQuickProductOpen(false)
    setQuickProductSubmitting(false)
  }

  async function saveChanges() {
    if (!orderId) return

    setSaving(true)
    try {
      const putIncludeTax = includeTax !== order?.includeTax ? includeTax : undefined
      const res = await fetch(`/api/purchase-orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedDate: expectedDate || null,
          notes,
          includeTax: putIncludeTax,
          expenses: expenses.map((exp) => ({
            ...(exp.id ? { id: exp.id } : {}),
            description: exp.description,
            amount: exp.amount,
          })),
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
        }),
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(payload?.error || "No se pudo guardar la orden")
      }

      await loadData()
    } catch (error: any) {
      alert(error.message || "Error al guardar cambios")
    } finally {
      setSaving(false)
    }
  }

  async function confirmOrder() {
    if (!orderId) return

    setSaving(true)
    try {
      const res = await fetch(`/api/purchase-orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CONFIRMED" }),
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(payload?.error || "No se pudo confirmar la orden")
      }

      await loadData()
    } catch (error: any) {
      alert(error.message || "Error al confirmar la orden")
    } finally {
      setSaving(false)
    }
  }

  async function receiveItems() {
    if (!orderId) return

    const receiptItems = Object.entries(receiveQuantities)
      .map(([itemId, quantity]) => ({ itemId, quantityReceived: Number(quantity) || 0 }))
      .filter((item) => item.quantityReceived > 0)

    if (receiptItems.length === 0) {
      alert("Indicá al menos una cantidad a recibir")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/purchase-orders/${orderId}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: receiptItems,
          notes: receiveNotes || undefined,
        }),
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(payload?.error || "No se pudo recibir la orden")
      }

      await loadData()
    } catch (error: any) {
      alert(error.message || "Error al recibir productos")
    } finally {
      setSaving(false)
    }
  }

  if (loading || !order) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/purchase-orders" className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Volver a órdenes
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Orden {order.orderNumber}</h1>
          <p className="text-muted-foreground">{order.supplier.name} · {order.location.name} · {statusLabel[order.status]}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => exportPurchaseOrderPDF({
              orderNumber: order.orderNumber,
              date: new Date(order.createdAt).toLocaleDateString("es-AR"),
              supplier: order.supplier.name,
              location: order.location.name,
              status: statusLabel[order.status],
              total: order.total,
              subtotal: order.subtotal,
              tax: order.tax,
              expectedDate: order.expectedDate ? new Date(order.expectedDate).toLocaleDateString("es-AR") : null,
              receivedDate: order.receivedDate ? new Date(order.receivedDate).toLocaleDateString("es-AR") : null,
              notes: order.notes,
              items: items.map((item) => ({
                id: item.id || item.productId,
                product: item.productName,
                quantity: item.quantity,
                unitCost: item.unitCost,
                subtotal: item.quantity * item.unitCost,
              })),
            })}
          >
            <FileDown className="h-4 w-4" />
            PDF
          </Button>
          {order.status === "PENDING" ? (
            <Button onClick={confirmOrder} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar orden"}
            </Button>
          ) : null}
          {canEdit ? (
            <Button variant="outline" onClick={saveChanges} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Datos de la orden</CardTitle>
              <CardDescription>Editá fecha y notas. La sucursal y el proveedor quedan fijos en esta versión.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha esperada</label>
                <Input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} disabled={!canEdit} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Notas</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={!canEdit}
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Productos</CardTitle>
                <CardDescription>Podés ajustar cantidades pendientes. No se puede bajar por debajo de lo recibido.</CardDescription>
              </div>
              {canEdit ? (
                <Button variant="outline" type="button" className="gap-2" onClick={() => setQuickProductOpen(true)}>
                  <PackagePlus className="h-4 w-4" />
                  Crear producto onsite
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {canEdit ? (
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_100px_140px_120px]">
                  <select
                    className="h-11 rounded-md border border-input bg-background px-3"
                    value={selectedProductId}
                    onChange={(event) => setSelectedProductId(event.target.value)}
                  >
                    <option value="">Seleccionar producto</option>
                    {products
                      .filter((product) => !items.some((item) => item.productId === product.id))
                      .map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} (ID {product.productNumber}) · {getUnitLabel(product.unitOfMeasure, product.customUnitName)}
                        </option>
                      ))}
                  </select>
                  <Input type="number" min={String(selectedProductMeta ? getQuantityStep(selectedProductMeta.unitOfMeasure) : 1)} step={String(selectedProductMeta ? getQuantityStep(selectedProductMeta.unitOfMeasure) : 1)} value={selectedQuantity} onChange={(event) => setSelectedQuantity(Number(event.target.value) || 1)} />
                  <Input type="number" min="0" step="0.01" value={selectedUnitCost || ""} onChange={(event) => setSelectedUnitCost(Number(event.target.value) || 0)} />
                  <Button type="button" variant="outline" onClick={addItem}>Agregar</Button>
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="py-2">Producto</th>
                      <th className="py-2 w-28">Pedida</th>
                      <th className="py-2 w-28">Recibida</th>
                      <th className="py-2 w-28">Pendiente</th>
                      <th className="py-2 w-36">Costo unit.</th>
                      <th className="py-2 w-32">Subtotal</th>
                      <th className="py-2 w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const pending = item.quantity - item.receivedQty

                      return (
                        <tr key={item.productId} className="border-b align-top">
                          <td className="py-3">
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">ID {item.productNumber} · {getUnitLabel(item.unitOfMeasure, item.customUnitName)}</p>
                          </td>
                          <td className="py-3">
                            <Input
                              type="number"
                              min={String(item.receivedQty || getQuantityStep(item.unitOfMeasure))}
                              step={String(getQuantityStep(item.unitOfMeasure))}
                              value={item.quantity}
                              disabled={!canEdit}
                              onChange={(event) => {
                                const nextQuantity = Number(event.target.value) || item.receivedQty || getQuantityStep(item.unitOfMeasure)
                                setItems((current) =>
                                  current.map((entry) =>
                                    entry.productId === item.productId
                                      ? { ...entry, quantity: Math.max(nextQuantity, entry.receivedQty || getQuantityStep(entry.unitOfMeasure)) }
                                      : entry
                                  )
                                )
                              }}
                            />
                          </td>
                          <td className="py-3 text-sm text-muted-foreground">{formatQuantity(item.receivedQty)}</td>
                          <td className="py-3 text-sm text-muted-foreground">{formatQuantity(pending)}</td>
                          <td className="py-3">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitCost}
                              disabled={!canEdit}
                              onChange={(event) => {
                                const nextCost = Number(event.target.value) || 0
                                setItems((current) =>
                                  current.map((entry) =>
                                    entry.productId === item.productId ? { ...entry, unitCost: nextCost } : entry
                                  )
                                )
                              }}
                            />
                          </td>
                          <td className="py-3 text-sm">{formatCurrency(item.quantity * item.unitCost)}</td>
                          <td className="py-3 text-right">
                            {canEdit && item.receivedQty === 0 ? (
                              <button className="text-sm text-destructive hover:underline" onClick={() => removeItem(item.productId)}>
                                Quitar
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {canReceive ? (
            <Card>
              <CardHeader>
                <CardTitle>Recibir productos</CardTitle>
                <CardDescription>Cargá solo lo que realmente llegó. El sistema suma stock por esa diferencia.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {order.items.map((item) => {
                    const pending = item.quantity - item.receivedQty

                    return (
                      <div key={item.id} className="grid gap-3 rounded-xl border border-border/70 p-4 md:grid-cols-[minmax(0,1fr)_140px] md:items-center">
                        <div>
                      <p className="font-medium">{item.product.name}</p>
                          <p className="text-sm text-muted-foreground">Recibido {formatQuantity(item.receivedQty)} de {formatQuantity(item.quantity)} {getUnitLabel(item.product.unitOfMeasure, item.product.customUnitName)} · pendiente {formatQuantity(pending)}</p>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          max={String(pending)}
                          step={String(getQuantityStep(item.product.unitOfMeasure))}
                          value={receiveQuantities[item.id] || ""}
                          placeholder="0"
                          onChange={(event) =>
                            setReceiveQuantities((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          disabled={pending <= 0}
                        />
                      </div>
                    )
                  })}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Notas de recepción</label>
                  <textarea
                    value={receiveNotes}
                    onChange={(event) => setReceiveNotes(event.target.value)}
                    className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2"
                    placeholder="Ej: faltaron 2 unidades, llega el resto mañana"
                  />
                </div>

                <Button onClick={receiveItems} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar recepción"}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span>Estado</span><span>{statusLabel[order.status]}</span></div>
              <div className="flex justify-between"><span>Creada</span><span>{new Date(order.createdAt).toLocaleDateString("es-AR")}</span></div>
              <div className="flex justify-between"><span>Esperada</span><span>{order.expectedDate ? new Date(order.expectedDate).toLocaleDateString("es-AR") : "-"}</span></div>
              <div className="flex justify-between"><span>Recibida completa</span><span>{order.receivedDate ? new Date(order.receivedDate).toLocaleDateString("es-AR") : "-"}</span></div>
              <div className="border-t pt-3" />
              {canEdit ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={includeTax}
                    onChange={(event) => setIncludeTax(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span>Incluye IVA (21%)</span>
                </label>
              ) : (
                <div className="flex justify-between"><span>Incluye IVA</span><span>{includeTax ? "Sí" : "No"}</span></div>
              )}
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
              {includeTax ? (
                <div className="flex justify-between"><span>IVA (21%)</span><span>{formatCurrency(totals.tax)}</span></div>
              ) : (
                <div className="flex justify-between text-muted-foreground"><span>IVA</span><span>$0</span></div>
              )}
              {totals.expensesTotal > 0 ? (
                <div className="flex justify-between"><span>Gastos adicionales</span><span>{formatCurrency(totals.expensesTotal)}</span></div>
              ) : null}
              <div className="flex justify-between font-semibold"><span>Total</span><span>{formatCurrency(totals.total)}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gastos adicionales</CardTitle>
              <CardDescription>Fletes, seguros, y otros gastos asociados a esta compra.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {expenses.length > 0 ? (
                <div className="space-y-2">
                  {expenses.map((exp) => (
                    <div key={exp.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/70 p-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{exp.description}</p>
                        <p className="text-sm text-muted-foreground">{formatCurrency(exp.amount)}</p>
                      </div>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => setExpenses((current) => current.filter((e) => e.id !== exp.id))}
                          className="text-destructive hover:text-destructive/80"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin gastos adicionales registrados.</p>
              )}
              {canEdit ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newExpenseDesc}
                    onChange={(event) => setNewExpenseDesc(event.target.value)}
                    placeholder="Descripción"
                    className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newExpenseAmount || ""}
                    onChange={(event) => setNewExpenseAmount(parseFloat(event.target.value) || 0)}
                    placeholder="Monto"
                    className="h-10 w-28 rounded-md border border-input bg-background px-3 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!newExpenseDesc || newExpenseAmount <= 0}
                    onClick={() => {
                      setExpenses((current) => [...current, {
                        id: `new-${Date.now()}`,
                        description: newExpenseDesc,
                        amount: newExpenseAmount,
                      }])
                      setNewExpenseDesc("")
                      setNewExpenseAmount(0)
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Adjuntos</CardTitle>
              <CardDescription>Facturas, presupuestos y documentos relacionados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((att) => (
                    <div key={att.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/70 p-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-700/10">
                          {att.type === "RECEIPT" ? "Factura" : att.type === "BUDGET" ? "Presupuesto" : "Otro"}
                        </span>
                        <p className="text-sm font-medium truncate">{att.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" download>
                          <Button type="button" variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm("¿Eliminar este archivo?")) return
                              try {
                                const res = await fetch(`/api/purchase-orders/${orderId}/attachments/${att.id}`, {
                                  method: "DELETE",
                                })
                                if (!res.ok) throw new Error("Error al eliminar")
                                setAttachments((current) => current.filter((a) => a.id !== att.id))
                              } catch {
                                alert("No se pudo eliminar el archivo")
                              }
                            }}
                            className="text-destructive hover:text-destructive/80"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin archivos adjuntos.</p>
              )}
              {canEdit ? (
                <div className="flex gap-2">
                  <select
                    value={attachmentType}
                    onChange={(event) => setAttachmentType(event.target.value as "RECEIPT" | "BUDGET" | "OTHER")}
                    className="h-10 w-36 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="RECEIPT">Factura</option>
                    <option value="BUDGET">Presupuesto</option>
                    <option value="OTHER">Otro</option>
                  </select>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={async (event) => {
                      const file = event.target.files?.[0]
                      if (!file) return

                      setUploading(true)
                      try {
                        const formData = new FormData()
                        formData.append("file", file)
                        formData.append("name", file.name)
                        formData.append("type", attachmentType)

                        const res = await fetch(`/api/purchase-orders/${orderId}/attachments`, {
                          method: "POST",
                          body: formData,
                        })

                        if (!res.ok) {
                          const payload = await res.json().catch(() => null)
                          throw new Error(payload?.error || "Error al subir archivo")
                        }

                        const newAttachment = await res.json()
                        setAttachments((current) => [...current, newAttachment])
                      } catch (error: any) {
                        alert(error.message || "No se pudo subir el archivo")
                      } finally {
                        setUploading(false)
                        event.target.value = ""
                      }
                    }}
                    className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-sm file:text-primary-foreground"
                  />
                </div>
              ) : null}
              {uploading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Subiendo archivo...
                </div>
              ) : null}
            </CardContent>
          </Card>
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
              Guardá el producto sin sumar stock. El costo es obligatorio; el precio de venta puede definirse más tarde.
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
