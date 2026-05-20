"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface Supplier { id: string; name: string }
interface Location { id: string; name: string }
interface Product { id: string; name: string; productNumber: number }
interface OrderItem {
  productId: string
  productName: string
  quantity: number
  unitCost: number
  subtotal: number
}

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
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

  useEffect(() => {
    setMounted(true)
    Promise.all([
      fetch("/api/suppliers").then(r => r.ok ? r.json() : []),
      fetch("/api/locations").then(r => r.ok ? r.json() : []),
      fetch("/api/products?limit=100").then(r => r.ok ? r.json() : { products: [] }),
    ]).then(([suppliersData, locationsData, productsData]) => {
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : [])
      setLocations(Array.isArray(locationsData) ? locationsData : [])
      setProducts(Array.isArray(productsData) ? productsData : (productsData.products || []))
    }).catch(() => {
      setSuppliers([])
      setLocations([])
      setProducts([])
    })
  }, [])

  function addItem() {
    if (!selectedProduct || quantity <= 0 || unitCost <= 0) return
    const product = products.find((p) => p.id === selectedProduct)
    if (!product) return
    const existingIndex = items.findIndex((item) => item.productId === selectedProduct)
    if (existingIndex >= 0) {
      const updatedItems = [...items]
      updatedItems[existingIndex].quantity += quantity
      updatedItems[existingIndex].subtotal = updatedItems[existingIndex].quantity * updatedItems[existingIndex].unitCost
      setItems(updatedItems)
    } else {
      setItems([...items, { productId: selectedProduct, productName: product.name, quantity, unitCost, subtotal: quantity * unitCost }])
    }
    setSelectedProduct("")
    setQuantity(1)
    setUnitCost(0)
  }

  function removeItem(productId: string) {
    setItems(items.filter((item) => item.productId !== productId))
  }

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
  const tax = subtotal * 0.21
  const total = subtotal + tax

  async function handleSubmit() {
    if (!selectedSupplier || !selectedLocation || items.length === 0) return
    setLoading(true)
    try {
      const res = await fetch("/api/purchase-orders", {
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
      if (res.ok) router.push("/purchase-orders")
    } catch {}
    setLoading(false)
  }

  if (!mounted) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nueva Orden de Compra</h1>
        <p className="text-muted-foreground">Crea una nueva orden de compra a proveedor</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Datos de la Orden</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Proveedor *</label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                >
                  <option value="">Seleccionar proveedor</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sucursal *</label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                >
                  <option value="">Seleccionar sucursal</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha Esperada</label>
                <input
                  type="date"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Notas</label>
                <input
                  type="text"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas adicionales"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Productos</h2>
            <div className="flex gap-4 mb-4">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Producto</label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                >
                  <option value="">Seleccionar producto</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} (ID {p.productNumber})</option>)}
                </select>
              </div>
              <div className="w-24 space-y-2">
                <label className="text-sm font-medium">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="w-32 space-y-2">
                <label className="text-sm font-medium">Costo Unit.</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={unitCost || ""}
                  onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={addItem}
                  className="h-10 px-4 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
                >
                  + Agregar
                </button>
              </div>
            </div>

            {items.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Producto</th>
                    <th className="text-left py-2 w-24">Cantidad</th>
                    <th className="text-left py-2 w-32">Costo Unit.</th>
                    <th className="text-left py-2 w-32">Subtotal</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.productId} className="border-b">
                      <td className="py-2">{item.productName}</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="1"
                          className="w-full h-8 px-2 rounded border"
                          value={item.quantity}
                          onChange={(e) => {
                            const qty = parseInt(e.target.value) || 1
                            setItems(items.map(i => i.productId === item.productId ? { ...i, quantity: qty, subtotal: qty * i.unitCost } : i))
                          }}
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-full h-8 px-2 rounded border"
                          value={item.unitCost}
                          onChange={(e) => {
                            const cost = parseFloat(e.target.value) || 0
                            setItems(items.map(i => i.productId === item.productId ? { ...i, unitCost: cost, subtotal: i.quantity * cost } : i))
                          }}
                        />
                      </td>
                      <td className="py-2">${item.subtotal.toFixed(2)}</td>
                      <td className="py-2">
                        <button onClick={() => removeItem(item.productId)} className="text-destructive hover:underline">X</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No hay productos agregados</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Resumen</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA (21%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !selectedSupplier || !selectedLocation || items.length === 0}
            className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Creando..." : "Crear Orden"}
          </button>
        </div>
      </div>
    </div>
  )
}
