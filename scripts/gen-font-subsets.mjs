/**
 * 生成网页字体
 * ---------------------------------------------------------------
 * Noto Sans / Noto Serif：从完整本地源字体按项目实际字符重建子集，
 * 再转成 WOFF。完整源字体位于被 Git 忽略的 pipeline/fonts-source/。
 * Cabin Sketch / Rubik Scribble：只保留项目实际用到的拉丁字符，再转 WOFF。
 *
 * 页面只引用 .woff；同目录 .ttf 是当前子集的可读源，便于复查。
 * 用法：npm run gen:fonts（生成后自动审计字形覆盖）
 */
import fs from 'node:fs';
import path from 'node:path';
import subsetFont from 'subset-font';
import { collectSansText, collectSerifText } from './font-text.mjs';

const FONT_DIR = 'public/fonts';
const SOURCE_DIR = 'pipeline/fonts-source';

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

/* 中文正文字体：完整扫描源码与数据，宁可有少量注释冗余，也不让运行期缺字。 */
const fullSansSource = path.join(SOURCE_DIR, 'NotoSansSC-full.ttf');
const sansText = collectSansText();
const sansTtfPath = path.join(FONT_DIR, 'NotoSansSC.ttf');
if (fs.existsSync(fullSansSource)) {
    const full = fs.readFileSync(fullSansSource);
    const subsetTtf = await subsetFont(full, sansText, { targetFormat: 'truetype' });
    fs.writeFileSync(sansTtfPath, subsetTtf);
    totalIn += full.length;
} else {
    console.warn(`missing full font source: ${fullSansSource}; reusing ${sansTtfPath}`);
}

/* 衬线标题：只覆盖项目标题、分类、固定栏目与按钮，不把正文塞进标题字体。 */
const fullSerifSource = path.join(SOURCE_DIR, 'NotoSerifSC-full.ttf');
const serifText = collectSerifText();
const serifTtfPath = path.join(FONT_DIR, 'NotoSerifSC-Headings.ttf');
if (fs.existsSync(fullSerifSource)) {
    const full = fs.readFileSync(fullSerifSource);
    const subsetTtf = await subsetFont(full, serifText, { targetFormat: 'truetype' });
    fs.writeFileSync(serifTtfPath, subsetTtf);
    totalIn += full.length;
} else {
    console.warn(`missing full font source: ${fullSerifSource}; reusing ${serifTtfPath}`);
}

const INPUTS = [
    { file: 'NotoSansSC.ttf', keepAll: true },
    { file: 'NotoSerifSC-Headings.ttf', keepAll: true },
    { file: 'CabinSketch-Bold.ttf', keepAll: false },
    { file: 'CabinSketch-Regular.ttf', keepAll: false },
    { file: 'RubikScribble-Regular.ttf', keepAll: false },
];

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
