/**
 * 关于房间 3 张贴图 · 构建期生成（SVG → sharp → webp）
 * ---------------------------------------------------------------
 * D3 自制素材：替换 ITom 原作者的「身份内容」占位
 *   · uowyspa.webp / freelancewyspa.webp —— 手绘浮岛（素描线 + 空白横幅，
 *     年份文字由运行期 <Text> 叠加，不再烘进图里）
 *   · awatarnachmurce.webp —— 手绘云朵 + 此唯真实头像（原图直出、圆形画框，
 *     照片本身不调色不处理）
 *
 * 用法（itom-study 根目录）：node pipeline/make-about-art.mjs
 * 依赖：sharp；头像源 pipeline/avatar-src-2.jpg（用户提供）
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const INK = '#1a1a1a';
const fontFile = path.resolve('pipeline/fonts-source/NotoSansSC-full.ttf');
const fontOption = fs.existsSync(fontFile) ? { font: fontFile } : {};
const AVATAR_SRC = 'pipeline/avatar-src-2.jpg';

/* ------------------------- 手绘浮岛 ------------------------- */
/* 倒锥岩体（左右两条采样线闭合为多边形）+ 草沿 + 垂根 + 中部空白横幅 */
function islandSvg(seed) {
    const W = 640, H = 349; // 与原图 2816x1536 同比例（1.833）
    const rng = ((s) => () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; })(seed);
    const j = (amt) => (rng() - 0.5) * amt;

    const cx = W / 2;
    const topY = H * 0.26;      // 草沿
    const bottomY = H * 0.92;   // 岛尖
    const halfW = W * 0.42;     // 岛宽（横幅要落在岩体宽度内）

    // 左右岩壁采样线（幂函数收窄：横幅区域保持足够宽度，下部收成岛尖）
    const N = 8;
    const left = [], right = [];
    for (let i = 0; i <= N; i++) {
        const t = i / N;
        const y = topY + (bottomY - topY) * t;
        const shrink = Math.pow(1 - t, 0.72);
        left.push([cx - halfW * shrink + j(14 * shrink + 4), y]);
        right.push([cx + halfW * shrink + j(14 * shrink + 4), y]);
    }
    const rockPoly = 'M' + left.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
        .join(' L') + ' L' + [...right].reverse().map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L') + ' Z';

    // 草沿：起伏上缘 + 平直下缘
    let grassTop = `M${cx - halfW - 8} ${topY + 8}`;
    for (let x = cx - halfW - 8; x <= cx + halfW + 8; x += 30) {
        const x2 = Math.min(x + 30, cx + halfW + 8);
        grassTop += ` Q${((x + x2) / 2).toFixed(1)} ${(topY - 7 + j(5)).toFixed(1)} ${x2.toFixed(1)} ${(topY + j(4)).toFixed(1)}`;
    }
    const grassPoly = grassTop + ` L${cx + halfW + 8} ${topY + 16} L${cx - halfW - 8} ${topY + 16} Z`;

    // 悬垂根须
    let roots = '';
    for (let i = 0; i < 7; i++) {
        const t = 0.55 + rng() * 0.35; // 集中在横幅以下的岩体
        const y0 = topY + (bottomY - topY) * t;
        const hw = halfW * Math.pow(1 - t, 0.72);
        const x = cx - hw * 0.75 + rng() * hw * 1.5;
        const len = 10 + rng() * 20;
        roots += `<path d="M${x.toFixed(1)} ${y0.toFixed(1)} q${j(8).toFixed(1)} ${(len / 2).toFixed(1)} ${j(4).toFixed(1)} ${len.toFixed(1)}" fill="none"/>`;
    }

    // 岩底右下排线（光向与气球一致：左上打光）
    let hatch = '';
    for (let y = topY + 36; y < bottomY - 6; y += 9) {
        const t = (y - topY) / (bottomY - topY);
        const hw = halfW * Math.pow(1 - t, 0.72);
        for (let x = cx + hw * 0.15; x < cx + hw; x += 9) {
            if (rng() > 0.3 + ((x - cx) / (hw || 1)) * 0.6) continue;
            hatch += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - 7).toFixed(1)}" y2="${(y - 7).toFixed(1)}"/>`;
        }
    }

    // 中部空白横幅：宽度 ≈ 该高度处岩体宽度的 82%，两侧露出岩壁
    const bannerH = H * 0.19;
    const by = topY + H * 0.10;
    const tAtBannerBottom = (by + bannerH - topY) / (bottomY - topY);
    const rockW = 2 * halfW * Math.pow(1 - tAtBannerBottom, 0.72);
    const bannerW = rockW * 0.82;
    const bx = cx - bannerW / 2;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <g stroke="${INK}" stroke-linejoin="round" stroke-linecap="round">
            <path d="${rockPoly}" fill="#f5f0e6" stroke-width="3"/>
            <clipPath id="rk"><path d="${rockPoly}"/></clipPath>
            <g clip-path="url(#rk)" stroke-opacity="0.28" stroke-width="2.4">${hatch}</g>
            <g stroke-width="2.2" stroke-opacity="0.7">${roots}</g>
            <path d="${grassPoly}" fill="#f7f4ea" stroke-width="3"/>
            <rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bannerW.toFixed(1)}" height="${bannerH}" rx="5" fill="#ffffff" stroke-width="3.5"/>
        </g>
    </svg>`;
}

/* ------------------------- 手绘云 + 头像画框 ------------------------- */
/* 单条闭合路径的云轮廓（上缘多段弧、下缘平缓内收），避免重叠圆的内部弧外露 */
function cloudSvg(W, H) {
    const w = W, h = H;
    // 单条闭合路径：左缘上行 → 三段云顶弧 → 右缘下行 → 底部平缓内收回起点
    const d = [
        `M${(0.07 * w).toFixed(1)} ${(0.72 * h).toFixed(1)}`,
        `C${(0.02 * w).toFixed(1)} ${(0.62 * h).toFixed(1)} ${(0.04 * w).toFixed(1)} ${(0.46 * h).toFixed(1)} ${(0.16 * w).toFixed(1)} ${(0.44 * h).toFixed(1)}`,
        `C${(0.17 * w).toFixed(1)} ${(0.26 * h).toFixed(1)} ${(0.34 * w).toFixed(1)} ${(0.16 * h).toFixed(1)} ${(0.47 * w).toFixed(1)} ${(0.26 * h).toFixed(1)}`,
        `C${(0.55 * w).toFixed(1)} ${(0.12 * h).toFixed(1)} ${(0.76 * w).toFixed(1)} ${(0.14 * h).toFixed(1)} ${(0.80 * w).toFixed(1)} ${(0.33 * h).toFixed(1)}`,
        `C${(0.92 * w).toFixed(1)} ${(0.34 * h).toFixed(1)} ${(0.97 * w).toFixed(1)} ${(0.48 * h).toFixed(1)} ${(0.94 * w).toFixed(1)} ${(0.62 * h).toFixed(1)}`,
        `C${(0.93 * w).toFixed(1)} ${(0.74 * h).toFixed(1)} ${(0.86 * w).toFixed(1)} ${(0.80 * h).toFixed(1)} ${(0.76 * w).toFixed(1)} ${(0.79 * h).toFixed(1)}`,
        `C${(0.74 * w).toFixed(1)} ${(0.92 * h).toFixed(1)} ${(0.60 * w).toFixed(1)} ${(0.99 * h).toFixed(1)} ${(0.47 * w).toFixed(1)} ${(0.95 * h).toFixed(1)}`,
        `C${(0.34 * w).toFixed(1)} ${(1.00 * h).toFixed(1)} ${(0.18 * w).toFixed(1)} ${(0.94 * h).toFixed(1)} ${(0.15 * w).toFixed(1)} ${(0.84 * h).toFixed(1)}`,
        `C${(0.09 * w).toFixed(1)} ${(0.84 * h).toFixed(1)} ${(0.07 * w).toFixed(1)} ${(0.78 * h).toFixed(1)} ${(0.07 * w).toFixed(1)} ${(0.72 * h).toFixed(1)}`,
        'Z',
    ].join(' ');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <path d="${d}" fill="#ffffff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    </svg>`;
}

