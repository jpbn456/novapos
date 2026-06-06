# pos-promos-vista Specification

## Purpose

Permitir que el POS navegue promociones activas como una vista propia y resuelva elecciones antes de agregar productos concretos al carrito.

## Requirements

### Requirement: Dedicated promotions view in POS

The system MUST provide separate Productos and Promociones views in the POS cart workflow, and the Promociones view MUST list active promotions that can be added from the current terminal session.

#### Scenario: Browse active promotions

- GIVEN the POS has active promotions available
- WHEN the cashier switches to the Promociones view
- THEN the system shows the active promotions independently from the product catalog

#### Scenario: No active promotions

- GIVEN there are no active promotions
- WHEN the cashier opens the Promociones view
- THEN the system MUST show an empty state instead of stale or unavailable promotions

### Requirement: Promo resolution before cart insertion

The system MUST add only concrete product lines to the cart; promotions without eligible choices MAY add directly, and promotions with eligible choices MUST require a selection modal before insertion.

#### Scenario: Add promo without choices

- GIVEN the cashier selects a promotion with only mandatory groups
- WHEN they confirm the promotion from the Promociones view
- THEN the cart receives the resolved product lines directly

#### Scenario: Complete eligible selection in modal

- GIVEN the cashier selects a promotion with eligible groups
- WHEN they complete the required choices in the modal
- THEN the cart receives only the chosen concrete product lines

#### Scenario: Block incomplete eligible selection

- GIVEN the cashier opens a promotion modal with required choices pending
- WHEN they try to confirm without satisfying the selection rules
- THEN the system MUST block the insertion into the cart
