/**
 * 头像帧（欢迎区 Avatar 面片 9 帧）—— 原图直出
 * ---------------------------------------------------------------
 * 2026-10-13（用户指令）：头像直接使用原图，**不允许修改**
 *   —— 不做素描/灰度/调色，只做帧槽必需的等比缩放（640×640 cover）
 *   与 webp 封装；同图写满 9 帧（动画系统不动 = 静态满铺）。
 *
 * 输入：pipeline/avatar-src-2.jpg（用户提供）
 * 输出：public/textures/corridor/avatar_anim/1..9.webp
 *
 * 用法（itom-study 根目录）：node pipeline/make-avatar.mjs [源文件]
 */
import sharp from 'sharp';
import path from 'node:path';

const SRC = process.argv[2] || 'pipeline/avatar-src-2.jpg';
const SIZE = 640;
const OUT = path.resolve('public/textures/corridor/avatar_anim');

// 仅等比缩放满铺 + 高质量 webp；保留原色，不做任何画面处理
const frame = await sharp(SRC)
  .resize(SIZE, SIZE, { fit: 'cover', position: sharp.strategy.attention })
  .webp({ quality: 92 })
  .toBuffer();

for (let i = 1; i <= 9; i++) {
  await sharp(frame).toFile(path.join(OUT, `${i}.webp`));
}
console.log(`✓ 头像（原图直出）9 帧已写入 ${path.relative(process.cwd(), OUT)}（${SIZE}×${SIZE}）`);