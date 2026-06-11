# Mejoras en Órdenes de Compra — Especificaciones

Propuesta de referencia: `openspec/changes/mejoras-ordenes-compra/proposal.md`

---

## 1. IVA Opcional (`iva-opcional`)

### Propósito

Permitir que cada orden de compra decida si incluye IVA (21%) en el cálculo de totales, manteniendo compatibilidad hacia atrás con órdenes existentes.

### Requirements

#### Requirement: Campo `includeTax` en el modelo

- SHALL: El modelo `PurchaseOrder` DEBE agregar el campo `includeTax Boolean @default(true)`.
- SHALL: Órdenes existentes SIN migración DEBEN conservar `includeTax = true` (comportamiento actual).
- SHALL: El campo DEBE ser persistido en base de datos y expuesto en la API.

#### Scenario: Crear orden sin IVA

- GIVEN un usuario completa el formulario de nueva orden
- WHEN desactiva el toggle "Incluye IVA" y envía la orden
- THEN `includeTax` se envía como `false` en el body del POST
- AND `calculatePurchaseOrderTotals()` calcula `tax = 0`
- AND `total = subtotal` (sin incluir gastos adicionales si los hubiera)
- AND la orden se guarda con `tax = 0` y `total = subtotal`

#### Scenario: Crear orden con IVA (comportamiento actual)

- GIVEN un usuario completa el formulario de nueva orden
- WHEN deja activo el toggle "Incluye IVA" (default)
- THEN `calculatePurchaseOrderTotals()` calcula `tax = subtotal * 0.21`
- AND `total = subtotal + tax`

#### Scenario: Desactivar IVA en orden existente

- GIVEN una orden existente con `includeTax = true` e items cargados
- WHEN el usuario desactiva "Incluye IVA" y guarda cambios vía PUT
- THEN el sistema recalcula `tax = 0` y `total = subtotal + expensesTotal`
- AND persiste `includeTax = false`

#### Scenario: Reactivar IVA en orden existente

- GIVEN una orden con `includeTax = false`
- WHEN el usuario activa "Incluye IVA" y guarda
- THEN `tax` y `total` se recalculan aplicando el 21% sobre el subtotal actual

#### Scenario: Cálculo en frontend refleja el toggle local

- GIVEN el usuario cambia el toggle "Incluye IVA" en el formulario
- WHEN el resumen se renderiza
- THEN `tax` se muestra como 21% del subtotal si `includeTax` es true, o `$0` si es false
- AND `total` se actualiza en tiempo real en el resumen

---

## 2. Adjuntos PDF (`adjuntos-pdf`)

### Propósito

Permitir adjuntar archivos PDF (recibos, presupuestos, otros comprobantes) a una orden de compra, con carga, visualización y eliminación.

### Requirements

#### Requirement: Modelo `PurchaseOrderAttachment`

- SHALL: Se DEBE crear el modelo `PurchaseOrderAttachment` con los campos:
  - `id String @id @default(cuid())`
  - `purchaseOrderId String` (FK a `PurchaseOrder`)
  - `name String` — nombre del archivo original
  - `fileUrl String` — URL pública del archivo en Supabase Storage
  - `type PurchaseOrderAttachmentType` — enum: `RECEIPT | BUDGET | OTHER`
  - `createdAt DateTime @default(now())`
- SHALL: Se DEBE crear el enum `PurchaseOrderAttachmentType` con los valores `RECEIPT`, `BUDGET`, `OTHER`.
- SHALL: La relación `PurchaseOrder → PurchaseOrderAttachment[]` DEBE usar `onDelete: Cascade`.

#### Scenario: Subir un attachment PDF

- GIVEN un usuario ve el detalle de una orden en estado editable
- WHEN selecciona un archivo PDF y hace clic en "Subir"
- THEN el archivo se sube al bucket `purchase-order-attachments` en Supabase Storage
- AND se crea un registro `PurchaseOrderAttachment` con `name`, `fileUrl`, `type`
- AND el attachment aparece en la lista de adjuntos de la orden

#### Scenario: Rechazar archivo no PDF

- GIVEN un usuario intenta subir un archivo que no es PDF
- WHEN el sistema valida el tipo MIME
- THEN MUST rechazar la subida con error `400` y mensaje "Solo se permiten archivos PDF"

#### Scenario: Descargar / visualizar un attachment

- GIVEN un usuario ve la lista de attachments
- WHEN hace clic en el botón de descarga de un attachment
- THEN el sistema abre el `fileUrl` en una nueva pestaña o inicia la descarga

#### Scenario: Eliminar un attachment

