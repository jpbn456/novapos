# Design: Promociones Inteligentes

## Technical Approach

Reemplazar el combo plano por grupos explícitos en Prisma y propagar ese shape a actions, `promotion-data` y `pricing`. El POS seguirá agregando productos concretos al carrito; la vista Promos sólo ayuda a prearmarlos y, si hay grupos elegibles, resuelve la selección en un modal antes de llamar al carrito.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|---|---|---|---|
| Modelo combo | Reusar `comboItems` con flags / crear `PromotionGroup` + `PromotionGroupOption` | Crear grupos y opciones | El pricing actual asume listas planas; N-de-M necesita estructura explícita, orden y validaciones por grupo. |
| Carrito POS | Guardar una “línea promo” abstracta / seguir con líneas de producto | Mantener líneas concretas | `createSale` y `/api/sales` ya recalculan promociones sobre productos; cambiar eso agrandaría alcance y riesgo histórico. |
| Matching elegible | Resolver al cobrar / resolver al agregar desde POS | Resolver en POS para UI; recalcular en pricing para backend | El usuario debe elegir opciones antes de agregar, pero ventas/API igual deben validar y descontar desde datos reales. |

## Data Flow

```text
PromotionsPage
  -> create/updatePromotion
  -> Prisma PromotionGroup/Option + PromotionProduct index

POS Products/Promos views
  -> promo card click
  -> choice modal (if eligible groups)
  -> cart.addItems([{productId, quantity}...])
  -> calculatePromotionalPricing(items, activePromotions)
  -> createSale / POST /api/sales
```

Pricing flow:

```text
cart lines -> group availability per product
          -> mandatory groups must fully match
          -> eligible groups pick best N options from remaining qty
          -> bundleCount = min(group bundle capacity)
          -> distribute combo discount proportionally to matched lines
```

## File Changes

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | Modify | Replace `PromotionComboItem` with `PromotionGroup` and `PromotionGroupOption`; keep `Promotion.products` as derived index. |
| `prisma/migrations/*` | Create | Backfill existing combos into one `MANDATORY` group preserving quantity and order. |
| `src/app/actions/promotions.ts` | Modify | Replace `comboItems` Zod/persistence with `groups`; enforce one discount strategy and valid eligible quantities. |
| `src/lib/promotion-data.ts` | Modify | Return groups/options plus display-ready product summaries for POS and pricing. |
| `src/lib/pricing.ts` | Modify | Add group-aware combo matcher, bundle capacity calculation, and proportional discount allocation. |
| `src/app/(dashboard)/promotions/page.tsx` | Modify | Swap flat combo editor for grouped editor; move “Quitar” into per-group header/actions. |
| `src/contexts/cart-context.tsx` | Modify | Add `addItems()` batch helper so promo confirmation can insert many concrete products atomically. |
| `src/app/(dashboard)/pos/page.tsx` | Modify | Add Products/Promos switch, promo cards, choice modal, and promo-to-cart mapping. |
| `src/app/actions/sales.ts` | Modify | Keep server-side repricing compatible with new promotion shape. |
| `src/app/api/sales/route.ts` | Modify | Mirror server-action repricing with the new shape. |

## Interfaces / Contracts

```ts
type PromotionGroupInput = {
  name: string
  type: "MANDATORY" | "ELIGIBLE"
  requiredQuantity: number
  sortOrder: number
  options: Array<{ productId: string; quantity: number; sortOrder: number }>
}

type ComboPromotionInput = {
  type: "COMBO"
  name: string
  description?: string
  comboPrice?: number
  discountPercent?: number
  discountAmount?: number
  groups: PromotionGroupInput[]
}
```

`requiredQuantity` means “how many options must be chosen” for `ELIGIBLE`, and MUST be `1` for `MANDATORY` in this change. `Promotion.products` is rebuilt from the distinct option product ids.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Group matcher, bundle count, discount distribution, tie cases | Table-driven tests in `pricing` with mandatory-only, eligible-only, mixed, insufficient qty, and overlapping-product cases. |
| Integration | Promotion create/update mapping and active promotion payload | Action-level tests/mocks verifying Prisma mutation shape and backfilled reads. |
| E2E | POS promo selection flow | Manual verification: promo tab, modal open/close, concrete items added, checkout totals match repricing. |

## Migration / Rollout

Prisma migration required. Create new tables, migrate every existing combo into one ordered `MANDATORY` group, rebuild `Promotion.products`, then drop `PromotionComboItem`. No feature flag required because old and new sales paths both consume server repricing.

## Open Questions

- [ ] If two eligible combinations yield the same discount, should pricing prefer cheaper or first-defined options for deterministic UX?
- [ ] Do we want `requiredQuantity > 1` for `MANDATORY` later, or keep that reserved for eligible groups only?
