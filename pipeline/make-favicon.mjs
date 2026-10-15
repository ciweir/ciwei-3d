/**
 * 生成此唯站点 favicon（手绘纸底 + 墨线「此」字）
 * ---------------------------------------------------------------
 * 用法：node pipeline/make-favicon.mjs
 * 输出：public/favico.png（32×32 与 512×512 各写一份，ICO 由 <link> 自动选）
 *      public/apple-touch-icon.png（180×180）
 * 依赖：sharp + Noto Sans SC 完整字体（构建期）
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const INK = '#1a1a1a';
const fontFile = path.resolve('pipeline/fonts-source/NotoSansSC-full.ttf');
const fontOption = fs.existsSync(fontFile) ? { font: fontFile } : {};

const OUT = 'public';

function faviconSvg(S) {
    const r = S * 0.08;           // 圆角半径
    const cx = S / 2, cy = S / 2;
    const size = S * 0.66;        // 字号
    const pad = S * 0.06;         // 内边距

    // 纸底 + 手绘边框
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
        <rect x="0" y="0" width="${S}" height="${S}" rx="${r}" fill="#f5f0e6"/>
        <rect x="${pad}" y="${pad}" width="${S - pad * 2}" height="${S - pad * 2}" rx="${r * 0.8}" fill="none" stroke="${INK}" stroke-width="${S * 0.045}"/>
        <text x="${cx}" y="${cy}" font-family="Noto Sans SC" font-size="${size}" font-weight="700" fill="${INK}" text-anchor="middle" dominant-baseline="central">此</text>
    </svg>`;
}

// 生成 32 / 180 / 512 三档
for (const [size, out] of [[32, 'favico.png'], [180, 'apple-touch-icon.png'], [512, 'favico-512.png']]) {
    await sharp(Buffer.from(faviconSvg(size)), fontOption).png().toFile(path.join(OUT, out));
}
console.log('✅ favicon 已生成：favico.png(32) · apple-touch-icon.png(180) · favico-512.png(512)');
