/**
 * 构建期生成入口「窗口头像」贴图（SVG → sharp → webp）
 * ---------------------------------------------------------------
 * 替换 ITom 的卡通头像占位：手绘窗格框 + 此唯真实头像（原图直出、
 * 圆形画框，照片不调色）。与 awatarnachmurce（云上头像）同一处理原则。
 *
 * 输出：public/textures/entrance/avatar_window.webp（1024×1024 透明底）
 * 用法：node pipeline/make-window-avatar.mjs
 * 依赖：sharp + Noto Sans SC 完整字体（构建期）
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const INK = '#1a1a1a';
const S = 1024; // 输出边长（与原图 1024×1024 一致）
const fontFile = path.resolve('pipeline/fonts-source/NotoSansSC-full.ttf');
const fontOption = fs.existsSync(fontFile) ? { font: fontFile } : {};
const AVATAR_SRC = 'pipeline/avatar-src-2.jpg'; // 此唯真实头像（用户提供）

/* 手绘窗格框：外框 + 十字窗棂，墨线抖动 */
function windowFrameSvg(size) {
    const w = size;
    const pad = w * 0.08;        // 外边距
    const fx = pad, fy = pad;    // 框起点
    const fw = w - pad * 2, fh = w - pad * 2; // 框宽高
    const lw = 5;                // 线宽

    // 抖动路径：沿矩形边框走一圈，采样点加微小随机偏移
    function jitterRect(x, y, ww, hh, step) {
        let d = '';
        const pts = [];
        for (let i = 0; i <= step; i++) pts.push([x + (ww * i) / step, y]);
        for (let i = 1; i <= step; i++) pts.push([x + ww, y + (hh * i) / step]);
        for (let i = 1; i <= step; i++) pts.push([x + ww - (ww * i) / step, y + hh]);
        for (let i = 1; i <= step; i++) pts.push([x, y + hh - (hh * i) / step]);
        d = 'M' + pts.map(([px, py], idx) => {
            const jx = (Math.sin(idx * 12.9898) * 43758.5453 % 1) * 4 - 2;
            const jy = (Math.cos(idx * 78.233) * 12345.6789 % 1) * 4 - 2;
            return `${(px + jx).toFixed(1)} ${(py + jy).toFixed(1)}`;
        }).join(' L');
        return d + ' Z';
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}" viewBox="0 0 ${w} ${w}">
        <g stroke="${INK}" fill="none" stroke-linejoin="round" stroke-linecap="round">
            <!-- 外框（双线） -->
            <path d="${jitterRect(fx, fy, fw, fh, 40)}" stroke-width="${lw}"/>
            <path d="${jitterRect(fx + 8, fy + 8, fw - 16, fh - 16, 36)}" stroke-width="${lw * 0.6}" stroke-opacity="0.6"/>
            <!-- 十字窗棂 -->
            <path d="${jitterRect(fx + fw / 2 - 4, fy, 8, fh, 30)}" stroke-width="${lw * 0.8}"/>
            <path d="${jitterRect(fx, fy + fh / 2 - 4, fw, 8, 30)}" stroke-width="${lw * 0.8}"/>
            <!-- 四角装饰小圆 -->
            ${[[fx + 14, fy + 14], [fx + fw - 14, fy + 14], [fx + 14, fy + fh - 14], [fx + fw - 14, fy + fh - 14]]
                .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${INK}" stroke="none"/>`).join('')}
        </g>
    </svg>`;
}

/* 主流程 */
const framePng = await sharp(Buffer.from(windowFrameSvg(S)), fontOption).png().toBuffer();

// 此唯头像：圆形裁切（照片直出不调色）
const D = Math.round(S * 0.58); // 头像圆直径（占窗格中部约 58%）
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

// 头像居中放在窗格十字正中（覆盖十字焦点区域，形成「人在窗口后」的感觉）
const left = Math.round((S - D) / 2);
const top = Math.round((S - D) / 2);

await sharp(framePng)
    .composite([
        { input: avatarCircle, left, top },
        { input: avatarRing, left, top },
    ])
    .webp({ quality: 92, alphaQuality: 90 })
    .toFile('public/textures/entrance/avatar_window.webp');

console.log('✅ 入口窗口头像已生成：手绘窗格框 + 此唯真实头像（照片直出，不调色）');
