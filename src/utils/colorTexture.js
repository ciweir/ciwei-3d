/**
 * 彩色/线稿贴图选择
 * ---------------------------------------------------------------
 * 桌面端默认彩色，触屏设备默认线稿；移动端右上角的“上色”按钮可以随时切换。
 * 切换时不重挂场景：初始贴图仍由 drei 的 useTexture 提供，另一套贴图在
 * 后台按需加载，加载完成后替换材质，避免整屏闪烁。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTexture as useDreiTexture } from '@react-three/drei';
import * as THREE from 'three';
import { PAINTED_TEXTURES } from '../config/texturePreloadList';
import { getColorEnabled, useColorEnabled, useColorLoadScope } from './colorMode';
import { isTouchDevice } from './deviceDetect';
import { beginColorLoad, endColorLoad } from './colorLoadStatus';

const PAINTED_SET = new Set(PAINTED_TEXTURES);

/** 线稿 URL → 彩色版 URL；无对应彩色版时原样返回 */
export const paintedSrc = (src) => {
    if (typeof src !== 'string') return src;
    if (!src.endsWith('.webp') || src.endsWith('_painted.webp')) return src;
    const cand = src.replace(/_sketch\.webp$/i, '.webp').replace(/\.webp$/i, '_painted.webp');
    return PAINTED_SET.has(cand) ? cand : src;
};

export const resolveTextureSrc = (src, colorEnabled = getColorEnabled()) =>
    colorEnabled ? paintedSrc(src) : src;

const mapInput = (input, mapper) => {
    if (typeof input === 'string') return mapper(input);
    if (Array.isArray(input)) return input.map(mapper);
    if (input && typeof input === 'object') {
        const mapped = {};
        for (const key of Object.keys(input)) mapped[key] = mapper(input[key]);
        return mapped;
    }
    return input;
};

const sameInput = (a, b) => {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((item, i) => item === b[i]);
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        const keys = Object.keys(a);
        return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
    }
    return false;
};

/* === 房间范围：彩色贴图只加载当前房间，其他房间进入时再补 === */
const SCOPE_OVERRIDES = {
    // 画廊门槛用的是走廊贴图，但当前房间是画廊
    '/textures/corridor/texturadoprogow.webp': 'gallery',
};

export const textureScope = (url) => {
    if (!url) return 'shared';
    if (SCOPE_OVERRIDES[url]) return SCOPE_OVERRIDES[url];
    if (url.startsWith('/covers/')) return 'gallery';
    if (url.startsWith('/textures/clouds/') || url.startsWith('/textures/paper-texture')) return 'shared';
    if (url.startsWith('/textures/gallery/')) return 'gallery';
    if (url.startsWith('/textures/studio/')) return 'studio';
    if (url.startsWith('/textures/about/')) return 'about';
    if (url.startsWith('/textures/contact/')) return 'contact';
    if (url.startsWith('/textures/corridor/') || url.startsWith('/textures/doors/')) return 'corridor';
    if (url.startsWith('/textures/entrance/')) return 'entrance';
    return 'shared';
};

const inputScope = (input) => {
    if (typeof input === 'string') return textureScope(input);
    if (Array.isArray(input)) {
        const scopes = input.map(textureScope).filter((s) => s !== 'shared');
        return scopes[0] || 'shared';
    }
    if (input && typeof input === 'object') {
        const scopes = Object.values(input).map(textureScope).filter((s) => s !== 'shared');
        return scopes[0] || 'shared';
    }
    return 'shared';
};

const scopeMatches = (scope, input) => {
    const target = inputScope(input);
    return target === 'shared' || target === scope;
};

/* === 按需加载：最多 6 个并发，避免一次点“上色”把移动网络打满 === */
const textureCache = new Map();
let activeLoads = 0;
const loadQueue = [];

const pumpQueue = () => {
    while (activeLoads < 6 && loadQueue.length > 0) {
        const job = loadQueue.shift();
        activeLoads += 1;
        job().finally(() => {
            activeLoads -= 1;
            pumpQueue();
        });
    }
};

const loadRawTexture = (url) =>
    new Promise((resolve, reject) => {
        new THREE.TextureLoader().load(url, resolve, undefined, reject);
    });

const loadTexture = (url) => {
    if (!url) return Promise.resolve(null);
    if (textureCache.has(url)) return textureCache.get(url);
    beginColorLoad();
    const promise = new Promise((resolve, reject) => {
        loadQueue.push(() => loadRawTexture(url).then(resolve, reject));
        pumpQueue();
    })
        .catch((error) => {
            textureCache.delete(url);
            throw error;
        })
        .finally(endColorLoad);
    textureCache.set(url, promise);
    return promise;
};

const copyTextureSettings = (texture, base) => {
    if (!texture) return texture;
    texture.colorSpace = THREE.SRGBColorSpace;
    if (base) {
        texture.colorSpace = base.colorSpace;
        texture.flipY = base.flipY;
        texture.wrapS = base.wrapS;
        texture.wrapT = base.wrapT;
        texture.minFilter = base.minFilter;
        texture.magFilter = base.magFilter;
        texture.anisotropy = base.anisotropy;
        texture.generateMipmaps = base.generateMipmaps;
        texture.repeat.copy(base.repeat);
        texture.offset.copy(base.offset);
        texture.center.copy(base.center);
        texture.rotation = base.rotation;
    }
    texture.needsUpdate = true;
    return texture;
};

