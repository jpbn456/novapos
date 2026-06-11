# Design: Mejoras en Órdenes de Compra

## Technical Approach

Tres capacidades aditivas sobre el módulo existente — sin cambios retroactivos ni refactors. Cada capacidad es independiente y puede implementarse en cualquier orden.

| Decisión | Opciones | Decisión | Razón |
|----------|----------|----------|-------|
| Storage adjuntos | Supabase Storage vs `public/uploads/` | `public/uploads/purchase-orders/` | El usuario lo pide explícitamente. Sin dependencia externa. Fácil de migrar a S3/Supabase después |
| Categoría en gastos | `String?` vs omitir | Omitir | Las specs no la incluyen. Se agrega después si hacen falta reportes |
| PUT gastos | `deleteMany+create` vs diff | Diff explícito: delete no-provistos, create nuevos | `deleteMany+create` perdería IDs de gastos existentes y rompería referencias |

---

## 1. IVA Opcional

### Schema

```prisma
model PurchaseOrder {
  // ...existing fields...
  includeTax Boolean @default(true)
  // ...existing relations...
}
```

### Data Flow

```
[Toggle "Incluye IVA"] → includeTax: boolean
                        ↓
  calculatePurchaseOrderTotals(items, includeTax, expenses)
    → { subtotal, tax, expensesTotal, total }
    → tax = includeTax ? subtotal * 0.21 : 0
    → total = subtotal + tax + expensesTotal
```

### API Changes

**POST schema** — add `includeTax?: boolean` (optional, default `true`)
**PUT schema** — add `includeTax?: boolean`
**Response** — `serializePurchaseOrder` incluye `includeTax: boolean`

### Frontend

- **new/page.tsx**: Agregar estado `includeTax` (default `true`), checkbox en el Card de Resumen, `useMemo` respeta el toggle
- **[id]/page.tsx**: Igual + el toggle se inicializa desde `order.includeTax` al cargar
- El resumen muestra "IVA (21%)" si `includeTax=true`, "IVA" en 0 si `includeTax=false`

---

## 2. PDF Attachments

### Schema

```prisma
enum PurchaseOrderAttachmentType {
  RECEIPT
  BUDGET
  OTHER
}

model PurchaseOrderAttachment {
  id              String                       @id @default(cuid())
  purchaseOrderId String
  name            String
  fileUrl         String
  type            PurchaseOrderAttachmentType
  createdAt       DateTime                     @default(now())

  purchaseOrder PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)

  @@index([purchaseOrderId])
}
```

### Data Flow

```
[Input file] → POST /api/purchase-orders/[id]/attachments
  → Valida MIME type (application/pdf)
  → Genera UUID filename, guarda en public/uploads/purchase-orders/{uuid}.pdf
  → Crea registro PurchaseOrderAttachment
  → Response 201 con el attachment serializado

DELETE /api/purchase-orders/[id]/attachments/[attachmentId]
  → Borra archivo del filesystem
  → Borra registro en DB
  → Response 200

GET /api/purchase-orders/[id]
  → include: { attachments: true } en Prisma query
  → serialize incluye attachments
```

### File Storage

- Directorio: `public/uploads/purchase-orders/`
- Filename: `${crypto.randomUUID()}.pdf`
- Se crea con `fs.mkdirSync` si no existe (en el handler)
- Servido estáticamente por Next.js desde `public/`

### New API Routes

| Route | Method | Input | Output |
|-------|--------|-------|--------|
| `/api/purchase-orders/[id]/attachments` | POST | FormData: file (PDF), type (string enum) | 201 + attachment |
| `/api/purchase-orders/[id]/attachments/[attachmentId]` | DELETE | — | 200 |

### Frontend — Sección "Adjuntos" en [id]/page.tsx

- Input file con accept=".pdf"
- Selector de tipo (Recibo, Presupuesto, Otro)
- Lista de archivos con nombre, tipo, fecha, botón descargar, botón eliminar
- Solo visible si `canEdit` para upload/delete
- Siempre visible en modo lectura

---

## 3. Gastos Adicionales

### Schema

