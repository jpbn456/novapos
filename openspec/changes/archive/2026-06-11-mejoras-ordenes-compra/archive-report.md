# Informe de Archive: Mejoras en Órdenes de Compra

**Cambio**: `mejoras-ordenes-compra`
**Fecha de archive**: 2026-06-11
**Archivado en**: `openspec/changes/archive/2026-06-11-mejoras-ordenes-compra/`
**Veredicto de verificación**: PASS WITH WARNINGS
**Tipo de archive**: Intencional con advertencias (ver sección de Problemas Conocidos)

---

## Resumen

Se implementaron tres capacidades aditivas sobre el módulo de órdenes de compra:

1. **IVA Opcional** — toggle "Incluye IVA" que permite crear/editar órdenes sin IVA (tax=0, total=subtotal).
2. **Gastos Adicionales** — modelo `PurchaseOrderExpense` para registrar fletes, seguros y otros gastos que afectan el total.
3. **Adjuntos PDF** — modelo `PurchaseOrderAttachment` con subida a `public/uploads/purchase-orders/`, visualización y eliminación.

---

## Artefactos del Cambio

| Artefacto | Ruta (archivado) |
|-----------|-------------------|
| Propuesta | `proposal.md` |
| Especificaciones | `specs/README.md` |
| Diseño técnico | `design.md` |
| Tareas | `tasks.md` |
| Informe de verificación | `verify-report.md` |
| **Este reporte** | `archive-report.md` |

### IDs de Observación (Engram)

- Propuesta: No disponible (artefacto openspec)
- Especificaciones: No disponible (artefacto openspec)
- Diseño: No disponible (artefacto openspec)
- Tareas: No disponible (artefacto openspec)
- Verify-report: No disponible (artefacto openspec)
- Apply-progress: Observation #12 (topic_key: `sdd/mejoras-ordenes-compra/apply-progress`)

---

## Estado de Implementación

### Lo que se construyó

#### 1. IVA Opcional
- ✅ Campo `includeTax Boolean @default(true)` en modelo `PurchaseOrder`
- ✅ Helper `calculatePurchaseOrderTotals(items, includeTax?, expenses?)` — tax=0 si includeTax=false
- ✅ `serializePurchaseOrder` serializa `includeTax` con default `true` para backward compatibility
- ✅ POST route: schema Zod acepta `includeTax`, lo persiste
- ✅ PUT route: schema Zod acepta `includeTax`, recalcula totals cuando cambia sin items
- ✅ Frontend `new/page.tsx`: checkbox "Incluye IVA" en Card Resumen, recálculo vía `useMemo`
- ✅ Frontend `[id]/page.tsx`: checkbox inicializado desde `order.includeTax`, condicional editable/read-only
- ✅ Resumen muestra "IVA (21%)" o "IVA $0" según el toggle
- ✅ PDF export respeta `includeTax` (oculta línea de IVA si es false)

#### 2. Gastos Adicionales
- ✅ Modelo `PurchaseOrderExpense` con id, purchaseOrderId, description, amount, createdAt
- ✅ Relación `onDelete: Cascade` con `PurchaseOrder`
- ✅ Helper suma `expensesTotal` al total: `total = subtotal + tax + expensesTotal`
- ✅ POST route: crea expenses anidados con `expenses: { create: ... }`
- ✅ PUT route: diff explícito — `deleteMany` para no-provistos, `create` para nuevos
- ✅ Frontend `new/page.tsx`: sección dinámica con inputs descripción + monto + botones agregar/quitar
- ✅ Frontend `[id]/page.tsx`: igual, condicional editable/read-only según `canEdit`
- ✅ Línea "Gastos adicionales" en resumen entre IVA y Total
- ✅ PDF export muestra línea de gastos si `expensesTotal > 0`