const loadForInput = async (altInput, baseInput, base) => {
    if (typeof altInput === 'string') {
        if (altInput === baseInput) return base;
        const texture = await loadTexture(altInput);
        return copyTextureSettings(texture, base);
    }
    if (Array.isArray(altInput)) {
        const result = await Promise.all(
            altInput.map((url, i) => loadForInput(url, baseInput?.[i], base?.[i]))
        );
        return result;
    }
    if (altInput && typeof altInput === 'object') {
        const result = {};
        await Promise.all(
            Object.keys(altInput).map(async (key) => {
                result[key] = await loadForInput(altInput[key], baseInput?.[key], base?.[key]);
            })
        );
        return result;
    }
    return base;
};

/**
 * 颜色模式感知的 useTexture：
 * - 首次渲染加载当前模式对应的贴图（保持首屏速度）
 * - 模式切换后异步加载另一套贴图，加载完成前继续用旧贴图
 */
export const useColorTexture = (input, ...rest) => {
    const colorEnabled = useColorEnabled();
    const scope = useColorLoadScope();
    const initialEnabled = useRef(colorEnabled);
    const baseInput = useMemo(
        () => mapInput(input, (src) => resolveTextureSrc(src, initialEnabled.current)),
        [input]
    );
    const base = useDreiTexture(baseInput, ...rest);
    const altInput = useMemo(
        () => mapInput(input, (src) => resolveTextureSrc(src, colorEnabled)),
        [input, colorEnabled]
    );
    const wantsAlt = !sameInput(altInput, baseInput);
    const altKey = useMemo(() => JSON.stringify(altInput), [altInput]);
    const [altState, setAltState] = useState(null);
    const altReady = Boolean(altState && altState.key === altKey);
    const needsLoad = wantsAlt && !altReady && scopeMatches(scope, altInput);

    useEffect(() => {
        if (!needsLoad) return undefined;
        let cancelled = false;
        loadForInput(altInput, baseInput, base)
            .then((next) => {
                if (!cancelled) setAltState({ key: altKey, value: next });
            })
            .catch(() => {
                if (!cancelled) setAltState(null);
            });
        return () => {
            cancelled = true;
        };
    }, [needsLoad, altInput, altKey, baseInput, base]);

    if (!wantsAlt) return base;
    return altReady ? altState.value : base;
};

/** 云朵在移动端彩色模式下仍保持线稿，避免彩色云贴图自带的矩形纸底 */
export const useCloudTexture = (url) => {
    const colorEnabled = useColorEnabled();
    const paintedUrl = !isTouchDevice() && colorEnabled ? paintedSrc(url) : null;
    return useTexturePair(url, paintedUrl);
};

/** 显式的一对线稿/彩色贴图（画廊封面等文件名不带 _sketch 后缀的资源） */
export const useTexturePair = (sketchUrl, paintedUrl) => {
    const colorEnabled = useColorEnabled();
    const scope = useColorLoadScope();
    const initialEnabled = useRef(colorEnabled);
    const baseUrl = initialEnabled.current && paintedUrl ? paintedUrl : sketchUrl;
    const base = useDreiTexture(baseUrl);
    const targetUrl = colorEnabled && paintedUrl ? paintedUrl : sketchUrl;
    const wantsAlt = targetUrl !== baseUrl;
    const [altState, setAltState] = useState(null);
    const altReady = Boolean(altState && altState.key === targetUrl);
    const needsLoad = wantsAlt && !altReady && scopeMatches(scope, targetUrl);

    useEffect(() => {
        if (!needsLoad) return undefined;
        let cancelled = false;
        loadTexture(targetUrl)
            .then((texture) => {
                if (!cancelled) setAltState({ key: targetUrl, value: copyTextureSettings(texture, base) });
            })
            .catch(() => {
                if (!cancelled) setAltState(null);
            });
        return () => {
            cancelled = true;
        };
    }, [needsLoad, targetUrl, base]);

    if (!wantsAlt) return base;
    return altReady ? altState.value : base;
};

/**
 * 只在上色模式加载的彩色贴图（Studio 的 painted 面、About 气球等）。
 * 初始线稿模式完全不发请求；点“上色”后异步补上。
 */
export const useColorOnlyTexture = (url) => {
    const colorEnabled = useColorEnabled();
    const scope = useColorLoadScope();
    const [state, setState] = useState(null);
    const ready = Boolean(state && state.key === url);
    const needsLoad = colorEnabled && url && !ready && scopeMatches(scope, url);

    useEffect(() => {
        if (!needsLoad) return undefined;
        let cancelled = false;
        loadTexture(url)
            .then((next) => {
                if (!cancelled) setState({ key: url, value: copyTextureSettings(next, null) });
            })
            .catch(() => {
                if (!cancelled) setState(null);
            });
        return () => {
            cancelled = true;
        };
    }, [needsLoad, url]);

    if (!colorEnabled || !ready) return null;
    return state.value ?? null;
};

// 透传 drei useTexture 的静态预载方法（SceneCanvas 模块级预载依赖它）
useColorTexture.preload = (src) => {
    // 触屏端云朵固定线稿，预载时不要被彩色模式改写成 _painted
    const resolved = isTouchDevice() && src.includes('/textures/clouds/')
        ? src
        : resolveTextureSrc(src);
    useDreiTexture.preload(resolved);
};
