import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const problems = [];
let checked = 0;

const shouldSkip = (url) =>
    !url ||
    typeof url !== 'string' ||
    url.startsWith('data:') ||
    url.startsWith('http') ||
    url.startsWith('#') ||
    url.includes('${') ||
    !url.startsWith('/');

const check = (url, label) => {
    if (shouldSkip(url)) return;
    const clean = url.split(/[?#]/)[0];
    checked += 1;
    if (!fs.existsSync(path.join(publicDir, clean.slice(1)))) {
        problems.push(`${label}: ${url}`);
    }
};

const preload = await import(
    pathToFileURL(path.join(root, 'src/config/texturePreloadList.js')).href
);
for (const [name, list] of Object.entries(preload)) {
    if (!Array.isArray(list)) continue;
    for (const url of list) check(url, `preload.${name}`);
}

const projects = JSON.parse(
    fs.readFileSync(path.join(root, 'src/data/ciwei-projects.json'), 'utf8')
);
for (const project of projects) {
    check(project.front, `project.${project.id}.front`);
    check(project.painted, `project.${project.id}.painted`);
    check(project.preview, `project.${project.id}.preview`);
    for (const [index, video] of (project.videos || []).entries()) {
        check(video?.url ?? video, `project.${project.id}.videos[${index}]`);
    }
}

for (const font of [
    'NotoSansSC.ttf',
    'CabinSketch-Bold.ttf',
    'CabinSketch-Regular.ttf',
    'MeowSubset.ttf',
    'RubikScribble-Regular.ttf',
]) {
    check(`/fonts/${font}`, 'font');
}

const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
            ? walk(path.join(dir, entry.name))
            : [path.join(dir, entry.name)]
    );

const files = [
    ...walk(path.join(root, 'src')),
    path.join(root, 'index.html'),
    path.join(root, 'seo-plugin.js'),
].filter((file) => fs.existsSync(file) && /\.(jsx?|scss|html)$/.test(file));

const refPattern =
    /(['"`])(\/(?:textures|media|fonts|images|covers|sounds)\/[^'"`\n]+?\.(?:webp|png|jpe?g|mp4|ttf|woff2?|mp3|ogg))\1/g;

for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(refPattern)) {
        check(match[2], path.relative(root, file));
    }
}

if (problems.length) {
    console.error(`asset audit: ${problems.length} missing of ${checked} refs`);
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
}

console.log(`asset audit: ${checked} refs, 0 missing`);
