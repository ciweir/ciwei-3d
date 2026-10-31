/**
 * Esc 层级管理
 *
 * 站里同时存在多个「按 Esc 该关掉谁」的候选：项目浮层、阅读室、
 * 地图 / 音频 / 成就面板，以及走廊里的「退出房间」。
 * 它们原先各自挂 window 监听，一次按键会全部触发——
 * 在阅读室里按 Esc 会顺手把房间也退掉。
 *
 * 这里用一张层级表统一裁决：越晚激活的层越靠上，只让最上面那一层消费按键，
 * 并在捕获阶段截断事件，下层（含 DoorSection 的退房）根本收不到。
 */
import { useEffect, useRef } from 'react';

const layers = new Map(); // 序号 -> handler
let seq = 0;
let bound = false;

const ensureBound = () => {
    if (bound) return;
    bound = true;

    window.addEventListener(
        'keydown',
        (e) => {
            if (e.key !== 'Escape' || layers.size === 0) return;
            // 序号越大 = 越晚激活 = 越靠上
            const ordered = [...layers.entries()].sort((a, b) => b[0] - a[0]);
            for (const [, handler] of ordered) {
                // 返回 false 表示这一层不消费（例如要先让浏览器退出全屏）
                if (handler() !== false) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return;
                }
            }
        },
        true
    );
};

/**
 * @param {boolean} active 该层是否处于打开状态
 * @param {() => (void|false)} onEscape 返回 false 表示这次按键不由本层消费
 */
export const useEscapeLayer = (active, onEscape) => {
    const idRef = useRef(0);
    const handlerRef = useRef(onEscape);
    handlerRef.current = onEscape;

    useEffect(() => {
        if (!active) return undefined;
        ensureBound();
        // 激活时刷新序号，保证「最近打开的层」优先
        idRef.current = ++seq;
        layers.set(idRef.current, () => handlerRef.current());
        return () => {
            layers.delete(idRef.current);
        };
    }, [active]);
};
