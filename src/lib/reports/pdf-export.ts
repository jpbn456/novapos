import type { SalesReportGroup, PurchaseReportGroup } from "@/lib/types/reports"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export async function exportSalesPDF(data: SalesReportGroup[], title: string) {
  const jsPDF = (await import("jspdf")).default
  const autoTable = (await import("jspdf-autotable")).default
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
  const jsPDF = (await import("jspdf")).default
  const autoTable = (await import("jspdf-autotable")).default
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
