"use client"

import { useEffect, useState } from "react"

import {
  createPromotion,
  deletePromotion,
  getPromotions,
  togglePromotionActive,
  updatePromotion,
} from "@/app/actions/promotions"
import { getProducts } from "@/app/actions/products"
import { PageHeader } from "@/components/dashboard/page-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Product = {
  id: string
  productNumber: number
  name: string
}

type PromotionProduct = {
  id: string
  productId: string
  product: Product
}

type PromotionGroupOption = {
  id: string
  productId: string
  quantity: number
  sortOrder: number
  product: Product
}

type PromotionGroup = {
  id: string
  name: string
  type: "MANDATORY" | "ELIGIBLE"
  requiredQuantity: number
  sortOrder: number
  options: PromotionGroupOption[]
}

type Promotion = {
  id: string
  name: string
  description?: string | null
  type: "COMBO" | "SCALE"
  isActive: boolean
  startsAt?: string | null
  endsAt?: string | null
  comboPrice?: number | null
  discountPercent?: number | null
  discountAmount?: number | null
  products: PromotionProduct[]
  groups: PromotionGroup[]
  tiers: Array<{ id: string; minimumQuantity: number; discountPercent?: number | null; discountAmount?: number | null; product?: Product | null }>
}

export type GroupOptionForm = {
  productId: string
  quantity: number
  sortOrder: number
}

export type GroupForm = {
  name: string
  type: "MANDATORY" | "ELIGIBLE"
  requiredQuantity: number
  sortOrder: number
  options: GroupOptionForm[]
}

type TierForm = {
  minimumQuantity: number
  mode: "PERCENT" | "AMOUNT"
  value: number
}

function createEmptyOption(sortOrder: number): GroupOptionForm {
  return {
    productId: "",
    quantity: 1,
    sortOrder,
  }
}

function createEmptyGroup(sortOrder: number): GroupForm {
  return {
    name: `Grupo ${sortOrder + 1}`,
    type: "MANDATORY",
    requiredQuantity: 1,
    sortOrder,
    options: [createEmptyOption(0)],
  }
}

function emptyGroups(): GroupForm[] {
  return [createEmptyGroup(0)]
}

function emptyTiers(): TierForm[] {
  return [{ minimumQuantity: 2, mode: "PERCENT", value: 10 }]
}

function formatDateInput(value?: string | null) {
  if (!value) return ""
  return new Date(value).toISOString().slice(0, 10)
}

export function normalizeGroups(groups: GroupForm[]) {
  return groups.map((group, groupIndex) => {
    const options = group.options.map((option, optionIndex) => ({
      productId: option.productId,
      quantity: Math.max(1, Number(option.quantity) || 1),
      sortOrder: optionIndex,
    }))

    return {
      name: group.name.trim(),
      type: group.type,
      requiredQuantity: group.type === "MANDATORY"
        ? options.length
        : Math.min(options.length, Math.max(1, Number(group.requiredQuantity) || 1)),
      sortOrder: groupIndex,
      options,
    }
  })
}

export function validateGroups(groups: GroupForm[]) {
  if (groups.length === 0) {
    return "El combo necesita al menos un grupo."
  }

  for (const group of groups) {
    if (!group.name.trim()) {
      return "Cada grupo necesita un nombre."
    }

    if (group.options.length === 0) {
      return `El grupo ${group.name || "sin nombre"} necesita al menos una opción.`
    }

    if (group.options.some((option) => !option.productId)) {
      return `Completá todos los productos del grupo ${group.name || "sin nombre"}.`
    }

    if (group.type === "ELIGIBLE" && group.requiredQuantity > group.options.length) {
      return `En ${group.name || "el grupo elegible"}, la cantidad requerida no puede superar las opciones.`
    }
  }

  return null
}

export function formatGroupTypeLabel(type: "MANDATORY" | "ELIGIBLE") {
  return type === "MANDATORY" ? "Obligatorio" : "Elegible"
}

