import { defineConfig } from 'astro/config'  // 导入 Astro 配置定义函数
import { unified } from '@astrojs/markdown-remark' // Astro v6 Markdown 处理器
import sitemap from '@astrojs/sitemap'       // 自动生成 sitemap.xml（网站地图，告诉搜索引擎网站结构）
import unocss from 'unocss/astro'            // UnoCSS 原子化 CSS 引擎（按需生成 CSS 工具类）
import astroExpressiveCode from 'astro-expressive-code'  // 代码块美化插件（语法高亮、主题等）
import mdx from '@astrojs/mdx'               // MDX 支持（在 Markdown 中使用 JSX 组件）

import { remarkPlugins, rehypePlugins } from './plugins'  // 自定义 Markdown 处理插件
import { SITE } from './src/config'          // 导入站点配置（从 config.ts 导入）

/**
 * Astro 配置对象
 *
 * defineConfig 是一个辅助函数，提供 TypeScript 类型推断和智能提示
 * 它返回一个配置对象，Astro 会在构建时读取这个配置
 */
export default defineConfig({
  // ==================== 站点基础配置 ====================
  site: SITE.website,    // 最终部署的完整 URL（用于生成规范链接、sitemap 等）
  base: SITE.base,        // 站点基础路径（如果部署在子目录，如 /my-site/）

  // ==================== 构建配置 ====================
  build: {
    inlineStylesheets: 'never',  // 从不内联样式，始终使用外部 CSS 文件
    // 'never': 所有样式都生成独立 CSS 文件
    // 'auto': 小样式内联，大样式外链
    // 'always': 所有样式都内联
  },

  // ==================== 集成插件 ====================
  // integrations 数组中的插件会在构建时按顺序执行
  integrations: [
    sitemap(),          // 生成 sitemap.xml，帮助 SEO
    unocss({
      injectReset: true  // 注入 CSS 重置样式（normalize.css）
    }),
    astroExpressiveCode(),  // 代码块美化（支持主题、行号、标题等）
    mdx(),              // 启用 MDX 支持
  ],

  // ==================== Markdown 配置 ====================
  markdown: {
    syntaxHighlight: false,     // 禁用 Astro 内置语法高亮（交给 expressive-code 处理）
    processor: unified({
      remarkPlugins,            // Remark 插件（处理 Markdown 语法树，如添加目录）
      rehypePlugins,            // Rehype 插件（处理 HTML 树，如优化图片）
    }),
  },

  // ==================== 图片优化配置 ====================
  image: {
    // 允许优化的远程图片域名列表（本地图片不需要配置）
    domains: SITE.imageDomains,  // 例如 ['images.unsplash.com']

    // 图片布局方式
    // 'constrained': 保持宽高比，限制在容器内，可能低于原始尺寸
    // 'fixed': 固定尺寸，不响应式
    // 'full-width': 全宽响应式
    layout: 'constrained',

    // 是否自动生成响应式样式（srcset）
    // 为图片生成不同尺寸版本，适应不同屏幕
    responsiveStyles: true,
  },

  // ==================== Vite 配置（底层构建工具） ====================
  vite: {
    build: {
      chunkSizeWarningLimit: 1200  // 代码块大小警告阈值（KB），超过提示优化
      // 默认 500KB，这里提升到 1200KB 避免不必要的警告
    },
  },

  // ==================== 预渲染配置 ====================
  // Astro v6 中 experimental.failOnPrerenderConflict 已转为正式配置
  prerenderConflictBehavior: 'error',

  // ==================== 实验性功能 ====================
  // 仅保留 Astro v6 仍支持的实验性功能
  experimental: {
    contentIntellisense: true,    // 内容集合智能提示（在 Markdown 中自动补全）
    chromeDevtoolsWorkspace: true, // Chrome DevTools 工作区支持（可在浏览器中编辑并保存）
  },
})
