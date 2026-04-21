import { DollarSign, Package, Receipt, Wallet } from "lucide-react"

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
import type { SalesReportRow, SalesReportSummary } from "@/lib/types/reports"

interface SalesReportProps {
  data: SalesReportRow[]
  summary: SalesReportSummary | null
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function getPaymentVariant(method: string) {
  if (method === "CASH") return "default"
  if (method === "CARD") return "secondary"
  return "outline"
}

function getStatusVariant(status: string) {
  if (status === "COMPLETED") return "default"
  if (status === "CANCELLED") return "destructive"
  return "outline"
}

export default function SalesReport({ data, summary }: SalesReportProps) {
  return (
    <div className="space-y-6">
      {summary ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Ventas" value={formatCurrency(summary.totalSales)} helper={`${summary.salesCount} transacciones`} icon={DollarSign} iconClassName="text-primary" />
          <StatCard label="Artículos" value={summary.totalItems} helper="Unidades vendidas" icon={Package} iconClassName="text-secondary-foreground" />
          <StatCard label="Impuestos" value={formatCurrency(summary.totalTax)} helper="Carga fiscal del período" icon={Receipt} iconClassName="text-warning" />
          <StatCard label="Ticket promedio" value={formatCurrency(summary.averageTicket)} helper="Valor medio por venta" icon={Wallet} iconClassName="text-success-foreground" />
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/70">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead className="hidden md:table-cell">Factura</TableHead>
              <TableHead className="hidden lg:table-cell">Sucursal</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="hidden sm:table-cell">Método</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  No hay datos de ventas en el período seleccionado.
                </TableCell>
              </TableRow>
            ) : (
              data.slice(0, 50).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.date}</TableCell>
                  <TableCell className="hidden font-mono text-xs md:table-cell">{row.invoiceNumber.slice(0, 8)}</TableCell>
                  <TableCell className="hidden lg:table-cell">{row.location}</TableCell>
                  <TableCell className="whitespace-normal">{row.product}</TableCell>
                  <TableCell className="text-right">{row.quantity}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(row.total)}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={getPaymentVariant(row.paymentMethod)}>{row.paymentMethod}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(row.status)}>{row.status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data.length > 50 ? (
        <p className="text-center text-sm text-muted-foreground">Mostrando los primeros 50 de {data.length} registros.</p>
      ) : null}
    </div>
  )
}
