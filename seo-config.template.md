# 站点域名与社交账号 · 配置说明

> 版本 v1 ｜ 2026-10-15 ｜ 对应 [src/config/site-config.js](./src/config/site-config.js)

## 一句话

全站的域名与社交账号**只有一处需要填**：[src/config/site-config.js](./src/config/site-config.js)。
填完即全站生效（JSON-LD 结构化数据、llms.txt、以及将来的导航外链），无需改任何其他文件。

## ⚠️ 为什么现在必须填（SEO 影响）

当前 `SITE.url` 是占位符 `https://ciwei.example.com`，它会被用于生成**构建产物里 42 个 JSON-LD 实体的全部 `@id` 与 URL**：

- `Person` / `WebSite` / `ProfilePage` 的 `@id` 与 `url`
- 19 个 `CreativeWork`（作品）与 19 个 `VideoObject`（正片）的 `@id`
- `VideoObject` 的 `contentUrl` / `thumbnailUrl`（绝对地址）
- `llms.txt` 里的所有链接

搜索引擎与 AI 引擎（Google AI Overviews、Perplexity、Gemini）依据这些 `@id` 认定「这些实体同属此唯这一个人/站点」。**用占位域名发布，等于对外声明了一个不存在的网站**，SEO 信号会被浪费。

## 填写步骤

1. 打开 [src/config/site-config.js](./src/config/site-config.js)
2. 把 `url: 'https://ciwei.example.com'` 改为正式域名，**不带结尾斜杠**：
   - 正确：`url: 'https://www.ciwei.tv'`
   - 错误：`url: 'https://www.ciwei.tv/'`
3. 按需填写 `SOCIAL` 里**真实存在**的账号（留空的项会自动被忽略，不会输出到 SEO 里）：
   ```js
   export const SOCIAL = {
       bilibili: 'https://space.bilibili.com/12345678',
       douyin: 'https://www.douyin.com/user/MS4wLjABAAAA...',
       // 没有的账号直接留空 ''，不要填假链接
   };
   ```
4. 重新构建：`npm run build`
5. 核验：构建后 `dist/index.html` 的 JSON-LD 里应出现你的域名，`dist/llms.txt` 同步更新

## 待填清单（Checklist）

- [ ] **正式域名** `SITE.url`（部署前必填；影响 42 个 JSON-LD 实体的 @id）
- [ ] **社交账号** `SOCIAL.bilibili`（必填：站点主要受众在国内）
- [ ] **社交账号** `SOCIAL.douyin`（必填：短视频主阵地）
- [ ] **社交账号** `SOCIAL.xiaohongshu`（可选）
- [ ] **社交账号** `SOCIAL.weibo`（可选）
- [ ] **社交账号** `SOCIAL.youtube` / `SOCIAL.bcc`（可选：如做英文/出海）
- [ ] **联系邮箱** `SOCIAL.email`（可选：将来联系房间展示用；不进 JSON-LD）

## 关键说明：`sameAs` 的作用

`SOCIAL` 里**留空的项不会被输出**——这一点很重要。填假链接或不维护的账号主页，会让搜索引擎把错误账号关联到你的实体，反而降低可信度。所以原则是：**有就填，没有就空着。**

填了之后，JSON-LD 的 `Person` 节点会自动带上：

```json
"sameAs": [
  "https://space.bilibili.com/12345678",
  "https://www.douyin.com/user/MS4wLjABAAAA..."
]
```

这让搜索引擎确认「此唯（本站 Person）与这些社交主页是同一个人」，有助于在搜索结果里展示社交资料卡。

## 常见错误

| 错误 | 后果 | 正确做法 |
|---|---|---|
| 域名带结尾斜杠 `/` | 拼接出 `https://x.com//#person`，@id 断裂 | 不带斜杠 |
| 填假链接/占位账号 | 搜索引擎关联错误账号，降可信度 | 只填真实主页 |
| 用 IP 或 localhost | 生产环境无效 | 只用正式域名 |
| 只改插件不改配置 | 下次构建又被覆盖 | 改 `site-config.js`（单一来源） |

## 关联文件

- [src/config/site-config.js](./src/config/site-config.js) —— **唯一的配置入口**
- [seo-plugin.js](./seo-plugin.js) —— 构建期消费 `SITE`/`socialUrls()`，生成 JSON-LD 与 llms.txt
- [index.html](./index.html) —— 静态 SEO 长文（`seo-content`），域名与社交账号不在此文件，无需改

> 提示：将来若接入联系房间的社交按钮，也应直接引用 `site-config.js` 的 `SOCIAL`，避免出现第二处真相来源。