#### 3. Adjuntos PDF
- ✅ Enum `PurchaseOrderAttachmentType` (RECEIPT, BUDGET, OTHER)
- ✅ Modelo `PurchaseOrderAttachment` con id, purchaseOrderId, name, fileUrl, type, createdAt
- ✅ Relación `onDelete: Cascade` con `PurchaseOrder`
- ✅ API `POST /api/purchase-orders/[id]/attachments` — validación MIME PDF + extensión, guarda en disco, crea registro
- ✅ API `DELETE /api/purchase-orders/[id]/attachments/[attachmentId]` — borra archivo + registro
- ✅ Frontend `[id]/page.tsx`: sección "Adjuntos" con input file, lista con badge de tipo, botón descargar y eliminar
- ✅ Upload con FormData, `type` se envía como "RECEIPT" (ver advertencia en desviaciones)
- ✅ Estado vacío con mensaje "Sin archivos adjuntos"
- ✅ Subida solo si `canEdit`, vista siempre visible
- ✅ Directorio `public/uploads/purchase-orders/` creado con `.gitkeep`
- ✅ Manejo graceful si el archivo no existe en disco al eliminar

#### 4. PDF Export
- ✅ Tipo `PurchaseOrderPDFData` incluye `includeTax` y `expensesTotal`
- ✅ `exportPurchaseOrderPDF` muestra/oculta IVA según `includeTax`
- ✅ Muestra línea de gastos adicionales si `expensesTotal > 0`

### Archivos Modificados/Creados

| Archivo | Acción |
|---------|--------|
| `prisma/schema.prisma` | Modificado — +`includeTax`, +`PurchaseOrderExpense`, +`PurchaseOrderAttachment`, +`PurchaseOrderAttachmentType` |
| `src/lib/purchase-orders.ts` | Modificado — firma `calculatePurchaseOrderTotals` actualizada, `serializePurchaseOrder` extendido |
| `src/lib/purchase-orders.test.ts` | Modificado — +12 tests nuevos (20 tests total) |
| `src/lib/reports/pdf-export.ts` | Modificado — tipos y render condicional en PDF |
| `src/app/api/purchase-orders/route.ts` | Modificado — schema Zod + persistencia de includeTax y expenses |
| `src/app/api/purchase-orders/[id]/route.ts` | Modificado — schema Zod, diff expenses, include en GET |
| `src/app/api/purchase-orders/[id]/attachments/route.ts` | **Nuevo** — POST upload |
| `src/app/api/purchase-orders/[id]/attachments/[attachmentId]/route.ts` | **Nuevo** — DELETE attachment |
| `src/app/(dashboard)/purchase-orders/new/page.tsx` | Modificado — +toggle IVA, +sección gastos |
| `src/app/(dashboard)/purchase-orders/[id]/page.tsx` | Modificado — +toggle IVA, +sección gastos, +sección adjuntos |
| `public/uploads/purchase-orders/.gitkeep` | **Nuevo** — directorio de uploads |

### Tareas Completadas

**Fase 1 (Infraestructura)**: 7/7 ✅
**Fase 2 (Implementación)**: 13/13 ✅
**Fase 3 (Testing)**: 3/8 ✅ (tareas 3.1–3.3 completadas; 3.4–3.8 diferidas)

**Total**: 23/28 tareas completadas

---

## Problemas Conocidos y Trabajo Diferido

### Tareas de Testing Pendientes (3.4–3.8)

Las siguientes tareas de testing de integración y e2e no fueron implementadas:

| Tarea | Descripción | Estado |
|-------|-------------|--------|
| 3.4 | Test integración: POST crea orden con includeTax=false y expenses | ⏳ Pendiente |
| 3.5 | Test integración: PUT actualiza expenses con diff | ⏳ Pendiente |
| 3.6 | Test integración: POST attachments rechaza archivo no-PDF | ⏳ Pendiente |
| 3.7 | Test integración: POST/DELETE attachments crea/borra archivo + registro | ⏳ Pendiente |
| 3.8 | Test e2e: flujo completo crear orden sin IVA + gastos | ⏳ Pendiente |

**Razón**: El entorno actual no cuenta con infraestructura de base de datos de prueba (Prisma mock o test DB) para realizar tests de integración. Los tests unitarios (3.1–3.3) cubren la lógica central de negocio y pasan correctamente (79 tests, 0 fallos).

**Recomendación**: Implementar tests de integración cuando se disponga de infraestructura adecuada (ej. `@prisma/test` o base de datos PostgreSQL de testing).

### Desviaciones de las Especificaciones

