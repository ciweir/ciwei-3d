import fs from 'node:fs';
import zlib from 'node:zlib';
import { collectSansText, collectSerifText, collectSceneText } from './font-text.mjs';

/* 只检查正文类型字符，避免源码里的罕见符号造成假阳性。 */
const CHECKED = /[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/g;

function readWoffTable(file, wanted) {
    const buf = fs.readFileSync(file);
    if (buf.toString('ascii', 0, 4) !== 'wOFF') {
        throw new Error(`not a WOFF file: ${file}`);
    }
    const count = buf.readUInt16BE(12);
    for (let i = 0; i < count; i += 1) {
        const p = 44 + i * 20;
        const tag = buf.toString('ascii', p, p + 4);
        if (tag !== wanted) continue;
        const offset = buf.readUInt32BE(p + 4);
        const compLength = buf.readUInt32BE(p + 8);
        const origLength = buf.readUInt32BE(p + 12);
        const data = buf.subarray(offset, offset + compLength);
        return compLength < origLength ? zlib.inflateSync(data) : data;
    }
    throw new Error(`missing ${wanted} table: ${file}`);
}

function cmapChars(file) {
    const cmap = readWoffTable(file, 'cmap');
    const count = cmap.readUInt16BE(2);
    const records = [];
    for (let i = 0; i < count; i += 1) {
        const p = 4 + i * 8;
        records.push({
            platform: cmap.readUInt16BE(p),
            encoding: cmap.readUInt16BE(p + 2),
            offset: cmap.readUInt32BE(p + 4),
        });
    }

    const chosen = records.find((r) => r.platform === 3 && r.encoding === 10)
        || records.find((r) => r.platform === 0 && cmap.readUInt16BE(r.offset) === 12)
        || records.find((r) => r.platform === 3 && r.encoding === 1)
        || records[0];
    if (!chosen) throw new Error(`empty cmap: ${file}`);

    const p = chosen.offset;
    const format = cmap.readUInt16BE(p);
    const chars = new Set();

    if (format === 12) {
        const groups = cmap.readUInt32BE(p + 12);
        for (let i = 0; i < groups; i += 1) {
            const q = p + 16 + i * 12;
            const start = cmap.readUInt32BE(q);
            const end = cmap.readUInt32BE(q + 4);
            for (let cp = start; cp <= end; cp += 1) chars.add(String.fromCodePoint(cp));
        }
        return chars;
    }

    if (format === 4) {
        const segCount = cmap.readUInt16BE(p + 6) / 2;
        const endBase = p + 14;
        const startBase = endBase + segCount * 2 + 2;
        const deltaBase = startBase + segCount * 2;
        const rangeBase = deltaBase + segCount * 2;
        for (let i = 0; i < segCount; i += 1) {
            const end = cmap.readUInt16BE(endBase + i * 2);
            const start = cmap.readUInt16BE(startBase + i * 2);
            const delta = cmap.readInt16BE(deltaBase + i * 2);
            const rangeOffset = cmap.readUInt16BE(rangeBase + i * 2);
            for (let cp = start; cp <= end && cp !== 0xffff; cp += 1) {
                let glyph;
                if (rangeOffset === 0) {
                    glyph = (cp + delta) & 0xffff;
                } else {
                    const glyphAddress = rangeBase + i * 2 + rangeOffset + (cp - start) * 2;
                    glyph = cmap.readUInt16BE(glyphAddress);
                    if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
                }
                if (glyph !== 0) chars.add(String.fromCodePoint(cp));
            }
        }
        return chars;
    }

    throw new Error(`unsupported cmap format ${format}: ${file}`);
}

function neededChars(text) {
    return new Set(text.match(CHECKED) || []);
}

let failed = false;
for (const [font, text] of [
    ['public/fonts/NotoSansSC.woff', collectSansText()],
    ['public/fonts/NotoSerifSC-Headings.woff', collectSerifText()],
    ['public/fonts/NotoSansSC-3D.woff', collectSceneText()],
    ['public/fonts/NotoSerifSC-Headings-3D.woff', collectSerifText()],
]) {
    const needs = neededChars(text);
    const available = cmapChars(font);
    const missing = [...needs].filter((ch) => !available.has(ch)).sort();
    console.log(`${font}: glyphs=${available.size}, checked=${needs.size}, missing=${missing.length}`);
    if (missing.length) {
        failed = true;
        console.error(`  missing: ${missing.join('')}`);
    }
}

if (failed) process.exit(1);
