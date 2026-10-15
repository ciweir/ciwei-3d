/**
 * 构建期上色管线：为线稿贴图批量产出彩色版（_painted）
 * ---------------------------------------------------------------
 * 背景：全站默认只有铅笔线稿，彩色版仅覆盖 38/163 张贴图，且只在悬停/入场
 *       揭示时短暂出现。本脚本按房间调色板为缺失彩色版的线稿补齐 _painted，
 *       令「全站全彩」具备素材基础。
 *
 * 与 make-balloons.mjs 同族：直接对同一张线稿源图上色，因此线稿与色块
 * 天然 100% 对齐（不是二次生成，不存在错位）。
 *
 * 配方（6 步）：
 *   ① 白点归一：取线稿亮度的 98 分位作为「纸白」，tone = L/纸白
 *   ② 分色（region fill）：对墨线围出的封闭区域做连通域标记，按面积排名
 *      分配调色板颜色 —— 最大区域拿主色（花盆/门板/机身），
 *      其余区域依次拿辅色（叶子/便利贴/点缀）。这样「花盆」不会被染成绿色。
 *      区域过多（密集排线）或面层类贴图（墙/地/纸）自动跳过，退回整幅水彩。
 *   ③ 色域起伏：低频 value-noise 在调色板之间平滑过渡（平铺贴图环状采样，
 *      与源图同周期 → 无缝），让同一块颜色有水彩的深浅变化。
 *   ④ 合成：out = 色 × tone × 颗粒 × 曝光   ← 保留源图全部明暗细节
 *      墨线 → 深色，纸白 → 本色，铅笔排线 → 原样保留（不再被压平）
 *   ⑤ 保色：源图本身高饱和的区域（如门上的便利贴）保留原色相，不被覆盖
 *   ⑥ 颗粒：中频周期噪声 + 逐像素白噪，叠一层水彩纸的水痕
 *
 * alpha 原样保留（剪影类贴图的透明边不变，沿用代码里的 alphaTest）。
 *
 * 用法（itom-study 根目录）：
 *   node pipeline/make-painted.mjs                    # 全量：补齐所有缺色线稿
 *   node pipeline/make-painted.mjs --only drzwiabout,kwiatekwdoniczce
 *   node pipeline/make-painted.mjs --out _preview      # 样张预览，不改动 public
 *   node pipeline/make-painted.mjs --list              # 只打印待处理清单
 *   node pipeline/make-painted.mjs --force             # 覆盖已存在的 _painted
 */
import sharp from 'sharp';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const TEX_ROOT = path.resolve('public/textures');
const argv = process.argv.slice(2);
const hasFlag = (k) => argv.includes(`--${k}`);
const getOpt = (k) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : null;
};
const ONLY = getOpt('only') ? getOpt('only').split(',').map((s) => s.trim()).filter(Boolean) : null;
const OUT_DIR = getOpt('out');
const FORCE = hasFlag('force');
const LIST_ONLY = hasFlag('list');
/** 彩度增益：1 = 调色板原样，>1 更浓（环绕中性灰提升 chroma） */
const BOOST = Number(getOpt('boost') || 1.0);

/* ============================================================
 * 调色板（冷调为主 + 一个暖色点缀，避免紫/粉）
 * 每个数组的 index 0 = 该类的「主体色」，其余为辅色/点缀色。
 * 房间主色与既有 _painted 素材保持一致，保证「模块颜色一致」。
 * ============================================================ */
