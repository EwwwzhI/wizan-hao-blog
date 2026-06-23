# LogoButton 使用说明

这份文档给后续维护者使用，说明如何在顶部导航左上角配置、替换和调整 `LogoButton` 的 logo。

## 相关文件

当前 logo 由下面两个文件控制：

```text
public/ewwwzhi.svg
src/components/widgets/LogoButton.astro
```

- `public/ewwwzhi.svg`：实际展示的 logo 资源
- `LogoButton.astro`：导航栏左上角 logo 组件，负责展示 logo 并链接到首页

## 当前用法

`LogoButton.astro` 中通过 `withBasePath()` 引用 `public/` 下的 SVG：

```astro
<img
  class="logo-icon"
  src={withBasePath('/ewwwzhi.svg')}
  alt=""
  aria-hidden="true"
/>
```

`public/` 目录里的文件会以站点根路径暴露，所以 `public/ewwwzhi.svg` 在代码里写成：

```astro
withBasePath('/ewwwzhi.svg')
```

不要写成：

```astro
withBasePath('/public/ewwwzhi.svg')
```

## 替换 logo

如果要换成新的 logo：

1. 把新的 SVG 文件放到 `public/` 目录
2. 打开 `src/components/widgets/LogoButton.astro`
3. 修改 `<img>` 的 `src`
4. 根据新 logo 的比例调整 `.logo-container` 的宽高

例如把 logo 换成 `public/new-logo.svg`：

```astro
<img
  class="logo-icon"
  src={withBasePath('/new-logo.svg')}
  alt=""
  aria-hidden="true"
/>
```

## 尺寸调整

当前 logo 是横向标识，因此尺寸主要由外层容器控制：

```css
.logo-container {
  width: 9.25rem;
  height: 3.0rem;
}
```

移动端尺寸单独配置：

```css
@media (max-width: 767.9px) {
  .logo-container {
    width: 7.25rem;
    height: 2.1rem;
  }
}
```

调整建议：

- logo 太小：增大 `.logo-container` 的 `width` 和 `height`
- logo 太宽：只减小 `width`，不要改 SVG 文件
- logo 太高：减小 `height`
- 手机端挤占导航空间：只调整 media query 里的尺寸

## 保证完整显示

当前组件通过下面的样式保证 logo 不被裁切：

```css
.logo-icon {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  object-position: left center;
}
```

关键点：

- `object-fit: contain`：按原始比例完整显示 logo
- `object-position: left center`：让 logo 靠左并垂直居中
- 不使用 `object-fit: cover`，否则横向 logo 可能被裁切
- 不使用圆角裁切，导航 logo 不应该被强制裁成圆形

如果新 logo 是横向文字标识，建议继续保留 `object-fit: contain`。

## 暗黑模式

当前暗黑模式通过 CSS 反色适配：

```css
:global(html.dark) .logo-icon {
  filter: invert(1);
}
```

适用情况：

- 原 logo 是深色，暗黑模式下需要变浅
- SVG 本身颜色比较简单
- 不想维护两套 logo 资源

如果新 logo 已经自带暗黑模式适配，或者反色后效果不好，可以删除这段样式：

```css
:global(html.dark) .logo-icon {
  filter: invert(1);
}
```

如果需要深浅色两套 logo，也可以改成渲染两个 `<img>`，再用 `html.dark` 控制显示隐藏。但当前项目默认推荐单 SVG 加 CSS 适配。

## 无障碍说明

当前 `<img>` 使用：

```astro
alt=""
aria-hidden="true"
```

原因是外层链接已经有：

```astro
aria-label={SITE.author}
```

也就是说，屏幕阅读器会读外层链接的语义，不需要重复读取图片内容。替换 logo 时通常不需要改这两个属性。

## 推荐资源格式

导航栏 logo 推荐使用 SVG：

- 缩放清晰
- 文件体积小
- 适合文字标识和品牌标识
- 可以通过 CSS 控制尺寸、位置和暗色模式

也可以使用 `PNG` 或 `WebP`，但位图在高分屏或放大后可能变糊。除非新 logo 本身就是复杂位图，否则优先使用 SVG。

## 常见问题

### logo 显示不完整

检查 `.logo-icon` 是否仍然是：

```css
object-fit: contain;
```

如果被改成 `cover`，横向 logo 很容易被裁切。

### logo 和导航项距离太近

适当减小 `.logo-container` 的 `width`，或者检查导航栏整体布局是否空间不足。

### 移动端 logo 太大

只修改 media query 中的尺寸，不要直接改桌面端尺寸：

```css
@media (max-width: 767.9px) {
  .logo-container {
    width: 7.25rem;
    height: 2.1rem;
  }
}
```

### 暗黑模式颜色不对

先检查是否是 `filter: invert(1)` 导致。如果反色不适合新 logo，可以移除这段样式，或者准备一份专门的暗黑模式 SVG。
