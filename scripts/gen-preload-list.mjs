/**
 * 生成纹理预加载清单
 * ---------------------------------------------------------------
 * 扫描 public/ 下的真实素材，写出 src/config/texturePreloadList.js。
 *
 * 规则：小于 1KB 的文件视为占位块（256×256 纯米色），不纳入预加载。
 * 因此清单始终与磁盘一致；补齐贴图后重跑本脚本即可自动收录。
 *
 * 用法：node scripts/gen-preload-list.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const PUB = 'public';
/* 本项目的占位块固定为 202 B（256×256 纯米色）；
   上游/自制的小图可能只有数百字节，故阈值取 512 B 只排除占位块。 */
const MIN_BYTES = 512;
const EXTS = ['.webp', '.jpg', '.jpeg', '.png', '.mp3', '.wav', '.ogg', '.gif'];
const OUT = 'src/config/texturePreloadList.js';

/* 列出目录内的素材；recurse=true 时递归子目录 */
function filesIn(dir, { recurse = false } = {}) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (recurse) out.push(...filesIn(p, { recurse }));
    } else if (
      EXTS.includes(path.extname(e.name).toLowerCase()) &&
      fs.statSync(p).size >= MIN_BYTES
    ) {
      out.push('/' + p.replace(/\\/g, '/').replace(/^public\//, ''));
    }
  }
  return out;
}

const uniq = (arr) => [...new Set(arr)].sort();

/* 回退版本剔除：同名 .webp 已存在时，.jpg/.png 只是兜底副本，不纳入预加载 */
function preferWebp(list) {
  const lower = new Set(list.map((u) => u.toLowerCase()));
  return list.filter((u) => {
    const ext = path.extname(u).toLowerCase();
    if (ext === '.webp') return true;
    const base = u.slice(0, -ext.length).toLowerCase();
    return !lower.has(base + '.webp');
  });
}

/* 分组：目录 → 导出名（与 App.jsx / 房间懒加载的语义一致） */
const G = {
  ENTRANCE_TEXTURES: uniq([
    ...filesIn(`${PUB}/textures`), // 根级共享贴图（如 paper-texture.webp）
    ...filesIn(`${PUB}/textures/doors`, { recurse: true }),
    ...filesIn(`${PUB}/textures/entrance`, { recurse: true }),
  ]),
  CORRIDOR_TEXTURES: uniq([
    ...filesIn(`${PUB}/textures/corridor`),
    ...filesIn(`${PUB}/textures/corridor/doors`, { recurse: true }),
    ...filesIn(`${PUB}/textures/corridor/decorations`, { recurse: true }),
  ]),
  UI_TEXTURES: uniq(filesIn(`${PUB}/textures/corridor/avatar_anim`, { recurse: true })),
  IMAGE_ASSETS: uniq(filesIn(`${PUB}/images`, { recurse: true })),
  GALLERY_TEXTURES: uniq([
    ...filesIn(`${PUB}/textures/gallery`, { recurse: true }),
    ...filesIn(`${PUB}/covers`, { recurse: true }), // 画廊卡片正反面（数据桥产出的真实素材）
  ]),
  CONTACT_TEXTURES: uniq(filesIn(`${PUB}/textures/contact`, { recurse: true })),
  STUDIO_TEXTURES: uniq(filesIn(`${PUB}/textures/studio`, { recurse: true })),
  ABOUT_TEXTURES: uniq([
    ...filesIn(`${PUB}/textures/about`, { recurse: true }),
    ...filesIn(`${PUB}/textures/clouds`, { recurse: true }),
  ]),
};

// 各组统一剔除回退副本
for (const key of Object.keys(G)) G[key] = preferWebp(G[key]);

/* 已有彩色版清单：供 utils/colorTexture.js 判断某线稿是否已配对彩色版，
   没有配对的（如头像逐帧、covers）原样保留，避免切色后 404 */
const PAINTED_TEXTURES = uniq(
  Object.values(G).flat().filter((u) => u.includes('_painted.webp'))
);

/* About 核心集：原作者意图是「头像 + 云」常驻预载，证书等重资产不进开机加载。
   原先靠 .slice(0,10) 实现，实际顺序会把证书排在最前——这里显式定义。 */
