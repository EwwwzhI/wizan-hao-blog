import getReadingTime from 'reading-time'
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
function remarkReadingTime() {
  return (tree: Root, file: VFile) => {
    const astroFile = file as AstroReadingTimeFile
    const { frontmatter } = astroFile.data.astro
    if (frontmatter.minutesRead || frontmatter.minutesRead === 0) return

    const textOnPage = toString(tree)
    const readingTime = getReadingTime(textOnPage)

    frontmatter.minutesRead = Math.max(1, Math.round(readingTime.minutes))
  }
}

export default remarkReadingTime