/* ------------------------- 主流程 ------------------------- */
const OUT = 'public/textures/about';

// 1) 两张浮岛（不同随机种子）
for (const { file, seed } of [
    { file: 'uowyspa.webp', seed: 7 },
    { file: 'freelancewyspa.webp', seed: 23 },
]) {
    await sharp(Buffer.from(islandSvg(seed)), fontOption)
        .webp({ quality: 92, alphaQuality: 90 })
        .toFile(path.join(OUT, file));
}

// 2) 云上头像：手绘云为底 + 此唯真实头像（原图圆形画框，不调色）
const CLOUD_W = 768, CLOUD_H = 419; // 同 1.833 比例（运行期 avatarWidth=6）
const cloudPng = await sharp(Buffer.from(cloudSvg(CLOUD_W, CLOUD_H)), fontOption).png().toBuffer();

const D = Math.round(CLOUD_W * 0.34); // 头像圆直径
const avatarCircle = await sharp(AVATAR_SRC)
    .resize(D, D, { fit: 'cover', position: sharp.strategy.attention })
    .ensureAlpha()
    .composite([{
        input: Buffer.from(`<svg width="${D}" height="${D}"><circle cx="${D / 2}" cy="${D / 2}" r="${D / 2 - 4}" fill="#fff"/></svg>`),
        blend: 'dest-in',
    }])
    .png().toBuffer();

const avatarRing = Buffer.from(
    `<svg width="${D}" height="${D}"><circle cx="${D / 2}" cy="${D / 2}" r="${D / 2 - 2}" fill="none" stroke="${INK}" stroke-width="5"/></svg>`
);

await sharp(cloudPng)
    .composite([
        { input: avatarCircle, left: Math.round(CLOUD_W / 2 - D / 2), top: Math.round(CLOUD_H * 0.05) },
        { input: avatarRing, left: Math.round(CLOUD_W / 2 - D / 2), top: Math.round(CLOUD_H * 0.05) },
    ])
    .webp({ quality: 92, alphaQuality: 90 })
    .toFile(path.join(OUT, 'awatarnachmurce.webp'));

console.log('✅ 关于房间 3 张自绘贴图已生成：uowyspa / freelancewyspa（浮岛+空白横幅）· awatarnachmurce（云+此唯头像画框）');
