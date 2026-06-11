# Tasks: Mejoras en Órdenes de Compra

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Líneas estimadas cambiadas | ~650 (sin migración) / ~750 (con migración) |
| 400-line budget risk | Alto |
| Chained PRs recommended | Sí |
| Suggested split | PR 1: IVA Opcional → PR 2: Gastos Adicionales → PR 3: PDF Attachments |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending — necesita decisión del equipo |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Base Branch |
|------|------|-----------|-------------|
| 1 | IVA Opcional — schema field + helper + API + frontend | PR 1 | feature/mejoras-ordenes-compra |
| 2 | Gastos Adicionales — schema model + helper + API + frontend | PR 2 | PR 1 branch |
| 3 | PDF Attachments — schema model + API routes + frontend + file storage | PR 3 | PR 2 branch |

## Fase 1: Infraestructura (Schema + Helpers)

- [x] 1.1 Schema: agregar `includeTax Boolean @default(true)` a `PurchaseOrder`
- [x] 1.2 Schema: crear modelo `PurchaseOrderExpense` con id, purchaseOrderId, description, amount, createdAt + relación con `PurchaseOrder`
- [x] 1.3 Schema: crear enum `PurchaseOrderAttachmentType` + modelo `PurchaseOrderAttachment` con id, purchaseOrderId, name, fileUrl, type, createdAt
- [x] 1.4 Schema: agregar `attachments PurchaseOrderAttachment[]` y `expenses PurchaseOrderExpense[]` al modelo `PurchaseOrder`
- [x] 1.5 Ejecutar `prisma migrate dev --name add-purchase-order-enhancements`
- [x] 1.6 Helper: modificar `calculatePurchaseOrderTotals(items, includeTax?, expenses?)` — tax=0 si includeTax=false, sumar expenses al total
- [x] 1.7 Helper: actualizar `serializePurchaseOrder` para incluir `includeTax: boolean`

## Fase 2: Implementación (API + Frontend)

- [x] 2.1 POST route: agregar `includeTax` y `expenses` al schema Zod + crear expenses anidados
- [x] 2.2 PUT route: agregar `includeTax` al schema Zod + lógica diff para expenses (delete no-provistos, create nuevos)
- [x] 2.3 GET [id] route: incluir `attachments` y `expenses` en la query Prisma
- [x] 2.4 API nueva: `POST /api/purchase-orders/[id]/attachments` — validar MIME PDF, guardar en `public/uploads/purchase-orders/`, crear registro
- [x] 2.5 API nueva: `DELETE /api/purchase-orders/[id]/attachments/[attachmentId]` — borrar archivo + registro
- [x] 2.6 PDF export: agregar `includeTax` y `expensesTotal` a `PurchaseOrderPDFData`, mostrar en el PDF generado
- [x] 2.7 Frontend new/page.tsx: agregar toggle "Incluye IVA" en Card Resumen + recálculo en useMemo
- [x] 2.8 Frontend new/page.tsx: agregar sección "Gastos adicionales" con inputs dinámicos (descripción + monto + botones agregar/quitar)
- [x] 2.9 Frontend [id]/page.tsx: agregar toggle "Incluye IVA" inicializado desde `order.includeTax`
- [x] 2.10 Frontend [id]/page.tsx: agregar sección "Gastos adicionales" solo editable si canEdit
- [x] 2.11 Frontend [id]/page.tsx: agregar sección "Adjuntos" con upload (input file + selector tipo) + lista con descarga/eliminación
- [x] 2.12 Frontend [id]/page.tsx: enviar `includeTax` y `expenses` en el body del PUT
- [x] 2.13 Crear directorio `public/uploads/purchase-orders/` si no existe

## Fase 3: Testing

- [x] 3.1 Test unitario: `calculatePurchaseOrderTotals` con includeTax=false devuelve tax=0
- [x] 3.2 Test unitario: `calculatePurchaseOrderTotals` con expenses suma al total
- [x] 3.3 Test unitario: `serializePurchaseOrder` incluye `includeTax`
- [ ] 3.4 Test integración: POST crea orden con includeTax=false y expenses
- [ ] 3.5 Test integración: PUT actualiza expenses con diff (nuevos, eliminados)
- [ ] 3.6 Test integración: POST attachments rechaza archivo no-PDF
- [ ] 3.7 Test integración: POST attachments crea archivo + registro; DELETE borra ambos
- [ ] 3.8 Test e2e: flujo completo — crear orden sin IVA + gastos → ver resumen actualizado
