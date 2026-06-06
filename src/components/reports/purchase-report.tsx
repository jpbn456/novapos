"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight, CircleDollarSign, ClipboardList, FileDown, PackageCheck, Timer } from "lucide-react"

import { StatCard } from "@/components/dashboard/page-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { PurchaseReportGroup, PurchaseReportSummary } from "@/lib/types/reports"
import { exportPurchasesPDF } from "@/lib/reports/pdf-export"

interface PurchaseReportProps {
  dateRange: { startDate: string; endDate: string }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function getStatusVariant(status: string) {
  if (status === "RECEIVED") return "default"
  if (status === "PENDING") return "outline"
  if (status === "CONFIRMED" || status === "PARTIALLY_RECEIVED") return "secondary"
  return "destructive"
}

export default function PurchaseReport({ dateRange }: PurchaseReportProps) {
  const [data, setData] = useState<PurchaseReportGroup[]>([])
  const [summary, setSummary] = useState<PurchaseReportSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleGroup(orderNumber: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(orderNumber)) {
        next.delete(orderNumber)
      } else {
        next.add(orderNumber)
      }
      return next
    })
  }

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.append("startDate", dateRange.startDate)
        params.append("endDate", dateRange.endDate)
        const res = await fetch(`/api/reports/purchases?${params}`)
        const json = await res.json()
        setData(json.data || [])
        setSummary(json.summary || null)
      } catch (error) {
        console.error("Error fetching purchases:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [dateRange])

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-muted/30"></div>
  }

  return (
    <div className="space-y-6">
      {summary ? (
        <div className="flex items-start justify-between gap-4">
          <div className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Órdenes" value={summary.totalOrders} helper="Compras registradas" icon={ClipboardList} iconClassName="text-primary" />
            <StatCard label="Items" value={summary.totalItems} helper="Unidades pedidas" icon={PackageCheck} iconClassName="text-success-foreground" />
            <StatCard label="Valor total" value={formatCurrency(summary.totalValue)} helper="Monto comprometido" icon={CircleDollarSign} iconClassName="text-secondary-foreground" />
            <StatCard label="Pendientes" value={summary.pendingCount} helper="Órdenes sin recepción final" icon={Timer} iconClassName="text-warning" />
          </div>
          <Button variant="outline" size="sm" className="mt-1 shrink-0" onClick={() => exportPurchasesPDF(data, "Reporte-Compras")}>
            <FileDown className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/70">
        <Table className="min-w-[780px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Orden</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="hidden md:table-cell">Proveedor</TableHead>
              <TableHead className="hidden lg:table-cell">Sucursal</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">No hay datos de compras.</TableCell>
              </TableRow>
            ) : (
              data.map((group) => (
                <>
                  <TableRow
                    key={group.orderNumber}
                    className="cursor-pointer bg-muted/20 hover:bg-muted/40"
                    onClick={() => toggleGroup(group.orderNumber)}
                  >
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        {expanded.has(group.orderNumber) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium">{group.orderNumber.slice(0, 8)}</TableCell>
                    <TableCell>{group.date}</TableCell>
                    <TableCell className="hidden md:table-cell">{group.supplier}</TableCell>
                    <TableCell className="hidden lg:table-cell">{group.location}</TableCell>
                    <TableCell className="text-right">{group.items.length}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(group.total)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(group.status)}>{group.status}</Badge>
                    </TableCell>
                  </TableRow>
                  {expanded.has(group.orderNumber) && (
                    <TableRow key={`${group.orderNumber}-items`}>
                      <TableCell colSpan={8} className="bg-muted/10 p-0">
                        <div className="px-10 py-3">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead className="text-right w-20">Cant.</TableHead>
                                <TableHead className="text-right w-28">Costo</TableHead>
                                <TableHead className="text-right w-28">Subtotal</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.items.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="whitespace-normal">{item.product}</TableCell>
                                  <TableCell className="text-right">{item.quantity}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(item.unitCost)}</TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(item.subtotal)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