```prisma
model PurchaseOrderExpense {
  id              String   @id @default(cuid())
  purchaseOrderId String
  description     String
  amount          Decimal  @db.Decimal(10, 2)
  createdAt       DateTime @default(now())

  purchaseOrder PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)

  @@index([purchaseOrderId])
}
```

### Data Flow

```
Frontend: Array<{ description: string, amount: number }>
  → POST/PUT body: { ..., expenses: [...] }
  → calculatePurchaseOrderTotals(items, includeTax, expenses)
    → expensesTotal = sum(expenses.amount)
    → total = subtotal + tax + expensesTotal
  → PUT: diff expenses (delete removed, create new)
  → POST: create all expenses
```

### API Changes

**POST** body: `expenses?: Array<{ description: string, amount: number }>`
**PUT** body: `expenses?: Array<{ description: string, amount: number }>` (reemplaza gastos existentes)
**PUT logic**: delete expenses no incluidos en el nuevo array, create los nuevos

### Frontend

- **new/page.tsx**: Sección "Gastos adicionales" con inputs dinámicos (descripción + monto + botón quitar + botón agregar)
- **[id]/page.tsx**: Igual + solo editable si `canEdit`
- **Resumen**: Línea "Gastos" con `expensesTotal` entre IVA y Total

---

## File Map

| Archivo | Acción |
|---------|--------|
| `prisma/schema.prisma` | Modificar — +`PurchaseOrder.includeTax`, +`PurchaseOrderAttachment`, +`PurchaseOrderExpense`, +`PurchaseOrderAttachmentType` enum |
| `src/lib/purchase-orders.ts` | Modificar — `calculatePurchaseOrderTotals` acepta `includeTax` y `expenses` |
| `src/lib/reports/pdf-export.ts` | Modificar — tipo `PurchaseOrderPDFData` incluye `includeTax`, `expensesTotal` |
| `src/app/api/purchase-orders/route.ts` | Modificar — schema Zod + persistir `includeTax` y `expenses` en POST |
| `src/app/api/purchase-orders/[id]/route.ts` | Modificar — schema Zod + persistir `includeTax` y `expenses` en PUT, incluir attachments en GET |
| `src/app/api/purchase-orders/[id]/attachments/route.ts` | **Crear** — POST handler para upload |
| `src/app/api/purchase-orders/[id]/attachments/[attachmentId]/route.ts` | **Crear** — DELETE handler |
| `src/app/(dashboard)/purchase-orders/new/page.tsx` | Modificar — +Toggle IVA, +Sección gastos |
| `src/app/(dashboard)/purchase-orders/[id]/page.tsx` | Modificar — +Toggle IVA, +Sección gastos, +Sección adjuntos |

---

## Testing Strategy

| Capa | Qué probar | Cómo |
|------|------------|------|
| Unit | `calculatePurchaseOrderTotals` con `includeTax=false` y `expenses` | Test directo de la función |
| Unit | `serializePurchaseOrder` incluye `includeTax` | Test directo |
| Integration | POST crea orden con `includeTax=false` y `expenses` | Prisma mock o test DB |
| Integration | Adjuntos: subida, validación PDF, delete | API route test |
| E2E | Flujo completo: crear orden sin IVA + gastos → ver resumen | Playwright |

---

## Migration Plan

1. Schema → migration → `prisma migrate dev --name add-purchase-order-enhancements`
2. Helpers (`calculatePurchaseOrderTotals`, `serializePurchaseOrder`)
3. API routes (POST, PUT, attachments)
4. Frontend (new page, detail page)
5. Static dir: `mkdir -p public/uploads/purchase-orders`
6. Commit por capacidad o en un solo PR (las tres son aditivas)

## Rollback

1. `git revert` del PR
2. `prisma migrate down` o revertir manual: `ALTER TABLE PurchaseOrder DROP COLUMN includeTax; DROP TABLE PurchaseOrderAttachment; DROP TABLE PurchaseOrderExpense;`
3. Eliminar `public/uploads/purchase-orders/` (opcional — archivos huérfanos)
4. Coordinar ventana de mantenimiento — schema change no es backward-compatible si se revierte
