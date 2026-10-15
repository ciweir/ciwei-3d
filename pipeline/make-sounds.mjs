/**
 * 环境音减重（音效管线）
 * ---------------------------------------------------------------
 * 背景：4 个房间的 PositionalAudio 环境底噪原始体积合计 6.9 MB
 *   （画廊·城市声 / 工作室·设备声 / 联系·海浪声 / 关于·风声），
 *   环境噪声对音质不敏感，可降码率瘦身。
 *
 * 两条关键约束（勿违反）：
 *   1. 保持 MP3 格式与文件名不变 —— 不转 OGG。站内唯一的 .ogg 是背景音乐，
 *      Safari 对 OGG 支持差，把环境音转成 OGG 会给 Safari 用户引入静音 bug；
 *      文件名不变，src 中所有硬编码路径即零改动。
 *   2. 单声道。这些音源是 PositionalAudio（3D 定位音），
 *      单声道才能被 PannerNode 正确空间化，立体声反而破坏定位感。
 *
 * 用法（itom-study 根目录）：
 *   node pipeline/make-sounds.mjs            # 探测当前规格，不改文件
 *   node pipeline/make-sounds.mjs --convert  # 归档原件并原地转码
 * 依赖：ffmpeg-static（devDependency）
 */
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, existsSync, statSync, renameSync, unlinkSync } from 'node:fs';
import path from 'node:path';

// 环境音转码目标码率（单声道）。环境噪声对音质不敏感，80k 足够。
const AMBIENT_BITRATE = 80;

const SOUNDS_DIR = path.resolve('public/sounds');
const ARCHIVE_DIR = path.resolve('_archive_20261015/sounds-original');

const FILES = [
    { name: 'szummiasta.mp3', kind: 'ambient', note: '画廊 · 城市声' },
    { name: 'szummonitorow.mp3', kind: 'ambient', note: '工作室 · 设备底噪' },
    { name: 'szummorza.mp3', kind: 'ambient', note: '联系 · 海浪声' },
    { name: 'szumwiatru.mp3', kind: 'ambient', note: '关于 · 风声' },
    { name: 'cfl_turningpages-belem-breeze-487596.ogg', kind: 'music', note: '背景音乐' },
];

const kb = (p) => statSync(p).size / 1024;

/** 用 ffmpeg -i 读取流信息（信息输出到 stderr） */
function probe(file) {
    let out = '';
    try {
        execFileSync(ffmpegPath, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (e) {
        out = (e.stderr || '').toString();
    }
    const dur = out.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
    const aud = out.match(/Audio:\s*([^,]+),\s*(\d+) Hz,\s*([^,]+),\s*[^,]*,\s*(\d+) kb\/s/);
    const secs = dur ? (+dur[1]) * 3600 + (+dur[2]) * 60 + parseFloat(dur[3]) : 0;
    return {
        durationSec: Math.round(secs),
        duration: dur ? `${dur[1]}:${dur[2]}:${String(dur[3]).padStart(4, '0')}` : '?',
        codec: aud ? aud[1].trim() : '?',
        sampleRate: aud ? +aud[2] : 0,
        channels: aud ? aud[3].trim() : '?',
        bitrate: aud ? +aud[4] : 0,
    };
}

const convert = process.argv.includes('--convert');
if (convert) mkdirSync(ARCHIVE_DIR, { recursive: true });

console.log(`环境音减重${convert ? '（转码模式）' : '（探测模式，不改文件）'}`);
console.log(`目标码率：单声道 ${AMBIENT_BITRATE} kbps\n`);
console.log('文件'.padEnd(34) + '说明'.padEnd(20) + '时长'.padEnd(9) + '原码率'.padEnd(9) + '声道'.padEnd(9) + '体积');
console.log('-'.repeat(95));

let totalBefore = 0;
let totalAfter = 0;

for (const f of FILES) {
    const src = path.join(SOUNDS_DIR, f.name);
    if (!existsSync(src)) {
        console.log(`${f.name}  —— 文件缺失，跳过`);
        continue;
    }
    const info = probe(src);
    const before = kb(src);
    totalBefore += before;

    let after = before;
    let mark = '';
    if (convert && f.kind === 'ambient') {
        // ① 归档原件（软处置：不硬删）
        copyFileSync(src, path.join(ARCHIVE_DIR, f.name));
        // ② 原地转码：单声道 + 目标码率，元数据清空
        const tmp = path.join(SOUNDS_DIR, `_tmp_${f.name}`);
        execFileSync(ffmpegPath, [
            '-hide_banner', '-loglevel', 'error', '-y',
            '-i', src,
            '-vn', '-ac', '1', '-ar', '44100',
            '-c:a', 'libmp3lame', '-b:a', `${AMBIENT_BITRATE}k`,
            '-map_metadata', '-1',
            tmp,
        ], { stdio: ['ignore', 'ignore', 'pipe'] });
        unlinkSync(src);
        renameSync(tmp, src);
        after = kb(src);
        mark = `  ← 已转码（省 ${Math.round((1 - after / before) * 100)}%）`;
    } else if (f.kind === 'music') {
        mark = '  ← 音乐，暂不转码（保音质）';
    }
    totalAfter += after;

    console.log(
        f.name.padEnd(34) +
        f.note.padEnd(20) +
        (info.duration + 's').padEnd(9) +
        (info.bitrate + 'k').padEnd(9) +
        info.channels.padEnd(9) +
        `${before.toFixed(0)} KB` +
        mark
    );
}

console.log('-'.repeat(95));
console.log(`合计：${(totalBefore / 1024).toFixed(2)} MB → ${(totalAfter / 1024).toFixed(2)} MB` +
    (convert ? `（省 ${((totalBefore - totalAfter) / 1024).toFixed(2)} MB）` : ''));
if (convert) console.log(`原件已归档：${path.relative(process.cwd(), ARCHIVE_DIR)}/`);