const hex = (s) => {
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const C = {
  slate: hex('#8CA3A8'), slateD: hex('#6A8288'), slateL: hex('#A8BEC1'),
  lake: hex('#7FA0C4'), lakeD: hex('#5C7FA8'), lakeL: hex('#A6BDD6'),
  steel: hex('#6E8AA6'), steelD: hex('#587891'), steelL: hex('#9BB0C4'),
  mist: hex('#9DB8CE'),
  sea: hex('#4F7A9B'), seaD: hex('#3C607A'), seaL: hex('#7FA3BC'),
  stone: hex('#A9B6B4'), stoneD: hex('#8B9998'), stoneL: hex('#C6CFCC'),
  gold: hex('#D9A55E'), goldD: hex('#B9863F'),
  wood: hex('#A9805A'), woodD: hex('#8A6647'), woodL: hex('#C39C72'),
  pot: hex('#B58C74'),          // 陶土花盆（唯一暖色点缀族，避免过艳）
  sage: hex('#7FAF9F'),
  plant: hex('#6E8F6A'), plantD: hex('#527050'), plantL: hex('#93B08C'),
  cream: hex('#E8DFCF'), creamD: hex('#CFC2AC'), creamL: hex('#F2ECDE'),
  device: hex('#5A626B'), deviceD: hex('#42484F'),
  lamp: hex('#E7C078'), cloudW: hex('#D6E1EA'), cloudB: hex('#AFC3D2'),
};

/* 需要平铺（RepeatWrapping）的贴图：色域起伏必须与源图同周期，否则平铺见缝 */
const TILING = new Set([
  'paper-texture.webp',
  'corridor/wall_texture.webp', 'corridor/ceiling_texture.webp', 'corridor/kawalekpodlogi.webp',
  'corridor/texturadoprogow.webp', 'corridor/texturadrewnadonozekbiurka.webp',
  'corridor/bokilampy.webp', 'corridor/kratkawentylacyjna.webp',
  'corridor/drzewkowdoniczce.webp', 'entrance/wall_bricks_2.webp', 'entrance/stone-path.webp',
  'entrance/floor_paper.webp', 'contact/faletopdown.webp', 'corridor/pustatabliczka.webp',
]);

/* ============================================================
 * 规格解析：按语义关键词推导配色
 *   pal    —— 调色板（index 0 为主体色）
 *   region —— 是否启用分色（有「多个独立物件」的场景才开）
 *   grain  —— 颗粒强度
 *   cells  —— 色域起伏的格数（越大越碎）
 * ============================================================ */
const FULL = { grain: 0.14, cells: 5, region: true };

function resolveSpec(rel) {
  const p = rel.toLowerCase();
  const at = (...ks) => ks.some((k) => p.includes(k));
  const spec = (pal, over = {}) => ({ ...FULL, pal, ...over });

  if (at('handle', 'klamka', 'klamerka'))
    return spec([C.steel, C.steelL, C.steelD, C.gold]);                     // 五金：钢 + 金
  if (at('kratanalampy', 'bokilampy', 'latarnia', 'kratkawentylac'))
    return spec([C.steel, C.lamp, C.steelL, C.gold]);                       // 灯具：暖光
  if (at('drzwi', 'door'))
    return spec([C.wood, C.woodD, C.woodL, C.gold], { cells: 6 });          // 门：木色（对齐既有彩色门）
  if (at('belka', 'pien', 'texturadrewna', 'gorastolika', 'szafkaprzod'))
    return spec([C.wood, C.woodD, C.woodL, C.gold], { cells: 4 });          // 木构架
  if (at('kwiatek', 'drzewko'))
    return spec([C.pot, C.plant, C.sage, C.plantL]);                        // 盆栽：花盆主体 + 叶绿
  if (at('tree_', 'kwiat'))
    return spec([C.plant, C.wood, C.sage, C.plantD]);                       // 树：枝叶主体 + 木质
  if (at('cat_', 'mouse_', 'pot_with_duck', 'bug_'))
    return spec([C.cream, C.stone, C.stoneL, C.stoneD], { grain: 0.18 });   // 小动物：米白 + 灰
  if (at('clouds/', 'awatarnachmurce', 'wyspa'))
    return spec([C.cloudW, C.cloudB, C.mist, C.creamD], { region: false, grain: 0.1 }); // 云
  if (at('faletopdown'))
    return spec([C.sea, C.seaL, C.seaD, C.cream], { region: false, cells: 3 });        // 海面
  if (at('statek'))
    return spec([C.wood, C.cream, C.seaL, C.sea]);                          // 船
  if (at('molo', 'beczka'))
    return spec([C.wood, C.cream, C.woodD, C.gold]);                        // 码头/木桶
  if (at('monitor', 'tv_', 'phone_', 'openliveproject'))
    return spec([C.device, C.deviceD, C.slate, C.gold], { cells: 3 });      // 设备外壳
  if (at('wall', 'ceil', 'floor', 'podlog', 'brick', 'stone', 'textur',
         'pustatabliczka', 'ramkanazdjecied', 'ramkanazdjeciem', 'rysuneknaobraz', 'paper-texture'))
    return spec([C.stone, C.stoneL, C.stoneD, C.stone], { region: false, cells: 3, grain: 0.1 }); // 面层/纸
  if (at('gallery/'))
    return spec([C.lake, C.lakeL, C.lakeD, C.gold]);                        // 画廊道具
  if (at('decorations/', 'paper_', 'speech_bubble', 'sign'))
    return spec([C.cream, C.creamD, C.creamL, C.gold], { grain: 0.16 });    // 纸品/文具
  if (at('balloons/'))
    return spec([C.lake, C.sage, C.slate, C.gold]);                         // 气球（沿用既有配色）
  if (at('entrance/'))
    return spec([C.stone, C.stoneL, C.slate, C.gold], { cells: 4 });        // 入口场景

  return spec([C.slate, C.slateL, C.slateD, C.gold]);                       // 兜底：青灰
}

/* ============================================================
 * 噪声工具（确定性播种：同一贴图永远同一配色）
 * ============================================================ */
function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const smooth = (t) => t * t * (3 - 2 * t);

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function makeGrid(gw, gh, rng) {
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  return g;
}

/** 环绕/夹取双线性采样 */
function sampleGrid(g, gw, gh, u, v, wrap) {
  const x0 = Math.floor(u), y0 = Math.floor(v);
  const fx = smooth(u - x0), fy = smooth(v - y0);
  const at = (ix, iy) => {
    if (wrap) { ix = ((ix % gw) + gw) % gw; iy = ((iy % gh) + gh) % gh; }
    else {
      ix = ix < 0 ? 0 : ix > gw - 1 ? gw - 1 : ix;
      iy = iy < 0 ? 0 : iy > gh - 1 ? gh - 1 : iy;
    }
    return g[iy * gw + ix];
  };
  const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

/** 全分辨率色域场：低分辨率 fbm 在调色板之间插值 → cubic 放大 */
async function buildWash(w, h, spec, wrap, seed) {
  const sw = Math.max(8, Math.round(w / 8));
  const sh = Math.max(8, Math.round(h / 8));
  const rng = mulberry32(seed);
  const oct = [0, 1, 2].map((i) => {
    const cx = Math.max(2, Math.round(spec.cells * Math.pow(2, i)));
    const cy = Math.max(2, Math.round((cx * h) / w));
    return { cx, cy, gw: cx, gh: cy, g: makeGrid(cx, cy, rng) };
  });
  // 色域场只用「非点缀色」（前三个）——点缀色留给分色，避免大面积串色
  const pal = spec.pal.slice(0, Math.min(3, spec.pal.length)), nPal = pal.length;
  const small = Buffer.alloc(sw * sh * 3);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const fx = x / sw, fy = y / sh;
      let n = 0.58 * sampleGrid(oct[0].g, oct[0].gw, oct[0].gh, fx * oct[0].cx, fy * oct[0].cy, wrap);
      n += 0.28 * sampleGrid(oct[1].g, oct[1].gw, oct[1].gh, fx * oct[1].cx, fy * oct[1].cy, wrap);
      n += 0.14 * sampleGrid(oct[2].g, oct[2].gw, oct[2].gh, fx * oct[2].cx, fy * oct[2].cy, wrap);
      n = n < 0 ? 0 : n > 1 ? 1 : n;
      const t = n * nPal;
      const i0 = Math.floor(t) % nPal, i1 = (i0 + 1) % nPal;
      const f = smooth(t - Math.floor(t));
      const a = pal[i0], b = pal[i1];
      const i = (y * sw + x) * 3;
      small[i] = Math.round(a[0] + (b[0] - a[0]) * f);
      small[i + 1] = Math.round(a[1] + (b[1] - a[1]) * f);
      small[i + 2] = Math.round(a[2] + (b[2] - a[2]) * f);
    }
  }
  return sharp(small, { raw: { width: sw, height: sh, channels: 3 } })
    .resize(w, h, { kernel: 'cubic' })
    .raw()
    .toBuffer();
}

