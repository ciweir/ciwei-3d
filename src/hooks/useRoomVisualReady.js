import { useEffect, useRef } from 'react';
import { useScene } from '../context/useScene';

// 房间自报“首个可见帧”后再等两帧 + 一个短缓冲，给贴图上传/合成留余量。
const DEFAULT_SETTLE_MS = 400;

export function useRoomVisualReady(roomId, ready, settleMs = DEFAULT_SETTLE_MS) {
    const { markRoomVisualReady } = useScene();
    const signaledRef = useRef(false);

    useEffect(() => {
        signaledRef.current = false;
    }, [roomId]);

    useEffect(() => {
        if (!ready) {
            signaledRef.current = false;
            return undefined;
        }
        if (signaledRef.current) return undefined;

        let cancelled = false;
        let raf1;
        let raf2;
        let timer;

        raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => {
                if (cancelled) return;
                timer = setTimeout(() => {
                    if (cancelled) return;
                    signaledRef.current = true;
                    markRoomVisualReady(roomId);
                }, settleMs);
            });
        });

        return () => {
            cancelled = true;
            cancelAnimationFrame(raf1);
            cancelAnimationFrame(raf2);
            clearTimeout(timer);
        };
    }, [ready, roomId, settleMs, markRoomVisualReady]);
}
