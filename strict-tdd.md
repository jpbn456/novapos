# Strict TDD — novapos

**Status**: Active
**Enabled**: 2026-06-11
**Test runner**: Vitest v3
**Command**: `npm test` / `vitest run`

## Rules

1. **Write tests before implementation.** Every new feature or bug fix starts with a failing test.
2. **Run the full suite before committing.** `npm test` must pass.
3. **Coverage gate**: aim for >80% coverage on new code. Run `npx vitest run --coverage` to verify.
4. **Test layers**:
   - Unit tests for pure logic, utilities, and helpers.
   - Integration tests for server actions, API routes, and component interactions.
   - E2E tests (future): Playwright for critical user flows.
5. **File conventions**:
   - Test files: `src/**/*.test.{ts,tsx}`
   - Co-locate with source where possible (e.g., `src/lib/pricing.test.ts` alongside `src/lib/pricing.ts`).
   - Use Vitest's `describe`/`it`/`expect` with Testing Library for component tests.

## Verification

- Run `npm test` before each commit.
- Run `npx vitest run --coverage` periodically to track coverage.
- TypeScript strict mode (`npx tsc --noEmit`) is also required before committing.
