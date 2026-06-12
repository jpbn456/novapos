import type { SalesReportGroup, PurchaseReportGroup } from "@/lib/types/reports"
import {
  calculateCashBillBreakdownTotal,
  CASH_BILL_DENOMINATIONS,
  type CashBillBreakdown,
} from "@/lib/cash-bill-breakdown"

export type SalePDFData = SalesReportGroup

export type PurchaseOrderPDFData = {
  orderNumber: string
  date: string
  supplier: string
  location: string
  status: string
  total: number
  subtotal?: number
  tax?: number
  includeTax?: boolean
  expensesTotal?: number
  expectedDate?: string | null
  receivedDate?: string | null
  notes?: string | null
  items: Array<{
    id: string
    product: string
    quantity: number
    unitCost: number
    subtotal: number
  }>
}

export type CashSessionPDFData = {
  registerLabel: string
  locationName: string
  shiftLabel: string
  status: "OPEN" | "CLOSED"
  businessDate: string
  openedAt: string
  closedAt?: string | null
  openingCashAmount: number
  openingCashBreakdown: CashBillBreakdown | null
  expectedCashAmount: number
  countedCashAmount: number | null
  closingCashBreakdown: CashBillBreakdown | null
  differenceAmount: number | null
  totalRaised: number
  salesCount: number
  externalCashIncome: number
  externalCashExpense: number
  salesBreakdown: Record<"CASH" | "CARD" | "TRANSFER" | "OTHER", number>
  movementBreakdown: Record<"CASH" | "CARD" | "TRANSFER" | "OTHER", { income: number; expense: number }>
  sales: Array<{ id: string; invoiceNumber: string; paymentMethod: string; total: number; createdAt: string }>
  movements: Array<{ id: string; type: string; category: string; paymentMethod: string; amount: number; description: string; createdAt: string; user?: { name?: string | null; email?: string | null } | null }>
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

async function loadPdfTools() {
  const [{ default: jsPDF }, autoTable] = await Promise.all([
    import("jspdf/dist/jspdf.es.min.js"),
    import("jspdf-autotable").then((m) => m.default),
  ])

  return { jsPDF, autoTable }
}

export async function exportSalesPDF(data: SalesReportGroup[], title: string) {
  const { jsPDF, autoTable } = await loadPdfTools()
  const doc = new jsPDF({ unit: "mm", format: "a4" })

  doc.setFontSize(16)
  doc.text(title, 14, 20)
  doc.setFontSize(10)
  doc.text(`Generado: ${new Date().toLocaleDateString("es-AR")}`, 14, 28)
  doc.text(`Total: ${formatCurrency(data.reduce((s, g) => s + g.total, 0))} | Transacciones: ${data.length}`, 14, 34)

  let yOffset = 42

  for (const group of data) {
    // Check if we need a new page
    if (yOffset > 250) {
      doc.addPage()
      yOffset = 20
    }

    // Invoice header
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text(`Factura: ${group.invoiceNumber}`, 14, yOffset)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.text(`${group.date} | ${group.location} | ${group.cashier}`, 14, yOffset + 5)
    doc.text(`Total: ${formatCurrency(group.total)} | ${group.status}`, 14, yOffset + 10)

    yOffset += 16

    // Items table
    autoTable(doc, {
      startY: yOffset,
      head: [["Producto", "Cant.", "Precio", "Subtotal"]],
      body: group.items.map((item) => [
        item.product,
        String(item.quantity),
        formatCurrency(item.unitPrice),
        formatCurrency(item.subtotal),
      ]),
      theme: "grid",
      headStyles: { fontSize: 8, fillColor: [59, 130, 246] },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14 },
      tableWidth: 180,
    })

    yOffset = (doc as any).lastAutoTable.finalY + 8
  }

  doc.save(`${title.replace(/\s+/g, "-").toLowerCase()}.pdf`)
}

