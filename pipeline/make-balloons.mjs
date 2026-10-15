/**
 * 构建期生成技能气球贴图（SVG → webp）
 * ---------------------------------------------------------------
 * 把手绘纸气球的几何/配色逻辑放在构建期，产物为透明底 webp：
 *   public/textures/about/balloons/<id>_sketch.webp    素描版（铅笔线）
 *   public/textures/about/balloons/<id>_painted.webp   上色版（色块+高光）
 * 两版同一随机种子 → 线稿与色块严格对齐，供 RevealBasicMaterial 揭示。
 *
 * 数据源：src/data/balloonConfig.js（与运行期组件共用，改配置即可）
 *
 * 用法（在 itom-study 根目录）：node pipeline/make-balloons.mjs
 * 依赖：sharp（已在 devDependencies）
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { BALLOON_CONFIG, BALLOON_TEXTURE_DIR } from '../src/data/balloonConfig.js';

/* 气球配色（冷调为主 + 一个暖色点缀，避免紫/粉） */
const PALETTE = [
    { base: '#7FA0C4', shade: '#5C7FA8' }, // 雾蓝
    { base: '#7FAF9F', shade: '#5C8E7E' }, // 灰青
    { base: '#D9A55E', shade: '#B9863F' }, // 赭黄（暖色点缀）
    { base: '#8CA3A8', shade: '#6A8288' }, // 石板
];

const INK = '#1a1a1a';
const WIDTH = 512; // 输出像素宽度（气球世界尺寸较小，512 足够清晰且轻量）

/* 确定性随机（FNV-1a 播种）：同一 id+变体永远同一只气球 */
function makeRng(seedStr) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
        h ^= seedStr.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    let a = h >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/* 气囊轮廓：椭圆 + 底部收窄 + 手绘抖动 */
function bodyPoints(cx, cy, rx, ry, rng, segments = 72) {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const ex = Math.cos(a);
        const ey = Math.sin(a);
        const lower = Math.max(0, ey);
        const nx = ex * (1 - 0.22 * lower * lower); // 底部收窄
        const ny = ey * (1 + 0.06 * Math.abs(ex)); // 纵向略拉长
        const jr = 1 + (rng() - 0.5) * 0.035; // 手绘抖动
        pts.push([cx + rx * nx * jr, cy + ry * ny * jr]);
    }
    return pts;
}

const pathOf = (pts) =>
    pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') + ' Z';

/* 右下月牙排线：沿气囊外缘的短斜线，越靠外缘越密（左上打光 → 右下阴影） */
function crescentLines(cx, cy, rx, ry, rng) {
    let out = '';
    for (let y = cy + ry * 0.02; y < cy + ry * 0.95; y += 7) {
        const t = (y - cy) / ry;
        const hw = rx * Math.sqrt(Math.max(0, 1 - t * t));
        for (let x = cx + hw * 0.42; x < cx + hw; x += 7) {
            const edge = hw > 0 ? (x - cx) / hw : 1;
            if (rng() > 0.3 + edge * 0.65) continue; // 内侧稀疏、外缘密集
            const len = 8 + rng() * 6;
            out += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - len * 0.55).toFixed(1)}" y2="${(y - len).toFixed(1)}"/>`;
        }
    }
    return out;
}

