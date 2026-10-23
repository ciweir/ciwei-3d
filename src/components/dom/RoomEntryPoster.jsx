import { useEffect, useRef, useState } from 'react';
import { useScene } from '../../context/useScene';
import '../../styles/RoomEntryPoster.scss';

const FALLBACK_HIDE_MS = 9000;
const LEAVE_MS = 360;

/**
 * 点击画廊后的即时首帧：3D 房间就绪前先显示静态画廊，
 * 避免用户面对纸张/空场景等待。只在画廊传送时出现。
 */
const RoomEntryPoster = () => {
    const { teleportTarget, teleportPhase, isTeleporting, currentRoom, readingProject } = useScene();
    const [phase, setPhase] = useState('hidden'); // hidden | visible | leaving
    const fallbackTimer = useRef(null);
    const doorEntryTimer = useRef(null);

    useEffect(() => {
        if (readingProject) {
            setPhase('hidden');
            return undefined;
        }

        if (teleportTarget === 'gallery') {
            setPhase('visible');
            return undefined;
        }

        if (teleportTarget && teleportTarget !== 'gallery') {
            setPhase('leaving');
        }
        return undefined;
    }, [teleportTarget, readingProject]);

    // 普通“开门”进入画廊：延迟 380ms 淡入，先让用户看到门/走近动作，
    // 再由首帧接管房间编译与开门等待。
    useEffect(() => {
        const handleRoomEntryStart = (event) => {
            if (event.detail?.roomId !== 'gallery' || teleportTarget) return;
            if (doorEntryTimer.current) clearTimeout(doorEntryTimer.current);
            doorEntryTimer.current = setTimeout(() => setPhase('visible'), 380);
        };
        window.addEventListener('ciwei:room-entry-start', handleRoomEntryStart);
        return () => {
            window.removeEventListener('ciwei:room-entry-start', handleRoomEntryStart);
            if (doorEntryTimer.current) clearTimeout(doorEntryTimer.current);
        };
    }, [teleportTarget]);

    // 兜底必须独立于 teleportTarget：进入过程中 target 会被提前清空
    useEffect(() => {
        if (phase !== 'visible') return undefined;
        fallbackTimer.current = setTimeout(() => setPhase('leaving'), FALLBACK_HIDE_MS);
        return () => {
            if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
        };
    }, [phase]);

    useEffect(() => {
        if (phase === 'hidden') return;
        const roomReady = teleportPhase === 'opening';
        const teleportEnded = !isTeleporting && teleportPhase === null && currentRoom === 'gallery';
        if (roomReady || teleportEnded) {
            setPhase('leaving');
        }
    }, [teleportPhase, isTeleporting, currentRoom, phase]);

    useEffect(() => {
        if (phase !== 'leaving') return undefined;
        const timer = setTimeout(() => setPhase('hidden'), LEAVE_MS);
        return () => clearTimeout(timer);
    }, [phase]);

    if (phase === 'hidden') return null;

    return (
        <div
            className={`room-entry-poster ${phase === 'visible' ? 'is-visible' : ''}`}
            aria-hidden="true"
        >
            <picture>
                <source media="(max-width: 767px)" srcSet="/images/gallery-entry-mobile.webp" />
                <img src="/images/gallery-entry.webp" alt="" draggable="false" />
            </picture>
        </div>
    );
};

export default RoomEntryPoster;
