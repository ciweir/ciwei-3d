/**
 * SEO 插件（本地数据源版 · 2026-10-14）
 * ---------------------------------------------------------------
 * 数据源改为 src/data/ciwei-projects.json（export-ciwei.mjs 导出），
 * 不再连接 Sanity CMS。构建时注入：
 *   1. JSON-LD 结构化数据（Person / WebSite / CreativeWork / VideoObject）
 *   2. llms.txt（AI 引擎可读的站点摘要）
 * index.html 里的手写中文长文 seo-content 不动（质量优于程序生成）。
 *
 * 若将来恢复 CMS 抓取：归档见 _archive_20261013/deadcode-round4/sanity-fetch-block.js
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SITE, socialUrls } from './src/config/site-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* 本地数据源：19 个项目 */
function loadProjects() {
    const file = path.join(__dirname, 'src', 'data', 'ciwei-projects.json');
    return JSON.parse(readFileSync(file, 'utf8'));
}

/* 视频时长 → ISO-8601（PT39S / PT2M29S） */
function isoDuration(seconds) {
    if (!seconds) return undefined;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `PT${m}M${s}S` : `PT${s}S`;
}

/**
 * 构建 JSON-LD 结构化数据（schema.org）
 * AI 搜索引擎（Google AI Overviews、Perplexity、Gemini）据此理解与引用内容
 */
function buildJsonLd(projects) {
    const graph = [];

    // 1. Person：知识图谱中心节点
    const personSameAs = socialUrls();
    graph.push({
        '@type': 'Person',
        '@id': `${SITE.url}/#person`,
        name: SITE.author,
        url: SITE.url,
        jobTitle: SITE.jobTitle,
        description: SITE.aboutMe,
        knowsAbout: SITE.skills,
        ...(personSameAs.length ? { sameAs: personSameAs } : {}),
    });

    // 2. WebSite
    graph.push({
        '@type': 'WebSite',
        '@id': `${SITE.url}/#website`,
        url: SITE.url,
        name: SITE.title,
        description: SITE.description,
        inLanguage: 'zh-CN',
        publisher: { '@id': `${SITE.url}/#person` },
    });

    // 3. ProfilePage
    graph.push({
        '@type': 'ProfilePage',
        '@id': `${SITE.url}/#profilepage`,
        url: SITE.url,
        mainEntity: { '@id': `${SITE.url}/#person` },
    });

    // 4. ItemList：作品清单（列表类富摘要）
    graph.push({
        '@type': 'ItemList',
        '@id': `${SITE.url}/#projectslist`,
        name: '此唯的作品集',
        description: '精选视频作品：产品片、快剪、信息流与口播，呈现于 3D 画廊。',
        numberOfItems: projects.length,
        itemListElement: projects.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: { '@id': `${SITE.url}/#project-${p.id}` },
        })),
    });

    // 5. CreativeWork + VideoObject：每个项目一条
    projects.forEach((p) => {
        const video = p.videos && p.videos[0];
        graph.push({
            '@type': 'CreativeWork',
            '@id': `${SITE.url}/#project-${p.id}`,
            name: p.title,
            description: p.description || '',
            creator: { '@id': `${SITE.url}/#person` },
            keywords: [p.category, ...(p.role || [])].filter(Boolean).join(', '),
            dateCreated: p.year ? `${p.year}` : undefined,
        });

        if (video && video.url) {
            const thumbnail = p.painted || p.front;
            graph.push({
                '@type': 'VideoObject',
                '@id': `${SITE.url}/#video-${video.id}`,
                name: video.title || p.title,
                description: p.description || '',
                contentUrl: video.url.startsWith('http') ? video.url : `${SITE.url}${video.url}`,
                thumbnailUrl: thumbnail && !thumbnail.startsWith('http') ? `${SITE.url}${thumbnail}` : thumbnail,
                duration: isoDuration(p.durationSeconds),
                uploadDate: p.year ? `${p.year}` : undefined,
                creator: { '@id': `${SITE.url}/#person` },
            });
        }
    });

    return { '@context': 'https://schema.org', '@graph': graph };
}

/* llms.txt 内容（Markdown） */
function buildLlmsTxt(projects) {
    let content = `# ${SITE.title}\n`;
    content += `> ${SITE.description}\n\n`;

    content += `## 简介\n${SITE.aboutMe}\n\n`;

    content += `## 核心手艺\n`;
    content += SITE.skills.map((s) => `- ${s}`).join('\n') + `\n\n`;

    content += `## 作品（${projects.length} 部）\n`;
    projects.forEach((p) => {
        const meta = [p.category, p.year, p.durationSeconds ? `${p.durationSeconds}s` : null]
            .filter(Boolean)
            .join(' · ');
        content += `- **${p.title}**（${meta}）：${p.description || ''}\n`;
    });

    return content;
}

export function generateSeoHtml() {
    let cachedLlmsContent = '';

    function getLlmsContent() {
        if (!cachedLlmsContent) {
            try {
                cachedLlmsContent = buildLlmsTxt(loadProjects());
            } catch (e) {
                console.error('SEO Plugin: 读取本地项目数据失败', e);
                cachedLlmsContent = `# 此唯\n> 视频导演作品集\n`;
            }
        }
        return cachedLlmsContent;
    }

    return {
        name: 'ciwei-seo-plugin',

        // dev 模式提供 /llms.txt
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (req.url === '/llms.txt') {
                    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    res.end(getLlmsContent());
                } else {
                    next();
                }
            });
        },

        // 构建 index.html 时注入 JSON-LD（不动手写 seo-content 长文）
        transformIndexHtml(html) {
            try {
                const jsonLdSchemas = buildJsonLd(loadProjects());
                const jsonLdScript = `\n  <!-- Dynamic Structured Data (JSON-LD) — 由 seo-plugin 从本地数据生成 -->\n  <script type="application/ld+json">\n${JSON.stringify(jsonLdSchemas, null, 2)}\n  </script>\n`;

                // 移除旧的 JSON-LD（重复注入保护），再插到 </head> 前
                const cleaned = html.replace(
                    /\n\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g,
                    ''
                );
                return cleaned.replace('</head>', `${jsonLdScript}</head>`);
            } catch (error) {
                console.error('SEO Plugin: 构建 JSON-LD 失败', error);
                return html; // 失败时返回原 HTML，不破坏构建
            }
        },

        // 产出 llms.txt 到构建目录
        generateBundle() {
            this.emitFile({
                type: 'asset',
                fileName: 'llms.txt',
                source: getLlmsContent(),
            });
        },
    };
}
