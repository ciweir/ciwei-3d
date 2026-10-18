/**
 * 站点信息与社交账号 · 单一配置来源
 * ---------------------------------------------------------------
 * 被两处共用：
 *   · src/（运行期）：将来联系房间 SocialBarrel、导航外链等直接引用
 *   · seo-plugin.js（构建期）：生成 JSON-LD 的 Person/WebSite/@id、
 *     VideoObject 的绝对 URL、llms.txt
 *
 * 修改本文件即全站生效，无需改多处。
 *
 * ── 待填清单（见同目录 seo-config.template.md 详细说明）──────
 *   1. SITE.url          —— 正式域名（不含结尾斜杠；部署后必填，
 *                            影响 JSON-LD 全部 @id、canonical、llms.txt）
 *   2. SOCIAL            —— 社交账号主页 URL（留空数组 = 该项不进
 *                            JSON-LD 的 sameAs；只填真实存在的账号）
 * ─────────────────────────────────────────────────────────
 */

export const SITE = {
    title: '此唯 · 视频导演 | 3D 作品集',
    description: "此唯的 3D 作品集世界。作品画廊、工作室、关于与联系，都在一个可以走进去的手绘空间里。",
    aboutMe:
        '我是此唯，一名常驻深圳的视频导演，负责拍摄、剪辑与调色的全流程。六年间为漫步者、小米、德云社、银行机构等客户交付商业影片，也在情感、育儿、医美等垂直自媒体领域长期供稿。',
    // ⚠️ 占位符：部署前必须替换为正式域名（例 'https://www.ciwei.tv'）
    url: 'https://ciwei.example.com',
    author: '此唯',
    jobTitle: '视频导演',
    skills: ['视频导演', '剪辑', '调色', '拍摄', '影像叙事'],
};

/* 社交账号（主页完整 URL，不含结尾斜杠）；留空 = 不输出该项 */
export const SOCIAL = {
    bilibili: '',   // 例 'https://space.bilibili.com/12345678'
    douyin: '',     // 例 'https://www.douyin.com/user/MS4wLjABAAAA...'
    xiaohongshu: '',// 例 'https://www.xiaohongshu.com/user/profile/5f...'
    weibo: '',      // 例 'https://weibo.com/u/1234567890'
    youtube: '',    // 例 'https://www.youtube.com/@ciwei'
    bcc: '',        // 必剪（如启用）
    linkedin: '',   // 如有英文/出海用途
    vimeo: '',      // 例 'https://vimeo.com/ciwei'
    email: '26397767570@qq.com', // 用于 mailto，非 URL
};

/* 从 SOCIAL 提取可用于 JSON-LD sameAs 的 URL 列表（email 除外） */
export function socialUrls(social = SOCIAL) {
    return Object.entries(social)
        .filter(([key, value]) => key !== 'email' && typeof value === 'string' && value.startsWith('http'))
        .map(([, value]) => value);
}