/** 98 分位白点（仅在 alpha>128 的像素上统计） */
function whitePointOf(src, w, h) {
  const hist = new Uint32Array(256);
  let total = 0;
  for (let i = 0, n = w * h; i < n; i++) {
    const s = i * 4;
    if (src[s + 3] < 128) continue;
    const L = (0.2126 * src[s] + 0.7152 * src[s + 1] + 0.0722 * src[s + 2]) | 0;
    hist[L]++; total++;
  }
  if (!total) return 255;
  const cut = total * 0.98;
  let acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= cut) return Math.max(64, v);
  }
  return 255;
}

/**
 * 分色：把墨线围出的封闭区域做连通域标记，按面积排名分配调色板颜色。
 * 墨线本身（ink > LINE_T）与透明像素都视为边界。
 * 返回 { label, regionCol }；区域过多时返回 null（密集排线不适合分色）。
 */
function buildRegions(ink, src, w, h, pal) {
  const N = w * h;
  const LINE_T = 0.45;
  const MAX_REGIONS = 48;

  // 边界 = 墨线 或 透明
  const bar = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (ink[i] > LINE_T || src[i * 4 + 3] < 8) bar[i] = 1;
  }
  // 先横后纵各膨胀一次 → 8 邻域效果，封住 1px 的线缝
  const dil = new Uint8Array(N);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      if (bar[i] || (x > 0 && bar[i - 1]) || (x < w - 1 && bar[i + 1])) dil[i] = 1;
    }
  }
  const vertical = new Uint8Array(N);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (dil[i] || (y > 0 && dil[i - w]) || (y < h - 1 && dil[i + w])) vertical[i] = 1;
    }
  }

  // 连通域（显式栈，避免递归爆栈）
  const label = new Int32Array(N).fill(-1);
  const stack = new Int32Array(N);
  const areas = [];
  let nl = 0;
  for (let i = 0; i < N; i++) {
    if (vertical[i] || label[i] !== -1) continue;
    if (nl >= MAX_REGIONS) return null; // 区域太多 → 密集排线，放弃分色
    const id = nl++;
    let sp = 0, area = 0;
    stack[sp++] = i; label[i] = id;
    while (sp > 0) {
      const p = stack[--sp];
      area++;
      const x = p % w, y = (p - x) / w;
      if (x > 0 && !vertical[p - 1] && label[p - 1] === -1) { label[p - 1] = id; stack[sp++] = p - 1; }
      if (x < w - 1 && !vertical[p + 1] && label[p + 1] === -1) { label[p + 1] = id; stack[sp++] = p + 1; }
      if (y > 0 && !vertical[p - w] && label[p - w] === -1) { label[p - w] = id; stack[sp++] = p - w; }
      if (y < h - 1 && !vertical[p + w] && label[p + w] === -1) { label[p + w] = id; stack[sp++] = p + w; }
    }
    areas.push(area);
  }
  if (nl < 2) return null; // 单一区域 = 没有可分的物件，退回整幅水彩

  // 面积降序 → 主色给最大区域，其余依次拿辅色；过小的区域并入辅色，避免噪点
  const order = Array.from({ length: nl }, (_, i) => i).sort((a, b) => areas[b] - areas[a]);
  const smallT = N * 0.004;
  const regionCol = new Array(nl);
  order.forEach((id, rank) => {
    regionCol[id] = pal[areas[id] < smallT ? 1 % pal.length : rank % pal.length];
  });
  return { label, regionCol };
}

