import { Suspense, useEffect } from 'react';
import { configureTextBuilder } from 'troika-three-text';
import { Canvas } from '@react-three/fiber';
import { Preload, PerformanceMonitor, useProgress } from '@react-three/drei';
import Experience from './Experience';
import { useScene } from '../../context/useScene';
import { getInitialRoomFromUrl } from '../../hooks/useDocumentMeta';
import ciweiProjects from '../../data/ciwei-projects.json';
import { useColorTexture as useTexture } from '../../utils/colorTexture';
import {
    ENTRANCE_TEXTURES,
    CORRIDOR_TEXTURES,
    UI_TEXTURES,
    GALLERY_TEXTURES,
    STUDIO_TEXTURES,
    ABOUT_TEXTURES,
    CONTACT_TEXTURES,
    filterTexturesByDevice,
} from '../../config/texturePreloadList';

// 文本排版放主线程：避免生产构建下 worker 序列化/字体 URL 解析导致的启动挂起
configureTextBuilder({ useWorker: false });

const supportsHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
const DEEP_LINK_ROOM = getInitialRoomFromUrl();
// 画廊额外依赖：隔断纸纹 + GalleryClouds 的 8 张云（不在生成器的 GALLERY 分组里）
const GALLERY_EXTRA_TEXTURES = [
    '/textures/paper-texture.webp',
    '/textures/paper-texture_painted.webp',
    '/textures/clouds/1131c3eb-dfae-423f-924b-ff39d8ccd6dc.webp',
    '/textures/clouds/1131c3eb-dfae-423f-924b-ff39d8ccd6dc_painted.webp',
    '/textures/clouds/254b8ec8-d6f7-4275-956f-7bab65b2ce2d.webp',
    '/textures/clouds/254b8ec8-d6f7-4275-956f-7bab65b2ce2d_painted.webp',
    '/textures/clouds/2cc88dd1-483c-466d-b07e-f8308c61ccbe.webp',
    '/textures/clouds/2cc88dd1-483c-466d-b07e-f8308c61ccbe_painted.webp',
    '/textures/clouds/5606fcc0-3252-447d-a58a-7bcbac73229a.webp',
    '/textures/clouds/5606fcc0-3252-447d-a58a-7bcbac73229a_painted.webp',
    '/textures/clouds/7882dc72-3d01-41fb-ac0e-d07b0184ebc1.webp',
    '/textures/clouds/7882dc72-3d01-41fb-ac0e-d07b0184ebc1_painted.webp',
    '/textures/clouds/9b2ca72f-7bd0-473b-ba6e-dd9e0eb79d35.webp',
    '/textures/clouds/9b2ca72f-7bd0-473b-ba6e-dd9e0eb79d35_painted.webp',
    '/textures/clouds/c83293c6-d90c-4a32-8d9d-5ac9af7e2296.webp',
    '/textures/clouds/c83293c6-d90c-4a32-8d9d-5ac9af7e2296_painted.webp',
    '/textures/clouds/f6e358bc-d27c-41dd-95f4-6787a835c41e.webp',
    '/textures/clouds/f6e358bc-d27c-41dd-95f4-6787a835c41e_painted.webp',
];
const ROOM_TEXTURES = {
    studio: STUDIO_TEXTURES,
    about: ABOUT_TEXTURES,
    contact: CONTACT_TEXTURES,
};
// 画廊首屏 9 个卡片槽位对应的封面：按 ciwei-projects 顺序插入分类隔断后取首尾
const buildInitialGalleryCovers = () => {
    const slots = [];
    let lastCategory = null;
    ciweiProjects.forEach((project) => {
        if (project.category !== lastCategory) {
            slots.push(null);
            lastCategory = project.category;
        }
        slots.push(project);
    });
    const indices = [
        ...Array.from({ length: Math.min(6, slots.length) }, (_, i) => i),
        ...Array.from({ length: Math.min(3, slots.length) }, (_, i) => slots.length - 1 - i),
    ];
    const urls = new Set();
    indices.forEach((slotIndex) => {
        const project = slots[slotIndex];
        if (!project) {
            urls.add('/textures/paper-texture.webp');
            return;
        }
        if (project.front) urls.add(project.front);
        if (project.painted) urls.add(project.painted);
    });
    return [...urls];
};
const GALLERY_SHARED_TEXTURES = [
    ...GALLERY_TEXTURES.filter((path) => !path.startsWith('/covers/')),
    ...GALLERY_EXTRA_TEXTURES,
    ...buildInitialGalleryCovers(),
];

