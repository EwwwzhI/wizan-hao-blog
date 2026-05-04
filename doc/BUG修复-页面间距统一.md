# 页面间距修复记录

> 记录本次 `home / blogs / projects` 页面标题区与正文起始位置不一致的问题、定位过程与最终修复方案。

---

## 1. 问题现象

页面顶部大标题与子标题下方的内容起始位置不一致：

- `blogs` 页面看起来更紧凑
- `home` 页面正文离 subtitle 更远
- `projects` 页面分类标题离 subtitle 也更远

最初容易误以为这是 `StandardLayout` 的统一间距问题，但实际不是。

---

## 2. 根因分析

### 2.1 `StandardLayout` 只控制标题区和正文容器之间的基础间距

当前 [StandardLayout.astro](file:///Users/a/Desktop/wutong-yu-blog/wutong-yu/src/layouts/StandardLayout.astro) 中：

```astro
<header
  class={`prose mx-auto mb-16${isCentered ? ' text-center' : ''}`}
>
```

这里的 `mb-16` 只负责：

- 页面标题
- 页面副标题
- 下方正文容器

之间的基础间距。

### 2.2 真正拉开差距的是“正文里的第一个元素”

三个页面进入正文后的首个可见元素不同，因此视觉间距不同：

#### `blogs`

`blogs` 第一屏最先出现的是年份标题 `Categorizer`。

在 [Categorizer.astro](file:///Users/a/Desktop/wutong-yu-blog/wutong-yu/src/components/base/Categorizer.astro) 中，普通版本的标题是：

```css
.categorizer__label {
  top: -2rem;
}
```

也就是年份标签会被向上提，因此视觉上更靠近 subtitle。

#### `projects`

`projects` 也是 `Categorizer`，但使用的是宽版：

```css
.categorizer--wide .categorizer__label {
  top: -1.5rem;
}
```

它也会上移，但原先上移量不足，所以看起来比 `blogs` 更远。

#### `home`

`home` 的第一个元素不是 `Categorizer`，而是 Markdown 正文中的首段 `<p>`。

在 [prose.css](file:///Users/a/Desktop/wutong-yu-blog/wutong-yu/src/styles/prose.css) 中：

```css
.prose p {
  margin-top: 1.25em;
}
```

默认首段会自带顶部外边距，因此首页正文会比 `blogs` 更靠下。

---

## 3. 处理思路

目标不是继续修改全局 `StandardLayout`，而是：

- 保持三页共用统一的基础标题间距
- 再分别处理各自首个元素的额外偏移

也就是：

1. `StandardLayout` 负责公共基础间距
2. `blogs` 保持现状
3. `projects` 调整宽版分类标题上移量
4. `home` 单独上移正文外层容器

---

## 4. 最终修改

### 4.1 `StandardLayout` 作为统一基础间距

当前统一使用：

```astro
<header class={`prose mx-auto mb-16${isCentered ? ' text-center' : ''}`}>
```

作用：

- 所有使用 `StandardLayout` 的页面先共享一套基础标题区间距

### 4.2 `blogs` 页面不额外加首组上边距

当前 [ListView.astro](file:///Users/a/Desktop/wutong-yu-blog/wutong-yu/src/components/views/ListView.astro) 保持：

```astro
<section data-year={group.year} class="mb-16">
```

说明：

- 不再额外给第一组年份块增加 `mt-*`
- 让 `blogs` 的顶部距离主要由 `StandardLayout + Categorizer 自身上移` 决定

### 4.3 `projects` 页面上移宽版分类标题

在 [Categorizer.astro](file:///Users/a/Desktop/wutong-yu-blog/wutong-yu/src/components/base/Categorizer.astro) 中，将宽版分类标题调整为：

```css
.categorizer--wide .categorizer__label {
  top: -1.5rem;
}
```

作用：

- 让 `projects` 页分类标题更靠近 subtitle
- 视觉上向 `blogs` 页面看齐

### 4.4 `home` 页面单独上移正文

在 [index.mdx](file:///Users/a/Desktop/wutong-yu-blog/wutong-yu/src/pages/index.mdx) 中，首页正文包了一层：

```mdx
<div slot="article" class="home-content" style="margin-top: -1em;">
  <RenderPage collectionType="home" id="index" />
</div>
```

作用：

- 只影响首页
- 让首页正文整体向上靠近 subtitle
- 不影响 `blogs` 和 `projects`

---

## 5. 当前结果

调整后：

- `blogs`：作为目标参考页，保持当前视觉关系
- `projects`：分类标题更接近 subtitle
- `home`：首段正文明显上移，更接近 `blogs`

目前三页仍不是像素级完全一致，因为首个可见元素本身不同：

- `blogs` 首元素是绝对定位的大年份标签
- `projects` 首元素是宽版大分类标签
- `home` 首元素是正文段落

但现在已经达到“视觉上更统一”的效果。

---

## 6. 涉及文件

- [StandardLayout.astro](file:///Users/a/Desktop/wutong-yu-blog/wutong-yu/src/layouts/StandardLayout.astro)
- [ListView.astro](file:///Users/a/Desktop/wutong-yu-blog/wutong-yu/src/components/views/ListView.astro)
- [Categorizer.astro](file:///Users/a/Desktop/wutong-yu-blog/wutong-yu/src/components/base/Categorizer.astro)
- [index.mdx](file:///Users/a/Desktop/wutong-yu-blog/wutong-yu/src/pages/index.mdx)
- [prose.css](file:///Users/a/Desktop/wutong-yu-blog/wutong-yu/src/styles/prose.css)

---

## 7. 后续可选优化

如果后续想做成更彻底的统一方案，可以继续往下收敛：

1. 给 `StandardLayout` 增加页面级的 `contentOffset` 属性
2. 让 `home / blogs / projects` 都通过统一参数控制正文起始位置
3. 避免在页面入口里写行内 `style`
4. 为 `Categorizer` 增加普通版和宽版的统一 offset 配置

这样后续调整页面顶部间距时，就不需要再分别改多个文件。