/** 单张：线稿 → 彩色版 */
async function makePainted(srcPath, destPath, rel) {
  const spec = resolveSpec(rel);
  const meta = await sharp(srcPath).metadata();
  const w = meta.width, h = meta.height;
  const { data: src } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const wrap = TILING.has(rel);
  const seed = hashStr(rel);
  const wp = whitePointOf(src, w, h);

  // ① 墨量 / 明度（tone 保留源图全部明暗细节）
  const N = w * h;
  const ink = new Float32Array(N);
  const tone = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const s = i * 4;
    const L = 0.2126 * src[s] + 0.7152 * src[s + 1] + 0.0722 * src[s + 2];
    let t = L / wp; t = t < 0 ? 0 : t > 1 ? 1 : t;
    tone[i] = t;
    ink[i] = 1 - t;
  }

  // ② 分色
  const regions = spec.region ? buildRegions(ink, src, w, h, spec.pal) : null;
  // ③ 色域起伏
  const wash = await buildWash(w, h, spec, wrap, seed);

  // ⑥ 颗粒网格（中频、环绕）
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const gGr = makeGrid(128, 128, rng);
  const EXPOSURE = 1.06; // 抵消 tone 在纸白处的轻微压暗，使纸面呈现调色板本色

  const out = Buffer.alloc(N * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = x + y * w, s = i * 4;
      const t = tone[i];

      // 基础色：分色优先，否则用色域场
      let cr, cg, cb;
      if (regions && regions.label[i] >= 0) {
        const c = regions.regionCol[regions.label[i]];
        cr = c[0]; cg = c[1]; cb = c[2];
        // 区域色 × 色域亮度（只借用起伏，不借用色相）→ 同色区有水彩深浅
        const wl = (0.2126 * wash[i * 3] + 0.7152 * wash[i * 3 + 1] + 0.0722 * wash[i * 3 + 2]) / 210;
        const k = 0.86 + 0.28 * wl;
        cr *= k; cg *= k; cb *= k;
      } else {
        cr = wash[i * 3]; cg = wash[i * 3 + 1]; cb = wash[i * 3 + 2];
      }

      // ④ 合成：色 × 明度 × 颗粒 × 曝光
      const fiber = sampleGrid(gGr, 128, 128, (x / w) * 128, (y / h) * 128, true);
      const tooth = ((Math.imul(x ^ (y * 374761393), 668265263) >>> 8) & 1023) / 1023;
      const grit = 1 - spec.grain * (1 - (0.65 * fiber + 0.35 * tooth));
      const m = t * grit * EXPOSURE;
      let r = cr * m, g = cg * m, b = cb * m;

      // 彩度增益（以亮度为轴外推 chroma）
      if (BOOST !== 1) {
        const lumC = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = lumC + (r - lumC) * BOOST;
        g = lumC + (g - lumC) * BOOST;
        b = lumC + (b - lumC) * BOOST;
      }

      // ⑤ 保色：源图高饱和区域（便利贴、警示色）保留原色相
      const r0 = src[s], g0 = src[s + 1], b0 = src[s + 2];
      const mx = r0 > g0 ? (r0 > b0 ? r0 : b0) : (g0 > b0 ? g0 : b0);
      const mn = r0 < g0 ? (r0 < b0 ? r0 : b0) : (g0 < b0 ? g0 : b0);
      const sat = mx > 0 ? (mx - mn) / mx : 0;
      if (sat > 0.22 && mx > 64) {
        const k = Math.min(1, (sat - 0.22) / 0.25) * t;
        r += (r0 - r) * k;
        g += (g0 - g) * k;
        b += (b0 - b) * k;
      }

      out[s] = r > 255 ? 255 : r < 0 ? 0 : r;
      out[s + 1] = g > 255 ? 255 : g < 0 ? 0 : g;
      out[s + 2] = b > 255 ? 255 : b < 0 ? 0 : b;
      out[s + 3] = src[s + 3];
    }
  }

  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .webp({ quality: 82, effort: 4 })
    .toFile(destPath);
}

