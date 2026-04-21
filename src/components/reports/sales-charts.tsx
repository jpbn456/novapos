import { useEffect, useState } from "react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { BarChart3, ChartPie, TrendingUp } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartDataPoint, TopProduct } from "@/lib/types/reports"

interface SalesChartsProps {
  dateRange: { startDate: string; endDate: string }
}

interface ChartsData {
  salesByDay: ChartDataPoint[]
  topProducts: TopProduct[]
  paymentBreakdown: { method: string; count: number; total: number }[]
}

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)", "var(--chart-3)", "var(--chart-5)"]

export default function SalesCharts({ dateRange }: SalesChartsProps) {
  const [data, setData] = useState<ChartsData | null>(null)
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
        const params = new URLSearchParams()
        params.append("startDate", dateRange.startDate)
        params.append("endDate", dateRange.endDate)
        const res = await fetch(`/api/reports/charts?${params}`)
        const json = await res.json()
        setData(json.data || null)
      } catch (error) {
        console.error("Error fetching charts:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [dateRange])

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-muted/30"></div>
  }

  if (!data) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No hay datos disponibles para los gráficos
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Ventas por día</CardTitle>
          <CardDescription>Evolución diaria del período seleccionado.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
          {data.salesByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.salesByDay}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Ventas"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--popover)", color: "var(--foreground)" }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--chart-1)"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
                  name="Ventas"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No hay datos de ventas en el período seleccionado
            </div>
          )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-secondary-foreground" />Top productos</CardTitle>
          <CardDescription>Comparativa entre cantidad vendida e ingresos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
          {data.topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topProducts} layout="vertical">
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="productName"
                  width={150}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === "revenue" ? formatCurrency(value) : value,
                    name === "revenue" ? "Ingresos" : "Cantidad",
                  ]}
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--popover)", color: "var(--foreground)" }}
                />
                <Legend wrapperStyle={{ color: "var(--muted-foreground)" }} />
                <Bar dataKey="totalSold" fill="var(--chart-2)" name="Cantidad" radius={[0, 6, 6, 0]} />
                <Bar dataKey="revenue" fill="var(--chart-1)" name="Ingresos" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No hay datos de productos vendidos
            </div>
          )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ChartPie className="h-5 w-5 text-info" />Métodos de pago</CardTitle>
          <CardDescription>Distribución por cantidad y total facturado.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
          {data.paymentBreakdown.length > 0 ? (
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.paymentBreakdown}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    dataKey="count"
                    nameKey="method"
                    stroke="var(--card)"
                    strokeWidth={2}
                    labelLine={false}
                    label={({ method, percent }) =>
                      `${method} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {data.paymentBreakdown.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                    <Tooltip
                      formatter={(value: number, name: string, props: any) => [
                        formatCurrency(props.payload.total),
                        "Total",
                      ]}
                      contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--popover)", color: "var(--foreground)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No hay datos de métodos de pago
            </div>
          )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
