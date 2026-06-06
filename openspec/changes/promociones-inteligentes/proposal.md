# Proposal: Promociones Inteligentes

## Intent

Habilitar combos más flexibles y una UX de POS orientada a vender promos reales, sin romper la regla base: el carrito, pricing y ventas persisten productos concretos. También corrige una fricción de usabilidad en el formulario de promociones.

## Scope

### In Scope
- Rediseñar promos COMBO para soportar grupos obligatorios y grupos elegibles con selección N de M.
- Agregar vista dual en POS: **Productos** y **Promociones**, con modal para promos con opciones.
- Reubicar el botón **Quitar** en el editor de promociones.

### Out of Scope
- Persistir “líneas de promo abstracta” en carrito, venta o BD.
- Edición histórica de ventas, reservas de stock por promo o dependencias externas.

## Capabilities

### New Capabilities
- `promociones-grupos`: definir combos con grupos obligatorios/elegibles y una sola estrategia de descuento.
- `pos-promos-vista`: navegar promos activas en POS y resolver selecciones elegibles antes de agregar productos.

### Modified Capabilities
- None.

## Approach

Migrar `PromotionComboItem` a una estructura de grupos/ítems: `PromotionComboGroup` (tipo, min/max/elegibles, orden) + `PromotionComboGroupItem` (producto, cantidad). Mantener `Promotion.products` como índice derivado para consultas rápidas. Actualizar validaciones Zod y acciones para crear/editar grupos; migrar combos actuales a un grupo obligatorio único. Extender `getActivePromotionsData()` y `calculatePromotionalPricing()` para evaluar bundles desde grupos resueltos pero seguir descontando sobre líneas concretas. En POS, separar catálogo y promos en tabs/toggle; promos sin opciones agregan productos directo y promos elegibles abren modal, resuelven selección y recién ahí llaman `addItem()`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | Nuevos modelos de grupos + retiro de dependencia en `comboItems` planos |
| `prisma/migrations/*` | New | Migración y backfill de combos existentes |
| `src/app/actions/promotions.ts` | Modified | Validación, payloads y CRUD de grupos |
| `src/lib/promotion-data.ts` | Modified | Shape activa para POS y pricing |
| `src/lib/pricing.ts` | Modified | Matching de bundles con grupos resueltos |
| `src/app/(dashboard)/promotions/page.tsx` | Modified | Editor de grupos y reubicación de quitar |
| `src/app/(dashboard)/pos/page.tsx` | Modified | Vista promociones + modal de selección |
| `src/contexts/cart-context.tsx` | Modified | API de agregado múltiple sin abstraer promos |
| `src/app/actions/sales.ts` | Modified | Consistencia con pricing actualizado |
| `src/app/api/sales/route.ts` | Modified | Consistencia con pricing actualizado |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Mayor complejidad del motor de pricing | High | Modelar grupos explícitos y cubrir migración + casos límite en specs |
| Migración incorrecta de combos actuales | Med | Backfill 1:1 a grupo obligatorio y verificación manual post-migración |

## Rollback Plan

Revertir deployment de app, deshacer la migración Prisma restaurando el esquema previo y volver a cargar `comboItems` desde backup/migración inversa.

## Dependencies

- None external.

## Success Criteria

- [ ] Se puede crear una promo con al menos un grupo obligatorio y un grupo elegible N/M.
- [ ] POS muestra vistas separadas y abre modal sólo para promos con opciones.
- [ ] Confirmar una promo agrega únicamente productos concretos al carrito.
- [ ] Combos existentes siguen funcionando tras la migración sin edición manual.
- [ ] El botón **Quitar** queda ubicado de forma consistente e intuitiva en el editor.
