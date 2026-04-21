"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Plus, Eye, CheckCircle, XCircle, Truck } from "lucide-react"
import Link from "next/link"

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

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  PENDING: { label: "Pendiente", variant: "secondary", icon: Clock },
  CONFIRMED: { label: "Confirmado", variant: "default", icon: Truck },
  RECEIVED: { label: "Recibido", variant: "outline", icon: CheckCircle },
  CANCELLED: { label: "Cancelado", variant: "destructive", icon: XCircle },
}

function Clock({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  )
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
    }
    setLoading(false)
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(amount)
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Órdenes de Compra</h1>
          <p className="text-muted-foreground">
            Gestiona las órdenes de compra a proveedores
          </p>
        </div>
        <Link href="/purchase-orders/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Orden
          </Button>
        </Link>
      </div>

      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || "all")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="PENDING">Pendiente</SelectItem>
            <SelectItem value="CONFIRMED">Confirmado</SelectItem>
            <SelectItem value="RECEIVED">Recibido</SelectItem>
            <SelectItem value="CANCELLED">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={supplierFilter} onValueChange={(val) => setSupplierFilter(val || "all")}>
          <SelectTrigger className="w-[220px]">
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Órdenes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Fecha Esperada</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const config = statusConfig[order.status] || { label: order.status, variant: "secondary" as const, icon: Clock }
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{order.supplier.name}</TableCell>
                      <TableCell>{order.location.name}</TableCell>
                      <TableCell>
                        <Badge variant={config.variant}>
                          <config.icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(order.total)}</TableCell>
                      <TableCell>{formatDate(order.expectedDate)}</TableCell>
                      <TableCell>{formatDate(order.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" disabled title="Vista detalle pendiente">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No hay órdenes de compra
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
