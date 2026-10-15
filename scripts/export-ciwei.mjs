/**
 * 数据桥（阶段 2）：CiWei placeholder.ts → ITom Gallery 数据
 * ---------------------------------------------------------------
 * CiWei 侧是 TS + @/ 别名（node 不能直接 import）——用本项目自带的
 * esbuild 转译后提取 projects，映射成 ITom 期望的形状 + 世界三处消费字段：
 *   画框/摘要层：id/title/front/painted/preview/role/client/year/category/durationSeconds
 *   阅读室（批次 2 预备）：background/problem/process/solution/reflection/results/videos/gallery
 * 封面 → public/covers/；6 秒预览视频 → public/media/preview/（小，悬停动图用）；
 * 正片与图集体积大，只导元数据（批次 2 再复制文件）。
 *
 * 用法（在 itom-study 根目录）：node scripts/export-ciwei.mjs
 */
import { buildSync } from 'esbuild';
import { writeFileSync, copyFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CIWEI = 'E:/CiWei';
const DATA_DIR = path.resolve('src/data');
const COVERS_DIR = path.resolve('public/covers');
const PREVIEW_DIR = path.resolve('public/media/preview');
const MEDIA_DIR = path.resolve('public/media'); // 正片目录（与主站 /media 同名）
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(COVERS_DIR, { recursive: true });
mkdirSync(PREVIEW_DIR, { recursive: true });
mkdirSync(MEDIA_DIR, { recursive: true });

/* ① esbuild 转译 CiWei 的 placeholder.ts（bundle + @/ alias + 类型擦除） */
const result = buildSync({
  entryPoints: [path.join(CIWEI, 'src/data/placeholder.ts')],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'node',
  alias: { '@/types/content': path.join(CIWEI, 'src/types/content.ts') },
  logLevel: 'silent',
});
const tmp = path.join(DATA_DIR, '_placeholder.bundle.mjs');
writeFileSync(tmp, result.outputFiles[0].text);

/* ② 动态 import 提取 projects */
const { projects } = await import(pathToFileURL(tmp).href);
unlinkSync(tmp);

/* ③ 映射 + 媒体复制 */
/* 1d-i（2026-10-12）：按分类排序上墙——同类相邻（类内保 order），
   为画廊「六类分区（长廊分段）」做准备 */
const CATEGORY_ORDER = ['产品片', '口播', '快剪', '信息流', '直播切片', '探店'];
const sortedProjects = [...projects].sort((a, b) => {
  const ia = CATEGORY_ORDER.indexOf(a.category);
  const ib = CATEGORY_ORDER.indexOf(b.category);
  const ra = ia === -1 ? 99 : ia;
  const rb = ib === -1 ? 99 : ib;
  return ra - rb || (a.order ?? 0) - (b.order ?? 0);
});

/* 复制一个小文件到世界 public 下，返回世界内 URL（缺失则警告并返回空） */
function copyMedia(src, destDir) {
  if (!src) return '';
  const from = path.join(CIWEI, 'public', src);
  if (!existsSync(from)) {
    console.warn('  ⚠️ 媒体缺失: ' + src);
    return '';
  }
  const to = path.join(destDir, path.basename(src));
  copyFileSync(from, to);
  return '/' + path.relative(path.resolve('public'), to).replace(/\\/g, '/');
}

const mapped = sortedProjects.map((p) => {
  let front = '';
  let painted = '';
  const coverSrc = p.coverImage?.src;
  if (coverSrc) {
    const from = path.join(CIWEI, 'public', coverSrc);
    const to = path.join(COVERS_DIR, `${p.slug}.jpg`);
    if (existsSync(from)) {
      copyFileSync(from, to);
      /* P0（2026-10-13）：画廊"悬停上色"需要成对贴图——
         素描版（front，默认展示）→ 彩色版（painted，hover 揭示）。
         两版由 pipeline/make-covers.mjs 从同一张 jpg 派生（同构图）。
         若派生文件尚未生成，回退到 jpg（避免 useTexture 404 崩树）。 */
      const sketchFile = path.join(COVERS_DIR, `${p.slug}-sketch.webp`);
      const paintedFile = path.join(COVERS_DIR, `${p.slug}.webp`);
      const jpgUrl = `/covers/${p.slug}.jpg`;
      front = existsSync(sketchFile) ? `/covers/${p.slug}-sketch.webp` : jpgUrl;
      painted = existsSync(paintedFile) ? `/covers/${p.slug}.webp` : jpgUrl;
    } else {
      console.warn('  ⚠️ 封面缺失: ' + coverSrc + ' (' + p.slug + ')');
    }
  }
  return {
    id: p.slug,
    title: p.title,
    front,
    painted,
    url: `#${p.slug}`, // 占位：详情跳转待接（阅读室深链 /read/<slug>）
    description: p.summary || p.background || p.title,
    techStack: [], // 无 logo 贴图资产（阶段 4）
    /* —— 批次 1：摘要浮层 + 悬停动图 + 四分类分区 —— */
    preview: copyMedia(p.previewSrc, PREVIEW_DIR), // 6 秒静音预览（悬停"会动的画"）
    role: p.role || [], // 署名（诚实性原则带进世界）
    client: p.client || '',
    year: p.year ?? null,
    category: p.category || '',
    durationSeconds: p.durationSeconds ?? null,
    /* —— 批次 2（阅读室）：五段 + 视频/图集 ——
       2026-10-13：正片文件也复制进世界 public/media/（原先只导元数据，URL 全 404，
       导致 13 个无 preview 的项目在浮层/阅读室看不到任何视频）。 */
    background: p.background || '',
    problem: p.problem || '',
    process: p.process || '',
    solution: p.solution || '',
    reflection: p.reflection || '',
    results: p.results || [],
    videos: (p.videos || []).map((v) => ({
      id: v.id,
      title: v.title,
      url: copyMedia(v.url, MEDIA_DIR), // 复制正片到 public/media/，缺失则空串
      durationSeconds: v.durationSeconds ?? null,
    })),
    gallery: (p.gallery || []).map((g) => ({ src: g.src, alt: g.alt || '' })),
  };
});

writeFileSync(path.join(DATA_DIR, 'ciwei-projects.json'), JSON.stringify(mapped, null, 2));
const withCover = mapped.filter((p) => p.front).length;
console.log(`✅ 导出完成：${mapped.length} 个项目（${withCover} 个有封面）→ src/data/ciwei-projects.json`);
console.log(`   封面目录：public/covers/（${withCover} 张）`);