- GIVEN un usuario con permisos de edición ve la lista de attachments
- WHEN hace clic en "Eliminar" sobre un attachment
- THEN el sistema DEBE eliminar el archivo del bucket `purchase-order-attachments`
- AND DEBE eliminar el registro `PurchaseOrderAttachment` de la base de datos
- AND el attachment desaparece de la UI

#### Scenario: Eliminar orden elimina attachments en cascada

- GIVEN una orden que tiene attachments asociados
- WHEN la orden se elimina
- THEN los registros `PurchaseOrderAttachment` se eliminan en cascada
- AND los archivos en Supabase Storage QUEDAN huérfanos (el sistema SHOULD limpiarlos)

#### Scenario: Lista de attachments vacía

- GIVEN una orden sin attachments
- WHEN se carga la página de detalle
- THEN se muestra una sección "Adjuntos" con estado vacío y botón de subir

---

## 3. Gastos Adicionales (`gastos-adicionales`)

### Propósito

Permitir registrar gastos adicionales por orden de compra (fletes, señas, etc.) que afectan el total, sin relación con productos ni inventario.

### Requirements

#### Requirement: Modelo `PurchaseOrderExpense`

- SHALL: Se DEBE crear el modelo `PurchaseOrderExpense` con los campos:
  - `id String @id @default(cuid())`
  - `purchaseOrderId String` (FK a `PurchaseOrder`)
  - `description String`
  - `amount Decimal @db.Decimal(10, 2)`
  - `createdAt DateTime @default(now())`
- SHALL: Cada gasto pertenece EXACTAMENTE a una orden (no compartido).
- SHALL: Los gastos son independientes de productos e inventario.

#### Requirement: Cálculo de totales con gastos

- SHALL: La función `calculatePurchaseOrderTotals()` DEBE aceptar un parámetro `expenses: { amount: number }[]`.
- SHALL: La fórmula actualizada DEBE ser:
  - `subtotal = sum(items.quantity * items.unitCost)`
  - `tax = includeTax ? subtotal * 0.21 : 0`
  - `expensesTotal = sum(expenses.amount)`
  - `total = subtotal + tax + expensesTotal`

#### Scenario: Crear orden con gastos

- GIVEN un usuario completa el formulario de nueva orden
- WHEN agrega un gasto con descripción "Flete" y monto $500
- THEN el gasto se incluye en el body del POST
- AND `total = subtotal + tax + 500`
- AND el gasto se persiste en `PurchaseOrderExpense`

#### Scenario: Agregar gasto a orden existente

- GIVEN una orden existente en estado editable
- WHEN el usuario agrega un gasto con descripción y monto, y guarda
- THEN el nuevo `PurchaseOrderExpense` se crea asociado a la orden
- AND `total` se recalcula incluyendo el nuevo gasto

#### Scenario: Remover gasto de orden existente

- GIVEN una orden existente con gastos previos
- WHEN el usuario elimina un gasto de la lista y guarda
- THEN el `PurchaseOrderExpense` se elimina de la base de datos
- AND `total` se recalcula sin ese gasto

#### Scenario: Gastos visibles en resumen

- GIVEN una orden con uno o más gastos
- WHEN se muestra la tarjeta de resumen
- THEN DEBE mostrar una línea "Gastos" con el subtotal de gastos
- AND DEBE incluir los gastos en el cálculo del total final
- AND la línea "Total" DEBE reflejar `subtotal + tax + gastos`

#### Scenario: Múltiples gastos en una orden

- GIVEN un usuario agrega tres gastos: $300, $150, $50
- WHEN se calculan los totales
- THEN `expensesTotal = 500`
- AND `total = subtotal + tax + 500`

#### Scenario: Gastos en orden no editable (solo lectura)

- GIVEN una orden en estado `RECEIVED` o `CANCELLED`
- WHEN se carga la página de detalle
- THEN los gastos se muestran en modo solo lectura (sin opción de agregar/remover)

---

## Escenarios Transversales

### Scenario: Orden con IVA desactivado y gastos

- GIVEN una orden con `includeTax = false` y gastos por $200
- WHEN se calculan los totales
- THEN `tax = 0`, `expensesTotal = 200`
- AND `total = subtotal + 200`
- AND el resumen muestra IVA en $0 y Gastos en $200

### Scenario: Compatibilidad hacia atrás — órdenes existentes

- GIVEN una orden creada antes de esta migración
- WHEN se consulta vía API GET
- THEN `includeTax` se retorna como `true`
- AND `tax` y `total` no cambian
- AND la UI muestra el toggle activo por defecto

### Scenario: Rechazar monto de gasto inválido

- GIVEN el usuario intenta agregar un gasto
- WHEN el monto es 0, negativo o no es un número válido
- THEN el schema Zod DEBE rechazar el valor
- AND la API DEBE responder con error `400`
