/**
 * 工作室展示数据（单一数据源）
 * ---------------------------------------------------------------
 * 文案与媒体全部由 ciwei-projects.json（数据桥产出）派生，
 * 本文件只做「分类 → 设备形态」的 UI 映射，不再另存一份手写文案。
 *
 * 设备形态决定显示器形状：tv 横屏 ／ monitor 桌面 ／ phone 竖屏。
 */
import ciweiProjects from './ciwei-projects.json';

// 分类 → 设备形态
const DEVICE_BY_CATEGORY = {
    产品片: 'tv',
    快剪: 'tv',
    直播切片: 'tv',
    探店: 'tv',
    口播: 'phone',
    信息流: 'monitor',
};

// 设备形态 → 平台标识（沿用既有 UI 语汇：视频平台 / 图文 / 短视频）
const PLATFORM_BY_DEVICE = {
    tv: 'youtube',
    monitor: 'blog',
    phone: 'tiktok',
};

const DEFAULT_DEVICE = 'tv';

export const STUDIO_SHOWCASE = ciweiProjects.map((p) => {
    const device = DEVICE_BY_CATEGORY[p.category] || DEFAULT_DEVICE;
    // 保留线稿/彩色两版：Studio 屏幕放映彩色成片，缺彩色版时回退线稿
    const cover = p.front || p.painted;
    return {
        ...p,
        device,
        platform: PLATFORM_BY_DEVICE[device],
        frontTexture: cover,
        paintedFrontTexture: p.painted || cover,
        date: p.year ? `${p.year}-01-01` : '',
    };
});