/* ============================================================
 * 目标清单与 CLI
 * ============================================================ */
function walk(dir, base = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (statSync(full).isDirectory()) out.push(...walk(full, rel));
    else if (name.toLowerCase().endsWith('.webp')) out.push(rel);
  }
  return out;
}

/** 源 → 彩色版文件名：X_sketch.webp 与 X.webp 都落到 X_painted.webp（与代码取用约定一致） */
const paintedName = (rel) => rel.replace(/_sketch\.webp$/i, '.webp').replace(/\.webp$/i, '_painted.webp');

async function main() {
  if (!existsSync(TEX_ROOT)) {
    console.error(`未找到贴图目录：${TEX_ROOT}`);
    process.exit(1);
  }
  const all = walk(TEX_ROOT);
  const allSet = new Set(all);

  let targets = all.filter((rel) => {
    if (/_painted\.webp$/i.test(rel)) return false;           // 已是彩色版
    if (rel.includes('avatar_anim/')) return false;           // 创作者头像照片，禁止调色
    if (allSet.has(paintedName(rel)) && !FORCE) return false; // 已有彩色版
    return true;
  });
  if (ONLY) {
    targets = targets.filter((rel) => ONLY.some((k) => rel.toLowerCase().includes(k.toLowerCase())));
  }

  const outRoot = OUT_DIR ? path.resolve(OUT_DIR) : null;
  console.log(`[上色] 贴图总数 ${all.length} ｜ 待处理 ${targets.length} ｜ 输出 ${outRoot || 'public/textures'}`);
  if (LIST_ONLY) { for (const rel of targets) console.log('  ·', rel); return; }
  if (!targets.length) { console.log('无待处理项'); return; }

  let ok = 0, fail = 0;
  for (const rel of targets) {
    const src = path.join(TEX_ROOT, rel);
    const dest = outRoot ? path.join(outRoot, paintedName(rel)) : path.join(TEX_ROOT, paintedName(rel));
    try {
      mkdirSync(path.dirname(dest), { recursive: true });
      await makePainted(src, dest, rel);
      ok++;
      console.log('  ✓', rel);
    } catch (e) {
      fail++;
      console.error('  ✗', rel, '—', e.message);
    }
  }
  console.log(`完成：成功 ${ok} ｜ 失败 ${fail} → ${outRoot || 'public/textures'}`);
}

await main();
