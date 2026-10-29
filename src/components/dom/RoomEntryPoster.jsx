import { useEffect, useRef, useState } from 'react';
import { useScene } from '../../context/useScene';
import { useColorEnabled } from '../../utils/colorMode';
import { isTouchDevice } from '../../utils/deviceDetect';
import '../../styles/RoomEntryPoster.scss';

const FALLBACK_HIDE_MS = 9000;
const LEAVE_MS = 360;
const STATUS_DELAY_MS = 1500;

/**
 * 点击画廊后的即时首帧：3D 房间就绪前先显示静态画廊，
 * 避免用户面对纸张/空场景等待。只在画廊传送时出现。
 */
const RoomEntryPoster = () => {
    const { teleportTarget, teleportPhase, isTeleporting, currentRoom, readingProject } = useScene();
    const colorEnabled = useColorEnabled();
    const [phase, setPhase] = useState('hidden'); // hidden | visible | leaving
    const [showStatus, setShowStatus] = useState(false);
    const fallbackTimer = useRef(null);
    const doorEntryTimer = useRef(null);

    // 静态首帧跟随当前配色，避免“线稿海报 → 彩色房间”的二次染色错觉
    const posterSrc = isTouchDevice()
        ? `/images/gallery-entry-mobile${colorEnabled ? '-color' : ''}.webp`
        : `/images/gallery-entry${colorEnabled ? '-color' : ''}.webp`;

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

    // 慢路径才出“正在布置”：缓存命中、房间瞬间就绪时不闪文字。
    useEffect(() => {
        if (phase !== 'visible') {
            setShowStatus(false);
            return undefined;
        }
        const timer = setTimeout(() => setShowStatus(true), STATUS_DELAY_MS);
        return () => clearTimeout(timer);
    }, [phase]);

    if (phase === 'hidden') return null;

    return (
        <div
            className={`room-entry-poster ${phase === 'visible' ? 'is-visible' : ''}`}
            aria-hidden="true"
        >
            <img className="room-entry-poster__image" src={posterSrc} alt="" draggable="false" />
            {showStatus && (
                <div className="room-entry-poster__status">
                    <span>画廊 · 正在布置</span>
                    <i />
                </div>
            )}
        </div>
    );
};

export default RoomEntryPoster;
