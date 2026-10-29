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

/* 注释不会出现在运行期文本里，先剔除再去重字符可以少带一些字形。
   只处理整行 // 注释与块注释，行尾注释保留 —— 宁可少省一点，也不误删字符串内容。 */
function stripComments(text) {
    return text
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/[^\n]*$/gm, '');
}

/* 正文字体覆盖运行期源码与数据中的全部字符。
   注释已剔除；数据文件（如 ciwei-projects.json 的长描述）仍整份收录，
   因为阅读室与浮层会原样渲染它们。 */
export function collectSansText(root = '.') {
    const files = [
        ...walk(path.join(root, 'src')),
        path.join(root, 'index.html'),
        path.join(root, 'seo-plugin.js'),
    ].filter((file) => fs.existsSync(file) && TEXT_EXT.test(file));

    const chars = new Set();
    for (const file of files) {
        for (const ch of stripComments(fs.readFileSync(file, 'utf8'))) chars.add(ch);
    }
    return [...chars].join('');
}

/* 3D 场景字体（troika）只渲染场景内的文字：画布组件里的文案、
   数据源里会被搬上屏幕的字段（项目标题/分类/客户/角色），以及数字与标点。
   项目长描述只会出现在 DOM 阅读室，不进 3D 字体。 */
export function collectSceneText(root = '.') {
    const files = [
        ...walk(path.join(root, 'src/components/canvas')),
        ...walk(path.join(root, 'src/data')).filter((file) => file.endsWith('.js')),
    ].filter((file) => file.endsWith('.js') || file.endsWith('.jsx'));

    const chars = new Set();
    for (const file of files) {
        for (const ch of stripComments(fs.readFileSync(file, 'utf8'))) chars.add(ch);
    }

    const projects = JSON.parse(
        fs.readFileSync(path.join(root, 'src/data/ciwei-projects.json'), 'utf8')
    );
    for (const project of projects) {
        for (const field of ['title', 'category', 'client']) {
            if (project[field]) for (const ch of project[field]) chars.add(ch);
        }
        (project.role || []).forEach((role) => {
            for (const ch of role) chars.add(ch);
        });
        if (project.year) for (const ch of String(project.year)) chars.add(ch);
    }

    for (let code = 32; code <= 126; code += 1) chars.add(String.fromCharCode(code));
    for (const ch of '·—…%％‰′″（）【】《》、，。！？：；“”‘’') chars.add(ch);
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
