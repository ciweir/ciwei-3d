/**
 * 全站彩色模式（桌面端默认彩色）
 * ---------------------------------------------------------------
 * 现状：贴图成对存在 —— `<name>.webp` / `<name>_sketch.webp`（线稿）
 *       与 `<name>_painted.webp`（彩色）。但绝大多数材质只挂了线稿，
 *       彩色版仅在悬停/入场揭示时才短暂出现，于是整站看起来仍是铅笔稿。
 *
 * 策略：桌面端（支持 hover）把线稿「透明地」换成彩色版，触摸设备维持线稿
 *       —— 与 texturePreloadList.filterTexturesByDevice 的内存策略一致
 *       （手机跳过 _painted，省内存）。
 *
 * paintedSrc() 只在彩色版确实存在时才替换，因此头像逐帧（avatar_anim）、
 * 作品卡 covers、以及任何未配对的贴图都会原样返回，不会产生 404。
 */
import { useTexture } from '@react-three/drei';
import { isTouchDevice } from './deviceDetect';
import { PAINTED_TEXTURES } from '../config/texturePreloadList';

const PAINTED_SET = new Set(PAINTED_TEXTURES);

/** 是否默认显示彩色版（桌面端为真，触摸设备为假） */
export const COLOR_DEFAULT = !isTouchDevice();

/** 线稿 URL → 彩色版 URL；无对应彩色版、已是对彩色版、非 .webp（含 data: 占位）时原样返回 */
export const paintedSrc = (src) => {
  if (!COLOR_DEFAULT || typeof src !== 'string') return src;
  if (!src.endsWith('.webp') || src.endsWith('_painted.webp')) return src;
  const cand = src.replace(/_sketch\.webp$/i, '.webp').replace(/\.webp$/i, '_painted.webp');
  return PAINTED_SET.has(cand) ? cand : src;
};

/**
 * useTexture 的彩色化包装：入参形态与 drei 的 useTexture 一致
 * （字符串 / 字符串数组 / { key: url } 对象），内部按 paintedSrc 改写。
 */
export const useColorTexture = (input, ...rest) => {
  const resolved =
    typeof input === 'string'
      ? paintedSrc(input)
      : Array.isArray(input)
        ? input.map(paintedSrc)
        : input && typeof input === 'object'
          ? Object.fromEntries(Object.keys(input).map((key) => [key, paintedSrc(input[key])]))
          : input;
  return useTexture(resolved, ...rest);
};

// 透传 drei useTexture 的静态预载方法（App.jsx 模块级预载依赖 useTexture.preload）
useColorTexture.preload = (src) => useTexture.preload(paintedSrc(src));
