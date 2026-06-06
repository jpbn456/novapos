declare module "vitest" {
  export const describe: (name: string, fn: () => void | Promise<void>) => void
  export const beforeEach: (fn: () => void | Promise<void>) => void
  export const expect: any
  export const vi: any

  export const test: {
    (name: string, fn: () => void | Promise<void>): void
    each: <T>(cases: readonly T[]) => (
      name: string,
      fn: (testCase: T) => void | Promise<void>
    ) => void
  }
}