export async function exportPurchasesPDF(data: PurchaseReportGroup[], title: string) {
  const { jsPDF, autoTable } = await loadPdfTools()
  const doc = new jsPDF({ unit: "mm", format: "a4" })

  doc.setFontSize(16)
  doc.text(title, 14, 20)
  doc.setFontSize(10)
  doc.text(`Generado: ${new Date().toLocaleDateString("es-AR")}`, 14, 28)
  doc.text(`Total: ${formatCurrency(data.reduce((s, g) => s + g.total, 0))} | Órdenes: ${data.length}`, 14, 34)

  let yOffset = 42

  for (const group of data) {
    if (yOffset > 250) {
      doc.addPage()
      yOffset = 20
    }

    // Order header
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text(`Orden: ${group.orderNumber}`, 14, yOffset)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.text(`${group.date} | ${group.supplier} | ${group.location}`, 14, yOffset + 5)
    doc.text(`Total: ${formatCurrency(group.total)} | ${group.status}`, 14, yOffset + 10)

    yOffset += 16

    // Items table
    autoTable(doc, {
      startY: yOffset,
      head: [["Producto", "Cant.", "Costo", "Subtotal"]],
      body: group.items.map((item) => [
        item.product,
        String(item.quantity),
        formatCurrency(item.unitCost),
        formatCurrency(item.subtotal),
      ]),
      theme: "grid",
      headStyles: { fontSize: 8, fillColor: [59, 130, 246] },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14 },
      tableWidth: 180,
    })

    yOffset = (doc as any).lastAutoTable.finalY + 8
  }

  doc.save(`${title.replace(/\s+/g, "-").toLowerCase()}.pdf`)
}

export async function exportSalePDF(sale: SalePDFData, title = `venta-${sale.invoiceNumber}`) {
  const { jsPDF, autoTable } = await loadPdfTools()
  const doc = new jsPDF({ unit: "mm", format: "a4" })

  doc.setFontSize(16)
  doc.text(`Venta ${sale.invoiceNumber}`, 14, 20)
  doc.setFontSize(10)
  doc.text(`${sale.date} | ${sale.location} | ${sale.cashier}`, 14, 28)
  doc.text(`Estado: ${sale.status} | Pago: ${sale.paymentMethod}`, 14, 34)
  doc.text(`Total: ${formatCurrency(sale.total)}`, 14, 40)

  autoTable(doc, {
    startY: 48,
    head: [["Producto", "Cant.", "Precio", "Subtotal"]],
    body: sale.items.map((item) => [
      item.product,
      String(item.quantity),
      formatCurrency(item.unitPrice),
      formatCurrency(item.subtotal),
    ]),
    theme: "grid",
    headStyles: { fontSize: 8, fillColor: [59, 130, 246] },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14 },
    tableWidth: 180,
  })

  doc.save(`${title.replace(/\s+/g, "-").toLowerCase()}.pdf`)
}

export async function exportPurchaseOrderPDF(order: PurchaseOrderPDFData, title = `compra-${order.orderNumber}`) {
  const { jsPDF, autoTable } = await loadPdfTools()
  const doc = new jsPDF({ unit: "mm", format: "a4" })

  doc.setFontSize(16)
  doc.text(`Orden ${order.orderNumber}`, 14, 20)
  doc.setFontSize(10)
  doc.text(`${order.date} | ${order.supplier} | ${order.location}`, 14, 28)
  doc.text(`Estado: ${order.status} | Total: ${formatCurrency(order.total)}`, 14, 34)

  let y = 42
  if (order.expectedDate) {
    doc.text(`Entrega esperada: ${order.expectedDate}`, 14, y)
    y += 6
  }
  if (order.receivedDate) {
    doc.text(`Recepción completa: ${order.receivedDate}`, 14, y)
    y += 6
  }
  if (order.notes) {
    doc.text(`Notas: ${order.notes}`, 14, y)
    y += 8
  }

  autoTable(doc, {
    startY: y,
    head: [["Producto", "Cant.", "Costo", "Subtotal"]],
    body: order.items.map((item) => [
      item.product,
      String(item.quantity),
      formatCurrency(item.unitCost),
      formatCurrency(item.subtotal),
    ]),
    theme: "grid",
    headStyles: { fontSize: 8, fillColor: [59, 130, 246] },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14 },
    tableWidth: 180,
  })

  y = (doc as any).lastAutoTable.finalY + 8

  // Summary lines
  const subtotal = order.subtotal ?? 0
  const tax = order.includeTax !== false ? (order.tax ?? 0) : 0
  const expensesTotal = order.expensesTotal ?? 0

  doc.setFontSize(9)
  doc.text(`Subtotal: ${formatCurrency(subtotal)}`, 14, y)
  y += 5
  if (order.includeTax !== false) {
    doc.text(`IVA (21%): ${formatCurrency(tax)}`, 14, y)
    y += 5
  }
  if (expensesTotal > 0) {
    doc.text(`Gastos adicionales: ${formatCurrency(expensesTotal)}`, 14, y)
    y += 5
  }
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text(`Total: ${formatCurrency(order.total)}`, 14, y + 4)

  doc.save(`${title.replace(/\s+/g, "-").toLowerCase()}.pdf`)
}

