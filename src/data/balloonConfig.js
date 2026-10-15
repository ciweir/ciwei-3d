/**
 * 技能气球配置（单一来源）
 * ---------------------------------------------------------------
 * 被两处共用：
 *   · pipeline/make-balloons.mjs —— 构建期据此生成 webp 贴图
 *   · InfiniteSkyManager.jsx —— 运行期据此摆放气球、推导贴图路径
 *
 * 改这里即可：加/删气球、改标签文案、位置、配色；
 * 改完重跑 `node pipeline/make-balloons.mjs` 重新生成贴图。
 *
 * 字段说明：
 *   id     文件名（ASCII，供 URL 使用）
 *   label  气球上的文字；空串 = 无字装饰气球
 *   size   large / medium / small（影响 world 尺寸倍率，见 SIZE_MULTIPLIERS）
 *   aspect 宽高比（宽/高），几何与贴图尺寸一致
 *   hue    配色索引（0 雾蓝 / 1 灰青 / 2 赭黄 / 3 石板），painted 版生效
 *   x/y/z/phase 世界位置与浮动相位
 */
export const BALLOON_CONFIG = [
    // 大号气球（核心技能）——正面居中
    { id: 'editing', label: '剪辑', size: 'large', aspect: 0.55, hue: 0, x: -2.5, y: 2, z: 0.3, phase: 0 },
    { id: 'shooting', label: '拍摄', size: 'large', aspect: 0.55, hue: 1, x: 2.5, y: 2.5, z: 0.2, phase: 1.5 },
    { id: 'grading', label: '调色', size: 'large', aspect: 0.55, hue: 2, x: 0, y: 3, z: 0.5, phase: 3 },

    // 中号气球——环绕散布
    { id: 'ops', label: '运营', size: 'medium', aspect: 0.52, hue: 3, x: -4, y: 1, z: -0.3, phase: 0.8 },
    { id: 'decor-1', label: '', size: 'medium', aspect: 0.52, hue: 1, x: 4, y: 1.5, z: -0.2, phase: 2.2 },
    { id: 'decor-2', label: '', size: 'medium', aspect: 0.52, hue: 0, x: 0, y: 0.5, z: -0.4, phase: 4 },

    // 小号气球——背景点缀
    { id: 'decor-3', label: '', size: 'small', aspect: 0.48, hue: 2, x: -5.5, y: 2.5, z: -0.8, phase: 1.2 },
    { id: 'decor-4', label: '', size: 'small', aspect: 0.48, hue: 3, x: 5.5, y: 3, z: -0.7, phase: 2.8 },
    { id: 'decor-5', label: '', size: 'small', aspect: 0.48, hue: 1, x: -3, y: 4.5, z: -0.5, phase: 3.5 },
    { id: 'decor-6', label: '', size: 'small', aspect: 0.48, hue: 0, x: 3.5, y: 4, z: -0.6, phase: 4.5 },
];

/* 生成贴图的存放目录（web 相对根路径的父目录） */
export const BALLOON_TEXTURE_DIR = 'public/textures/about/balloons';
export const BALLOON_URL_PREFIX = '/textures/about/balloons';

/* 贴图路径推导（构建期与运行期共用，保证两边永远一致） */
export const balloonSketchUrl = (config) => `${BALLOON_URL_PREFIX}/${config.id}_sketch.webp`;
export const balloonPaintedUrl = (config) => `${BALLOON_URL_PREFIX}/${config.id}_painted.webp`;
