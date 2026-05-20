"use client"

import { useEffect, useState } from "react"

import { createPromotion, getPromotions } from "@/app/actions/promotions"
import { getProducts } from "@/app/actions/products"
import { PageHeader } from "@/components/dashboard/page-primitives"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Product = {
  id: string
  productNumber: number
  name: string
}

type Promotion = {
  id: string
  name: string
  type: "COMBO" | "SCALE"
  isActive: boolean
  comboPrice?: number | null
  discountPercent?: number | null
  discountAmount?: number | null
  comboItems: Array<{ id: string; quantity: number; product: Product }>
  tiers: Array<{ id: string; minimumQuantity: number; discountPercent?: number | null; discountAmount?: number | null; product?: Product | null }>
}

export default function PromotionsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [type, setType] = useState<"COMBO" | "SCALE">("COMBO")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")
  const [comboPrice, setComboPrice] = useState("")
  const [comboDiscountPercent, setComboDiscountPercent] = useState("")
  const [comboItems, setComboItems] = useState([{ productId: "", quantity: 1 }, { productId: "", quantity: 1 }])
  const [scaleProductId, setScaleProductId] = useState("")
  const [tiers, setTiers] = useState([{ minimumQuantity: 2, discountPercent: 10, discountAmount: 0 }])

  async function loadData() {
    const [productsResult, promotionsResult] = await Promise.all([
      getProducts(1, 200),
      getPromotions(),
    ])

    if (productsResult.success && productsResult.data) {
      setProducts(productsResult.data.products.map((product) => ({ id: product.id, productNumber: product.productNumber, name: product.name })))
    }

    setPromotions(promotionsResult as Promotion[])
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSubmit() {
    const result = await createPromotion(
      type === "COMBO"
        ? {
            name,
            description,
            type,
            startsAt: startsAt || undefined,
            endsAt: endsAt || undefined,
            comboPrice: comboPrice ? Number(comboPrice) : undefined,
            discountPercent: comboDiscountPercent ? Number(comboDiscountPercent) : undefined,
            comboItems: comboItems.filter((item) => item.productId),
          }
        : {
            name,
            description,
            type,
            startsAt: startsAt || undefined,
            endsAt: endsAt || undefined,
            productId: scaleProductId,
            tiers: tiers.map((tier) => ({
              minimumQuantity: Number(tier.minimumQuantity),
              discountPercent: tier.discountPercent ? Number(tier.discountPercent) : undefined,
              discountAmount: tier.discountAmount ? Number(tier.discountAmount) : undefined,
            })),
          }
    )

    if (!result.success) {
      alert(result.error || "Error al crear promoción")
      return
    }

    setName("")
    setDescription("")
    setStartsAt("")
    setEndsAt("")
    setComboPrice("")
    setComboDiscountPercent("")
    setComboItems([{ productId: "", quantity: 1 }, { productId: "", quantity: 1 }])
    setScaleProductId("")
    setTiers([{ minimumQuantity: 2, discountPercent: 10, discountAmount: 0 }])
    await loadData()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promociones"
        description="Armá combos y promociones escaladas por cantidad sobre línea de producto."
      />

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Nueva promoción</CardTitle>
            <CardDescription>Elegí si querés un combo o una escala por cantidad.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <select value={type} onChange={(event) => setType(event.target.value as any)} className="w-full h-11 rounded-md border border-input bg-background px-3">
                <option value="COMBO">Combo</option>
                <option value="SCALE">Escalada por cantidad</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Desde</Label>
                <Input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Hasta</Label>
                <Input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
              </div>
            </div>

            {type === "COMBO" ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Precio combo</Label>
                    <Input type="number" min="0" step="0.01" value={comboPrice} onChange={(event) => setComboPrice(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Descuento % (opcional)</Label>
                    <Input type="number" min="0" max="100" step="0.01" value={comboDiscountPercent} onChange={(event) => setComboDiscountPercent(event.target.value)} />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Productos del combo</Label>
                  {comboItems.map((item, index) => (
                    <div key={index} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_100px]">
                      <select
                        value={item.productId}
                        onChange={(event) => setComboItems((current) => current.map((entry, currentIndex) => currentIndex === index ? { ...entry, productId: event.target.value } : entry))}
                        className="h-11 rounded-md border border-input bg-background px-3"
                      >
                        <option value="">Seleccionar producto</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>{product.name} (ID {product.productNumber})</option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(event) => setComboItems((current) => current.map((entry, currentIndex) => currentIndex === index ? { ...entry, quantity: Number(event.target.value) || 1 } : entry))}
                      />
                    </div>
                  ))}
                  <Button variant="outline" onClick={() => setComboItems((current) => [...current, { productId: "", quantity: 1 }])}>Agregar producto</Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Producto base</Label>
                  <select value={scaleProductId} onChange={(event) => setScaleProductId(event.target.value)} className="w-full h-11 rounded-md border border-input bg-background px-3">
                    <option value="">Seleccionar producto</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>{product.name} (ID {product.productNumber})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <Label>Escalones</Label>
                  {tiers.map((tier, index) => (
                    <div key={index} className="grid gap-3 md:grid-cols-3">
                      <Input type="number" min="1" value={tier.minimumQuantity} onChange={(event) => setTiers((current) => current.map((entry, currentIndex) => currentIndex === index ? { ...entry, minimumQuantity: Number(event.target.value) || 1 } : entry))} />
                      <Input type="number" min="0" max="100" step="0.01" value={tier.discountPercent} onChange={(event) => setTiers((current) => current.map((entry, currentIndex) => currentIndex === index ? { ...entry, discountPercent: Number(event.target.value) || 0 } : entry))} />
                      <Input type="number" min="0" step="0.01" value={tier.discountAmount} onChange={(event) => setTiers((current) => current.map((entry, currentIndex) => currentIndex === index ? { ...entry, discountAmount: Number(event.target.value) || 0 } : entry))} />
                    </div>
                  ))}
                  <div className="grid gap-3 md:grid-cols-3 text-xs text-muted-foreground">
                    <span>Cantidad mínima</span>
                    <span>Descuento %</span>
                    <span>Descuento fijo</span>
                  </div>
                  <Button variant="outline" onClick={() => setTiers((current) => [...current, { minimumQuantity: current.length + 2, discountPercent: 0, discountAmount: 0 }])}>Agregar escalón</Button>
                </div>
              </>
            )}

            <Button className="w-full" onClick={handleSubmit} disabled={!name}>Guardar promoción</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Promociones activas</CardTitle>
            <CardDescription>{promotions.length} promociones configuradas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {promotions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay promociones creadas.</p>
            ) : promotions.map((promotion) => (
              <div key={promotion.id} className="rounded-2xl border border-border/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{promotion.name}</p>
                    <p className="text-sm text-muted-foreground">{promotion.type === "COMBO" ? "Combo" : "Escalada por cantidad"}</p>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs">{promotion.isActive ? "Activa" : "Inactiva"}</span>
                </div>

                {promotion.type === "COMBO" ? (
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <p>Precio combo: {promotion.comboPrice ? `$${promotion.comboPrice}` : "Sin precio fijo"}</p>
                    {promotion.comboItems.map((item) => (
                      <p key={item.id}>· {item.product.name} × {item.quantity}</p>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {promotion.tiers.map((tier) => (
                      <p key={tier.id}>· Desde {tier.minimumQuantity} unidades → {tier.discountPercent ? `${tier.discountPercent}%` : `$${tier.discountAmount || 0}`}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
