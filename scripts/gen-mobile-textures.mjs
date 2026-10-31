/**
 * 生成移动端贴图变体
 * ---------------------------------------------------------------
 * 触屏设备用 `xxx-mobile.webp`：封面 512px 宽，房间贴图 768px 宽。
 * 同时生成 src/config/mobileTextureManifest.js，供运行期判断哪些图有变体。
 *
 * 用法：node scripts/gen-mobile-textures.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const PUB = 'public';
const MANIFEST = 'src/config/mobileTextureManifest.js';
const manifestOnly = process.argv.includes('--manifest-only');
const TARGETS = [
    // 封面：屏幕上的侧屏卡片实际投影不到 200px，448 足够，再大会白花带宽
    { dir: 'covers', width: 448 },
    { dir: 'textures', width: 768, recurse: true },
];

const walk = (dir, recurse) => {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (recurse) out.push(...walk(file, true));
        } else if (
            entry.name.toLowerCase().endsWith('.webp') &&
            !entry.name.endsWith('-mobile.webp') &&
            fs.statSync(file).size >= 1024
        ) {
            out.push(file);
        }
    }
    return out;
};

const manifest = [];
let generated = 0;
let skipped = 0;

for (const target of TARGETS) {
    const root = path.join(PUB, target.dir);
    for (const file of walk(root, target.recurse)) {
        const meta = await sharp(file).metadata();
        if (!meta.width || meta.width <= target.width) {
            skipped += 1;
            continue;
        }
        const out = file.replace(/\.webp$/i, '-mobile.webp');
        const publicPath = '/' + file.replace(/\\/g, '/').replace(/^public\//, '');
        if (manifestOnly) {
            // 只重建清单：已有变体且确实比原图小的才登记
            if (fs.existsSync(out) && fs.statSync(out).size < fs.statSync(file).size) manifest.push(publicPath);
            continue;
        }
        await sharp(file)
            .resize({ width: target.width, withoutEnlargement: true })
            .webp({ quality: 78, effort: 6 })
            .toFile(out);
        // 重编码未必更小：变体反而更大时丢弃，让 smallSrc 回退到原图
        if (fs.statSync(out).size >= fs.statSync(file).size) {
            fs.unlinkSync(out);
            skipped += 1;
            continue;
        }
        manifest.push(publicPath);
        generated += 1;
    }
}

const body = `/**
 * 移动端贴图变体清单（自动生成，请勿手改）
 * 由 scripts/gen-mobile-textures.mjs 生成。
 * 触屏设备加载 base 路径对应的 -mobile.webp，桌面仍用原图。
 */
export const MOBILE_TEXTURES = [
${[...new Set(manifest)].sort().map((url) => `    '${url}',`).join('\n')}
];
`;

fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, body, 'utf8');

console.log(`mobile textures: ${generated} generated, ${skipped} skipped`);
