import { useEffect, useState } from "react"
import { AlertTriangle, Boxes, Package, Store } from "lucide-react"

import { StatCard } from "@/components/dashboard/page-primitives"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { InventoryReportRow, InventoryReportSummary } from "@/lib/types/reports"

interface InventoryReportProps {
  dateRange?: { startDate: string; endDate: string }
}

export default function InventoryReport({ dateRange }: InventoryReportProps) {
  const [data, setData] = useState<InventoryReportRow[]>([])
  const [summary, setSummary] = useState<InventoryReportSummary | null>(null)
  const [loading, setLoading] = useState(true)

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const res = await fetch("/api/reports/inventory")
        const json = await res.json()
        setData(json.data || [])
        setSummary(json.summary || null)
      } catch (error) {
        console.error("Error fetching inventory:", error)
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="IDs" value={summary.totalProducts} helper="Productos relevados" icon={Package} iconClassName="text-primary" />
          <StatCard label="Sucursales" value={summary.totalLocations} helper="Con inventario auditado" icon={Store} iconClassName="text-success-foreground" />
          <StatCard label="Valor de stock" value={formatCurrency(summary.totalStockValue)} helper="Valor comercial estimado" icon={Boxes} iconClassName="text-secondary-foreground" />
          <StatCard label="Stock bajo" value={summary.lowStockCount} helper="Requiere reposición" icon={AlertTriangle} iconClassName="text-warning" />
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/70">
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow>
              <TableHead className="hidden sm:table-cell">ID</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="hidden md:table-cell">Categoría</TableHead>
              <TableHead className="hidden lg:table-cell">Sucursal</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead className="hidden md:table-cell text-right">Costo</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">No hay datos de inventario.</TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id} className={row.isLowStock ? "bg-warning/10" : undefined}>
                  <TableCell className="hidden font-mono text-xs sm:table-cell">{row.productNumber}</TableCell>
                  <TableCell className="whitespace-normal">{row.product}</TableCell>
                  <TableCell className="hidden md:table-cell">{row.category}</TableCell>
                  <TableCell className="hidden lg:table-cell">{row.location}</TableCell>
                  <TableCell className="text-right">
                      <span className={row.isLowStock ? "font-semibold text-warning-foreground" : undefined}>{row.quantity}</span>
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell">{formatCurrency(row.cost)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.price)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(row.stockValue)}
                    {row.isLowStock ? <Badge variant="warning" className="ml-2">Bajo</Badge> : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
