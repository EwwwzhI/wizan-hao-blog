import type { Site, Ui, Features } from './types'

export const SITE: Site = {
  website: 'https://wutongyu.site/',
  base: '/',
  title: 'EwwwzhI',
  description: 'EwwwzhI 的个人档案站，记录博客、项目和技术笔记。',
  author: 'EwwwzhI',
  lang: 'zh-CN',
  ogLocale: 'zh_CN',
  imageDomains: [],
}

export const UI: Ui = {
  internalNavs: [
    {
      path: '/',
      title: 'Home',
      displayMode: 'alwaysText',
      text: 'Home',
    },
    {
      path: '/blogs',
      title: 'Blog',
      displayMode: 'alwaysText',
      text: 'Blogs',
    },
    {
      path: '/projects',
      title: 'Projects',
      displayMode: 'alwaysText',
      text: 'Projects',
    },
  ],
  socialLinks: [
    {
      link: 'https://github.com/wutongyuonce',
      title: 'GitHub',
      displayMode: 'alwaysIcon',
      icon: 'i-uil-github-alt',
    },
  ],
  navBarLayout: {
    left: [],
    right: [
      'internalNavs',
      'hr',
      'socialLinks',
      'hr',
      'searchButton',
      'themeButton',
    ],
    mergeOnMobile: true,
  },
  postView: {
    postMetaStyle: 'minimal',
    useCoverAltAsCaption: true,
  },
  groupView: {
    maxGroupColumns: 3,
    showGroupItemColorOnHover: true,
  },
  externalLink: {
    newTab: false,
    cursorType: '',
    showNewTabIcon: false,
  },
}

/**
 * Globally controls whether to enable special features:
 *  - Set to `false` or `[false, {...}]` to disable the feature.
 *  - Set to `[true, {...}]` to enable and configure the feature.
 */
export const FEATURES: Features = {
  slideEnterAnim: [true, { enterStep: 60 }],
  ogImage: [
    true,
    {
      authorOrBrand: `${SITE.title}`,
      fallbackTitle: `${SITE.description}`,
      fallbackBgType: 'plum',
    },
  ],
  toc: [
    true,
    {
      minHeadingLevel: 2,
      maxHeadingLevel: 4,
      displayPosition: 'right',
      displayMode: 'content',
    },
  ],
  search: [
    true,
    {
      includes: ['blogs'],
      filter: false,
      navHighlight: true,
      batchLoadSize: [true, 5],
      maxItemsPerPage: [true, 3],
    },
  ],
}
