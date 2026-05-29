import { glob, file } from 'astro/loaders'
import { defineCollection } from 'astro:content'

import {
  friendSchema,
  insightSchema,
  pageSchema,
  postSchema,
  projectSchema,
} from '~/content/schema'

const pages = defineCollection({
  loader: glob({ base: './src/pages', pattern: '**/*.mdx' }),
  schema: pageSchema,
})

const home = defineCollection({
  loader: glob({ base: './src/content/home', pattern: 'index.{md,mdx}' }),
})

const blogs = defineCollection({
  loader: glob({ base: './src/content/blogs', pattern: '**/*.{md,mdx}' }),
  schema: postSchema,
})

const projects = defineCollection({
  loader: file('./src/content/projects/data.json'),
  schema: projectSchema,
})

const friends = defineCollection({
  loader: file('./src/content/friends/data.json'),
  schema: friendSchema,
})

const insights = defineCollection({
  loader: glob({ base: './src/content/insights', pattern: '**/*.{md,mdx}' }),
  schema: insightSchema,
})

export const collections = {
  pages,
  home,
  blogs,
  projects,
  friends,
  insights,
}
