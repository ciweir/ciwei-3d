import { Suspense, useCallback, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';

import InfiniteCorridorManager from './corridor/InfiniteCorridorManager';
import EntranceDoors from './entrance/EntranceDoors';
import EmptyCorridor from './entrance/EmptyCorridor';
import TeleportRoom from './corridor/TeleportRoom';
import useInfiniteCamera from '../../hooks/useInfiniteCamera';
import SignSystem from './entrance/SignSystem';
import { useScene } from '../../context/useScene';
import { useReducedMotion } from '../../utils/motion';

// Positioning:
// - Segment -1's SegmentDoors are at Z=15
// - Entrance doors at Z=22 (in front of segment doors)
// - 「此唯」头像区在 Z≈5.5
// - Camera starts at Z=28, ends at Z=8 (in front of avatar)
const ENTRANCE_DOORS_Z = 22;

/**
 * Experience Component
 * 
 * Flow:
 * 1. Preloader fades out -> user sees 3D entrance doors
 * 2. Click doors -> they open + camera flies through
 * 3. Behind doors: infinite corridor with 「此唯」
 */
const SceneReadyGate = ({ onReady }) => {
    const frames = useRef(0);
    const fired = useRef(false);

    useFrame(() => {
        if (fired.current) return;
        if (++frames.current >= 2) {
            fired.current = true;
            onReady?.();
        }
    });

    return null;
};

const Experience = ({ onSceneReady }) => {
    // Use SceneContext for room state
    const { hasEntered, markEntered, enterRoom, isTeleporting, isInRoom, initialRoom } = useScene();

    const { camera } = useThree();
    // 入口先渲染；走廊在推门/已进入时才挂载，避免首屏编译整条走廊
    const [corridorRequested, setCorridorRequested] = useState(false);
    // 系统偏好「减少动态效果」时关闭鼠标视差，滚动推进保留（用户主动操作）
    const reducedMotion = useReducedMotion();

    // Camera control - both scroll and parallax only work after entering
    // Disable during teleporting to prevent scroll interference
    const { setCameraOverride } = useInfiniteCamera({
        segmentLength: 80,
        scrollSpeed: 0.025,
        parallaxIntensity: reducedMotion ? 0 : 0.4,
        smoothing: 0.06,
        scrollEnabled: hasEntered && !isTeleporting && !isInRoom,
        parallaxEnabled: hasEntered && !isTeleporting && !isInRoom
    });

    // NOTE: Camera override is now managed directly by DoorSection.jsx
    // We removed the useEffect that was calling setCameraOverride here because
    // it conflicted with DoorSection's direct control and caused camera jumps.
    // The scrollEnabled/parallaxEnabled props already handle disabling scroll when in room.


    // Handle entrance complete
    const handleEntranceComplete = useCallback(() => {
        markEntered();
    }, [markEntered]);

    // Handle door enter from inside corridor
    const handleDoorEnter = useCallback((doorId) => {
        enterRoom(doorId);
    }, [enterRoom]);

    const handleEnterStart = useCallback(() => {
        setCorridorRequested(true);
    }, []);

    // 深链直接进房间：入口不参与渲染，省掉 49 张门面贴图与首次编译
    const showEntrance = !hasEntered && !initialRoom;

    return (
        <>
            {/* 首屏就绪只等当前场景提交；走廊贴图分批预取、房间封面由卡片按需加载（见 SceneCanvas / GalleryRoom） */}
            <SceneReadyGate onReady={onSceneReady} />

            {/* === GLOBAL LIGHTING === */}
            {/* <ambientLight intensity={isLowTier ? 2.5 : 2.2} /> */}
            {/* <directionalLight
                position={[5, 10, 5]}
                intensity={0.8}
                color="#acacac"
                castShadow={!isLowTier}
                shadow-mapSize={[1024, 1024]}
            /> */}
            {/* <directionalLight position={[-5, 8, -10]} intensity={0.4} color="#ffffff" /> */}

            {/* === EMPTY CORRIDOR (provides context during entrance) === */}
            {showEntrance && (
                <EmptyCorridor camera={camera} />
            )}

            {/* === ENTRANCE DOORS (visible until entered) === */}
            {showEntrance && (
                <EntranceDoors
                    position={[0, 0, ENTRANCE_DOORS_Z]}
                    onComplete={handleEntranceComplete}
                    onEnterStart={handleEnterStart}
                />
            )}

            {/* Separate SignSystem to avoid fragment nesting issues if any */}
            {showEntrance && (
                <SignSystem position={[0, 0, ENTRANCE_DOORS_Z]} />
            )}

            {/* === INFINITE CORRIDOR (deferred until door click / already inside) === */}
            {(corridorRequested || hasEntered) && (
                initialRoom ? (
                    <Suspense fallback={null}>
                        <InfiniteCorridorManager
                            onDoorEnter={handleDoorEnter}
                            hideDoorsForSegments={hasEntered ? [] : [-1]}
                            clipSegmentNeg1={!hasEntered}
                            setCameraOverride={setCameraOverride}
                            initialSegments={[0]}
                        />
                    </Suspense>
                ) : (
                    <Suspense fallback={null}>
                        <InfiniteCorridorManager
                            onDoorEnter={handleDoorEnter}
                            hideDoorsForSegments={hasEntered ? [] : [-1]}
                            clipSegmentNeg1={!hasEntered}
                            setCameraOverride={setCameraOverride}
                        />
                    </Suspense>
                )
            )}

            {/* === TELEPORT ROOM (renders room directly during teleportation) === */}
            <TeleportRoom />
        </>
    );
};

export default Experience;

