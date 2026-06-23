import { getCollection, render } from 'astro:content'

import { getYear } from '~/utils/datetime'

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
  collection: 'blogs'
) {
  return await getCollection(collection, ({ data }) => {
    return import.meta.env.PROD ? !data.draft : true
  })
}

/**
 * Sorts an array of posts by their publication date in descending order.
 */
export function getSortedPosts(
  posts: CollectionEntry<'blogs'>[]
) {
  return [...posts].sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  )
}

export interface GroupedBlogItem {
  idx: number
  year: string
  id: CollectionEntry<'blogs'>['id']
  data: CollectionEntry<'blogs'>['data']
  minutesRead: number
}

export interface GroupedBlogYear {
  year: string
  items: GroupedBlogItem[]
}

/**
 * Retrieves all blog posts and groups them by publication year in descending order.
 */
export async function getGroupedPostsByYear(
  collection: 'blogs'
): Promise<GroupedBlogYear[]> {
  const items = await getFilteredPosts(collection)
  const sortedPosts = getSortedPosts(items)

  const enrichedPosts = await Promise.all(
    sortedPosts.map(async (item, idx) => {
      const { data, id } = item
      const { remarkPluginFrontmatter } = await render(item)

      return {
        idx,
        year: getYear(data.pubDate).toString(),
        id,
        data,
        minutesRead: getMinutesRead(
          data.minutesRead,
          remarkPluginFrontmatter.minutesRead
        ),
      }
    })
  )

  return enrichedPosts.reduce<GroupedBlogYear[]>((groups, item) => {
    const existingGroup = groups.find((group) => group.year === item.year)

    if (existingGroup) {
      existingGroup.items.push(item)
      return groups
    }

    groups.push({
      year: item.year,
      items: [item],
    })

    return groups
  }, [])
}