export async function exportCashSessionPDF(session: CashSessionPDFData, title = `caja-${session.registerLabel}`) {
  const { jsPDF, autoTable } = await loadPdfTools()
  const doc = new jsPDF({ unit: "mm", format: "a4" })

  const HEADER_BG = [30, 64, 100] as const
  const ACCENT = [70, 130, 180] as const
  const LIGHT_BG = [245, 247, 250] as const

  const pageW = 210
  const marginL = 16
  const tableW = pageW - marginL * 2

  const openingTotal = session.openingCashBreakdown
    ? calculateCashBillBreakdownTotal(session.openingCashBreakdown) : 0
  const closingTotal = session.closingCashBreakdown
    ? calculateCashBillBreakdownTotal(session.closingCashBreakdown) : 0

  function sectionTitle(text: string, y: number) {
    doc.setFillColor(...HEADER_BG)
    doc.rect(marginL, y - 5, tableW, 7, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.text(text, marginL + 3, y)
    doc.setTextColor(0, 0, 0)
    return y + 9
  }

  function keyValue(label: string, value: string, y: number) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.text(label, marginL + 2, y)
    doc.setFont("helvetica", "bold")
    doc.text(value, marginL + 70, y)
    return y + 5
  }

  function divider(y: number) {
    doc.setDrawColor(200, 200, 200)
    doc.line(marginL, y, marginL + tableW, y)
    return y + 3
  }

  doc.setFillColor(...HEADER_BG)
  doc.rect(0, 0, pageW, 28, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text("Registro de Caja", marginL, 12)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text(`${session.locationName} · ${session.registerLabel} · turno ${session.shiftLabel.toLowerCase()}`, marginL, 21)
  doc.setTextColor(0, 0, 0)

  let y = 38
  const diffLabel = session.differenceAmount != null
    ? `${session.differenceAmount >= 0 ? "+" : ""}${formatCurrency(session.differenceAmount)}`
    : "Pendiente"
  const diffColor = session.differenceAmount != null
    ? (session.differenceAmount >= 0 ? [22, 163, 74] : [220, 38, 38])
    : [100, 100, 100]

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text(`Fecha: ${session.businessDate}`, marginL + tableW - 40, 36, { align: "right" })
  doc.text(`Estado: ${session.status === "CLOSED" ? "Cerrada" : "Abierta"}`, marginL + tableW - 40, 31, { align: "right" })
  doc.setTextColor(0, 0, 0)

  y = sectionTitle("Billetes", y)

  autoTable(doc, {
    startY: y,
    head: [["Denominación", "Inicio (cant)", "Inicio ($)", "Final (cant)", "Final ($)"]],
    body: [
      ...CASH_BILL_DENOMINATIONS.map((denomination) => {
        const openingCount = session.openingCashBreakdown
          ? session.openingCashBreakdown[String(denomination) as keyof CashBillBreakdown] : 0
        const closingCount = session.closingCashBreakdown
          ? session.closingCashBreakdown[String(denomination) as keyof CashBillBreakdown] : 0
        const label = "$" + formatCurrency(denomination).replace("$", "").trim()
        return [
          label,
          String(openingCount),
          formatCurrency(denomination * openingCount),
          String(closingCount),
          formatCurrency(denomination * closingCount),
        ]
      }),
    ],
    foot: [
      [
        { content: "Total efectivo", styles: { fontStyle: "bold", fontSize: 9 } as any },
        "",
        { content: formatCurrency(openingTotal), styles: { fontStyle: "bold", fontSize: 9 } as any },
        "",
        { content: formatCurrency(closingTotal), styles: { fontStyle: "bold", fontSize: 9 } as any },
      ],
    ],
    theme: "grid",
    headStyles: { fontSize: 7, fillColor: [...ACCENT], textColor: [255, 255, 255], halign: "center" },
    bodyStyles: { fontSize: 8, halign: "center" },
    footStyles: { fontSize: 8, halign: "center", fillColor: [240, 244, 248] },
    columnStyles: { 0: { halign: "left", cellPadding: { left: 4 } } },
    margin: { left: marginL },
    tableWidth: tableW,
  })

  y = (doc as any).lastAutoTable.finalY + 8

  y = sectionTitle("Resumen de recaudación", y)

  doc.setFillColor(...LIGHT_BG)
  doc.rect(marginL, y - 2, tableW, 30, "F")

  let ry = y + 1
  ry = keyValue("Efectivo:", formatCurrency(session.salesBreakdown.CASH), ry)
  ry = keyValue("Transferencia:", formatCurrency(session.salesBreakdown.TRANSFER), ry)
  ry = keyValue("Otros:", formatCurrency(session.salesBreakdown.OTHER + session.salesBreakdown.CARD), ry)
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.5)
  doc.line(marginL + 2, ry, marginL + tableW - 2, ry)
  ry += 3
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text("Recaudación total del día:", marginL + 2, ry)
  doc.setTextColor(...ACCENT)
  doc.text(formatCurrency(session.totalRaised), marginL + tableW - 4, ry, { align: "right" })
  doc.setTextColor(0, 0, 0)

  y = ry + 10

  y = sectionTitle("Detalles del turno", y)

  ry = y
  ry = keyValue("Caja inicial:", formatCurrency(session.openingCashAmount), ry)
  ry = keyValue("Horario:", `${session.openedAt} - ${session.closedAt || "en curso"}`, ry)

  doc.setDrawColor(220, 220, 220)
  doc.line(marginL + 2, ry, marginL + tableW - 2, ry)
  ry += 3
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text("Diferencia de caja:", marginL + 2, ry)
  doc.setTextColor(diffColor[0], diffColor[1], diffColor[2])
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text(diffLabel, marginL + tableW - 4, ry, { align: "right" })
  doc.setTextColor(0, 0, 0)

  y = ry + 10

  y = sectionTitle("Observaciones", y)

  const openingNotes = (session as any).openingNotes || ""
  const closingNotes = (session as any).closingNotes || ""
  const notes = [openingNotes, closingNotes].filter(Boolean).join(" | ") || "Sin observaciones"

  doc.setFillColor(...LIGHT_BG)
  doc.rect(marginL, y - 2, tableW, 14, "F")
  doc.setFont("helvetica", "italic")
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  doc.text(notes, marginL + 3, y + 2, { maxWidth: tableW - 6 })
  doc.setTextColor(0, 0, 0)

  y = y + 18

  if (y > 220) {
    doc.addPage()
    y = 20
  }

  y = sectionTitle("Ventas vinculadas", y)

  autoTable(doc, {
    startY: y,
    head: [["Factura", "Fecha", "Pago", "Total"]],
    body: session.sales.map((sale) => [
      sale.invoiceNumber.slice(0, 8),
      sale.createdAt,
      sale.paymentMethod,
      formatCurrency(sale.total),
    ]),
    theme: "grid",
    headStyles: { fontSize: 7, fillColor: [...ACCENT], textColor: [255, 255, 255] },
    bodyStyles: { fontSize: 8 },
    margin: { left: marginL },
    tableWidth: tableW,
  })

  y = (doc as any).lastAutoTable.finalY + 6

  if (y > 260) {
    doc.addPage()
    y = 20
  }

  y = sectionTitle("Movimientos de caja", y)

  autoTable(doc, {
    startY: y,
    head: [["Fecha", "Categoría", "Detalle", "Medio", "Monto"]],
    body: session.movements.map((movement) => [
      movement.createdAt,
      movement.category,
      movement.description,
      movement.paymentMethod,
      `${movement.type === "INCOME" ? "+" : "-"}${formatCurrency(movement.amount)}`,
    ]),
    theme: "grid",
    headStyles: { fontSize: 7, fillColor: [...ACCENT], textColor: [255, 255, 255] },
    bodyStyles: { fontSize: 8 },
    margin: { left: marginL },
    tableWidth: tableW,
  })

  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(marginL, 285, marginL + tableW, 285)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6)
  doc.setTextColor(150, 150, 150)
  doc.text(`Generado el ${new Date().toLocaleDateString("es-AR")} a las ${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`, marginL, 291)

  doc.save(`${title.replace(/\s+/g, "-").toLowerCase()}.pdf`)
}
