/**
 * 作品卡封面资产（P0 · 2026-10-13）
 * ---------------------------------------------------------------
 * 输入：public/covers/<slug>.jpg（真实视频截图，由 scripts/export-ciwei.mjs 复制）
 * 输出：public/covers/<slug>.webp          上色版（彩色 · 规格化 3:4）
 *       public/covers/<slug>-sketch.webp   素描版（铅笔 · 同源同构图）
 *
 * 用途：画廊卡片「悬停上色」（PaintReveal）——
 *       front（素描）→ hover 800ms 揭示 painted（彩色）。
 *
 * 配方（交接文档 §8.2 · 照片/大块剪影类，非线稿提线法）：
 *   明暗层 = 灰度 normalise → linear(0.34,166)     （暗部→浅灰，亮部→纸白）
 *   墨线层 = normalise → blur(1.2) → 拉普拉斯卷积 [0,-1,0,-1,4,-1,0,-1,0]
 *            → threshold(30) → negate
 *   合成   = multiply
 *
 * ⚠️ 两段式铁律：sharp 管线实际执行顺序 ≠ 调用顺序，
 *    normalise 必须先出 buffer，再对新 buffer 做 linear，否则提亮失效。
 *
 * 用法（itom-study 根目录）：node pipeline/make-covers.mjs
 */
import sharp from 'sharp';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const COVERS = path.resolve('public/covers');
const W = 768;
const H = 1024; // 卡片面片 1.5 × 2 = 3:4（竖版纸卡）

if (!existsSync(COVERS)) {
  console.error('未找到 public/covers 目录');
  process.exit(1);
}

const files = readdirSync(COVERS).filter((f) => f.endsWith('.jpg'));
if (!files.length) {
  console.error('未找到 public/covers/*.jpg —— 请先运行 scripts/export-ciwei.mjs');
  process.exit(1);
}

let ok = 0;
for (const f of files) {
  const slug = f.replace(/\.jpg$/, '');
  const src = path.join(COVERS, f);

  // ① 几何基准：cover 裁到 3:4（智能取景，两版共用 → 构图 100% 对齐）
  const base = await sharp(src)
    .resize(W, H, { fit: 'cover', position: sharp.strategy.attention })
    .png()
    .toBuffer();

  // ② 上色版（彩色原图规格化）
  await sharp(base).webp({ quality: 85 }).toFile(path.join(COVERS, `${slug}.webp`));

  // ③ 素描版
  //   明暗层：normalise 出 buffer → 再 linear（两段式）
  const toneNorm = await sharp(base).grayscale().normalise().toBuffer();
  const tone = await sharp(toneNorm).linear(0.34, 166).png().toBuffer();

  //   墨线层：normalise → blur → 拉普拉斯卷积 → threshold → negate
  //   ⚠️ 每一步都必须独立出 buffer——sharp 会把同一条链里的
  //      threshold/negate 重排（negate 先执行 → 输出反相为黑底白线），
  //      此坑与「normalise → linear」同族，属两段式铁律。
  const lineNorm = await sharp(base).grayscale().normalise().blur(1.2).toBuffer();
  const lineConv = await sharp(lineNorm)
    .convolve({ width: 3, height: 3, kernel: [0, -1, 0, -1, 4, -1, 0, -1, 0] })
    .toBuffer();
  const lineThr = await sharp(lineConv).threshold(18).toBuffer();
  const line = await sharp(lineThr).negate().png().toBuffer();

  //   合成：明暗 × 墨线
  await sharp(tone)
    .composite([{ input: line, blend: 'multiply' }])
    .webp({ quality: 85 })
    .toFile(path.join(COVERS, `${slug}-sketch.webp`));

  ok++;
  console.log('✓', slug);
}

console.log(`完成：${ok} 组（上色 + 素描）→ public/covers/`);