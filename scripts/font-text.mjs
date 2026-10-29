import fs from 'node:fs';
import path from 'node:path';

const TEXT_EXT = /\.(?:js|jsx|json|html|scss|css)$/i;

function walk(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const file = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(file) : [file];
    });
}

/* 正文字体覆盖运行期源码与数据中的全部字符；注释也会被收录，
   这是有意的冗余：宁可多几个字形，也不能让 3D 文案静默空白。 */
export function collectSansText(root = '.') {
    const files = [
        ...walk(path.join(root, 'src')),
        path.join(root, 'index.html'),
        path.join(root, 'seo-plugin.js'),
    ].filter((file) => fs.existsSync(file) && TEXT_EXT.test(file));

    const chars = new Set();
    for (const file of files) {
        for (const ch of fs.readFileSync(file, 'utf8')) chars.add(ch);
    }
    return [...chars].join('');
}

/* 衬线只服务标题层级：项目标题、分类、房间名与阅读室固定栏目。
   新增使用 $font-display 的文案时，把固定文字补进 FIXED_HEADINGS。 */
const FIXED_HEADINGS = [
    '此唯',
    '直接聊聊你的项目',
    '项目详情',
    '分类',
    '关于画廊联系工作室地图选择一个房间，推门进入',
    '背景问题过程方案反思结果',
    '阅读室深读档案返回画廊',
    '2D目录影像作品集',
    '部作品',
];

export function collectSerifText(root = '.') {
    const projects = JSON.parse(
        fs.readFileSync(path.join(root, 'src/data/ciwei-projects.json'), 'utf8')
    );
    const parts = [...FIXED_HEADINGS];
    for (const project of projects) {
        if (project.title) parts.push(project.title);
        if (project.category) parts.push(project.category);
        if (project.client) parts.push(project.client);
    }
    return [...new Set(parts.join(''))].join('');
}
