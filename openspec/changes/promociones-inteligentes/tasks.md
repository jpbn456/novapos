# Tasks: Promociones Inteligentes

## Phase 1: Infraestructura y migración

- [x] 1.1 Modificar `prisma/schema.prisma` para reemplazar `PromotionComboItem` por `PromotionGroup`/`PromotionGroupOption`, agregar enums/campos de grupo y mantener `Promotion.products` como índice derivado.
- [x] 1.2 Crear `prisma/migrations/20260606_promotions_groups/migration.sql` para crear tablas nuevas, migrar combos legacy a un grupo `MANDATORY`, reconstruir `Promotion.products` y eliminar la estructura plana.
- [x] 1.3 Actualizar `src/lib/promotion-data.ts` para leer grupos/opciones desde Prisma y devolver un payload activo compatible con POS y pricing.

## Phase 2: Backend de promociones y pricing

- [x] 2.1 Refactorizar `src/app/actions/promotions.ts` para cambiar Zod/payloads de `comboItems` a `groups`, validar una sola estrategia de descuento y rechazar `ELIGIBLE.requiredQuantity` inválidos.
- [x] 2.2 Ajustar `src/app/actions/promotions.ts` para persistir create/update con `groups.options`, limpiar relaciones previas al editar y recalcular `products.create` desde opciones únicas.
- [x] 2.3 Reescribir `src/lib/pricing.ts` para matchear combos por grupos obligatorios/elegibles, calcular `bundleCount` con stock restante y distribuir el descuento proporcionalmente sobre líneas concretas.
- [x] 2.4 Adaptar `src/app/actions/sales.ts` y `src/app/api/sales/route.ts` para reutilizar el nuevo shape de promociones activas y mantener la repricing server-side alineada con `src/lib/pricing.ts`.

## Phase 3: Backoffice y POS

- [x] 3.1 Rediseñar `src/app/(dashboard)/promotions/page.tsx` para editar `groups` y `options`, permitir grupos `MANDATORY`/`ELIGIBLE`, y mover cada botón “Quitar” al header o ítem que elimina.
- [x] 3.2 Extender `src/contexts/cart-context.tsx` con `addItems()` para insertar múltiples productos concretos en una sola operación sin crear líneas abstractas de promo.
- [x] 3.3 Actualizar `src/app/(dashboard)/pos/page.tsx` con switch/tab `Productos`/`Promociones`, listado de promos activas y estado vacío cuando `getActivePromotions()` no devuelve resultados.
- [x] 3.4 Completar `src/app/(dashboard)/pos/page.tsx` con modal de selección para grupos elegibles, bloqueo de confirmación incompleta y alta directa al carrito para promos sólo obligatorias usando `addItems()`.

## Phase 4: Verificación

- [x] 4.1 Crear `src/lib/pricing.test.ts` con casos table-driven para escenarios de specs: mandatory-only, mixed groups, selección insuficiente, solapamiento de productos y migración legacy con mismo descuento.
- [x] 4.2 Crear `src/app/actions/promotions.test.ts` y/o `src/lib/promotion-data.test.ts` con mocks de Prisma para validar create/update de grupos, rechazo de reglas elegibles inválidas y lectura backfilled de combos legacy.
- [ ] 4.3 Verificar manualmente `src/app/(dashboard)/promotions/page.tsx` y `src/app/(dashboard)/pos/page.tsx` cubriendo: browse/no promos, modal open-close, bloqueo por selección incompleta, agregado de líneas concretas y ubicación explícita de “Quitar”.
