import { glob, file } from 'astro/loaders'
import { defineCollection } from 'astro:content'

import { postSchema, projectSchema } from '~/content/schema'

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

export const collections = {
  home,
  blogs,
  projects,
}
