## Archive Report

**Change**: promociones-inteligentes  
**Date**: 2026-06-06  
**Mode**: hybrid  
**Status**: BLOCKED

---

## Summary

No archivé el cambio ni sincronicé specs al source of truth principal.

La razón es simple: el `verify-report.md` actual marca **CRITICAL** issues y el skill de archive exige **NEVER archive a change that has CRITICAL issues in its verification report**.

---

## Traceability

### Filesystem artifacts read
- `openspec/changes/promociones-inteligentes/proposal.md`
- `openspec/changes/promociones-inteligentes/specs/promociones-grupos/spec.md`
- `openspec/changes/promociones-inteligentes/specs/pos-promos-vista/spec.md`
- `openspec/changes/promociones-inteligentes/design.md`
- `openspec/changes/promociones-inteligentes/tasks.md`
- `openspec/changes/promociones-inteligentes/verify-report.md`

### Engram observations
- Proposal: `#277` → `sdd/promociones-inteligentes/proposal`
- Spec: `#279` → `sdd/promociones-inteligentes/spec`
- Design: `#282` → `sdd/promociones-inteligentes/design`
- Verify report: `#298` → `sdd/promociones-inteligentes/verify-report`
- Tasks: **not found in Engram**

---

## Verification blocker

### CRITICAL issues from verify
1. No hay runner/configuración ejecutable para correr los tests; por eso 0/9 escenarios tienen evidencia de ejecución.
2. La tarea manual `4.3` sigue incompleta, así que los flujos UI del Backoffice/POS no tienen evidencia validada.

### Important note

Los issues CRITICAL reportados son principalmente **gaps de infraestructura/verificación** (runner de tests ausente) y **evidencia faltante de validación manual**, no defects de runtime confirmados por el verificador.

Igual, el mismo verify también registra warnings de desvío contra el diseño:
- `PromotionComboItem` sigue presente en `prisma/schema.prisma`
- la migración hace backfill pero no elimina la estructura legacy

---

## Archive decision

### Specs sync
- `openspec/specs/promociones-grupos/spec.md`: **not created**
- `openspec/specs/pos-promos-vista/spec.md`: **not created**

### Folder move
- `openspec/changes/promociones-inteligentes/` → **not moved**

### Reason

Archivar ahora rompería la regla del workflow: movería al audit trail un cambio con verificación fallida y blockers explícitos pendientes.

---

## Required next steps before archive

1. Resolver o aceptar explícitamente el gap de infraestructura de tests.
2. Completar la verificación manual de la tarea `4.3`.
3. Regenerar el `verify-report.md` con un estado que quite los blockers CRITICAL.
4. Reintentar la fase de archive.

---

## Result

**Archive attempt persisted, but archive execution was blocked by verification status.**
