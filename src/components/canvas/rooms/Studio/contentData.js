/**
 * 工作室 UI 配置
 * ---------------------------------------------------------------
 * 展示数据（CONTENT_DATA）由 src/data/studio-showcase.js 单一数据源派生
 * （其来源为 ciwei-projects.json）；本文件只保留设备与平台的外观配置。
 */

export { STUDIO_SHOWCASE as CONTENT_DATA } from '../../../../data/studio-showcase';

export const PLATFORM_CONFIG = {
    youtube: {
        color: '#FF0000',
        accentColor: '#cc0000',
        icon: '▶',
        label: '视频平台',
        shape: 'tv', // Wide CRT style
    },
    blog: {
        color: '#4A90D9',
        accentColor: '#2d6cb5',
        icon: '📝',
        label: '图文',
        shape: 'monitor', // Thin desktop monitor
    },
    tiktok: {
        color: '#00F2EA',
        accentColor: '#FF0050',
        icon: '🎵',
        label: '短视频',
        shape: 'phone', // Vertical phone
    },
};
