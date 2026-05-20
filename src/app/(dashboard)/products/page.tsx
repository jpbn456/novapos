"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { createProduct, deleteProduct, getCategories, getProducts, updateProduct } from "@/app/actions/products"
import { getLocations } from "@/app/actions/locations"
import { PageHeader, StatCard } from "@/components/dashboard/page-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Barcode,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
} from "lucide-react"

interface Product {
  id: string
  productNumber: number
  name: string
  slug: string
  sku: string | null
  description: string | null
  price: number
  cost: number | null
  barcode: string | null
  image: string | null
  isActive: boolean
  lowStockThreshold: number
  unitOfMeasure: "UNIT" | "ML" | "G" | "KG" | "LT" | "OTHER"
  customUnitName: string | null
  categoryId: string | null
  category: { id: string; name: string } | null
  createdAt: Date
}

interface Category {
  id: string
  name: string
}

interface Location {
  id: string
  name: string
  isActive: boolean
}

const unitLabels: Record<Product["unitOfMeasure"], string> = {
  UNIT: "Unidad",
  ML: "Mililitros",
  G: "Gramos",
  KG: "Kilogramos",
  LT: "Litros",
  OTHER: "Otra",
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const limit = 20

  const loadData = useCallback(async () => {
    setLoading(true)

    const [productsResult, categoriesResult, locationsResult] = await Promise.all([
      getProducts(page, limit, search, categoryFilter === "all" ? undefined : categoryFilter),
      getCategories(),
      getLocations(),
    ])

    if (productsResult.success && productsResult.data) {
      setProducts(productsResult.data.products.map((product) => ({ ...product, createdAt: new Date(product.createdAt) })) as Product[])
      setTotalPages(Math.max(1, Math.ceil(productsResult.data.total / limit)))
    }

    if (categoriesResult.success && categoriesResult.data) {
      setCategories(categoriesResult.data as Category[])
    }

    if (locationsResult.success && locationsResult.data) {
      setLocations((locationsResult.data as Location[]).filter((location) => location.isActive))
    }

    setLoading(false)
  }, [page, search, categoryFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)

    const formData = new FormData(event.currentTarget)
    if (formData.get("categoryId") === "unassigned") {
      formData.set("categoryId", "")
    }

    const result = editingProduct
      ? await updateProduct(editingProduct.id, formData)
      : await createProduct(formData)

    if (result.success) {
      setOpen(false)
      setEditingProduct(null)
      loadData()
    } else {
      alert(result.error || "Error")
    }

    setSubmitting(false)
  }

  async function handleDelete(id: string) {
    const result = await deleteProduct(id)
    if (result.success) {
      loadData()
    } else {
      alert(result.error || "Error")
    }
  }

  const activeProducts = useMemo(() => products.filter((product) => product.isActive).length, [products])
  const inactiveProducts = products.length - activeProducts
  const pricedProducts = useMemo(() => products.filter((product) => product.price > 0), [products])
  const averageTicketablePrice = pricedProducts.length
    ? pricedProducts.reduce((acc, product) => acc + product.price, 0) / pricedProducts.length
    : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Productos"
        description="Catálogo comercial con filtros sobrios, tabla legible y edición rápida sin romper el flujo actual."
        actions={
          <Button onClick={() => { setEditingProduct(null); setOpen(true) }} className="w-full gap-2 sm:w-auto">
            <Plus className="h-4 w-4" />
            Nuevo producto
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total productos" value={products.length} helper="Registros cargados en la página actual" icon={Package} />
        <StatCard
          label="Productos activos"
          value={activeProducts}
          helper={`${inactiveProducts} inactivos en esta vista`}
          icon={Barcode}
          iconClassName="text-success-foreground"
        />
        <StatCard
          label="Precio promedio"
          value={formatCurrency(averageTicketablePrice)}
          helper={`${categories.length} categorías disponibles`}
          icon={Tags}
          iconClassName="text-secondary-foreground"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
            <CardDescription>Buscá por nombre, ID o código de barras y reducí el ruido visual del listado.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, ID o código de barras..."
              className="h-11 pl-10"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </div>
          <Select
            value={categoryFilter}
            onValueChange={(value) => {
              setCategoryFilter(value || "all")
              setPage(1)
            }}
          >
            <SelectTrigger className="h-11 w-full lg:w-60">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listado de productos</CardTitle>
          <CardDescription>Jerarquía visual alineada a ERPOS: nombre primero, contexto comercial después, acciones al final.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="hidden md:table-cell">Categoría</TableHead>
                    <TableHead>ID / código</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Costo</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="hidden sm:table-cell text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="whitespace-normal">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{product.name}</p>
                          <p className="line-clamp-1 text-sm text-muted-foreground">
                            {product.description || "Sin descripción adicional"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {unitLabels[product.unitOfMeasure]}{product.customUnitName ? ` · ${product.customUnitName}` : ""}
                          </p>
                          <div className="flex flex-wrap gap-2 md:hidden">
                            {product.category ? <Badge variant="secondary">{product.category.name}</Badge> : null}
                            <Badge variant={product.isActive ? "default" : "outline"}>
                              {product.isActive ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {product.category ? <Badge variant="secondary">{product.category.name}</Badge> : <span className="text-sm text-muted-foreground">Sin categoría</span>}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="space-y-1 text-sm">
                          <p>ID {product.productNumber}</p>
                          <p className="text-muted-foreground">{product.barcode || "Sin código de barras"}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-right text-muted-foreground lg:table-cell">{formatCurrency(product.cost || 0)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(product.price)}</TableCell>
                      <TableCell className="hidden text-center sm:table-cell">
                        <Badge variant={product.isActive ? "default" : "outline"}>
                          {product.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => {
                              setEditingProduct(product)
                              setOpen(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" className="h-10 w-10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  El producto se desactiva y conserva el historial existente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(product.id)}>Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {products.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                        No hay productos registrados para este filtro.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Página {page} de {totalPages}
                </p>
                <div className="grid gap-2 sm:flex">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-10"
                    onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-10"
                    onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
                    disabled={page >= totalPages}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto px-4 sm:px-6">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar producto" : "Nuevo producto"}</DialogTitle>
            <DialogDescription>
              {editingProduct ? "Actualizá la información comercial del producto." : "Cargá un nuevo producto manteniendo la estructura del catálogo actual."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input id="name" name="name" defaultValue={editingProduct?.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="productNumber">ID</Label>
                <Input id="productNumber" value={editingProduct ? String(editingProduct.productNumber) : "Automático al crear"} readOnly disabled />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Input id="description" name="description" defaultValue={editingProduct?.description || ""} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="price">Precio *</Label>
                <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue={editingProduct?.price} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Costo</Label>
                <Input id="cost" name="cost" type="number" step="0.01" min="0" defaultValue={editingProduct?.cost || ""} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="barcode">Código de barras</Label>
                <Input id="barcode" name="barcode" defaultValue={editingProduct?.barcode || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lowStockThreshold">Stock mínimo</Label>
                <Input id="lowStockThreshold" name="lowStockThreshold" type="number" min="0" defaultValue={editingProduct?.lowStockThreshold || 10} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="unitOfMeasure">Unidad de medida</Label>
                <select
                  id="unitOfMeasure"
                  name="unitOfMeasure"
                  defaultValue={editingProduct?.unitOfMeasure || "UNIT"}
                  className="w-full h-11 rounded-md border border-input bg-background px-3"
                >
                  <option value="UNIT">Unidad</option>
                  <option value="ML">Mililitros</option>
                  <option value="G">Gramos</option>
                  <option value="KG">Kilogramos</option>
                  <option value="LT">Litros</option>
                  <option value="OTHER">Otra</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customUnitName">Unidad personalizada</Label>
                <Input id="customUnitName" name="customUnitName" defaultValue={editingProduct?.customUnitName || ""} placeholder="Ej: pack, caja, docena" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">Categoría</Label>
              <select
                id="categoryId"
                name="categoryId"
                defaultValue={editingProduct?.categoryId || "unassigned"}
                className="w-full h-11 rounded-md border border-input bg-background px-3"
              >
                <option value="unassigned">Sin categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {!editingProduct ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="initialStock">Stock inicial</Label>
                  <Input id="initialStock" name="initialStock" type="number" min="0" defaultValue="0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initialLocationId">Sucursal del stock inicial</Label>
                  <select
                    id="initialLocationId"
                    name="initialLocationId"
                    defaultValue=""
                    className="w-full h-11 rounded-md border border-input bg-background px-3"
                  >
                    <option value="">Seleccionar sucursal</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="image">URL de imagen</Label>
              <Input id="image" name="image" type="url" placeholder="https://..." defaultValue={editingProduct?.image || ""} />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingProduct ? "Actualizar producto" : "Crear producto"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
