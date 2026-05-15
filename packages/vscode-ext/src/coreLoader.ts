// esbuild 번들 환경: @promptshot/core가 번들에 인라인됨 (dynamic import가 번들 시간에 해석됨)
// tsc CJS 컴파일 환경(테스트용): dynamic import로 ESM 패키지를 올바르게 로드
import type * as Core from '@promptshot/core'

let cached: typeof Core | undefined
export async function loadCore(): Promise<typeof Core> {
  if (cached) return cached
  // import()는 esbuild가 번들 시 인라인으로 포함시킴.
  // tsc CJS 환경에서는 런타임 dynamic import로 ESM 패키지 로드.
  cached = await import('@promptshot/core')
  return cached
}