// 深链直接进房间：只预载目标房间 + 走廊 + UI，不再预载用不到的入口门面
const INITIAL_TEXTURES = DEEP_LINK_ROOM
    ? [
        ...(DEEP_LINK_ROOM === 'gallery'
            ? GALLERY_SHARED_TEXTURES
            : (ROOM_TEXTURES[DEEP_LINK_ROOM] || [])),
        ...CORRIDOR_TEXTURES,
        ...UI_TEXTURES,
    ]
    : [...ENTRANCE_TEXTURES, ...UI_TEXTURES];
const filteredInitial = filterTexturesByDevice(INITIAL_TEXTURES, supportsHover);

filteredInitial.forEach((path) => useTexture.preload(path));

const SceneLoadingProgress = ({ onProgress }) => {
    const { progress, active } = useProgress();

    useEffect(() => {
        onProgress?.({ progress, active });
    }, [progress, active, onProgress]);

    return null;
};

const SceneCanvas = ({
    settings,
    isLoaded,
    onSceneReady,
    downgradeTier,
    onProgress,
}) => {
    const { readingProject, hasEntered } = useScene();

    // 入口先就绪；走廊纹理在预载退出后分批预取，避免一次性拉 80 张造成交互卡顿。
    // 画廊封面已下沉到每张卡按需加载，这里不再整体预取。
    useEffect(() => {
        if (!isLoaded || DEEP_LINK_ROOM) return undefined;
        const paths = filterTexturesByDevice(CORRIDOR_TEXTURES, supportsHover);
        const idle = window.requestIdleCallback || ((cb) => window.setTimeout(cb, 600));
        const cancelIdle = window.cancelIdleCallback || window.clearTimeout;
        let index = 0;
        let handle = null;
        const run = () => {
            paths.slice(index, index + 6).forEach((path) => useTexture.preload(path));
            index += 6;
            if (index < paths.length) handle = idle(run, { timeout: 800 });
        };
        handle = idle(run, { timeout: 800 });
        return () => { if (handle !== null) cancelIdle(handle); };
    }, [isLoaded]);

    // 进入走廊后预取画廊首屏 9 张卡的封面（约 700KB），
    // 让首次访问点开画廊时不再等这批贴图；深层卡片仍由各卡按需加载。
    useEffect(() => {
        if (!isLoaded || !hasEntered || DEEP_LINK_ROOM) return undefined;
        const idle = window.requestIdleCallback || ((cb) => window.setTimeout(cb, 300));
        const cancelIdle = window.cancelIdleCallback || window.clearTimeout;
        const handle = idle(() => {
            filterTexturesByDevice(buildInitialGalleryCovers(), supportsHover)
                .forEach((path) => useTexture.preload(path));
        }, { timeout: 1200 });
        return () => cancelIdle(handle);
    }, [isLoaded, hasEntered]);

    return (
        <Canvas
            camera={{
                position: [0, 0.2, 28],
                fov: 60,
                near: 0.1,
                far: 150,
            }}
            gl={{
                antialias: settings.antialias,
                alpha: false,
                powerPreference: settings.powerPreference,
                localClippingEnabled: true,
                failIfMajorPerformanceCaveat: false,
            }}
            dpr={settings.dpr}
            shadows={settings.shadows}
            frameloop={readingProject ? 'never' : 'always'}
        >
            <color attach="background" args={['#fafafa']} />
            <fog attach="fog" args={['#fafafa', 15, 50]} />

            <PerformanceMonitor
                onDecline={() => downgradeTier()}
                flipflops={3}
                onFallback={() => downgradeTier()}
            />

            <SceneLoadingProgress onProgress={onProgress} />

            <Suspense fallback={null}>
                <Experience onSceneReady={onSceneReady} />
                <Preload all />
            </Suspense>
        </Canvas>
    );
};

export default SceneCanvas;
