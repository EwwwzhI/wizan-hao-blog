---
title: Vercel快速部署网站+国内访问
description: Quickly Deploy Websites with Vercel + Optimize for Access Within China
pubDate: 2026-05-07
lastModDate: ''
ogImage: false
toc: true
search: true
---

利用 Vercel，Cloudflare 平台进行代理，实现 cdn 加速国内代理，使得网站在国内能够访问

## 使用静态站点生成器Astro构建一个部署在vercel的博客

[Vercel](https://github.com/vercel)是一家总部在美国的公司，前身叫 Zeit。

它提供了一个云端平台，让开发者可以一键部署前端项目，尤其是静态站点和 Serverless 应用。

其中[Serverless](https://aws.amazon.com/cn/campaigns/serverless/)是一个国外很流行的技术，属于**云服务**，这里就不展开。

Vercel还和 [GitHub](https://github.com/)/[GitLab](https://about.gitlab.com/) 深度集成，提供了优质的**CI/CD**服务，每次`git push`的时候，都会自动重新构建、部署项目。

SSG之前介绍了，我之前有使用过[Hexo](https://hexo.io/)、[Hugo](https://gohugo.io/)，但现在切换到了[Astro](https://astro.build/)。

跟着官网的教程创建一个站点并部署在github上，然后你需要在vercel中，`add new project`打开这个项目。`import Github repository`将你的github项目导入，进入配置界面。在这里配置`框架预设`，如果你是astro就用其预设。

> deploy完成后，vercel会给你一个类似 `[项目名].vercel.app` 的域名，通过这个域名你就可以访问你的项目了（前提是开了vpn），在中国大陆一般是访问不了的。 这个时候就需要另外一个东西：Cloudflare。

## 部署到国内（阿里云购买+Cloudflare转发）

阿里云购买个性化域名 wutongyu.site

点击Vercel左侧栏的Domains，选择右上侧的Add Existing，输入购买的个性化域名

![PixPin_2026-05-07_13-43-13](/deploy-img/PixPin_2026-05-07_13-43-13.png)

打开 Cloudflare，进入 Domains-Overview-Add domain

![PixPin_2026-05-07_13-49-42](/deploy-img/PixPin_2026-05-07_13-49-42.png)

回到之前添加的两条域名，进行 Auto configure，分别各自增加 TXT 和 CNAME 两条 records

![PixPin_2026-05-07_13-59-47](/deploy-img/PixPin_2026-05-07_13-59-47.png)

![PixPin_2026-05-07_14-00-13](/deploy-img/PixPin_2026-05-07_14-00-13.png)

在 Cloudflare 点击添加的 domain，进入 DNS-Records，可以看到四条

![PixPin_2026-05-07_14-03-26](/deploy-img/PixPin_2026-05-07_14-03-26.png)

可以看到下方有 Cloudflare Nameservers，复制这两条 NS

![PixPin_2026-05-07_13-51-25](/deploy-img/PixPin_2026-05-07_13-51-25.png)

进入阿里云，打开域名控制台修改DNS服务器地址

1. 前往[域名产品控制台](https://dc.console.aliyun.com/?spm=5176.28197678_55416700.console-base_help.18.63045b8eO61o25)，在域名列表中找到目标域名，单击操作列的 **管理** 按钮![image.png](/deploy-img-img/p751347.png)
2. 在左侧导航栏选择 **DNS管理** 下的 **DNS修改** 菜单，单击 **修改DNS服务器** 按钮![image.png](/deploy-img-img/p751353.png)
3. 输入 **云解析 DNS** 分配的DNS服务器地址，例如：`vip1.alidns.com`、`vip2.alidns.com`，提交变更。![image](/deploy-img/p852184.png)

完成之后回到 Cloudflare 的域名Overview，可以 Check nameservers now，阿里云那边生效之后，这个页面会刷新：

![PixPin_2026-05-07_14-10-06](/deploy-img/PixPin_2026-05-07_14-10-06.png)

