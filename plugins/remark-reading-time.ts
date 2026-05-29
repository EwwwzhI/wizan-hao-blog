import { toString } from 'mdast-util-to-string'

import type { Root } from 'mdast'
import type { VFile } from 'vfile'

interface ReadingTimeFrontmatter {
  minutesRead?: number | boolean
}

type AstroReadingTimeFile = VFile & {
  data: VFile['data'] & {
    astro: {
      frontmatter: ReadingTimeFrontmatter
    }
  }
}

/**
 * Used to add a reading time property to the frontmatter of your Markdown or MDX files.
 *
 * @see https://docs.astro.build/en/recipes/reading-time/
 */
const CJK_CHAR_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu
const WORD_RE = /[\p{L}\p{N}_'-]+/gu
const WORDS_PER_MINUTE = 200

function estimateReadingMinutes(text: string) {
  const cjkChars = text.match(CJK_CHAR_RE)?.length ?? 0
  const nonCjkText = text.replace(CJK_CHAR_RE, ' ')
  const words = nonCjkText.match(WORD_RE)?.length ?? 0
  const totalUnits = cjkChars + words

  return Math.max(1, Math.round(totalUnits / WORDS_PER_MINUTE))
}

function remarkReadingTime() {
  return (tree: Root, file: VFile) => {
    const astroFile = file as AstroReadingTimeFile
    const { frontmatter } = astroFile.data.astro
    if (frontmatter.minutesRead || frontmatter.minutesRead === 0) return

    const textOnPage = toString(tree)
    frontmatter.minutesRead = estimateReadingMinutes(textOnPage)
  }
}

export default remarkReadingTime
