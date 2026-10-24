import { useSyncExternalStore } from 'react';

/* 与 three/drei 解耦：DOM 导航按钮订阅上色进度时不会把 3D 依赖拉进首包 */
let pendingLoads = 0;
const listeners = new Set();

const notify = () => listeners.forEach((listener) => listener());

const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const beginColorLoad = () => {
    pendingLoads += 1;
    notify();
};

export const endColorLoad = () => {
    pendingLoads = Math.max(0, pendingLoads - 1);
    notify();
};

export const getColorLoadPending = () => pendingLoads;

export const useColorLoadPending = () =>
    useSyncExternalStore(subscribe, getColorLoadPending, () => 0);
