"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { endOfMonth, format, startOfMonth, subDays } from "date-fns"
import { CalendarRange, Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { PageHeader } from "@/components/dashboard/page-primitives"
import InventoryReport from "@/components/reports/inventory-report"
import PurchaseReport from "@/components/reports/purchase-report"
import SalesCharts from "@/components/reports/sales-charts"
import SalesReport from "@/components/reports/sales-report"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface SalesReportRow {
  id: string
  invoiceNumber: string
  date: string
  location: string
  cashier: string
  product: string
  quantity: number
  unitPrice: number
  subtotal: number
  tax: number
  total: number
  paymentMethod: string
  status: string
}

interface SalesReportSummary {
  totalSales: number
  totalItems: number
  totalTax: number
  averageTicket: number
  salesCount: number
}

const tabs = [
  { id: "sales", label: "Ventas" },
  { id: "inventory", label: "Inventario" },
  { id: "purchases", label: "Compras" },
  { id: "charts", label: "Gráficos" },
] as const

const datePresets = [
  { label: "Últimos 7 días", getValue: () => ({ startDate: format(subDays(new Date(), 7), "yyyy-MM-dd"), endDate: format(new Date(), "yyyy-MM-dd") }) },
  { label: "Últimos 30 días", getValue: () => ({ startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"), endDate: format(new Date(), "yyyy-MM-dd") }) },
  { label: "Este mes", getValue: () => ({ startDate: format(startOfMonth(new Date()), "yyyy-MM-dd"), endDate: format(new Date(), "yyyy-MM-dd") }) },
  { label: "Mes completo", getValue: () => ({ startDate: format(startOfMonth(new Date()), "yyyy-MM-dd"), endDate: format(endOfMonth(new Date()), "yyyy-MM-dd") }) },
]

function ReportsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("sales")
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  })
  const [salesData, setSalesData] = useState<SalesReportRow[]>([])
  const [salesSummary, setSalesSummary] = useState<SalesReportSummary | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchSalesData = useCallback(async () => {
    setLoading(true)

    try {
      const params = new URLSearchParams(dateRange)
      const response = await fetch(`/api/reports/sales?${params}`)
      const json = await response.json()

      setSalesData(json.data || [])
      setSalesSummary(json.summary || null)
    } catch (error) {
      console.error("Error fetching sales data:", error)
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    fetchSalesData()
  }, [fetchSalesData])

  useEffect(() => {
    const requestedTab = searchParams.get("tab") as (typeof tabs)[number]["id"] | null
    if (requestedTab && tabs.some((tab) => tab.id === requestedTab)) {
      setActiveTab(requestedTab)
      return
    }
    setActiveTab("sales")
  }, [searchParams])

  function handleTabChange(tabId: (typeof tabs)[number]["id"]) {
    setActiveTab(tabId)
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", tabId)
    router.replace(`/reports?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description="Unificamos filtros, tabs y superficies para que la lectura se parezca mucho más a ERPOS y no a un panel aislado."
        actions={
          <Badge variant="info" className="min-h-9 max-w-full px-3 text-center sm:text-left">
            <CalendarRange className="mr-2 h-4 w-4" />
            {dateRange.startDate} → {dateRange.endDate}
          </Badge>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Período de análisis</CardTitle>
          <CardDescription>Filtros compactos, espaciado consistente y presets rápidos para la operación diaria.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid gap-4 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-center">
            <label className="grid gap-2 text-sm text-muted-foreground">
              <span>Desde</span>
              <Input
                type="date"
                className="h-11"
                value={dateRange.startDate}
                onChange={(event) => setDateRange((current) => ({ ...current, startDate: event.target.value }))}
              />
            </label>
            <label className="grid gap-2 text-sm text-muted-foreground">
              <span>Hasta</span>
              <Input
                type="date"
                className="h-11"
                value={dateRange.endDate}
                onChange={(event) => setDateRange((current) => ({ ...current, endDate: event.target.value }))}
              />
            </label>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2">
              {datePresets.map((preset) => (
                <Button key={preset.label} variant="outline" size="sm" className="min-h-10" onClick={() => setDateRange(preset.getValue())}>
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vista analítica</CardTitle>
          <CardDescription>La navegación ahora comparte la misma jerarquía visual del resto del dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="overflow-x-auto border-b border-border/70 pb-4">
            <div className="flex min-w-max gap-2">
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "default" : "outline"}
                  size="sm"
                  className="min-h-10"
                  onClick={() => handleTabChange(tab.id)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>

          {loading && activeTab === "sales" ? (
            <div className="flex min-h-72 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          {!loading && activeTab === "sales" ? <SalesReport data={salesData} summary={salesSummary} /> : null}
          {activeTab === "inventory" ? <InventoryReport dateRange={dateRange} /> : null}
          {activeTab === "purchases" ? <PurchaseReport dateRange={dateRange} /> : null}
          {activeTab === "charts" ? <SalesCharts dateRange={dateRange} /> : null}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsPageContent />
    </Suspense>
  )
}
