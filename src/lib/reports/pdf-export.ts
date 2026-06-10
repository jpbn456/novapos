import type { SalesReportGroup, PurchaseReportGroup } from "@/lib/types/reports"

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
  expectedCashAmount: number
  countedCashAmount: number | null
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

  doc.save(`${title.replace(/\s+/g, "-").toLowerCase()}.pdf`)
}

export async function exportCashSessionPDF(session: CashSessionPDFData, title = `caja-${session.registerLabel}`) {
  const { jsPDF, autoTable } = await loadPdfTools()
  const doc = new jsPDF({ unit: "mm", format: "a4" })

  doc.setFontSize(16)
  doc.text(`Caja ${session.registerLabel}`, 14, 20)
  doc.setFontSize(10)
  doc.text(`${session.locationName} | turno ${session.shiftLabel.toLowerCase()} | ${session.businessDate}`, 14, 28)
  doc.text(`Estado: ${session.status} | Ventas: ${session.salesCount} | Recaudado: ${formatCurrency(session.totalRaised)}`, 14, 34)

  autoTable(doc, {
    startY: 42,
    head: [["Métrica", "Valor"]],
    body: [
      ["Apertura", formatCurrency(session.openingCashAmount)],
      ["Efectivo esperado", formatCurrency(session.expectedCashAmount)],
      ["Efectivo contado", session.countedCashAmount != null ? formatCurrency(session.countedCashAmount) : "Pendiente"],
      ["Diferencia", session.differenceAmount != null ? formatCurrency(session.differenceAmount) : "Pendiente"],
      ["Ingresos externos efectivo", formatCurrency(session.externalCashIncome)],
      ["Egresos externos efectivo", formatCurrency(session.externalCashExpense)],
    ],
    theme: "grid",
    headStyles: { fontSize: 8, fillColor: [59, 130, 246] },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14 },
    tableWidth: 90,
  })

  autoTable(doc, {
    startY: 42,
    margin: { left: 112 },
    head: [["Medio", "Ventas", "Ingresos", "Egresos"]],
    body: (["CASH", "CARD", "TRANSFER", "OTHER"] as const).map((method) => [
      method,
      formatCurrency(session.salesBreakdown[method]),
      formatCurrency(session.movementBreakdown[method].income),
      formatCurrency(session.movementBreakdown[method].expense),
    ]),
    theme: "grid",
    headStyles: { fontSize: 8, fillColor: [59, 130, 246] },
    bodyStyles: { fontSize: 8 },
    tableWidth: 88,
  })

  let y = Math.max((doc as any).lastAutoTable.finalY + 8, 88)

  doc.setFontSize(11)
  doc.text("Ventas vinculadas", 14, y)
  autoTable(doc, {
    startY: y + 4,
    head: [["Factura", "Fecha", "Pago", "Total"]],
    body: session.sales.map((sale) => [
      sale.invoiceNumber,
      sale.createdAt,
      sale.paymentMethod,
      formatCurrency(sale.total),
    ]),
    theme: "grid",
    headStyles: { fontSize: 8, fillColor: [59, 130, 246] },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14 },
    tableWidth: 180,
  })

  y = (doc as any).lastAutoTable.finalY + 8
  doc.setFontSize(11)
  doc.text("Movimientos de caja", 14, y)
  autoTable(doc, {
    startY: y + 4,
    head: [["Fecha", "Categoría", "Detalle", "Medio", "Monto"]],
    body: session.movements.map((movement) => [
      movement.createdAt,
      movement.category,
      movement.description,
      movement.paymentMethod,
      `${movement.type === "INCOME" ? "+" : "-"}${formatCurrency(movement.amount)}`,
    ]),
    theme: "grid",
    headStyles: { fontSize: 8, fillColor: [59, 130, 246] },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14 },
    tableWidth: 180,
  })

  doc.save(`${title.replace(/\s+/g, "-").toLowerCase()}.pdf`)
}
