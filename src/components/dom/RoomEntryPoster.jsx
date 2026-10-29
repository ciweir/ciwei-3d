import { useEffect, useRef, useState } from 'react';
import { useScene } from '../../context/useScene';
import { useColorEnabled } from '../../utils/colorMode';
import { isTouchDevice } from '../../utils/deviceDetect';
import '../../styles/RoomEntryPoster.scss';

const FALLBACK_HIDE_MS = 9000;
const LEAVE_MS = 360;
const STATUS_DELAY_MS = 1500;

const ROOM_POSTERS = {
    gallery: { base: 'gallery-entry', mobile: 'gallery-entry-mobile', label: '画廊' },
    studio: { base: 'studio-entry', mobile: 'studio-entry-mobile', label: '工作室' },
    about: { base: 'about-entry', mobile: 'about-entry-mobile', label: '关于' },
    contact: { base: 'contact-entry', mobile: 'contact-entry-mobile', label: '联系' },
};

const posterSrcFor = (room, colorEnabled) => {
    const config = ROOM_POSTERS[room] || ROOM_POSTERS.gallery;
    const base = isTouchDevice() ? config.mobile : config.base;
    return `/images/${base}${colorEnabled ? '-color' : ''}.webp`;
};

/**
 * 房间入口首帧：3D 房间就绪前先显示对应房间的静态画面，
 * 避免用户面对纸张/空场景等待。地图传送与普通开门都走同一接管。
 */
const RoomEntryPoster = () => {
    const { teleportTarget, teleportPhase, isTeleporting, currentRoom, readingProject } = useScene();
    const colorEnabled = useColorEnabled();
    const [phase, setPhase] = useState('hidden'); // hidden | visible | leaving
    const [activeRoom, setActiveRoom] = useState('gallery');
    const [showStatus, setShowStatus] = useState(false);
    const fallbackTimer = useRef(null);
    const doorEntryTimer = useRef(null);

    const posterSrc = posterSrcFor(activeRoom, colorEnabled);
    const roomLabel = (ROOM_POSTERS[activeRoom] || ROOM_POSTERS.gallery).label;

    useEffect(() => {
        if (readingProject) {
            setPhase('hidden');
            return undefined;
        }

        if (teleportTarget && ROOM_POSTERS[teleportTarget]) {
            setActiveRoom(teleportTarget);
            setPhase('visible');
            return undefined;
        }

        if (teleportTarget) {
            setPhase('leaving');
        }
        return undefined;
    }, [teleportTarget, readingProject]);

    // 普通“开门”进入房间：延迟 380ms 淡入，先让用户看到门/走近动作，
    // 再由首帧接管房间编译与开门等待。
    useEffect(() => {
        const handleRoomEntryStart = (event) => {
            const roomId = event.detail?.roomId;
            if (!ROOM_POSTERS[roomId] || teleportTarget) return;
            setActiveRoom(roomId);
            // 提前拉首帧，避免 380ms 后才开始下载
            const img = new Image();
            img.src = posterSrcFor(roomId, colorEnabled);
            if (doorEntryTimer.current) clearTimeout(doorEntryTimer.current);
            doorEntryTimer.current = setTimeout(() => setPhase('visible'), 380);
        };
        window.addEventListener('ciwei:room-entry-start', handleRoomEntryStart);
        return () => {
            window.removeEventListener('ciwei:room-entry-start', handleRoomEntryStart);
            if (doorEntryTimer.current) clearTimeout(doorEntryTimer.current);
        };
    }, [teleportTarget, colorEnabled]);

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
        const teleportEnded = !isTeleporting && teleportPhase === null && currentRoom === activeRoom;
        if (roomReady || teleportEnded) {
            setPhase('leaving');
        }
    }, [teleportPhase, isTeleporting, currentRoom, activeRoom, phase]);

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
                    <span>{roomLabel} · 正在布置</span>
                    <i />
                </div>
            )}
        </div>
    );
};

export default RoomEntryPoster;
