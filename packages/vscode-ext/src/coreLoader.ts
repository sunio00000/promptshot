// Workaround: dynamic import of ESM from CJS. TS would compile `import()` to `require()`
// when module: commonjs, which breaks for ESM packages. eval-based call preserves the
// runtime dynamic import.
import type * as Core from '@promptshot/core'

let cached: typeof Core | undefined
export async function loadCore(): Promise<typeof Core> {
  if (cached) return cached
  cached = await (new Function('m', 'return import(m)') as (m: string) => Promise<typeof Core>)('@promptshot/core')
  return cached
}
