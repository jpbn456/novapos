"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  QrCode,
  Receipt,
  Search,
  ShoppingCart,
  Store,
  Trash2,
} from "lucide-react"

import { getCashSessions } from "@/app/actions/cash"
import { getLocations } from "@/app/actions/locations"
import { getActivePromotions } from "@/app/actions/promotions"
import { getProducts } from "@/app/actions/products"
import { createSale } from "@/app/actions/sales"
import { Badge } from "@/components/ui/badge"
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
import { CartProvider, useCart } from "@/contexts/cart-context"
import { calculatePromotionalPricing, type PromotionPricingInput } from "@/lib/pricing"
import { formatQuantity, getQuantityStep, getUnitLabel, type UnitOfMeasureValue } from "@/lib/quantity"

interface Location {
  id: string
  name: string
}

export interface Product {
  id: string
  productNumber: number
  name: string
  price: number
  sku: string | null
  barcode: string | null
  unitOfMeasure: UnitOfMeasureValue
  customUnitName: string | null
}

interface CashSessionOption {
  id: string
  locationId: string
  registerLabel: string
  shiftLabel: "MANANA" | "TARDE" | "OTRO"
  status: "OPEN" | "CLOSED"
}

interface PricingView {
  subtotal: number
  total: number
  savings: number
  lines: Array<{
    productId: string
    quantity: number
    baseUnitPrice: number
    effectiveUnitPrice: number
    originalSubtotal: number
    discountedSubtotal: number
    savings: number
    appliedPromotions: Array<{
      promotionId: string
      promotionName: string
      type: "COMBO" | "SCALE"
      discount: number
    }>
  }>
  appliedPromotions: Array<{
    promotionId: string
    promotionName: string
    type: "COMBO" | "SCALE"
    discount: number
  }>
}

export type PromoOption = {
  id?: string
  productId: string
  quantity: number
  sortOrder?: number
  product?: Product | null
}

export type PromoGroup = {
  id?: string
  name?: string
  type: "MANDATORY" | "ELIGIBLE"
  requiredQuantity: number
  sortOrder?: number
  options: PromoOption[]
}

export type POSPromotion = PromotionPricingInput & {
  description?: string | null
  groups?: PromoGroup[]
}

