"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  CheckCircle,
  Clock3,
  Eye,
  Loader2,
  PackageCheck,
  Plus,
  ReceiptText,
  Store,
  Truck,
  XCircle,
} from "lucide-react"

import { PageHeader, StatCard } from "@/components/dashboard/page-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

interface PurchaseOrder {
  id: string
  orderNumber: string
  supplierId: string
  supplier: { name: string }
  locationId: string
  location: { name: string }
  status: string
  subtotal: number
  tax: number
  total: number
  expectedDate: string | null
  receivedDate: string | null
  createdAt: string
  items: { id: string; quantity: number }[]
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock3; helper: string }> = {
  PENDING: { label: "Pendiente", variant: "secondary", icon: Clock3, helper: "Todavia no se confirmo" },
  CONFIRMED: { label: "Confirmado", variant: "default", icon: Truck, helper: "Listo para recibir" },
  PARTIALLY_RECEIVED: { label: "Recepcion parcial", variant: "secondary", icon: Truck, helper: "Ingreso parcial de mercaderia" },
  RECEIVED: { label: "Recibido", variant: "outline", icon: CheckCircle, helper: "Cerrada con stock ingresado" },
  CANCELLED: { label: "Cancelado", variant: "destructive", icon: XCircle, helper: "Orden anulada" },
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateString: string | null) {
  if (!dateString) return "-"

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateString))
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [supplierFilter, setSupplierFilter] = useState<string>("all")
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    loadSuppliers()
  }, [])

  useEffect(() => {
    loadOrders()
  }, [statusFilter, supplierFilter])

  async function loadSuppliers() {
    try {
      const res = await fetch("/api/suppliers?includeInactive=true")
      if (res.ok) {
        const data = await res.json()
        setSuppliers(data)
      }
    } catch (error) {
      console.error("Error loading suppliers:", error)
    }
  }

  async function loadOrders() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.append("status", statusFilter)
      if (supplierFilter !== "all") params.append("supplierId", supplierFilter)

      const res = await fetch(`/api/purchase-orders?${params}`)
      if (res.ok) {
        const data = await res.json()
        setOrders(data)
      }
    } catch (error) {
      console.error("Error loading orders:", error)
    } finally {
      setLoading(false)
    }
  }

  const metrics = useMemo(() => {
    const totalCommitted = orders.reduce((sum, order) => sum + order.total, 0)
    const pendingCount = orders.filter((order) => order.status === "PENDING").length
    const receivingCount = orders.filter((order) => ["CONFIRMED", "PARTIALLY_RECEIVED"].includes(order.status)).length
    const totalUnits = orders.reduce(
      (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + Number(item.quantity), 0),
      0
    )

    return { totalCommitted, pendingCount, receivingCount, totalUnits }
  }, [orders])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ordenes de compra"
        description="Segui el circuito completo de compras con filtros claros, estado visible y acceso rapido a cada orden para confirmar, editar o recibir mercaderia."
        actions={
          <Link href="/purchase-orders/new" className="w-full sm:w-auto">
            <Button className="w-full gap-2 sm:w-auto">
              <Plus className="h-4 w-4" />
              Nueva orden
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ordenes visibles"
          value={orders.length}
          helper="Aplicando los filtros actuales"
          icon={ReceiptText}
        />
        <StatCard
          label="Pendientes"
          value={metrics.pendingCount}
          helper="Todavia sin confirmar"
          icon={Clock3}
          iconClassName="text-warning"
        />
        <StatCard
          label="En recepcion"
          value={metrics.receivingCount}
          helper="Confirmadas o parciales"
          icon={PackageCheck}
          iconClassName="text-secondary-foreground"
        />
        <StatCard
          label="Monto comprometido"
          value={formatCurrency(metrics.totalCommitted)}
          helper={`${metrics.totalUnits} unidades pedidas en esta vista`}
          icon={Store}
          iconClassName="text-success-foreground"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Reduci ruido visual y quedate solo con las compras que realmente necesitas revisar ahora.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[220px_280px]">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value || "all")}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="PENDING">Pendiente</SelectItem>
              <SelectItem value="CONFIRMED">Confirmado</SelectItem>
              <SelectItem value="PARTIALLY_RECEIVED">Recepcion parcial</SelectItem>
              <SelectItem value="RECEIVED">Recibido</SelectItem>
              <SelectItem value="CANCELLED">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          <Select value={supplierFilter} onValueChange={(value) => setSupplierFilter(value || "all")}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue placeholder="Proveedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los proveedores</SelectItem>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listado de ordenes</CardTitle>
          <CardDescription>Nombre del proveedor primero, estado bien visible y fechas alineadas para detectar rapido que esta por vencer o recibir.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-56 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/15 px-6 text-center">
              <ReceiptText className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">No hay ordenes para este filtro</p>
              <p className="text-sm text-muted-foreground">Probá cambiar estado o proveedor, o cargá una orden nueva para empezar el circuito.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border/70">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="hidden md:table-cell">Sucursal</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Esperada</TableHead>
                    <TableHead>Creada</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const config = statusConfig[order.status] || {
                      label: order.status,
                      variant: "secondary" as const,
                      icon: Clock3,
                      helper: "Estado no mapeado",
                    }
                    const StatusIcon = config.icon
                    const totalItems = order.items.reduce((sum, item) => sum + Number(item.quantity), 0)

                    return (
                      <TableRow key={order.id}>
                        <TableCell className="whitespace-normal">
                          <div className="space-y-1">
                            <p className="font-mono text-xs font-medium text-muted-foreground">{order.orderNumber}</p>
                            <p className="font-medium text-foreground">Compra a {order.supplier.name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{order.supplier.name}</p>
                            <p className="text-sm text-muted-foreground">{config.helper}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{order.location.name}</TableCell>
                        <TableCell>
                          <Badge variant={config.variant} className="gap-1.5">
                            <StatusIcon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{totalItems}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(order.total)}</TableCell>
                        <TableCell>{formatDate(order.expectedDate)}</TableCell>
                        <TableCell>{formatDate(order.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <Link href={`/purchase-orders/${order.id}`}>
                            <Button variant="outline" size="sm" className="gap-2">
                              <Eye className="h-4 w-4" />
                              Abrir
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