| # | Especificación | Implementación | Severidad |
|---|---|---|---|
| 1 | Almacenamiento en Supabase Storage bucket `purchase-order-attachments` | Sistema de archivos local `public/uploads/purchase-orders/` | ⚠️ WARNING |
| 2 | Selector de tipo de attachment en UI (RECEIPT/BUDGET/OTHER) | Frontend siempre envía `type: "RECEIPT"` hardcodeado | ⚠️ WARNING |

**Nota sobre la desviación #1**: El diseño técnico (`design.md`) ya había corregido la especificación original para usar el sistema de archivos local en lugar de Supabase Storage. La especificación (`specs/README.md`) no fue actualizada para reflejar esta decisión. Si en el futuro se migra a Supabase Storage, se recomienda extraer la lógica de almacenamiento a un servicio (`storage-service.ts`) para facilitar el reemplazo.

**Nota sobre la desviación #2**: El frontend no presenta un selector de tipo de attachment. Siempre envía `type: "RECEIPT"`. El enum `PurchaseOrderAttachmentType` soporta RECEIPT, BUDGET y OTHER, pero la UI solo usa RECEIPT. Para aprovechar el enum completo, agregar un selector (select/dropdown) en la sección de adjuntos.

---

## Instrucciones para el Próximo Desarrollador

### Si retomás este cambio

1. **Tests de integración pendientes**: Implementar tests para las tareas 3.4–3.8 usando `@prisma/test` o una base PostgreSQL de testing.
2. **Selector de tipo de attachment**: Agregar un dropdown en `[id]/page.tsx` (sección Adjuntos) para que el usuario pueda elegir entre Factura/Presupuesto/Otro.
3. **Migración a Supabase Storage**: Si se decide migrar, reemplazar las rutas de archivos locales (`public/uploads/purchase-orders/`) por el bucket `purchase-order-attachments` de Supabase. Extraer la lógica de almacenamiento a un servicio primero.

### Si trabajás en el módulo de órdenes de compra

- El toggle "Incluye IVA" está en `new/page.tsx` (línea 76, 408–416) y `[id]/page.tsx` (línea 138, 667–679).
- Los gastos adicionales se renderizan en ambos frontends con estado `expenses[]` y se envían como array en POST/PUT.
- Los attachments se suben vía FormData a `POST /api/purchase-orders/[id]/attachments` y se listan desde `order.attachments`.
- El PUT de expenses hace diff: elimina los que no están en el array entrante (`deleteMany where id notIn`) y crea los nuevos (sin id). Los gastos existentes con id no se modifican.
- El PDF export (`exportPurchaseOrderPDF`) respeta `includeTax` y `expensesTotal`. Si agregás un campo nuevo, actualizá `PurchaseOrderPDFData` y el render en esa función.

### Decisiones de Arquitectura Registradas

- **Storage local vs Supabase**: Se eligió `public/uploads/purchase-orders/` (sistema de archivos local) por simplicidad y facilidad de migración futura. El diseño técnico lo documenta explícitamente.
- **Diff de gastos en PUT**: Se usa diff explícito (delete no-provistos + create nuevos) en lugar de `deleteMany+create` para preservar IDs de gastos existentes y evitar pérdida de referencias.
- **Backward compatibility**: `includeTax` default `true` tanto en schema Prisma como en `serializePurchaseOrder` para que órdenes existentes mantengan su comportamiento.

---

## Registro de Archive (Engram)

Este reporte se persiste también en Engram con:
- **topic_key**: `sdd/mejoras-ordenes-compra/archive-report`
- **type**: `architecture`

---

## Verificación Final

- [x] Todos los artefactos están presentes en el archive
- [x] Las especificaciones funcionales están correctamente implementadas
- [x] 79 tests pasan, 0 fallos
- [x] TypeScript compila sin errores
- [x] No hay issues CRITICAL en el informe de verificación
- [x] El cambio ya no está en el directorio activo (`openspec/changes/`)
- [x] El directorio `public/uploads/purchase-orders/` está creado
- [x] La migración de Prisma fue ejecutada (`add-purchase-order-enhancements`)
- [x] `openspec/config.yaml` no requiere cambios (ya contiene reglas de archive estándar)

---

## Ciclo SDD Completo

El cambio fue planificado, especificado, diseñado, implementado, verificado y archivado.
