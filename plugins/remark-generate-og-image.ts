import { join, basename, dirname } from 'node:path'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'

import { decode } from 'html-entities'
import satori from 'satori'
import sharp from 'sharp'

import { getCurrentFormattedTime } from '../src/utils/datetime'
import { ogImageMarkup } from './og-template/markup'
import { FEATURES } from '../src/config'

import type { Root } from 'mdast'
import type { SatoriOptions } from 'satori'
import type { html } from 'satori-html'
import type { VFile } from 'vfile'
import type { BgType } from '../src/types'

interface OgImageFrontmatter {
  draft?: boolean
  redirect?: string
  title?: string
  ogImage?: string | boolean
  bgType?: BgType | false
}

type AstroOgImageFile = VFile & {
  data: VFile['data'] & {
    astro: {
      frontmatter: OgImageFrontmatter
    }
  }
}

const Inter = readFileSync('plugins/og-template/Inter-Regular-24pt.ttf')

const satoriOptions: SatoriOptions = {
  // debug: true,
  width: 1200,
  height: 630,
  fonts: [
    {
      name: 'Inter',
      weight: 400,
      style: 'normal',
      data: Inter,
    },
  ],
}

function logWithTime(level: 'info' | 'warn' | 'error', message: string) {
  const timestamp = getCurrentFormattedTime()
  const prefix = level === 'info' ? '' : `[${level.toUpperCase()}] `
  const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log

  logger(`${timestamp} ${prefix}${message}`)
}

/**
 * Checks if a file exists in a specified directory.
 * This path is relative to the current working directory.
 * (`public/og-images` is equivalent to `./public/og-images` and relative to the cwd)
 */
export function checkFileExistsInDir(path: string, filename: string) {
  const fullPath = join(process.cwd(), path, filename)

  return existsSync(fullPath)
}

/**
 * Recursively unescapes HTML entities in a given virtual DOM node's children.
 *
 * Fix accidental HTML entity escaping in 'satori-html'.
 * @see https://github.com/natemoo-re/satori-html/issues/20#issuecomment-1999332693
 */
function unescapeHTML(node: ReturnType<typeof html>) {
  const children = node?.props?.children
  if (!children) {
    return
  } else if (Array.isArray(children)) {
    for (const n of children) {
      unescapeHTML(n)
    }
  } else if (typeof children === 'object') {
    unescapeHTML(children)
  } else if (typeof children === 'string') {
    node.props.children = decode(children)
  }
}

/**
 * Generates an Open Graph image and writes it to the specified output file.
 */
async function generateOgImage(
  authorOrBrand: string,
  title: string,
  bgType: BgType,
  output: string
) {
  await mkdir(dirname(output), { recursive: true })

  logWithTime('info', `Generating ${output}...`)

  try {
    const node = ogImageMarkup(authorOrBrand, title, bgType)
    unescapeHTML(node)

    const svg = await satori(node, satoriOptions)

    const compressedPngBuffer = await sharp(Buffer.from(svg))
      .png({
        compressionLevel: 9,
        quality: 100,
      })
      .toBuffer()

    writeFileSync(output, compressedPngBuffer)
  } catch (e) {
    logWithTime('error', `Failed to generate og image for '${basename(output)}'.`)
    console.error(e)
  }
}

/**
 * Used to generate {@link https://ogp.me/ Open Graph} images.
 *
 * @see https://github.com/vfile/vfile
 */
function remarkGenerateOgImage() {
  // get config
  const ogImage = FEATURES.ogImage
  if (!(Array.isArray(ogImage) && ogImage[0])) return

  const { authorOrBrand, fallbackTitle, fallbackBgType } = ogImage[1]

  return async (_tree: Root, file: VFile) => {
    const astroFile = file as AstroOgImageFile

    // regenerate fallback
    if (!checkFileExistsInDir('public/og-images', 'og-image.png')) {
      await generateOgImage(
        authorOrBrand,
        fallbackTitle,
        fallbackBgType,
        'public/og-images/og-image.png'
      )
    }

    // check filename
    const filename = astroFile.basename
    if (!filename || !(filename.endsWith('.md') || filename.endsWith('.mdx')))
      return

    // check draft & redirect
    const draft = astroFile.data.astro.frontmatter.draft
    const redirect = astroFile.data.astro.frontmatter.redirect
    if (draft || redirect) return

    // check if it need to be skipped
    const title = astroFile.data.astro.frontmatter.title
    if (!title || !title.trim().length) return
    const ogImage = astroFile.data.astro.frontmatter.ogImage
    if (ogImage === false) return
    const customOgImage =
      typeof ogImage === 'string' && ogImage.trim().length > 0 ? ogImage : undefined

    // check if it has been generated
    const extname = astroFile.extname
    const dirpath = astroFile.dirname
    let nameWithoutExt = basename(filename, extname)
    if (nameWithoutExt === 'index') {
      const dirBaseName = dirpath ? basename(dirpath) : ''
      nameWithoutExt =
        dirBaseName && dirBaseName !== 'pages' ? dirBaseName : 'index'
    }
    if (checkFileExistsInDir('public/og-images', `${nameWithoutExt}.png`))
      return

    // check if it has been assigned & actually exists
    if (
      customOgImage &&
      checkFileExistsInDir('public/og-images', basename(customOgImage))
    )
      return

    if (
      customOgImage &&
      !checkFileExistsInDir('public/og-images', basename(customOgImage))
    ) {
      logWithTime(
        'warn',
        `The '${customOgImage}' specified in '${astroFile.path}' was not found.\n  Hint: Put the file under public/og-images/ or set ogImage: true to auto-generate it.`
      )
      return
    }

    // get bgType
    const pageBgType = astroFile.data.astro.frontmatter.bgType
    const bgType = pageBgType || fallbackBgType

    // generate og images
    await generateOgImage(
      authorOrBrand,
      title.trim(),
      bgType,
      `public/og-images/${nameWithoutExt}.png`
    )
  }
}

export default remarkGenerateOgImage
