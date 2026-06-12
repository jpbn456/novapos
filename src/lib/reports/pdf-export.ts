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

  const ML = 16
  const W = 210 - ML * 2

  const C_HEADER = [25, 56, 92] as const
  const C_ACCENT = [59, 120, 170] as const
  const C_LIGHT = [245, 247, 250] as const
  const C_GRAY = [100, 100, 100] as const

  const openingTotal = session.openingCashBreakdown
    ? calculateCashBillBreakdownTotal(session.openingCashBreakdown) : 0
  const closingTotal = session.closingCashBreakdown
    ? calculateCashBillBreakdownTotal(session.closingCashBreakdown) : 0

  function sectionBar(text: string, y: number) {
    doc.setFillColor(...C_HEADER)
    doc.rect(ML, y - 4, W, 6, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.text(text, ML + 3, y + 0.5)
    doc.setTextColor(0, 0, 0)
    return y + 8
  }

  function kv(label: string, value: string, y: number) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.text(label, ML + 2, y)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    doc.text(value, ML + 75, y)
    return y + 5
  }

  const diffAmount = session.differenceAmount
  const diffLabel = diffAmount != null
    ? `${diffAmount >= 0 ? "+" : ""}${formatCurrency(diffAmount)}`
    : "Pendiente"
  const diffColor = diffAmount != null
    ? (diffAmount >= 0 ? [22, 163, 74] : [220, 38, 38])
    : C_GRAY

  // ── HEADER BANNER ──
  doc.setFillColor(...C_HEADER)
  doc.rect(0, 0, 210, 26, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.text("Registro de Caja", ML, 11)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text(`${session.locationName}  ·  ${session.registerLabel}  ·  turno ${session.shiftLabel.toLowerCase()}`, ML, 20)
  doc.setTextColor(0, 0, 0)

  // ── INFO ROW BELOW HEADER ──
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...C_GRAY)
  doc.text(`Estado: ${session.status === "CLOSED" ? "Cerrada" : "Abierta"}`, ML, 33)
  doc.text(`Fecha: ${session.businessDate}`, ML, 38)
  const headerInfoY = 38

  // ── 1. BILLETES ──
  let y = sectionBar("Billetes", headerInfoY + 6)

  autoTable(doc, {
    startY: y,
    head: [["Denominación", "Inicio (cant)", "Inicio ($)", "Final (cant)", "Final ($)"]],
    body: CASH_BILL_DENOMINATIONS.map((denomination) => {
      const oc = session.openingCashBreakdown
        ? session.openingCashBreakdown[String(denomination) as keyof CashBillBreakdown] : 0
      const fc = session.closingCashBreakdown
        ? session.closingCashBreakdown[String(denomination) as keyof CashBillBreakdown] : 0
      return [
        "$" + formatCurrency(denomination).replace("$", "").trim(),
        String(oc || ""),
        oc ? formatCurrency(denomination * oc) : "",
        String(fc || ""),
        fc ? formatCurrency(denomination * fc) : "",
      ]
    }),
    foot: [
      [
        { content: "Total efectivo", styles: { fontStyle: "bold", fontSize: 8 } as any },
        "",
        { content: formatCurrency(openingTotal), styles: { fontStyle: "bold", fontSize: 8 } as any },
        "",
        { content: formatCurrency(closingTotal), styles: { fontStyle: "bold", fontSize: 8 } as any },
      ],
    ],
    theme: "grid",
    headStyles: { fontSize: 7, fillColor: [...C_ACCENT], textColor: [255, 255, 255], halign: "center" },
    bodyStyles: { fontSize: 8, halign: "center" },
    footStyles: { fontSize: 7, halign: "center", fillColor: [237, 242, 247], fontStyle: "bold" },
    columnStyles: { 0: { halign: "left", cellPadding: { left: 4 } } },
    margin: { left: ML },
    tableWidth: W,
  })

  y = (doc as any).lastAutoTable.finalY + 7

  // ── 2. RESUMEN DE RECAUDACIÓN ──
  y = sectionBar("Resumen de recaudación", y)

  const recBgH = 28
  doc.setFillColor(...C_LIGHT)
  doc.rect(ML, y - 1, W, recBgH, "F")

  let ry = y + 1
  ry = kv("Efectivo:", formatCurrency(session.salesBreakdown.CASH), ry)
  ry = kv("Transferencia:", formatCurrency(session.salesBreakdown.TRANSFER), ry)
  ry = kv("Otros:", formatCurrency(session.salesBreakdown.OTHER + session.salesBreakdown.CARD), ry)

  doc.setDrawColor(...C_ACCENT)
  doc.setLineWidth(0.4)
  doc.line(ML + 2, ry, ML + W - 2, ry)
  ry += 3.5

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.text("Recaudación total del día", ML + 2, ry)
  doc.setTextColor(...C_ACCENT)
  doc.setFontSize(10)
  doc.text(formatCurrency(session.totalRaised), ML + W - 2, ry, { align: "right" })
  doc.setTextColor(0, 0, 0)

  y = ry + 9

  // ── 3. DETALLES DEL TURNO ──
  y = sectionBar("Detalles del turno", y)

  ry = y
  ry = kv("Caja inicial:", formatCurrency(session.openingCashAmount), ry)
  ry = kv("Horario:", `${session.openedAt}  —  ${session.closedAt || "en curso"}`, ry)

  doc.setDrawColor(215, 215, 215)
  doc.line(ML + 2, ry, ML + W - 2, ry)
  ry += 3.5

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.text("Diferencia de caja:", ML + 2, ry)
  doc.setTextColor(diffColor[0], diffColor[1], diffColor[2])
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.text(diffLabel, ML + W - 2, ry, { align: "right" })
  doc.setTextColor(0, 0, 0)

  y = ry + 9

  // ── 4. OBSERVACIONES ──
  y = sectionBar("Observaciones", y)

  const openingNotes = (session as any).openingNotes || ""
  const closingNotes = (session as any).closingNotes || ""
  const notes = [openingNotes, closingNotes].filter(Boolean).join(" | ") || "Sin observaciones"

  const obsH = 12
  doc.setFillColor(...C_LIGHT)
  doc.rect(ML, y - 1, W, obsH, "F")
  doc.setFont("helvetica", "italic")
  doc.setFontSize(7.5)
  doc.setTextColor(90, 90, 90)
  doc.text(notes, ML + 3, y + 2, { maxWidth: W - 6 })
  doc.setTextColor(0, 0, 0)

  y += obsH + 6

  // ── 5. VENTAS VINCULADAS ──
  if (y > 190) { doc.addPage(); y = 20 }
  y = sectionBar("Ventas vinculadas", y)

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
    headStyles: { fontSize: 7, fillColor: [...C_ACCENT], textColor: [255, 255, 255] },
    bodyStyles: { fontSize: 7.5 },
    margin: { left: ML },
    tableWidth: W,
  })

  y = (doc as any).lastAutoTable.finalY + 6

  // ── 6. MOVIMIENTOS DE CAJA ──
  if (y > 230) { doc.addPage(); y = 20 }
  y = sectionBar("Movimientos de caja", y)

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
    headStyles: { fontSize: 7, fillColor: [...C_ACCENT], textColor: [255, 255, 255] },
    bodyStyles: { fontSize: 7.5 },
    margin: { left: ML },
    tableWidth: W,
  })

  // ── FOOTER ──
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(ML, 286, ML + W, 286)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6)
  doc.setTextColor(160, 160, 160)
  const now = new Date()
  const genDate = now.toLocaleDateString("es-AR")
  const genTime = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
  doc.text(`Generado el ${genDate} a las ${genTime}  ·  ${session.locationName}`, ML, 291)

  doc.save(`${title.replace(/\s+/g, "-").toLowerCase()}.pdf`)
}
