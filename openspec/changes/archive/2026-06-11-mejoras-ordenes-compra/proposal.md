# Propuesta: Mejoras en Órdenes de Compra

## Intención

Agregar flexibilidad al módulo de órdenes de compra: permitir IVA opcional, adjuntar PDFs (recibos, presupuestos) y agregar gastos adicionales por orden. Hoy el IVA está fijo en 21% sin posibilidad de desactivarlo, no hay soporte para adjuntar comprobantes, y los gastos extra (fletes, señas) no pueden registrarse en la orden.

## Alcance

### Incluido
- **IVA opcional**: toggle "Incluye IVA" en creación y edición. Cuando está desactivado, tax=0 y total=subtotal.
- **Adjuntos PDF**: modelo `PurchaseOrderAttachment` con nombre, URL, tipo (RECEIPT|BUDGET|OTHER) y fecha de subida. UI en detalle para upload/view/delete. Storage vía Supabase Storage.
- **Gastos adicionales**: modelo `PurchaseOrderExpense` con descripción, monto y categoría opcional. Afectan el total. UI en creación y detalle para agregar/remover.

### Excluido
- Gastos compartidos entre órdenes (cada gasto pertenece a una sola orden).
- OCR o procesamiento automático de PDFs.
- Reportes contables agregados de gastos por proveedor.
- Traducción a otros idiomas.

## Valor de Negocio

- **IVA opcional**: proveedores no responsables inscriptos no facturan IVA. Hoy el sistema forza 21% y los totales quedan incorrectos.
- **Adjuntos PDF**: centraliza comprobantes en la orden. Elimina archivos sueltos en Drive/WhatsApp.
- **Gastos adicionales**: fletes, señas y otros costos asociados se registran donde corresponden. El total refleja el costo real de la compra.

## Enfoque Técnico

### IVA Opcional
1. Agregar `includeTax Boolean @default(true)` al modelo `PurchaseOrder`.
2. Modificar `calculatePurchaseOrderTotals(items, includeTax?)` — si `includeTax` es `false`, tax=0.
3. Agregar toggle checkbox en `new/page.tsx` y `[id]/page.tsx`. El estado `includeTax` se envía en el body del POST/PUT.
4. Actualizar schemas de validación Zod en ambas APIs para aceptar `includeTax`.
5. El cálculo en los `useMemo` del frontend debe respetar el toggle local antes de guardar.

### Adjuntos PDF
1. Nuevo modelo `PurchaseOrderAttachment`: `id, purchaseOrderId, name, fileUrl, type (PurchaseOrderAttachmentType), createdAt`.
2. Bucket `purchase-order-attachments` en Supabase Storage. Los archivos se suben directo desde el cliente al bucket usando políticas RLS o tokens efímeros.
3. Nueva API route `src/app/api/purchase-orders/[id]/attachments/route.ts` para CRUD.
4. Sección "Adjuntos" en `[id]/page.tsx` con lista de archivos, botón de upload (input file → Supabase upload → POST metadata) y botón de delete.
5. La ruta GET de orden incluye los attachments.

### Gastos Adicionales
1. Nuevo modelo `PurchaseOrderExpense`: `id, purchaseOrderId, description, amount, category (String?), createdAt`.
2. Modificar `calculatePurchaseOrderTotals()`: aceptar `expenses?: SumAmount[]`, sumarlos al total. Fórmula: `total = subtotal + tax + expensesTotal`.
3. UI de gastos en creación (sección dinámica con inputs descripción + monto) y detalle (igual + poder remover).
4. POST/PUT API: aceptar `expenses` en el schema Zod, crearlos/actualizarlos en cascada.

## Riesgos

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Migración de datos: órdenes existentes sin `includeTax` | Alta | Default `true` en schema — el comportamiento actual no cambia |
| Archivos huérfanos en Supabase Storage si se elimina attachment sin borrar el archivo | Media | Delete del archivo vía API de Supabase antes de borrar el registro |
| Gastos sin categoría generan inconsistencia en reportes futuros | Baja | `category` es opcional por ahora. Se puede agregar un enum más adelante |
| PUT API actual no maneja creación/eliminación de hijos (items usa deleteMany + create). Gastos y attachments necesitan lógica diferencial | Media | Usar `upsert` o lógica de diff explícita. No replicar el patrón deleteMany+create que ya existe para items |

## Módulos Afectados

| Módulo | Cambio |
|--------|--------|
| `prisma/schema.prisma` | +`PurchaseOrder.includeTax`, +`PurchaseOrderAttachment`, +`PurchaseOrderExpense`, +`PurchaseOrderAttachmentType` enum |
| `src/lib/purchase-orders.ts` | Modificar `calculatePurchaseOrderTotals()` — parámetro `includeTax` y `expenses` |
| `src/app/api/purchase-orders/route.ts` | Schema Zod + persistir `includeTax` y `expenses` |
| `src/app/api/purchase-orders/[id]/route.ts` | Schema Zod + persistir `includeTax` y `expenses` |
| `src/app/(dashboard)/purchase-orders/new/page.tsx` | +Toggle IVA, +Sección gastos |
| `src/app/(dashboard)/purchase-orders/[id]/page.tsx` | +Toggle IVA, +Sección gastos, +Sección adjuntos |
| `src/app/api/purchase-orders/[id]/attachments/route.ts` | **Nuevo** — CRUD de attachments |

## Plan de Rollback

1. **Prisma**: revertir migración (`prisma migrate down` o eliminar las nuevas tablas y columna manualmente).
2. **Código**: `git revert` del commit/PR de este cambio.
3. **Storage**: los archivos subidos a Supabase Storage quedarían huérfanos. Ejecutar script de limpieza del bucket `purchase-order-attachments` posterior al revert.
4. Si el deploy ya está en producción, coordinar ventana de mantenimiento porque el schema change no es backward-compatible si se revierte (pérdida de datos de gastos y attachments).

## Capacidades Nuevas

- `iva-opcional`: toggle que controla si una orden de compra incluye IVA en el cálculo de totales
- `adjuntos-pdf`: gestión de archivos PDF asociados a una orden de compra (subida, visualización, eliminación)
- `gastos-adicionales`: registro y gestión de gastos extra por orden de compra que afectan el total

## Criterios de Éxito

- [ ] Órdenes nuevas pueden crearse sin IVA y el total = subtotal
- [ ] Órdenes existentes sin migrar siguen mostrando IVA (default true)
- [ ] Se pueden subir y ver PDFs en el detalle de orden
- [ ] Se pueden agregar/remover gastos y el total se actualiza correctamente
- [ ] Todos los tests existentes pasan sin modificaciones
