/* 成就定义（2026-10-15 从 AchievementsContext.jsx 拆出）：
   常量与组件同文件导出同样会破坏 Fast Refresh 边界。 */
export const ACHIEVEMENTS = {
    // 中文化（2026-10-12）：操作说明要看得懂，成就名保留一点游戏感
    corridor_enter: { id: 'corridor_enter', label: '点击一扇门进入', title: '探索者' },
    corridor_explore: { id: 'corridor_explore', label: '滚动滚轮，沿走廊前行', title: '漫游者' },
    about_fly: { id: 'about_fly', label: '滚动滚轮，飞过我的故事', title: '行者' },
    studio_interact: { id: 'studio_interact', label: '拖动旋转，浏览内容', title: '导演' },
    gallery_inspect: { id: 'gallery_inspect', label: '点击作品，查看详情', title: '鉴赏家' },
    contact_choose: { id: 'contact_choose', label: '找到一种联系方式', title: '社交达人' }
};