const aboutAvatar = `${PUB}/textures/about/awatarnachmurce.webp`;
const ABOUT_CORE_TEXTURES = uniq([
  ...(fs.existsSync(aboutAvatar) && fs.statSync(aboutAvatar).size >= MIN_BYTES
    ? ['/textures/about/awatarnachmurce.webp']
    : []),
  ...filesIn(`${PUB}/textures/clouds`, { recurse: true }),
]);

const arr = (name, vals, note) =>
  `// ${note}\nexport const ${name} = [\n${vals.map((v) => `    '${v}',`).join('\n')}\n];\n`;

const sameAsSource = (() => {
  const size = (v) => `    ${v.length} 项`;
  return Object.entries(G).map(([k, v]) => `${k} ${size(v)}`).join(' ｜ ');
})();

const body = `/**
 * 纹理预加载清单（自动生成，请勿手改）
 * ---------------------------------------------------------------
 * 由 scripts/gen-preload-list.mjs 扫描 public/ 生成。
 * 规则：小于 512 B 的文件视为占位块（256×256 纯米色），不纳入预加载。
 * 补齐贴图后重跑生成脚本，清单会自动收录新素材。
 *
 * 本次扫描结果：${sameAsSource}
 */
import { isTouchDevice } from '../utils/deviceDetect';

${arr('ENTRANCE_TEXTURES', G.ENTRANCE_TEXTURES, '入口场景：共享贴图 + 入口门/道具')}
${arr('CORRIDOR_TEXTURES', G.CORRIDOR_TEXTURES, '走廊：墙面地面 + 单门 + 装饰')}
${arr('UI_TEXTURES', G.UI_TEXTURES, '界面：头像逐帧动画')}
${arr('IMAGE_ASSETS', G.IMAGE_ASSETS, '标准 HTML 图片（<img> 预载）')}
${arr('GALLERY_TEXTURES', G.GALLERY_TEXTURES, '画廊：房间贴图 + 作品卡片正反面（covers）')}
${arr('CONTACT_TEXTURES', G.CONTACT_TEXTURES, '联系房间贴图')}
${arr('ABOUT_TEXTURES', G.ABOUT_TEXTURES, '关于房间贴图（含云）')}
${arr('ABOUT_CORE_TEXTURES', ABOUT_CORE_TEXTURES, '关于房间核心集：头像 + 云（常驻预载）')}
${arr('STUDIO_TEXTURES', G.STUDIO_TEXTURES, '工作室房间贴图')}
${arr('PAINTED_TEXTURES', PAINTED_TEXTURES, '已存在的彩色版（_painted）：供运行期判断能否把线稿切成彩色')}
/**
 * 按当前颜色模式过滤贴图清单：
 * 线稿模式跳过 _painted（彩色）版本，只加载素描版，节省移动端内存。
 * @param {string[]} list 贴图路径清单
 * @param {boolean} usePainted 是否保留彩色版本
 * @returns {string[]} 过滤后的清单
 */
export const filterTexturesByDevice = (list, usePainted) => {
    const painted = new Set(PAINTED_TEXTURES);
    return list.filter((path) => {
        // 画廊封面是 -sketch.webp / .webp 成对文件，不在 /textures/ 下。
        // 线稿模式不预取彩色封面，点“上色”后再由按需加载补齐。
        if (path.startsWith('/covers/') && !usePainted && !path.endsWith('-sketch.webp')) {
            return false;
        }
        // 云朵在触屏端始终用线稿，不预取彩色云；桌面端彩色模式用彩色云。
        if (path.includes('/textures/clouds/')) {
            if (path.endsWith('_painted.webp')) return !isTouchDevice() && usePainted;
            return isTouchDevice() || !usePainted;
        }
        if (!path.startsWith('/textures/')) return true;
        if (path.endsWith('_painted.webp')) return usePainted;
        if (!usePainted) return true;
        // 桌面端 colorTexture 会把线稿/底图映射到彩色版；有配对时只预载彩色版
        const cand = path.endsWith('_sketch.webp')
            ? path.replace(/_sketch\.webp$/i, '_painted.webp')
            : path.replace(/\.webp$/i, '_painted.webp');
        return !painted.has(cand);
    });
};
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, body, 'utf8');

const total = Object.values(G).reduce((n, v) => n + v.length, 0);
console.log(`已生成 ${OUT}`);
console.log(`分组：${sameAsSource}`);
console.log(`ABOUT_CORE_TEXTURES ${ABOUT_CORE_TEXTURES.length} 项 ｜ PRELOAD 合计 ${total} 项`);
