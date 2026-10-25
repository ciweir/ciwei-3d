/**
 * 生成 WOFF2 网页字体
 * ---------------------------------------------------------------
 * Noto Sans / Noto Serif：保留全部字形（避免 Sanity 动态文案缺字），只转 WOFF2。
 * Cabin Sketch / Rubik Scribble：只保留项目实际用到的拉丁字符，再转 WOFF2。
 *
 * 原始 TTF 保留在 public/fonts，供以后重新生成；页面只引用 .woff。
 * 用法：node scripts/gen-font-subsets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import subsetFont from 'subset-font';

const FONT_DIR = 'public/fonts';
const INPUTS = [
    { file: 'NotoSansSC.ttf', keepAll: true },
    { file: 'NotoSerifSC-Headings.ttf', keepAll: true },
    { file: 'CabinSketch-Bold.ttf', keepAll: false },
    { file: 'CabinSketch-Regular.ttf', keepAll: false },
    { file: 'RubikScribble-Regular.ttf', keepAll: false },
];

const collectLatinSource = () => {
    const files = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const file = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(file);
            else if (/\.(js|jsx|json|html|scss|css)$/i.test(entry.name)) files.push(file);
        }
    };
    walk('src');
    if (fs.existsSync('index.html')) files.push('index.html');

    const chars = new Set();
    for (const file of files) {
        const text = fs.readFileSync(file, 'utf8');
        for (const ch of text) {
            if (!/[\u3400-\u9fff]/.test(ch)) chars.add(ch);
        }
    }
    // 装饰字体只用于英文/数字/常见符号，补齐 ASCII 与排版符号
    for (let code = 32; code <= 126; code += 1) chars.add(String.fromCharCode(code));
    for (const ch of '·—…‘’“”《》【】（）×÷°←→↑↓') chars.add(ch);
    return [...chars].join('');
};

const latinText = collectLatinSource();
let totalIn = 0;
let totalOut = 0;

for (const input of INPUTS) {
    const src = path.join(FONT_DIR, input.file);
    const out = src.replace(/\.ttf$/i, '.woff');
    if (!fs.existsSync(src)) {
        console.warn('skip missing', src);
        continue;
    }
    const buffer = fs.readFileSync(src);
    const subset = await subsetFont(
        buffer,
        input.keepAll ? undefined : latinText,
        {
            targetFormat: 'woff',
            noHinting: !input.keepAll,
            ...(input.keepAll ? { keepAllGlyphs: true } : {}),
        }
    );
    fs.writeFileSync(out, subset);
    totalIn += buffer.length;
    totalOut += subset.length;
    console.log(
        path.basename(out),
        `${Math.round(buffer.length / 1024)}KB -> ${Math.round(subset.length / 1024)}KB`
    );
}

console.log(
    `total ${Math.round(totalIn / 1024)}KB -> ${Math.round(totalOut / 1024)}KB ` +
    `(saved ${Math.round((1 - totalOut / totalIn) * 100)}%)`
);