export type CartBatchItem = {
  productId: string
  name: string
  price: number
  quantity: number
  unitOfMeasure?: UnitOfMeasureValue
  customUnitName?: string | null
  sku?: string | null
  barcode?: string | null
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function getGroupKey(promotionId: string, group: PromoGroup, index: number) {
  return group.id || `${promotionId}-${index}`
}

export function pluralizeOptions(count: number) {
  return count === 1 ? "opción" : "opciones"
}

export function formatGroupSummary(group: PromoGroup) {
  if (group.type === "MANDATORY") {
    return `${group.name || "Grupo"}: incluye ${group.options.length} ${pluralizeOptions(group.options.length)}`
  }

  return `${group.name || "Grupo"}: elegí ${group.requiredQuantity} de ${group.options.length}`
}

export function findPromotionProduct(option: PromoOption, productLookup: Map<string, Product>) {
  return option.product || productLookup.get(option.productId) || null
}

export function buildPromotionCartItems(
  promotion: POSPromotion,
  productLookup: Map<string, Product>,
  selections: Record<string, string[]>
): { items: CartBatchItem[]; error?: string } {
  const items: CartBatchItem[] = []

  if (promotion.groups?.length) {
    for (const [groupIndex, group] of promotion.groups.entries()) {
      const groupKey = getGroupKey(promotion.id, group, groupIndex)
      const selectedIds = new Set(selections[groupKey] || [])

      const selectedOptions = group.type === "MANDATORY"
        ? group.options
        : group.options.filter((option) => selectedIds.has(option.productId))

      if (group.type === "ELIGIBLE" && selectedOptions.length !== group.requiredQuantity) {
        return { items: [], error: `Completá ${group.name || "las selecciones"} antes de confirmar.` }
      }

      for (const option of selectedOptions) {
        const product = findPromotionProduct(option, productLookup)
        if (!product) {
          return { items: [], error: `Falta información del producto para ${promotion.name}.` }
        }

        items.push({
          productId: option.productId,
          name: product.name,
          price: product.price,
          quantity: option.quantity,
          unitOfMeasure: product.unitOfMeasure,
          customUnitName: product.customUnitName,
          sku: product.sku,
          barcode: product.barcode,
        })
      }
    }

    return { items }
  }

  if (promotion.comboItems?.length) {
    for (const option of promotion.comboItems) {
      const product = productLookup.get(option.productId)
      if (!product) {
        return { items: [], error: `Falta información del producto para ${promotion.name}.` }
      }

      items.push({
        productId: option.productId,
        name: product.name,
        price: product.price,
        quantity: option.quantity,
        unitOfMeasure: product.unitOfMeasure,
        customUnitName: product.customUnitName,
        sku: product.sku,
        barcode: product.barcode,
      })
    }
  }

  return { items }
}

function POSContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { items, addItem, addItems, removeItem, updateQuantity, clearCart, getItemCount } = useCart()

  const [locations, setLocations] = useState<Location[]>([])
  const [cashSessions, setCashSessions] = useState<CashSessionOption[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [promotions, setPromotions] = useState<POSPromotion[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [locationId, setLocationId] = useState("")
  const [cashSessionId, setCashSessionId] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "TRANSFER" | "OTHER">("CASH")
  const [submitting, setSubmitting] = useState(false)
  const [saleComplete, setSaleComplete] = useState<any>(null)
  const [activeView, setActiveView] = useState<"PRODUCTS" | "PROMOTIONS">("PRODUCTS")
  const [selectedPromotion, setSelectedPromotion] = useState<POSPromotion | null>(null)
  const [promoSelections, setPromoSelections] = useState<Record<string, string[]>>({})
  const [promoFeedback, setPromoFeedback] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!promoFeedback) return

    const timeout = window.setTimeout(() => setPromoFeedback(null), 3000)
    return () => window.clearTimeout(timeout)
  }, [promoFeedback])

  async function loadData() {
    setLoading(true)
    const [locationsResult, productsResult, promotionsResult] = await Promise.all([getLocations(), getProducts(1, 200), getActivePromotions()])

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

    setPromotions(promotionsResult as POSPromotion[])
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

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.name.toLowerCase().includes(search.toLowerCase()) ||
          String(product.productNumber).includes(search) ||
          (product.barcode && product.barcode.includes(search))
      ),
    [products, search]
  )

  const currentLocation = locations.find((location) => location.id === locationId)
  const currentCashSession = cashSessions.find((session) => session.id === cashSessionId)
  const productLookup = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])

  const pricing = useMemo<PricingView>(() => calculatePromotionalPricing(
    items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.price,
      name: item.name,
    })),
    promotions
  ), [items, promotions])

  function closePromotionModal() {
    setSelectedPromotion(null)
    setPromoSelections({})
  }

  function isPromoSelectionComplete(promotion: POSPromotion) {
    const eligibleGroups = promotion.groups?.filter((group) => group.type === "ELIGIBLE") || []
    return eligibleGroups.every((group, groupIndex) => {
      const actualGroupIndex = promotion.groups?.findIndex((entry) => entry === group) ?? groupIndex
      const groupKey = getGroupKey(promotion.id, group, actualGroupIndex)
      return (promoSelections[groupKey] || []).length === group.requiredQuantity
    })
  }

  function handlePromoSelection(groupKey: string, optionProductId: string, requiredQuantity: number) {
    setPromoSelections((current) => {
      const selected = current[groupKey] || []
      const alreadySelected = selected.includes(optionProductId)

      if (requiredQuantity === 1) {
        return {
          ...current,
          [groupKey]: alreadySelected ? [] : [optionProductId],
        }
      }

      if (alreadySelected) {
        return {
          ...current,
          [groupKey]: selected.filter((value) => value !== optionProductId),
        }
      }

      if (selected.length >= requiredQuantity) {
        return current
      }

      return {
        ...current,
        [groupKey]: [...selected, optionProductId],
      }
    })
  }

  function handlePromoCardClick(promotion: POSPromotion) {
    const hasEligibleGroups = promotion.groups?.some((group) => group.type === "ELIGIBLE")

    if (!hasEligibleGroups) {
      const result = buildPromotionCartItems(promotion, productLookup, {})
      if (result.error) {
        alert(result.error)
        return
      }

      addItems(result.items)
      setPromoFeedback(`Se agregó ${promotion.name} al carrito.`)
      return
    }

    const nextSelections: Record<string, string[]> = {}
    promotion.groups?.forEach((group, index) => {
      if (group.type === "ELIGIBLE") {
        nextSelections[getGroupKey(promotion.id, group, index)] = []
      }
    })

    setPromoSelections(nextSelections)
    setSelectedPromotion(promotion)
  }

  function handleConfirmPromotion() {
    if (!selectedPromotion) return

    const result = buildPromotionCartItems(selectedPromotion, productLookup, promoSelections)
    if (result.error) {
      alert(result.error)
      return
    }

    addItems(result.items)
    setPromoFeedback(`Se agregó ${selectedPromotion.name} al carrito.`)
    closePromotionModal()
  }

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
      items: pricing.lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.effectiveUnitPrice,
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
                    <TableCell className="whitespace-normal">{item.product.name} x {formatQuantity(item.quantity)} {getUnitLabel(item.product.unitOfMeasure, item.product.customUnitName)}</TableCell>
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
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Punto de venta</h1>
            <p className="text-sm text-muted-foreground md:text-base">
              Caja operativa con productos, promos activas y carrito persistente en la misma pantalla.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="min-h-9 px-3">{formatQuantity(getItemCount())} en carrito</Badge>
            <Badge variant="info" className="min-h-9 max-w-full px-3 text-center">{currentLocation?.name || "Sin sucursal"}</Badge>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,420px)]">
          <div className="min-w-0 space-y-4">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Selección de venta</CardTitle>
                  <CardDescription>Alterná entre catálogo y promociones sin perder el carrito de vista.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto border-b border-border/70 pb-4">
                  <div className="flex min-w-max gap-2">
                    <Button variant={activeView === "PRODUCTS" ? "default" : "outline"} size="sm" className="min-h-10" onClick={() => setActiveView("PRODUCTS")}>Productos</Button>
                    <Button variant={activeView === "PROMOTIONS" ? "default" : "outline"} size="sm" className="min-h-10" onClick={() => setActiveView("PROMOTIONS")}>Promociones</Button>
                  </div>
                </div>

                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  {activeView === "PRODUCTS" ? (
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nombre, ID o código de barras..."
                        className="h-11 pl-10"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </div>
                  ) : <div className="hidden flex-1 lg:block" />}
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

                {activeView === "PRODUCTS" ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <QrCode className="h-4 w-4" />
                    Podés buscar por texto, ID o pegar el código de barras manualmente.
                  </div>
                ) : null}

                {!cashSessions.length ? (
                  <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
                    No hay cajas abiertas para esta sucursal. Abrí una desde Caja antes de cobrar.
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {promoFeedback ? (
              <div className="flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success-foreground">
                <CheckCircle2 className="h-4 w-4" />
                {promoFeedback}
              </div>
            ) : null}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{activeView === "PRODUCTS" ? "Productos disponibles" : "Promociones activas"}</CardTitle>
                  <CardDescription>
                    {activeView === "PRODUCTS"
                      ? `${filteredProducts.length} coincidencias para venta rápida.`
                      : `${promotions.length} promociones activas en esta caja.`}
                  </CardDescription>
                </div>
                {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : null}
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex min-h-80 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : activeView === "PRODUCTS" ? (
                  filteredProducts.length === 0 ? (
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
                  )
                ) : promotions.length === 0 ? (
                  <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 text-center">
                    <CheckCircle2 className="mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="font-medium text-foreground">No hay promos activas.</p>
                    <p className="text-sm text-muted-foreground">Activá una promoción desde Backoffice para verla acá.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {promotions.map((promotion) => promotion.type === "COMBO" ? (
                      <button
                        key={promotion.id}
                        type="button"
                        onClick={() => handlePromoCardClick(promotion)}
                        className="flex min-h-48 flex-col rounded-2xl border border-border/70 bg-muted/10 p-4 text-left transition-colors hover:bg-secondary/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">{promotion.name}</p>
                            {promotion.description ? <p className="mt-2 text-sm text-muted-foreground">{promotion.description}</p> : null}
                          </div>
                          <Badge variant="info">Combo</Badge>
                        </div>

                        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                          {(promotion.groups || []).map((group, index) => (
                            <div key={getGroupKey(promotion.id, group, index)} className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                              <p className="font-medium text-foreground">{formatGroupSummary(group)}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {group.options.map((option) => findPromotionProduct(option, productLookup)?.name || `Producto ${option.productId}`).join(" · ")}
                              </p>
                            </div>
                          ))}
                        </div>
                      </button>
                    ) : (
                      <div key={promotion.id} className="flex min-h-48 flex-col rounded-2xl border border-border/70 bg-muted/10 p-4 text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">{promotion.name}</p>
                            {promotion.description ? <p className="mt-2 text-sm text-muted-foreground">{promotion.description}</p> : null}
                          </div>
                          <Badge variant="secondary">Escala</Badge>
                        </div>

                        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                          <p>Se aplica automáticamente al cargar producto y cantidad suficiente.</p>
                          {(promotion.tiers || []).map((tier, index) => (
                            <div key={`${promotion.id}-tier-${index}`} className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                              Desde {tier.minimumQuantity} unidades → {tier.discountPercent != null ? `${tier.discountPercent}%` : formatCurrency(tier.discountAmount || 0)}
                            </div>
                          ))}
                        </div>
                      </div>
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
                    <p className="text-sm text-muted-foreground">Seleccioná productos o promos para comenzar la venta.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 sm:hidden">
                      {items.map((item) => (
                        <div key={item.productId} className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <p className="font-medium text-foreground">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{formatCurrency(item.price)} c/{getUnitLabel(item.unitOfMeasure, item.customUnitName)}</p>
                              {pricing.lines.find((line) => line.productId === item.productId)?.savings ? (
                                <p className="text-xs text-success-foreground">
                                  Ahorro: {formatCurrency(pricing.lines.find((line) => line.productId === item.productId)?.savings || 0)}
                                </p>
                              ) : null}
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
                                onClick={() => updateQuantity(item.productId, item.quantity - getQuantityStep(item.unitOfMeasure))}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Input
                                type="number"
                                min={String(getQuantityStep(item.unitOfMeasure))}
                                step={String(getQuantityStep(item.unitOfMeasure))}
                                className="h-10 w-24 text-center"
                                value={item.quantity}
                                onChange={(event) => updateQuantity(item.productId, Number(event.target.value) || 0)}
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10"
                                onClick={() => updateQuantity(item.productId, item.quantity + getQuantityStep(item.unitOfMeasure))}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="text-right">
                              {pricing.lines.find((line) => line.productId === item.productId)?.savings ? (
                                <p className="text-xs text-muted-foreground line-through">{formatCurrency(item.subtotal)}</p>
                              ) : null}
                              <p className="font-medium text-foreground">{formatCurrency(pricing.lines.find((line) => line.productId === item.productId)?.discountedSubtotal || item.subtotal)}</p>
                            </div>
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
                                  <p className="text-xs text-muted-foreground">{formatCurrency(item.price)} c/{getUnitLabel(item.unitOfMeasure, item.customUnitName)}</p>
                                  {pricing.lines.find((line) => line.productId === item.productId)?.savings ? (
                                    <p className="text-xs text-success-foreground">
                                      Ahorro: {formatCurrency(pricing.lines.find((line) => line.productId === item.productId)?.savings || 0)}
                                    </p>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="icon-sm"
                                    onClick={() => updateQuantity(item.productId, item.quantity - getQuantityStep(item.unitOfMeasure))}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min={String(getQuantityStep(item.unitOfMeasure))}
                                    step={String(getQuantityStep(item.unitOfMeasure))}
                                    className="h-8 w-24 text-center"
                                    value={item.quantity}
                                    onChange={(event) => updateQuantity(item.productId, Number(event.target.value) || 0)}
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon-sm"
                                    onClick={() => updateQuantity(item.productId, item.quantity + getQuantityStep(item.unitOfMeasure))}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="space-y-1">
                                  {pricing.lines.find((line) => line.productId === item.productId)?.savings ? (
                                    <p className="text-xs text-muted-foreground line-through">{formatCurrency(item.subtotal)}</p>
                                  ) : null}
                                  <p className="font-medium text-foreground">{formatCurrency(pricing.lines.find((line) => line.productId === item.productId)?.discountedSubtotal || item.subtotal)}</p>
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
                  <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                    <span>Subtotal base</span>
                    <span>{formatCurrency(items.reduce((sum, item) => sum + item.subtotal, 0))}</span>
                  </div>
                  {pricing.savings > 0 ? (
                    <div className="mt-2 flex items-center justify-between text-sm text-success-foreground">
                      <span>Ahorro promociones</span>
                      <span>-{formatCurrency(pricing.savings)}</span>
                    </div>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between text-xl font-semibold text-foreground">
                    <span>Total</span>
                    <span>{formatCurrency(pricing.total)}</span>
                  </div>
                </div>

                {pricing.appliedPromotions.length > 0 ? (
                  <div className="rounded-2xl border border-success/30 bg-success/10 p-4">
                    <p className="text-sm font-medium text-foreground">Promociones aplicadas</p>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {pricing.appliedPromotions.map((promotion, index) => (
                        <div key={`${promotion.promotionId}-${index}`} className="flex items-center justify-between gap-3">
                          <span>{promotion.promotionName}</span>
                          <span className="text-success-foreground">-{formatCurrency(promotion.discount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

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

      <Dialog open={Boolean(selectedPromotion)} onOpenChange={(open) => { if (!open) closePromotionModal() }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedPromotion?.name}</DialogTitle>
            <DialogDescription>
              {selectedPromotion?.description || "Elegí las opciones requeridas antes de agregar la promo al carrito."}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {selectedPromotion?.groups?.map((group, groupIndex) => {
              const groupKey = getGroupKey(selectedPromotion.id, group, groupIndex)
              const selectedIds = new Set(promoSelections[groupKey] || [])
              const isMandatory = group.type === "MANDATORY"

              return (
                <div key={groupKey} className="space-y-3 rounded-2xl border border-border/70 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{group.name || `Grupo ${groupIndex + 1}`}</p>
                    <Badge variant={isMandatory ? "secondary" : "info"}>{isMandatory ? "Obligatorio" : "Elegible"}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {isMandatory ? "Se agrega completo" : `Elegí ${group.requiredQuantity} opción${group.requiredQuantity === 1 ? "" : "es"}`}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {group.options.map((option) => {
                      const product = findPromotionProduct(option, productLookup)
                      const checked = selectedIds.has(option.productId)

                      return (
                        <label key={option.productId} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${checked ? "border-primary bg-primary/8" : "border-border/70 bg-muted/10"} ${isMandatory ? "cursor-default" : "hover:bg-secondary/20"}`}>
                          {isMandatory ? (
                            <div className="mt-0.5 h-4 w-4 rounded-full border border-border bg-secondary/40" />
                          ) : (
                            <input
                              type={group.requiredQuantity === 1 ? "radio" : "checkbox"}
                              name={groupKey}
                              checked={checked}
                              onChange={() => handlePromoSelection(groupKey, option.productId, group.requiredQuantity)}
                              className="mt-1"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground">{product?.name || `Producto ${option.productId}`}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatQuantity(option.quantity)} {getUnitLabel(product?.unitOfMeasure, product?.customUnitName)}
                              {product ? ` · ${formatCurrency(product.price)}` : ""}
                            </p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closePromotionModal}>Cancelar</Button>
            <Button onClick={handleConfirmPromotion} disabled={!selectedPromotion || !isPromoSelectionComplete(selectedPromotion)}>
              Agregar al carrito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function POSPage() {
  return (
    <Suspense fallback={null}>
      <CartProvider>
        <POSContent />
      </CartProvider>
    </Suspense>
  )
}
