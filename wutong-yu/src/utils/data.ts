import { getCollection } from 'astro:content'

import type { CollectionEntry } from 'astro:content'

/**
 * Ensures that a value is a positive integer.
 */
function ensurePositiveInteger(value: number, name: string) {
  if (Number.isInteger(value) && value > 0) return value
  throw new Error(
    `'${name}' must be a positive integer. Please check 'src/config.ts' for the correct configuration.`
  )
}

/**
 * Parses a tuple of boolean and number.
 */
export function parseTuple(
  tuple: boolean | [boolean, number] | undefined,
  name: string
) {
  if (!tuple || !Array.isArray(tuple) || !tuple[0]) return undefined
  return ensurePositiveInteger(tuple[1], name)
}

/**
 * Retrieves the minutes read for a post.
 */
export function getMinutesRead(
  minutesRead: number | boolean,
  computedMinutesRead: number
) {
  return minutesRead === false
    ? 0
    : typeof minutesRead === 'number' && minutesRead > 0
      ? minutesRead
      : computedMinutesRead
}

/**
 * Retrieves filtered posts from the specified content collection.
 * In production, it filters out draft posts.
 */
export async function getFilteredPosts(
  collection: 'blog'
) {
  return await getCollection(collection, ({ data }) => {
    return import.meta.env.PROD ? !data.draft : true
  })
}

/**
 * Sorts an array of posts by their publication date in descending order.
 */
export function getSortedPosts(
  posts: CollectionEntry<'blog'>[]
) {
  return posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  )
}
