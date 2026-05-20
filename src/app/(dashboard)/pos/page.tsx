"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Banknote,
  CreditCard,
  Loader2,
  Minus,
  QrCode,
  Receipt,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  Plus,
} from "lucide-react"

import { getLocations } from "@/app/actions/locations"
import { getProducts } from "@/app/actions/products"
import { createSale } from "@/app/actions/sales"
import { getCashSessions } from "@/app/actions/cash"
import { useCart, CartProvider } from "@/contexts/cart-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table"

interface Location {
  id: string
  name: string
}

interface Product {
  id: string
  productNumber: number
  name: string
  price: number
  sku: string | null
  barcode: string | null
}

interface CashSessionOption {
  id: string
  locationId: string
  registerLabel: string
  shiftLabel: "MANANA" | "TARDE" | "OTRO"
  status: "OPEN" | "CLOSED"
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function POSContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { items, addItem, removeItem, updateQuantity, clearCart, getTotal, getItemCount } = useCart()

  const [locations, setLocations] = useState<Location[]>([])
  const [cashSessions, setCashSessions] = useState<CashSessionOption[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [locationId, setLocationId] = useState("")
  const [cashSessionId, setCashSessionId] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "TRANSFER" | "OTHER">("CASH")
  const [submitting, setSubmitting] = useState(false)
  const [saleComplete, setSaleComplete] = useState<any>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [locationsResult, productsResult] = await Promise.all([getLocations(), getProducts(1, 50)])

    if (locationsResult.success && locationsResult.data) {
      const activeLocations = (locationsResult.data as any[]).filter((location) => location.isActive)
      setLocations(activeLocations)
      const requestedLocationId = searchParams.get("locationId")
      if (requestedLocationId && activeLocations.some((location) => location.id === requestedLocationId)) {
        setLocationId(requestedLocationId)
      } else if (activeLocations.length > 0 && !locationId) {
        setLocationId(activeLocations[0].id)
      }
    }

    if (productsResult.success && productsResult.data) {
      setProducts(productsResult.data.products as Product[])
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!locationId) {
      setCashSessions([])
      setCashSessionId("")
      return
    }

    getCashSessions(locationId, "OPEN").then((sessions) => {
      const normalized = (sessions as any[]).map((session) => ({
        id: session.id,
        locationId: session.locationId,
        registerLabel: session.registerLabel,
        shiftLabel: session.shiftLabel,
        status: session.status,
      })) as CashSessionOption[]

      setCashSessions(normalized)

      const requestedCashSessionId = searchParams.get("cashSessionId")
      if (requestedCashSessionId && normalized.some((session) => session.id === requestedCashSessionId)) {
        setCashSessionId(requestedCashSessionId)
        return
      }

      setCashSessionId((current) => (
        normalized.some((session) => session.id === current)
          ? current
          : (normalized[0]?.id || "")
      ))
    })
  }, [locationId, searchParams])

  function handleCheckout() {
    if (!locationId) {
      alert("Seleccioná una sucursal")
      return
    }

    if (items.length === 0) {
      alert("El carrito está vacío")
      return
    }

    if (!cashSessionId) {
      alert("Seleccioná una caja abierta")
      return
    }

    setSubmitting(true)

    createSale({
      locationId,
      cashSessionId,
      paymentMethod,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.price,
      })),
    }).then((result) => {
      setSubmitting(false)

      if (result.success) {
        setSaleComplete(result.data)
        clearCart()
      } else {
        alert(result.error || "Error al procesar venta")
      }
    })
  }

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.name.toLowerCase().includes(search.toLowerCase()) ||
          String(product.productNumber).includes(search) ||
          (product.sku && product.sku.toLowerCase().includes(search.toLowerCase())) ||
          (product.barcode && product.barcode.includes(search))
      ),
    [products, search]
  )

  const currentLocation = locations.find((location) => location.id === locationId)
  const currentCashSession = cashSessions.find((session) => session.id === cashSessionId)

  if (saleComplete) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success/18">
              <Receipt className="h-8 w-8 text-success-foreground" />
            </div>
            <CardTitle className="mt-2 text-2xl">Venta completada</CardTitle>
            <CardDescription>Factura {saleComplete.invoiceNumber}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableBody>
                {saleComplete.items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-normal">{item.product.name} x {item.quantity}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between border-t border-border/70 pt-4 text-lg font-semibold">
              <span>Total</span>
              <span>{formatCurrency(saleComplete.total)}</span>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              {saleComplete.location.name} · {saleComplete.user.name}
            </p>

            <Button
              className="w-full"
              onClick={() => {
                setSaleComplete(null)
                router.refresh()
                loadData()
              }}
            >
              Nueva venta
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Punto de venta</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Caja operativa con búsqueda rápida, grilla de productos y carrito persistente en la misma pantalla.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="min-h-9 px-3">{getItemCount()} items en carrito</Badge>
          <Badge variant="info" className="min-h-9 max-w-full px-3 text-center">{currentLocation?.name || "Sin sucursal"}</Badge>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,420px)]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Selección de productos</CardTitle>
              <CardDescription>Patrón visual parecido a ERPOS: filtros arriba, catálogo abajo, acciones claras.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, ID o código de barras..."
                    className="h-11 pl-10"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <Select value={locationId} onValueChange={(value) => setLocationId(value || "") }>
                  <SelectTrigger className="h-11 w-full lg:w-60">
                    <Store className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={cashSessionId} onValueChange={(value) => setCashSessionId(value || "") }>
                  <SelectTrigger className="h-11 w-full lg:w-72">
                    <Banknote className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Caja abierta" />
                  </SelectTrigger>
                  <SelectContent>
                    {cashSessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.registerLabel} · {session.shiftLabel.toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <QrCode className="h-4 w-4" />
                Podés buscar por texto, ID o pegar el código de barras manualmente.
              </div>
              {!cashSessions.length ? (
                <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
                  No hay cajas abiertas para esta sucursal. Abrí una desde Caja antes de cobrar.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Productos disponibles</CardTitle>
                <CardDescription>{filteredProducts.length} coincidencias para venta rápida.</CardDescription>
              </div>
              {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : null}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex min-h-80 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 text-center">
                  <Search className="mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="font-medium text-foreground">No se encontraron productos.</p>
                  <p className="text-sm text-muted-foreground">Probá con otro nombre, ID o código.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addItem(product)}
                      className="group flex min-h-36 flex-col rounded-2xl border border-border/70 bg-muted/10 p-4 text-left transition-colors hover:bg-secondary/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                        <Badge variant="secondary" className="min-h-8 px-2.5">ID {product.productNumber}</Badge>
                        {product.barcode ? <span className="max-w-full truncate text-xs text-muted-foreground">{product.barcode}</span> : null}
                      </div>
                      <p className="line-clamp-2 font-medium text-foreground">{product.name}</p>
                      <p className="mt-auto pt-4 text-lg font-semibold text-foreground">{formatCurrency(product.price)}</p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit xl:sticky xl:top-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Carrito
            </CardTitle>
            <CardDescription>
              {getItemCount()} productos agregados para el cobro actual.
              {currentCashSession ? ` · ${currentCashSession.registerLabel}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[420px] overflow-y-auto pr-1">
              {items.length === 0 ? (
                <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 text-center">
                  <ShoppingCart className="mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="font-medium text-foreground">Carrito vacío</p>
                  <p className="text-sm text-muted-foreground">Seleccioná productos para comenzar la venta.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 sm:hidden">
                    {items.map((item) => (
                      <div key={item.productId} className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="font-medium text-foreground">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(item.price)} c/u</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 shrink-0 text-destructive"
                            onClick={() => removeItem(item.productId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10"
                              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="min-w-8 text-center text-sm font-medium">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10"
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-right font-medium text-foreground">{formatCurrency(item.subtotal)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden sm:block">
                    <Table className="min-w-[480px]">
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.productId}>
                            <TableCell className="whitespace-normal">
                              <div className="space-y-1">
                                <p className="font-medium text-foreground">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{formatCurrency(item.price)} c/u</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="space-y-1">
                                <p className="font-medium text-foreground">{formatCurrency(item.subtotal)}</p>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="ml-auto text-destructive"
                                  onClick={() => removeItem(item.productId)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-4 border-t border-border/70 pt-4">
              <div className="rounded-2xl bg-accent/65 p-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Items</span>
                  <span>{getItemCount()}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xl font-semibold text-foreground">
                  <span>Total</span>
                  <span>{formatCurrency(getTotal())}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Método de pago</Label>
                <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4" />
                        Efectivo
                      </div>
                    </SelectItem>
                    <SelectItem value="CARD">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Tarjeta
                      </div>
                    </SelectItem>
                    <SelectItem value="TRANSFER">Transferencia</SelectItem>
                    <SelectItem value="OTHER">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" className="min-h-11" onClick={clearCart} disabled={items.length === 0}>
                  Limpiar
                </Button>
                <Button className="min-h-11" onClick={handleCheckout} disabled={submitting || !locationId || !cashSessionId || items.length === 0}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cobrar"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function POSPage() {
  return (
    <CartProvider>
      <POSContent />
    </CartProvider>
  )
}
