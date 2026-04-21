import Link from "next/link"

import { getDashboardMetrics } from "@/app/actions/dashboard"
import { PageHeader, StatCard } from "@/components/dashboard/page-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Package,
  ShoppingCart,
  Store,
  Truck,
} from "lucide-react"

export const dynamic = "force-dynamic"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-AR").format(value)
}

const quickLinks = [
  { href: "/pos", label: "Nueva venta", description: "Cobrá rápido desde caja", icon: ShoppingCart },
  { href: "/products", label: "Productos", description: "Revisá catálogo y stock", icon: Package },
  { href: "/purchase-orders", label: "Compras", description: "Seguimiento de abastecimiento", icon: Truck },
  { href: "/reports", label: "Reportes", description: "Analizá ventas y márgenes", icon: ArrowRight },
]

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics()
  const lowStockRatio = Math.min((metrics.lowStockProducts / 20) * 100, 100)
  const unitsSold = metrics.topProducts.reduce((acc, product) => acc + product.totalSold, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Resumen operativo del día con foco en ventas, stock y movimiento comercial."
        actions={
          <Badge variant="success">
            <span className="mr-2 h-2 w-2 rounded-full bg-success" />
            Operación en línea
          </Badge>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ventas de hoy"
          value={formatCurrency(metrics.todaySales)}
          helper={`${formatNumber(metrics.todaySalesCount)} transacciones registradas`}
          icon={DollarSign}
          iconClassName="text-primary"
        />
        <StatCard
          label="Productos con alerta"
          value={formatNumber(metrics.lowStockProducts)}
          helper={`${lowStockRatio.toFixed(0)}% del umbral visual de seguimiento`}
          icon={AlertTriangle}
          iconClassName="text-warning"
        />
        <StatCard
          label="Transferencias pendientes"
          value={formatNumber(metrics.pendingTransfers)}
          helper="Esperando revisión o confirmación"
          icon={Truck}
          iconClassName="text-info"
        />
        <StatCard
          label="Unidades vendidas"
          value={formatNumber(unitsSold)}
          helper="Acumulado de los productos con mejor salida"
          icon={ShoppingCart}
          iconClassName="text-secondary-foreground"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Productos más vendidos</CardTitle>
            <CardDescription>Lectura rápida del rendimiento comercial del día.</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.topProducts.length > 0 ? (
              <div className="space-y-4">
                {metrics.topProducts.map((product, index) => (
                  <div
                    key={`${product.name}-${index}`}
                    className="flex items-center justify-between gap-4 border-b border-border/70 pb-4 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/80 text-sm font-semibold text-accent-foreground">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatNumber(product.totalSold)} unidades vendidas
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {formatCurrency(product.totalSold * 100)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 text-center">
                <ShoppingCart className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium text-foreground">Todavía no hay ventas para mostrar.</p>
                <p className="text-sm text-muted-foreground">Cuando ingresen ventas, acá vas a ver el ranking del día.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones rápidas</CardTitle>
            <CardDescription>Accesos directos a los flujos más usados, sin ruido visual.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {quickLinks.map(({ href, label, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-4 transition-colors hover:bg-secondary/22"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background shadow-xs transition-colors group-hover:bg-secondary/55">
                    <Icon className="h-4 w-4 text-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{label}</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Seguimiento operativo</CardTitle>
            <CardDescription>Estado general de puntos de atención y riesgo de stock.</CardDescription>
          </div>
          <Link href="/reports" className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary/22 hover:text-secondary-foreground">
            Ver reportes
          </Link>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Store className="h-4 w-4 text-primary" />
              Estado comercial
            </div>
            <p className="text-2xl font-bold text-foreground">{formatNumber(metrics.todaySalesCount)}</p>
            <p className="text-sm text-muted-foreground">ventas emitidas hoy en el circuito operativo.</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Package className="h-4 w-4 text-primary" />
              Riesgo de stock
            </div>
            <p className="text-2xl font-bold text-foreground">{formatNumber(metrics.lowStockProducts)}</p>
            <p className="text-sm text-muted-foreground">productos requieren reposición o revisión de mínimos.</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Truck className="h-4 w-4 text-primary" />
              Abastecimiento
            </div>
            <p className="text-2xl font-bold text-foreground">{formatNumber(metrics.pendingTransfers)}</p>
            <p className="text-sm text-muted-foreground">movimientos pendientes para equilibrar inventario.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
