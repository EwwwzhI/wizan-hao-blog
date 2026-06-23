import { z } from 'astro/zod'  // 导入 Zod 验证库
import type { SchemaContext } from 'astro:content'  // 导入类型定义

/* =====================================================
   文章 Schema - 用于博客文章
   ===================================================== */
export const postSchema = ({ image }: SchemaContext) =>
  z.object({
    // 文章标题（必填，最多60字符）
    title: z
      .string()
      .max(60)  // SEO 最佳实践建议60字符以内
      .describe(
        '**必填**。文章标题，限制 **60 字符**。遵循 Moz 的建议，确保 90% 的标题在搜索结果中正常显示。'
      )
      .transform((value) => value.trim()),  // 自动去除首尾空格

    // 文章副标题
    subtitle: z
      .string()
      .default('')
      .describe('文章副标题。不需要时留空或删除。')
      .transform((value) => value.trim()),

    // SEO 描述
    description: z
      .string()
      .default('')
      .describe('简短描述，用于 SEO 和分享。不需要时使用站点默认描述。')
      .transform((value) => value.trim()),

    // 标签列表
    tags: z
      .array(z.string())  // 字符串数组
      .default([])
      .describe('文章标签。不需要时留空数组或删除。'),

    // 封面图片
    // 接收一个 SchemaContext 类型的参数
    // 从中解构出 image 函数
    // 用 image() 创建一个验证器，用于验证本地图片路径
    // 允许 cover 字段接受本地图片路径或远程 URL
    cover: z
      .union([image(), z.url()])
      .default('')
      .describe('封面图片。可以是 URL 或当前目录的相对路径。不需要时留空。'),

    // 封面图片的 alt 文本（无障碍访问）
    coverAlt: z
      .string()
      .default('')
      .describe('封面图片的 alt 文本。不需要时留空。'),

    // 发布日期（必填）
    pubDate: z.coerce
      .date()  // z.coerce 会自动转换各种日期格式
      .describe('**必填**。发布日期。'),

    // 最后修改日期（可选）
    lastModDate: z
      .union([z.coerce.date(), z.literal('')])  // 可以是日期或空字符串
      .optional()
      .describe('最后修改日期。不需要时留空。'),

    // 预计阅读时间
    minutesRead: z
      .union([z.number(), z.boolean()])
      .default(true)
      .describe(
        '预计阅读时间（分钟）。\n' +
        '- true：自动计算\n' +
        '- false/0：隐藏不显示'
      ),

    // 是否包含音频内容
    radio: z
      .boolean()
      .default(false)
      .describe('是否包含音频内容。如果为 true，文章列表项会显示音频图标。'),

    // 是否包含视频内容
    video: z
      .boolean()
      .default(false)
      .describe('是否包含视频内容。如果为 true，文章列表项会显示视频图标。'),

    // 音视频发布平台
    platform: z
      .string()
      .default('')
      .describe('音视频内容的发布平台名称（如 YouTube、Spotify）。不需要时留空。'),

    // OG 图片
    ogImage: z
      .union([z.string(), z.boolean()])
      .default(true)
      .describe('社交分享图片。true=自动生成，false=禁用，字符串=使用自定义图片。'),

    // 是否生成目录（Table of Contents）
    toc: z
      .boolean()
      .default(true)
      .describe('是否为文章生成目录。'),

    // 是否支持搜索
    search: z
      .boolean()
      .default(true)
      .describe('文章是否可被搜索。false 时会从搜索结果中排除。'),

    // 重定向 URL
    redirect: z
      .union([z.url('无效的 URL 格式。'), z.literal('')])
      .default('')
      .describe('设置重定向目标 URL。不需要时留空。'),

    // 草稿状态
    draft: z
      .boolean()
      .default(false)
      .describe(
        '标记为草稿。true 时仅在开发环境可见，生产构建时会被排除。'
      ),
  })

/* =====================================================
   项目 Schema - 用于作品集/项目展示
   ===================================================== */
export const projectSchema = z.object({
  // 项目 ID/名称（必填）
  id: z
    .string()
    .describe('**必填**。要显示的项目名称。'),

  // 项目链接（必填）
  link: z
    .url('无效的 URL 格式。')  // 必须是有效的 URL
    .describe('**必填**。项目页面或仓库的链接。'),

  // 项目描述（必填）
  desc: z
    .string()
    .describe('**必填**。项目简短描述。'),

  // 图标
  icon: z
    .string()
    .regex(
      /^i-[\w-]+(:[\w-]+)?$/,
      '图标格式必须为 `i-<collection>-<icon>` 或 `i-<collection>:<icon>`，遵循 UnoCSS 规范。'
    )
    .describe(
      '**必填**。项目图标，遵循 UnoCSS 图标规范。' +
      '格式示例：i-logos-vue、i-ri:twitter-fill\n' +
      '可用的图标：https://icones.js.org/'
    ),

  // 项目分类（必填）
  category: z
    .string()
    .describe('**必填**。项目的分类。'),
})
