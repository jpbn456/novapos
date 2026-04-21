import { useEffect, useState } from "react"
import { CircleDollarSign, ClipboardList, PackageCheck, Timer } from "lucide-react"

import { StatCard } from "@/components/dashboard/page-primitives"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PurchaseReportRow, PurchaseReportSummary } from "@/lib/types/reports"

interface PurchaseReportProps {
  dateRange: { startDate: string; endDate: string }
}

export default function PurchaseReport({ dateRange }: PurchaseReportProps) {
  const [data, setData] = useState<PurchaseReportRow[]>([])
  const [summary, setSummary] = useState<PurchaseReportSummary | null>(null)
  const [loading, setLoading] = useState(true)

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
    if (status === "SENT") return "secondary"
    return "destructive"
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Órdenes" value={summary.totalOrders} helper="Compras registradas" icon={ClipboardList} iconClassName="text-primary" />
          <StatCard label="Items" value={summary.totalItems} helper="Unidades pedidas" icon={PackageCheck} iconClassName="text-success-foreground" />
          <StatCard label="Valor total" value={formatCurrency(summary.totalValue)} helper="Monto comprometido" icon={CircleDollarSign} iconClassName="text-secondary-foreground" />
          <StatCard label="Pendientes" value={summary.pendingCount} helper="Órdenes sin recepción final" icon={Timer} iconClassName="text-warning" />
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/70">
        <Table className="min-w-[780px]">
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead className="hidden md:table-cell">Orden</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead className="hidden lg:table-cell">Sucursal</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Costo</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">No hay datos de compras.</TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.date}</TableCell>
                  <TableCell className="hidden font-mono text-xs md:table-cell">{row.orderNumber.slice(0, 8)}</TableCell>
                  <TableCell>{row.supplier}</TableCell>
                  <TableCell className="hidden lg:table-cell">{row.location}</TableCell>
                  <TableCell className="whitespace-normal">{row.product}</TableCell>
                  <TableCell className="text-right">{row.quantity}</TableCell>
                  <TableCell className="hidden text-right sm:table-cell">{formatCurrency(row.unitCost)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(row.status)}>{row.status}</Badge>
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