/* 单只气球的 SVG（透明底） */
function balloonSvg({ label, variant, hue, aspect }) {
    const w = WIDTH;
    const h = Math.round(WIDTH / aspect);
    const rng = makeRng(`${label}|${variant === 'sketch' ? 's' : 'p'}|${hue}`);
    const pal = PALETTE[hue % PALETTE.length];
    const lw = 2.4 * (w / 384);

    const cx = w / 2;
    const cy = h * 0.4;
    const rx = w * 0.36;
    const ry = h * 0.3;
    const knotY = cy + ry * 1.04;
    const yBot = h * 0.97;

    const outline = bodyPoints(cx, cy, rx, ry, makeRng(`${label}|line|${hue}`));
    const bodyPath = pathOf(outline);
    const fillPath = pathOf(bodyPoints(cx, cy, rx, ry, makeRng(`${label}|fill|${hue}`)));
    const id = `c${hue}${variant}`;

    let s = '';

    // 上色版：色块 + 左上高光
    if (variant === 'painted') {
        s += `<defs><radialGradient id="hl${id}" cx="30%" cy="28%" r="70%">
          <stop offset="0%" stop-color="#fff" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
        </radialGradient></defs>`;
        s += `<path d="${fillPath}" fill="${pal.base}"/>`;
        s += `<path d="${fillPath}" fill="url(#hl${id})"/>`;
    }

    // 墨线轮廓
    s += `<path d="${bodyPath}" fill="none" stroke="${INK}" stroke-width="${lw}" stroke-linejoin="round"/>`;

    // 素描版：再描一遍淡线 → 铅笔双线
    if (variant === 'sketch') {
        const ghost = bodyPoints(cx, cy, rx * 1.008, ry * 1.008, makeRng(`${label}|ghost|${hue}`));
        s += `<path d="${pathOf(ghost)}" fill="none" stroke="${INK}" stroke-opacity="0.4" stroke-width="${lw * 0.8}"/>`;
    }

    // 右下月牙排线（两变体共用，光向一致）
    s += `<clipPath id="cl${id}"><path d="${bodyPath}"/></clipPath>`;
    s += `<g clip-path="url(#cl${id})" stroke="${variant === 'painted' ? pal.shade : INK}" stroke-opacity="${variant === 'painted' ? 0.45 : 0.32}" stroke-width="${lw * 0.7}">${crescentLines(cx, cy, rx, ry, rng)}</g>`;

    // 收口结 + 系绳
    s += `<path d="M${cx - rx * 0.09} ${knotY - ry * 0.06} L${cx} ${knotY + ry * 0.05} L${cx + rx * 0.09} ${knotY - ry * 0.06}" fill="none" stroke="${INK}" stroke-width="${lw}"/>`;
    s += `<path d="M${cx} ${knotY + ry * 0.05} C${cx + (rng() - 0.5) * 18} ${knotY + (yBot - knotY) * 0.35}, ${cx + (rng() - 0.5) * 24} ${knotY + (yBot - knotY) * 0.7}, ${cx + (rng() - 0.5) * 14} ${yBot}" fill="none" stroke="${INK}" stroke-width="${lw * 0.85}"/>`;

    // 文字标签（构建期用 Noto Sans SC 子集字体，保证字形正确）
    if (label) {
        const len = [...label].length;
        const size = len <= 1 ? w * 0.3 : len === 2 ? w * 0.24 : w * 0.15;
        s += `<text x="${cx}" y="${cy}" font-family="Noto Sans SC" font-size="${size}" font-weight="700" fill="${INK}" text-anchor="middle" dominant-baseline="central">${label}</text>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${s}</svg>`;
}

/* ------------------------- 主流程 ------------------------- */
fs.mkdirSync(BALLOON_TEXTURE_DIR, { recursive: true });

const fontFile = path.resolve('pipeline/fonts-source/NotoSansSC-full.ttf');
let fontOption = {};
if (fs.existsSync(fontFile)) {
    fontOption = { font: fontFile };
    console.log('使用字体: pipeline/fonts-source/NotoSansSC-full.ttf');
} else {
    console.warn('⚠️  未找到完整 Noto Sans SC 字体，标签文字可能回退为系统字体');
}

let count = 0;
for (const cfg of BALLOON_CONFIG) {
    for (const variant of ['sketch', 'painted']) {
        const svg = balloonSvg({ label: cfg.label, variant, hue: cfg.hue, aspect: cfg.aspect });
        const out = path.join(BALLOON_TEXTURE_DIR, `${cfg.id}_${variant}.webp`);
        await sharp(Buffer.from(svg), fontOption).webp({ quality: 92, alphaQuality: 90 }).toFile(out);
        count++;
    }
}

console.log(`✅ 气球贴图已生成 ${count} 个 → ${BALLOON_TEXTURE_DIR}/（气球 ${BALLOON_CONFIG.length} 只 × 素描/上色两版）`);
