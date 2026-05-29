import type { Root, RootContent, ElementContent } from 'hast'

interface RehypeWrapAllOptions {
  selector: string
  wrapper: string
}

function hasChildren(
  node: Root | RootContent | ElementContent
): node is Root | Extract<RootContent, { children: unknown[] }> {
  return 'children' in node && Array.isArray(node.children)
}

function wrapMatchingChildren(
  node: Root | RootContent | ElementContent,
  selector: string,
  wrapper: string
) {
  if (!hasChildren(node)) return

  for (let index = 0; index < node.children.length; index++) {
    const child = node.children[index]

    if (child.type === 'element' && child.tagName === selector) {
      node.children[index] = {
        type: 'element',
        tagName: wrapper,
        properties: {},
        children: [child],
      }
      continue
    }

    wrapMatchingChildren(child, selector, wrapper)
  }
}

function rehypeWrapAll({ selector, wrapper }: RehypeWrapAllOptions) {
  return (tree: Root) => {
    wrapMatchingChildren(tree, selector, wrapper)
  }
}

export default rehypeWrapAll
