import { useEffect, useState } from "react"
import { Boxes, CheckCheck, Repeat, Timer } from "lucide-react"

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
import { TransferReportRow, TransferReportSummary } from "@/lib/types/reports"

interface TransferReportProps {
  dateRange: { startDate: string; endDate: string }
}

export default function TransferReport({ dateRange }: TransferReportProps) {
  const [data, setData] = useState<TransferReportRow[]>([])
  const [summary, setSummary] = useState<TransferReportSummary | null>(null)
  const [loading, setLoading] = useState(true)

  function getStatusVariant(status: string) {
    if (status === "COMPLETED") return "default"
    if (status === "PENDING") return "outline"
    if (status === "IN_TRANSIT") return "secondary"
    return "destructive"
  }

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.append("startDate", dateRange.startDate)
        params.append("endDate", dateRange.endDate)
        const res = await fetch(`/api/reports/transfers?${params}`)
        const json = await res.json()
        setData(json.data || [])
        setSummary(json.summary || null)
      } catch (error) {
        console.error("Error fetching transfers:", error)
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
          <StatCard label="Transferencias" value={summary.totalTransfers} helper="Movimientos registrados" icon={Repeat} iconClassName="text-primary" />
          <StatCard label="Items" value={summary.totalItems} helper="Unidades transferidas" icon={Boxes} iconClassName="text-secondary-foreground" />
          <StatCard label="Pendientes" value={summary.pendingCount} helper="Esperando acción" icon={Timer} iconClassName="text-warning" />
          <StatCard label="Completadas" value={summary.completedCount} helper="Cerradas correctamente" icon={CheckCheck} iconClassName="text-success-foreground" />
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/70">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead className="hidden md:table-cell">Referencia</TableHead>
              <TableHead className="hidden sm:table-cell">Origen</TableHead>
              <TableHead className="hidden sm:table-cell">Destino</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No hay datos de transferencias.</TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.date}</TableCell>
                  <TableCell className="hidden font-mono text-xs md:table-cell">{row.reference.slice(0, 8)}</TableCell>
                  <TableCell className="hidden sm:table-cell">{row.fromLocation}</TableCell>
                  <TableCell className="hidden sm:table-cell">{row.toLocation}</TableCell>
                  <TableCell className="whitespace-normal">{row.product}</TableCell>
                  <TableCell className="text-right">{row.quantity}</TableCell>
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
