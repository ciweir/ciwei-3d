import { useSyncExternalStore } from 'react';
import { isTouchDevice } from './deviceDetect';

const STORAGE_KEY = 'ciwei-color-mode';
const SLOW_EFFECTIVE_TYPES = new Set(['slow-2g', '2g', '3g']);
const listeners = new Set();

/**
 * 触屏设备的默认上色策略：网络不慢、且硬件够用时才默认彩色。
 * 彩色贴图比线稿多约 1.5~2.5MB，且两套纹理同时驻留显存，
 * 低端机会因此掉帧，所以默认保持线稿，由用户手动上色。
 */
export const shouldDefaultToColor = ({ nav, isTouch }) => {
    if (!isTouch || !nav) return true;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (connection?.saveData) return false;
    if (connection?.effectiveType && SLOW_EFFECTIVE_TYPES.has(connection.effectiveType)) return false;
    // Chrome/Android 提供 deviceMemory；Safari 不提供，退而用 CPU 核心数
    if (typeof nav.deviceMemory === 'number') return nav.deviceMemory >= 8;
    return (nav.hardwareConcurrency || 0) >= 6;
};

const readInitial = () => {
    if (typeof window === 'undefined') return true;
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === 'color') return true;
        if (stored === 'sketch') return false;
    } catch {
        // localStorage can be unavailable in private/embedded contexts
    }
    return shouldDefaultToColor({ nav: window.navigator, isTouch: isTouchDevice() });
};

let enabled = readInitial();

export const getColorEnabled = () => enabled;

export const setColorEnabled = (next) => {
    if (next === enabled) return;
    enabled = next;
    try {
        window.localStorage.setItem(STORAGE_KEY, next ? 'color' : 'sketch');
    } catch {
        // ignore storage failures
    }
    listeners.forEach((listener) => listener());
};

export const toggleColorEnabled = () => setColorEnabled(!enabled);

const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const useColorEnabled = () => useSyncExternalStore(subscribe, getColorEnabled, () => true);

/* === 当前上色范围：只加载当前房间的彩色贴图，其他房间进入时再补 === */
const scopeListeners = new Set();
let loadScope = 'corridor';

export const getColorLoadScope = () => loadScope;

export const setColorLoadScope = (next) => {
    const scope = next || 'corridor';
    if (scope === loadScope) return;
    loadScope = scope;
    scopeListeners.forEach((listener) => listener());
};

const subscribeScope = (listener) => {
    scopeListeners.add(listener);
    return () => scopeListeners.delete(listener);
};

export const useColorLoadScope = () => useSyncExternalStore(subscribeScope, getColorLoadScope, () => 'corridor');
