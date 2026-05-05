import { glob, file } from 'astro/loaders'
import { defineCollection } from 'astro:content'

import { pageSchema, postSchema, projectSchema } from '~/content/schema'

const pages = defineCollection({
  loader: glob({ base: './src/pages', pattern: '**/*.mdx' }),
  schema: pageSchema,
})

const home = defineCollection({
  loader: glob({ base: './src/content/home', pattern: 'index.{md,mdx}' }),
})

const blogs = defineCollection({
  loader: glob({ base: './src/content/blogs', pattern: '**/[^_]*.{md,mdx}' }),
  schema: postSchema,
})

const projects = defineCollection({
  loader: file('./src/content/projects/data.json'),
  schema: projectSchema,
})

export const collections = {
  pages,
  home,
  blogs,
  projects,
}
