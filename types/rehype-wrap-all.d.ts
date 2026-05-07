declare module 'rehype-wrap-all' {
  import type { Root } from 'hast'
  import type { Plugin } from 'unified'

  export interface RehypeWrapAllOptions {
    selector: string
    wrapper: string
  }

  const rehypeWrapAll: Plugin<[RehypeWrapAllOptions], Root>

  export default rehypeWrapAll
}