export function formatComboSummary(promotion: Promotion) {
  return promotion.comboPrice != null
    ? `Precio combo: $${promotion.comboPrice}`
    : promotion.discountPercent != null
      ? `Descuento: ${promotion.discountPercent}%`
      : `Descuento fijo: $${promotion.discountAmount || 0}`
}

export default function PromotionsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [editingPromotionId, setEditingPromotionId] = useState<string | null>(null)
  const [type, setType] = useState<"COMBO" | "SCALE">("COMBO")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")
  const [comboMode, setComboMode] = useState<"PRICE" | "PERCENT" | "AMOUNT">("PRICE")
  const [comboValue, setComboValue] = useState("")
  const [groups, setGroups] = useState<GroupForm[]>(emptyGroups())
  const [scaleProductId, setScaleProductId] = useState("")
  const [tiers, setTiers] = useState<TierForm[]>(emptyTiers())
  const [submitting, setSubmitting] = useState(false)

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

  function resetForm() {
    setEditingPromotionId(null)
    setType("COMBO")
    setName("")
    setDescription("")
    setStartsAt("")
    setEndsAt("")
    setComboMode("PRICE")
    setComboValue("")
    setGroups(emptyGroups())
    setScaleProductId("")
    setTiers(emptyTiers())
  }

  function startEdit(promotion: Promotion) {
    setEditingPromotionId(promotion.id)
    setType(promotion.type)
    setName(promotion.name)
    setDescription(promotion.description || "")
    setStartsAt(formatDateInput(promotion.startsAt))
    setEndsAt(formatDateInput(promotion.endsAt))

    if (promotion.type === "COMBO") {
      if (promotion.comboPrice != null) {
        setComboMode("PRICE")
        setComboValue(String(promotion.comboPrice))
      } else if (promotion.discountPercent != null) {
        setComboMode("PERCENT")
        setComboValue(String(promotion.discountPercent))
      } else {
        setComboMode("AMOUNT")
        setComboValue(String(promotion.discountAmount || ""))
      }

      setGroups(
        promotion.groups.length
          ? promotion.groups.map((group, groupIndex) => ({
              name: group.name,
              type: group.type,
              requiredQuantity: group.type === "MANDATORY" ? group.options.length : group.requiredQuantity,
              sortOrder: group.sortOrder ?? groupIndex,
              options: group.options.map((option, optionIndex) => ({
                productId: option.productId,
                quantity: option.quantity,
                sortOrder: option.sortOrder ?? optionIndex,
              })),
            }))
          : emptyGroups()
      )
      setScaleProductId("")
      setTiers(emptyTiers())
      return
    }

    setScaleProductId(promotion.products[0]?.productId || promotion.products[0]?.product.id || "")
    setTiers(
      promotion.tiers.map((tier) => ({
        minimumQuantity: tier.minimumQuantity,
        mode: tier.discountPercent != null ? "PERCENT" : "AMOUNT",
        value: tier.discountPercent ?? tier.discountAmount ?? 0,
      }))
    )
    setGroups(emptyGroups())
    setComboValue("")
    setComboMode("PRICE")
  }

  function buildPayload() {
    if (type === "COMBO") {
      return {
        name,
        description,
        type,
        startsAt: startsAt || undefined,
        endsAt: endsAt || undefined,
        comboPrice: comboMode === "PRICE" ? Number(comboValue) : undefined,
        discountPercent: comboMode === "PERCENT" ? Number(comboValue) : undefined,
        discountAmount: comboMode === "AMOUNT" ? Number(comboValue) : undefined,
        groups: normalizeGroups(groups),
      }
    }

    return {
      name,
      description,
      type,
      startsAt: startsAt || undefined,
      endsAt: endsAt || undefined,
      productId: scaleProductId,
      tiers: tiers.map((tier) => ({
        minimumQuantity: Number(tier.minimumQuantity),
        discountPercent: tier.mode === "PERCENT" ? Number(tier.value) : undefined,
        discountAmount: tier.mode === "AMOUNT" ? Number(tier.value) : undefined,
      })),
    }
  }

  async function handleSubmit() {
    if (type === "COMBO") {
      const validationError = validateGroups(groups)
      if (validationError) {
        alert(validationError)
        return
      }
    }

    setSubmitting(true)
    const payload = buildPayload()
    const result = editingPromotionId
      ? await updatePromotion(editingPromotionId, payload)
      : await createPromotion(payload)

    if (!result.success) {
      alert(result.error || "Error al guardar promoción")
      setSubmitting(false)
      return
    }

    resetForm()
    await loadData()
    setSubmitting(false)
  }

  async function handleToggle(promotionId: string) {
    const result = await togglePromotionActive(promotionId)
    if (!result.success) {
      alert(result.error || "No se pudo cambiar el estado")
      return
    }

    await loadData()
  }

  async function handleDelete(promotionId: string) {
    if (!window.confirm("¿Seguro querés eliminar esta promoción?")) return

    const result = await deletePromotion(promotionId)
    if (!result.success) {
      alert(result.error || "No se pudo eliminar la promoción")
      return
    }

    if (editingPromotionId === promotionId) {
      resetForm()
    }

    await loadData()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promociones"
        description="Armá, editá, activá o eliminá combos y promociones escaladas por cantidad."
      />

      <div className="grid gap-6 xl:grid-cols-[460px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{editingPromotionId ? "Editar promoción" : "Nueva promoción"}</CardTitle>
              <CardDescription>
                {editingPromotionId ? "Ajustá la promoción y guardá los cambios." : "Elegí si querés un combo o una escala por cantidad."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <select value={type} onChange={(event) => setType(event.target.value as "COMBO" | "SCALE")} className="h-11 w-full rounded-md border border-input bg-background px-3" disabled={Boolean(editingPromotionId)}>
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
                    <Label>Estrategia</Label>
                    <select value={comboMode} onChange={(event) => setComboMode(event.target.value as "PRICE" | "PERCENT" | "AMOUNT")} className="h-11 w-full rounded-md border border-input bg-background px-3">
                      <option value="PRICE">Precio combo</option>
                      <option value="PERCENT">Descuento %</option>
                      <option value="AMOUNT">Descuento fijo</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor</Label>
                    <Input type="number" min="0" step="0.01" value={comboValue} onChange={(event) => setComboValue(event.target.value)} />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Grupos del combo</Label>
                    <Button variant="outline" type="button" onClick={() => setGroups((current) => [...current, createEmptyGroup(current.length)])}>
                      Agregar grupo
                    </Button>
                  </div>

                  {groups.map((group, groupIndex) => (
                    <div key={`${group.sortOrder}-${groupIndex}`} className="space-y-4 rounded-2xl border border-border/70 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="grid flex-1 gap-3 md:grid-cols-2">
                          <div className="space-y-2 md:col-span-2">
                            <Label>Nombre del grupo</Label>
                            <Input
                              value={group.name}
                              onChange={(event) => setGroups((current) => current.map((entry, currentIndex) => currentIndex === groupIndex ? { ...entry, name: event.target.value } : entry))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Tipo</Label>
                            <select
                              value={group.type}
                              onChange={(event) => {
                                const nextType = event.target.value as "MANDATORY" | "ELIGIBLE"
                                setGroups((current) => current.map((entry, currentIndex) => currentIndex === groupIndex
                                  ? {
                                      ...entry,
                                      type: nextType,
                                      requiredQuantity: nextType === "MANDATORY"
                                        ? entry.options.length
                                        : Math.min(Math.max(1, entry.requiredQuantity), entry.options.length),
                                    }
                                  : entry))
                              }}
                              className="h-11 w-full rounded-md border border-input bg-background px-3"
                            >
                              <option value="MANDATORY">MANDATORY</option>
                              <option value="ELIGIBLE">ELIGIBLE</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>Cantidad requerida</Label>
                            <Input
                              type="number"
                              min="1"
                              max={String(Math.max(1, group.options.length))}
                              disabled={group.type === "MANDATORY"}
                              value={group.type === "MANDATORY" ? group.options.length : group.requiredQuantity}
                              onChange={(event) => setGroups((current) => current.map((entry, currentIndex) => currentIndex === groupIndex
                                ? {
                                    ...entry,
                                    requiredQuantity: Math.min(entry.options.length, Math.max(1, Number(event.target.value) || 1)),
                                  }
                                : entry))}
                            />
                            <p className="text-xs text-muted-foreground">
                              {group.type === "MANDATORY"
                                ? "Los grupos obligatorios incluyen todas sus opciones."
                                : `Elegí hasta ${group.options.length} opción${group.options.length === 1 ? "" : "es"}.`}
                            </p>
                          </div>
                        </div>
                        <Button variant="outline" type="button" onClick={() => setGroups((current) => current.filter((_, currentIndex) => currentIndex !== groupIndex))} disabled={groups.length <= 1}>
                          Quitar grupo
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Label>Opciones</Label>
                            <Badge variant={group.type === "MANDATORY" ? "secondary" : "info"}>{formatGroupTypeLabel(group.type)}</Badge>
                          </div>
                          <Button
                            variant="outline"
                            type="button"
                            size="sm"
                            onClick={() => setGroups((current) => current.map((entry, currentIndex) => currentIndex === groupIndex
                              ? {
                                  ...entry,
                                  options: [...entry.options, createEmptyOption(entry.options.length)],
                                  requiredQuantity: entry.type === "MANDATORY"
                                    ? entry.options.length + 1
                                    : Math.min(entry.options.length + 1, entry.requiredQuantity),
                                }
                              : entry))}
                          >
                            Agregar opción
                          </Button>
                        </div>

                        {group.options.map((option, optionIndex) => (
                          <div key={`${groupIndex}-${optionIndex}`} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_110px_110px]">
                            <select
                              value={option.productId}
                              onChange={(event) => setGroups((current) => current.map((entry, currentIndex) => currentIndex === groupIndex
                                ? {
                                    ...entry,
                                    options: entry.options.map((currentOption, currentOptionIndex) => currentOptionIndex === optionIndex ? { ...currentOption, productId: event.target.value } : currentOption),
                                  }
                                : entry))}
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
                              value={option.quantity}
                              onChange={(event) => setGroups((current) => current.map((entry, currentIndex) => currentIndex === groupIndex
                                ? {
                                    ...entry,
                                    options: entry.options.map((currentOption, currentOptionIndex) => currentOptionIndex === optionIndex ? { ...currentOption, quantity: Math.max(1, Number(event.target.value) || 1) } : currentOption),
                                  }
                                : entry))}
                            />
                            <Button
                              variant="outline"
                              type="button"
                              onClick={() => setGroups((current) => current.map((entry, currentIndex) => {
                                if (currentIndex !== groupIndex) return entry
                                const nextOptions = entry.options.filter((_, currentOptionIndex) => currentOptionIndex !== optionIndex)
                                return {
                                  ...entry,
                                  options: nextOptions.length ? nextOptions : [createEmptyOption(0)],
                                  requiredQuantity: entry.type === "MANDATORY"
                                    ? Math.max(1, nextOptions.length || 1)
                                    : Math.min(Math.max(1, entry.requiredQuantity), Math.max(1, nextOptions.length || 1)),
                                }
                              }))}
                              disabled={group.options.length <= 1}
                            >
                              Quitar
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Producto base</Label>
                  <select value={scaleProductId} onChange={(event) => setScaleProductId(event.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3">
                    <option value="">Seleccionar producto</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>{product.name} (ID {product.productNumber})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <Label>Escalones</Label>
                  {tiers.map((tier, index) => (
                    <div key={index} className="grid gap-3 md:grid-cols-[120px_1fr_120px_80px]">
                      <Input type="number" min="1" value={tier.minimumQuantity} onChange={(event) => setTiers((current) => current.map((entry, currentIndex) => currentIndex === index ? { ...entry, minimumQuantity: Number(event.target.value) || 1 } : entry))} />
                      <select value={tier.mode} onChange={(event) => setTiers((current) => current.map((entry, currentIndex) => currentIndex === index ? { ...entry, mode: event.target.value as "PERCENT" | "AMOUNT" } : entry))} className="h-11 rounded-md border border-input bg-background px-3">
                        <option value="PERCENT">Descuento %</option>
                        <option value="AMOUNT">Descuento fijo</option>
                      </select>
                      <Input type="number" min="0" step="0.01" value={tier.value} onChange={(event) => setTiers((current) => current.map((entry, currentIndex) => currentIndex === index ? { ...entry, value: Number(event.target.value) || 0 } : entry))} />
                      <Button variant="outline" type="button" onClick={() => setTiers((current) => current.filter((_, currentIndex) => currentIndex !== index))} disabled={tiers.length <= 1}>Quitar</Button>
                    </div>
                  ))}
                  <Button variant="outline" type="button" onClick={() => setTiers((current) => [...current, { minimumQuantity: current.length + 2, mode: "PERCENT", value: 0 }])}>Agregar escalón</Button>
                </div>
              </>
            )}

            <div className="flex gap-3">
              <Button className="flex-1" onClick={handleSubmit} disabled={!name || submitting}>
                {submitting ? "Guardando..." : editingPromotionId ? "Guardar cambios" : "Crear promoción"}
              </Button>
              {editingPromotionId ? (
                <Button variant="outline" type="button" onClick={resetForm}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Promociones configuradas</CardTitle>
              <CardDescription>{promotions.length} promociones registradas.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {promotions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay promociones creadas.</p>
            ) : promotions.map((promotion) => (
              <div key={promotion.id} className="rounded-2xl border border-border/70 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{promotion.name}</p>
                    <p className="text-sm text-muted-foreground">{promotion.type === "COMBO" ? "Combo" : "Escalada por cantidad"}</p>
                    {promotion.description ? <p className="mt-2 text-sm text-muted-foreground">{promotion.description}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-muted px-3 py-1 text-xs">{promotion.isActive ? "Activa" : "Inactiva"}</span>
                    <Button variant="outline" size="sm" onClick={() => startEdit(promotion)}>Editar</Button>
                    <Button variant="outline" size="sm" onClick={() => handleToggle(promotion.id)}>{promotion.isActive ? "Desactivar" : "Activar"}</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(promotion.id)}>Eliminar</Button>
                  </div>
                </div>

                {promotion.type === "COMBO" ? (
                  <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                    <p>{formatComboSummary(promotion)}</p>
                    <div className="space-y-2">
                      {promotion.groups.map((group) => (
                        <div key={group.id} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground">{group.name}</p>
                            <Badge variant={group.type === "MANDATORY" ? "secondary" : "info"}>{formatGroupTypeLabel(group.type)}</Badge>
                            <span>Requeridas: {group.type === "MANDATORY" ? group.options.length : group.requiredQuantity}</span>
                          </div>
                          <div className="mt-2 space-y-1">
                            {group.options.map((option) => (
                              <p key={option.id}>· {option.product.name} × {option.quantity}</p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <p>Producto base: {promotion.products[0]?.product.name}</p>
                    {promotion.tiers.map((tier) => (
                      <p key={tier.id}>· Desde {tier.minimumQuantity} unidades → {tier.discountPercent != null ? `${tier.discountPercent}%` : `$${tier.discountAmount || 0}`}</p>
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
