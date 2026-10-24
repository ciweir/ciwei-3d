import { useSyncExternalStore } from 'react';
import { isTouchDevice } from './deviceDetect';

const STORAGE_KEY = 'ciwei-color-mode';
const listeners = new Set();

const readInitial = () => {
    if (typeof window === 'undefined') return true;
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === 'color') return true;
        if (stored === 'sketch') return false;
    } catch {
        // localStorage can be unavailable in private/embedded contexts
    }
    return !isTouchDevice();
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
