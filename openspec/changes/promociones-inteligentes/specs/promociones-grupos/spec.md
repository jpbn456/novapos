# promociones-grupos Specification

## Purpose

Definir promociones combo mediante grupos obligatorios y elegibles, manteniendo un único descuento por promoción y una edición clara en backoffice.

## Requirements

### Requirement: Group-based combo definition

The system MUST allow a combo promotion to contain one or more groups, where each group is either mandatory or eligible, and the promotion MUST use exactly one discount strategy.

#### Scenario: Create promo with mixed groups

- GIVEN an operator creates a combo promotion
- WHEN they add one mandatory group and one eligible group with valid quantities
- THEN the promotion is saved with both groups under the same promotion
- AND only one discount mode is stored for that promotion

#### Scenario: Reject invalid eligible group rules

- GIVEN an operator configures an eligible group
- WHEN the requested selection exceeds the available options or is less than one
- THEN the system MUST reject the configuration

### Requirement: Legacy combo continuity

The system MUST preserve existing flat combos by representing them as a single mandatory group with equivalent products, quantities, and discount outcome.

#### Scenario: Migrate existing combo

- GIVEN a combo promotion created before group support exists
- WHEN the migration or read model is applied
- THEN the promotion is available as one mandatory group
- AND selling it keeps the same concrete product outcome as before

### Requirement: Remove actions in promotion editor

The system SHOULD place each "Quitar" action next to the group or item it removes, so operators can identify the target without scanning unrelated controls.

#### Scenario: Remove target is explicit

- GIVEN an operator edits a promotion with multiple groups or items
- WHEN they view the remove action
- THEN the action is shown adjacent to the element being removed
