import { useRef, useState, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { useFrame, useThree, createPortal } from '@react-three/fiber';
import { Text, Edges, PositionalAudio, useTexture as useDreiTexture } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { CONTENT_DATA, PLATFORM_CONFIG } from './contentData';
import MonitorBlock from './MonitorBlock';
import HeroVideoScreen from './HeroVideoScreen';
import { STUDIO_PAINT_CONFIG } from './studioPaintConfig';
import { useScene } from '../../../../context/useScene';
import { useAchievements } from '../../../../context/useAchievements';
import { useAudio } from '../../../../context/useAudio';
import { useStudioContent } from '../../../../hooks/useSanityData';
import { mobileSrc } from '../../../../utils/colorTexture';
import { usePaintMaterial } from '../Gallery/usePaintMaterial';

const STUDIO_ENTER_DISTANCE = 8;
const BASE_FALL_SPEED = 0.04;
const SCROLL_SENSITIVITY = 0.008;
const DRAG_SENSITIVITY = 0.01;
const SPEED_DECAY = 0.985;
const BENCH_HEIGHT = 0.62;
const HERO_GAP = 0.12;

const AUDIO_SETTINGS = {
    volume: 1,
    distance: 2,
    rolloff: 1.0,
};

const DEVICE_DIMENSIONS = {
    tv: { width: 1.6, height: 1.187, depth: 1.0 },
    monitor: { width: 1.6, height: 1.0, depth: 0.15 },
    phone: { width: 0.6, height: 1.139, depth: 0.1 },
};

const getDevice = (content) => content.device || PLATFORM_CONFIG[content.platform]?.shape || 'tv';

const getStageLayout = (width) => {
    if (width < 768) {
        return {
            kind: 'mobile',
            heroDist: 6.9,
            heroMaxWidth: 2.85,
            heroMaxHeight: 2.45,
            heroZoom: 1.8,
            backgroundScale: 0.54,
            columns: [-2.3, 2.3],
            rows: 11,
            rowGap: 1.25,
            backgroundZ: -3.8,
            wallYOffset: -0.55,
        };
    }
    if (width < 1024) {
        return {
            kind: 'tablet',
            heroDist: 7.2,
            heroMaxWidth: 3.5,
            heroMaxHeight: 2.9,
            heroZoom: 2.2,
            backgroundScale: 0.62,
            columns: [-3.25, 3.25],
            rows: 11,
            rowGap: 1.5,
            backgroundZ: -4.0,
            wallYOffset: -0.35,
        };
    }
    return {
        kind: 'desktop',
        heroDist: 7.4,
        heroMaxWidth: 3.9,
        heroMaxHeight: 3.15,
        heroZoom: 2.6,
        backgroundScale: 0.72,
        columns: [-4.8, -2.65, 2.65, 4.8],
        rows: 7,
        rowGap: 1.7,
        backgroundZ: -4.1,
        wallYOffset: -0.2,
    };
};

const getPlatformConfig = (content) => {
    const device = getDevice(content);
    return PLATFORM_CONFIG[content.platform] || {
        shape: device,
        color: '#ffffff',
        accentColor: '#cccccc',
        icon: '·',
        label: content.platform || '作品',
    };
};

const buildHeroItem = (content, layout) => {
    if (!content) return null;
    const device = getDevice(content);
    const base = DEVICE_DIMENSIONS[device] || DEVICE_DIMENSIONS.tv;
    const scale = Math.min(layout.heroMaxWidth / base.width, layout.heroMaxHeight / base.height);
    const height = base.height * scale;
    // 主屏画面始终用彩色成片：房间是线稿，屏幕里放的是真实作品
    const paintedCover = content.paintedFrontTexture || content.frontTexture;
    return {
        ...content,
        device,
        isHero: true,
        x: 0,
        baseY: BENCH_HEIGHT + HERO_GAP + height / 2,
        z: 0,
        rot: 0,
        width: base.width * scale,
        height,
        depth: base.depth * scale,
        frontTexture: paintedCover,
        paintedFrontTexture: paintedCover,
        platformConfig: getPlatformConfig(content),
    };
};

const buildBackgroundItems = (content, heroItem, layout) => {
    // 侧屏是完整片单，不随主屏选择重排；主屏当前项也会在循环片墙里出现。
    const source = content;
    if (source.length === 0) return [];
    const items = [];
    const maxColumn = Math.max(...layout.columns.map((value) => Math.abs(value)), 1);
    const slots = layout.rows * layout.columns.length;

    for (let index = 0; index < slots; index += 1) {
        const contentItem = source[index % source.length];
        const column = index % layout.columns.length;
        const row = Math.floor(index / layout.columns.length);
        const x = layout.columns[column];
        const device = getDevice(contentItem);
        const base = DEVICE_DIMENSIONS[device] || DEVICE_DIMENSIONS.tv;
        const deviceScale = layout.backgroundScale * (device === 'phone' ? 1.7 : 1);
        const scale = deviceScale * (1 + Math.sin(index * 2.17) * 0.03);
        const paintedCover = contentItem.paintedFrontTexture || contentItem.frontTexture;

        items.push({
            ...contentItem,
            index,
            isHero: false,
            x,
            baseY: heroItem.baseY
                + layout.wallYOffset
                + (column - (layout.columns.length - 1) / 2) * layout.rowGap * 0.32
                + (row - (layout.rows - 1) / 2) * layout.rowGap
                + Math.sin(index * 1.7) * 0.1,
            z: layout.backgroundZ - (Math.abs(x) / maxColumn) * 0.5,
            rot: Math.sin(index * 1.3) * 0.025,
            width: base.width * scale,
            height: base.height * scale,
            depth: base.depth * scale,
            frontTexture: paintedCover,
            paintedFrontTexture: paintedCover,
            platformConfig: getPlatformConfig(contentItem),
        });
    }

    return items;
};

const createPaperTexture = ({ base, line }) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');

    context.fillStyle = base;
    context.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 760; i += 1) {
        const alpha = 0.015 + Math.random() * 0.035;
        context.fillStyle = `rgba(96, 85, 66, ${alpha})`;
        context.fillRect(Math.random() * 512, Math.random() * 512, 1, 1);
    }

    context.strokeStyle = 'rgba(115, 104, 84, 0.045)';
    context.lineWidth = 1;
    for (let i = 0; i < 38; i += 1) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + 18 + Math.random() * 60, y + (Math.random() - 0.5) * 7);
        context.stroke();
    }

    context.strokeStyle = line;
    context.lineWidth = 1;
    for (let x = 0; x <= 512; x += 64) {
        context.beginPath();
        for (let y = 0; y <= 512; y += 16) {
            const wobble = Math.sin((x + y) * 0.045) * 1.2;
            if (y === 0) context.moveTo(x + wobble, y);
            else context.lineTo(x + wobble, y);
        }
        context.stroke();
    }
    for (let y = 0; y <= 512; y += 64) {
        context.beginPath();
        for (let x = 0; x <= 512; x += 16) {
            const wobble = Math.sin((x - y) * 0.04) * 1.2;
            if (x === 0) context.moveTo(x, y + wobble);
            else context.lineTo(x, y + wobble);
        }
        context.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
};

const createShadowTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(128, 128, 18, 128, 128, 126);
    gradient.addColorStop(0, 'rgba(24, 20, 14, 0.32)');
    gradient.addColorStop(0.55, 'rgba(24, 20, 14, 0.14)');
    gradient.addColorStop(1, 'rgba(24, 20, 14, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
};

const createTopFadeTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, 'rgba(247, 242, 232, 0.95)');
    gradient.addColorStop(0.55, 'rgba(247, 242, 232, 0.55)');
    gradient.addColorStop(0.82, 'rgba(247, 242, 232, 0.18)');
    gradient.addColorStop(1, 'rgba(247, 242, 232, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
};

const createClapperTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 192;
    const context = canvas.getContext('2d');

    context.fillStyle = '#26231d';
    context.fillRect(0, 0, 256, 192);

    context.save();
    context.beginPath();
    context.rect(0, 0, 256, 40);
    context.clip();
    context.fillStyle = '#f2eadc';
    context.fillRect(0, 0, 256, 40);
    context.fillStyle = '#26231d';
    for (let x = -40; x < 300; x += 32) {
        context.beginPath();
        context.moveTo(x, 40);
        context.lineTo(x + 18, 0);
        context.lineTo(x + 34, 0);
        context.lineTo(x + 16, 40);
        context.fill();
    }
    context.restore();

    context.strokeStyle = '#f2eadc';
    context.lineWidth = 3;
    context.strokeRect(9, 49, 238, 134);

    context.fillStyle = '#f2eadc';
    context.font = '700 25px Arial, sans-serif';
    context.fillText('STUDIO 01', 22, 88);
    context.font = '14px Arial, sans-serif';
    context.fillText('SCENE 01  ·  TAKE 01', 22, 116);
    context.strokeStyle = 'rgba(242, 234, 220, 0.5)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(22, 132);
    context.lineTo(230, 132);
    context.stroke();
    context.font = '11px Arial, sans-serif';
    context.fillText('DIRECTOR / CIWEI', 22, 154);

    context.fillStyle = '#f2eadc';
    context.beginPath();
    context.arc(20, 20, 6, 0, Math.PI * 2);
    context.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
};

const Clapperboard = () => {
    const texture = useMemo(() => createClapperTexture(), []);
    useEffect(() => () => texture.dispose(), [texture]);

    return (
        <group>
            <mesh position={[0, 0, -0.014]}>
                <boxGeometry args={[0.54, 0.41, 0.026]} />
                <meshBasicMaterial color="#1f1c17" />
            </mesh>
            <mesh position={[0, 0, 0.002]} raycast={() => null}>
                <planeGeometry args={[0.52, 0.39]} />
                <meshBasicMaterial map={texture} toneMapped={false} />
            </mesh>
        </group>
    );
};

const makeTornPanelGeometry = (width, height, jitter = 0.028) => {
    const shape = new THREE.Shape();
    const points = [];
    const segX = 12;
    const segY = 9;

    for (let i = 0; i < segX; i += 1) {
        const t = i / segX;
        points.push([-width / 2 + width * t, height / 2 + Math.sin(i * 2.4) * jitter]);
    }
    for (let i = 0; i < segY; i += 1) {
        const t = i / segY;
        points.push([width / 2 + Math.sin(i * 2.7) * jitter, height / 2 - height * t]);
    }
    for (let i = 0; i < segX; i += 1) {
        const t = i / segX;
        points.push([width / 2 - width * t, -height / 2 + Math.sin(i * 2.2) * jitter]);
    }
    for (let i = 0; i < segY; i += 1) {
        const t = i / segY;
        points.push([-width / 2 + Math.sin(i * 2.9) * jitter, -height / 2 + height * t]);
    }

    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
        shape.lineTo(points[i][0], points[i][1]);
    }
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
};

const HeroCaption = ({ width, height, title, meta, titleSize, metaSize }) => {
    const geometry = useMemo(() => makeTornPanelGeometry(width, height, 0.011), [width, height]);
    const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 30), [geometry]);
    const playGeometry = useMemo(() => {
        const shape = new THREE.Shape();
        shape.moveTo(-0.042, -0.058);
        shape.lineTo(0.058, 0);
        shape.lineTo(-0.042, 0.058);
        shape.closePath();
        return new THREE.ShapeGeometry(shape);
    }, []);

    useEffect(() => () => {
        geometry.dispose();
        edges.dispose();
        playGeometry.dispose();
    }, [geometry, edges, playGeometry]);

    return (
        <group rotation={[0, 0, -0.004]}>
            <mesh raycast={() => null}>
                <primitive object={geometry} attach="geometry" />
                <meshBasicMaterial color="#f7f0e3" side={THREE.DoubleSide} />
            </mesh>
            <lineSegments geometry={edges} position={[0, 0, 0.004]}>
                <lineBasicMaterial color="#8a7f6c" transparent opacity={0.28} />
            </lineSegments>
            <mesh position={[width / 2 - 0.2, height / 2 - 0.02, 0.012]} rotation={[0, 0, -0.05]} raycast={() => null}>
                <planeGeometry args={[0.26, 0.075]} />
                <meshBasicMaterial color="#e5dac0" transparent opacity={0.9} />
            </mesh>
            <mesh position={[-width / 2 + 0.13, 0, 0.015]} raycast={() => null}>
                <ringGeometry args={[0.068, 0.086, 24]} />
                <meshBasicMaterial color="#26231e" transparent opacity={0.85} />
            </mesh>
            <mesh geometry={playGeometry} position={[-width / 2 + 0.148, 0, 0.018]} raycast={() => null}>
                <meshBasicMaterial color="#26231e" />
            </mesh>
            <Text
                font="/fonts/NotoSansSC.woff"
                fontSize={titleSize}
                color="#26231e"
                anchorX="left"
                anchorY="middle"
                position={[-width / 2 + 0.34, 0.072, 0.018]}
                maxWidth={width - 0.42}
                raycast={() => null}
            >
                {title}
            </Text>
            <Text
                font="/fonts/NotoSansSC.woff"
                fontSize={metaSize}
                color="#6a6256"
                anchorX="left"
                anchorY="middle"
                position={[-width / 2 + 0.34, -0.112, 0.018]}
                maxWidth={width - 0.42}
                raycast={() => null}
            >
                {meta}
            </Text>
        </group>
    );
};

const WallPlaque = ({ width, height, isMobile, currentIndex, totalCount }) => {
    const geometry = useMemo(() => makeTornPanelGeometry(width, height, 0.018), [width, height]);
    const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 30), [geometry]);
    const current = String(currentIndex).padStart(2, '0');
    const total = String(totalCount).padStart(2, '0');

    useEffect(() => () => {
        geometry.dispose();
        edges.dispose();
    }, [geometry, edges]);

    return (
        <group rotation={[0, 0, 0.003]}>
            <mesh raycast={() => null}>
                <primitive object={geometry} attach="geometry" />
                <meshBasicMaterial color="#f6efe2" side={THREE.DoubleSide} />
            </mesh>
            <lineSegments geometry={edges} position={[0, 0, 0.004]}>
                <lineBasicMaterial color="#8a7f6c" transparent opacity={0.24} />
            </lineSegments>
            <Text
                font="/fonts/CabinSketch-Bold.woff"
                fontSize={isMobile ? 0.4 : 0.48}
                color="#26231e"
                anchorX="center"
                anchorY="middle"
                position={[0, 0.17, 0.03]}
                letterSpacing={0.04}
                raycast={() => null}
            >
                STUDIO 01
            </Text>
            <mesh position={[-width * 0.24, -0.15, 0.03]} raycast={() => null}>
                <circleGeometry args={[0.026, 20]} />
                <meshBasicMaterial color="#9a3b2c" />
            </mesh>
            <Text
                font="/fonts/NotoSansSC.woff"
                fontSize={isMobile ? 0.15 : 0.185}
                color="#5f584d"
                anchorX="left"
                anchorY="middle"
                position={[-width * 0.21, -0.13, 0.03]}
                raycast={() => null}
            >
                {`放映 ${current} / ${total}`}
            </Text>
            <Text
                font="/fonts/NotoSansSC.woff"
                fontSize={isMobile ? 0.135 : 0.17}
                color="#6a6256"
                anchorX="center"
                anchorY="middle"
                position={[0, -0.31, 0.03]}
                raycast={() => null}
            >
                点侧屏换片 · 点主屏看详情
            </Text>
            <mesh position={[-width / 2 + 0.15, height / 2 - 0.1, 0.035]} rotation={[0, 0, 0.06]} raycast={() => null}>
                <planeGeometry args={[0.36, 0.11]} />
                <meshBasicMaterial color="#e5dac0" transparent opacity={0.95} />
            </mesh>
            <mesh position={[width / 2 - 0.15, height / 2 - 0.1, 0.035]} rotation={[0, 0, -0.06]} raycast={() => null}>
                <planeGeometry args={[0.36, 0.11]} />
                <meshBasicMaterial color="#e5dac0" transparent opacity={0.95} />
            </mesh>
        </group>
    );
};

const StudioRoom = ({ showRoom, onReady, isExiting, isWarmup }) => {
    const groupRef = useRef();
    const stageRef = useRef();
    const { camera, size, scene } = useThree();
    const layout = useMemo(() => getStageLayout(size.width), [size.width]);

    const [stageFrame, setStageFrame] = useState(null);
    const [selectedMonitor, setSelectedMonitor] = useState(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [activeProjectId, setActiveProjectId] = useState(null);
    const [activeWallSlot, setActiveWallSlot] = useState(null);

    const { openOverlay, overlayContent, isTeleporting } = useScene();
    const { showTutorial, unlockAchievement, hidePopup } = useAchievements();
    const { globalVolume, isMuted } = useAudio();
    const effectiveVolume = isMuted ? 0 : AUDIO_SETTINGS.volume * globalVolume;

    const sanityContent = useStudioContent();
    const activeContent = sanityContent || CONTENT_DATA;

    const selectedContent = useMemo(() => {
        if (!activeContent?.length) return null;
        const selected = activeProjectId
            ? activeContent.find((item) => item.id === activeProjectId)
            : null;
        if (selected) return selected;
        return [...activeContent].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    }, [activeContent, activeProjectId]);

    const heroItem = useMemo(
        () => buildHeroItem(selectedContent, layout),
        [selectedContent, layout]
    );

    const backgroundItems = useMemo(
        () => buildBackgroundItems(activeContent || [], heroItem, layout),
        [activeContent, heroItem, layout]
    );

    const playlistPositions = useMemo(
        () => new Map((activeContent || []).map((item, index) => [item.id, index + 1])),
        [activeContent]
    );
    const activePlaylistIndex = playlistPositions.get(heroItem?.id) || 1;
    const totalWorks = activeContent?.length || 0;

    // 换片时把主屏状态同步给读屏层，也让 DOM 验收能读到真实选中项。
    useEffect(() => {
        if (!heroItem) return;
        window.dispatchEvent(new CustomEvent('ciwei:studio-program', {
            detail: {
                title: heroItem.title,
                index: activePlaylistIndex,
                total: totalWorks,
            },
        }));
    }, [heroItem, activePlaylistIndex, totalWorks]);

    // 屏幕里始终是彩色成片；提前拉当前设备版本的封面，避免相机落位后主屏才出图
    useMemo(() => {
        (activeContent || []).forEach((item) => {
            const cover = item.paintedFrontTexture || item.frontTexture;
            if (cover) useDreiTexture.preload(mobileSrc(cover));
        });
    }, [activeContent]);

    const heroRef = useRef();
    const monitorRefs = useRef([]);
    const monitorOffsets = useRef([]);
    const isDraggingRef = useRef(false);
    const dragStartY = useRef(0);
    const dragStartX = useRef(0);
    const dragDistance = useRef(0);
    const fallSpeed = useRef(BASE_FALL_SPEED);
    const cameraHome = useRef(null);
    const prevOverlayContent = useRef(null);
    const hasSignaledReady = useRef(false);
    const frameCount = useRef(0);

    const audioRef = useRef();

    const { onBeforeCompile: paintOnBeforeCompile, animatePaint, resetPaint, uniformsData: paintUniforms, updateRoomOrigin } = usePaintMaterial(STUDIO_PAINT_CONFIG);

    useEffect(() => {
        if (audioRef.current && audioRef.current.setVolume) {
            audioRef.current.setVolume(effectiveVolume);
        }
    }, [effectiveVolume]);

    useEffect(() => {
        if (isExiting || isTeleporting) hidePopup();
    }, [isExiting, isTeleporting, hidePopup]);

    // 相机在开门后会再向房内飞 8 个单位；用落位后的相机推算舞台，首帧就摆正。
    // 舞台挂在场景根节点：门的墙体会做非等比挤压，若留在房间层级里会把整组拉斜。
    useLayoutEffect(() => {
        if (!showRoom || stageFrame || !heroItem) return undefined;

        const forward = camera.getWorldDirection(new THREE.Vector3());
        forward.y = 0;
        forward.normalize();
        const finalWorld = camera.position.clone().addScaledVector(forward, STUDIO_ENTER_DISTANCE);
        const stagePosition = finalWorld.clone().addScaledVector(forward, layout.heroDist);
        stagePosition.y = finalWorld.y - 2.45;
        const yaw = Math.atan2(finalWorld.x - stagePosition.x, finalWorld.z - stagePosition.z);

        setStageFrame({
            position: stagePosition.toArray(),
            yaw,
        });
        return undefined;
    }, [showRoom, stageFrame, heroItem, camera, layout.heroDist]);

    const backgroundCount = backgroundItems.length;
    useEffect(() => {
        // 选片只改主屏内容；片墙槽位和已滚动位置保持不变。
        monitorOffsets.current = Array.from(
            { length: backgroundCount },
            (_, index) => monitorOffsets.current[index] ?? 0
        );
    }, [backgroundCount]);

    useEffect(() => {
        if (showRoom && !isWarmup) {
            if (isTeleporting) {
                paintUniforms.uPaintProgress.value = 1.0;
            } else {
                resetPaint();
                animatePaint(0.2, 2.5);
            }
        } else {
            paintUniforms.uPaintProgress.value = 1.0;
        }
    }, [showRoom, isWarmup, isTeleporting, animatePaint, resetPaint, paintUniforms]);

    useEffect(() => {
        const handleWheel = (event) => {
            if (selectedMonitor || overlayContent || isAnimating || isExiting) return;
            fallSpeed.current += event.deltaY * SCROLL_SENSITIVITY;
            unlockAchievement('studio_interact');
        };
        window.addEventListener('wheel', handleWheel, { passive: true });
        return () => window.removeEventListener('wheel', handleWheel);
    }, [selectedMonitor, overlayContent, isAnimating, isExiting, unlockAchievement]);

    const handlePointerDown = useCallback((event) => {
        if (isAnimating || event.button > 0) return;
        isDraggingRef.current = true;
        dragStartY.current = event.clientY;
        dragStartX.current = event.clientX;
        dragDistance.current = 0;
        document.body.style.cursor = 'grabbing';
    }, [isAnimating]);

    const handlePointerUp = useCallback(() => {
        isDraggingRef.current = false;
        document.body.style.cursor = 'auto';
    }, []);

    const handlePointerMove = useCallback((event) => {
        if (!isDraggingRef.current || isAnimating) return;
        const clientX = typeof event.clientX === 'number'
            ? event.clientX
            : (event.touches && event.touches[0]?.clientX);
        const clientY = typeof event.clientY === 'number'
            ? event.clientY
            : (event.touches && event.touches[0]?.clientY);
        if (typeof clientX !== 'number' || typeof clientY !== 'number') return;

        const deltaX = clientX - dragStartX.current;
        const deltaY = clientY - dragStartY.current;
        dragStartX.current = clientX;
        dragStartY.current = clientY;
        dragDistance.current += Math.abs(deltaX) + Math.abs(deltaY);
        if (Math.abs(deltaY) > 0.5) {
            fallSpeed.current += deltaY * DRAG_SENSITIVITY;
            unlockAchievement('studio_interact');
        }
    }, [isAnimating, unlockAchievement]);

    useEffect(() => {
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointermove', handlePointerMove);
        return () => {
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointermove', handlePointerMove);
        };
    }, [handlePointerUp, handlePointerMove]);

    const openScreen = useCallback((item, screenRef) => {
        if (dragDistance.current > 6 || isAnimating || !screenRef?.current) return;

        setIsAnimating(true);
        setSelectedMonitor(item);
        unlockAchievement('studio_interact');

        const worldPosition = screenRef.current.getWorldPosition(new THREE.Vector3());
        const forward = camera.getWorldDirection(new THREE.Vector3());
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
        const relative = worldPosition.clone().sub(camera.position);
        const depth = relative.dot(forward);
        const xLocal = relative.dot(right);
        const yLocal = relative.y;
        const isMobile = layout.kind === 'mobile';
        const zoomDistance = item.isHero ? layout.heroZoom : (isMobile ? 4.8 : 4.2);
        const newDepth = Math.max(isMobile ? 3.8 : 4.2, depth - zoomDistance);

        cameraHome.current = {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            rotationX: camera.rotation.x,
            rotationY: camera.rotation.y,
            rotationZ: camera.rotation.z,
        };

        const targetPosition = camera.position.clone()
            .addScaledVector(forward, depth - newDepth);

        let targetRotationX = camera.rotation.x;

        if (isMobile) {
            targetPosition.addScaledVector(right, xLocal);
            const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
            const screenAngle = Math.atan2(yLocal, newDepth);
            const desiredAngle = Math.atan(0.5 * tanV);
            targetRotationX = THREE.MathUtils.clamp(
                camera.rotation.x - (desiredAngle - screenAngle),
                -0.52,
                0.16
            );
        } else {
            const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
            const desiredOffset = -0.38 * tanH * newDepth;
            targetPosition.addScaledVector(right, xLocal - desiredOffset);
        }

        gsap.to(camera.position, {
            x: targetPosition.x,
            y: targetPosition.y,
            z: targetPosition.z,
            duration: 0.55,
            ease: 'power2.inOut',
        });

        gsap.to(camera.rotation, {
            x: targetRotationX,
            y: camera.rotation.y,
            z: camera.rotation.z,
            duration: 0.55,
            ease: 'power2.inOut',
            onComplete: () => {
                setIsAnimating(false);
                openOverlay(item);
            },
        });
    }, [camera, isAnimating, layout, openOverlay, unlockAchievement]);

    const handleHeroClick = useCallback((item) => {
        openScreen(item, heroRef);
    }, [openScreen]);

    const handleBackgroundClick = useCallback((item, index) => {
        if (dragDistance.current > 6 || isAnimating) return;
        setActiveProjectId(item.id);
        setActiveWallSlot(index);
        unlockAchievement('studio_interact');
    }, [isAnimating, unlockAchievement]);

    const returnCamera = useCallback(() => {
        const home = cameraHome.current;
        if (!home) {
            setIsAnimating(false);
            setSelectedMonitor(null);
            return;
        }

        setIsAnimating(true);
        gsap.to(camera.position, {
            x: home.x,
            y: home.y,
            z: home.z,
            duration: 0.7,
            ease: 'power2.inOut',
        });
        gsap.to(camera.rotation, {
            x: home.rotationX,
            y: home.rotationY,
            z: home.rotationZ,
            duration: 0.7,
            ease: 'power2.inOut',
            onComplete: () => {
                setIsAnimating(false);
                setSelectedMonitor(null);
            },
        });
    }, [camera]);

    useEffect(() => {
        if (prevOverlayContent.current && !overlayContent && selectedMonitor && !isAnimating) {
            if (isExiting || isTeleporting) {
                setSelectedMonitor(null);
            } else {
                returnCamera();
            }
        }
        prevOverlayContent.current = overlayContent;
    }, [overlayContent, selectedMonitor, isAnimating, isExiting, isTeleporting, returnCamera]);

    useFrame((_, delta) => {
        updateRoomOrigin(stageRef.current || groupRef);

        if (!hasSignaledReady.current) {
            frameCount.current += 1;
            if (frameCount.current >= 5) {
                hasSignaledReady.current = true;
                onReady?.();
                if (!isWarmup) setTimeout(() => showTutorial('studio_interact'), 2000);
            }
        }

        if (!stageFrame || backgroundItems.length === 0) return;
        if (isDraggingRef.current || isAnimating || selectedMonitor || isExiting) return;

        const targetSpeed = fallSpeed.current >= 0 ? BASE_FALL_SPEED : -BASE_FALL_SPEED;
        fallSpeed.current = THREE.MathUtils.lerp(fallSpeed.current, targetSpeed, 1 - SPEED_DECAY);

        const totalHeight = layout.rows * layout.rowGap;
        const rowMin = heroItem.baseY + layout.wallYOffset - ((layout.rows - 1) / 2) * layout.rowGap;
        const rowMax = heroItem.baseY + layout.wallYOffset + ((layout.rows - 1) / 2) * layout.rowGap;

        backgroundItems.forEach((item, index) => {
            if (monitorOffsets.current[index] === undefined) monitorOffsets.current[index] = 0;
            monitorOffsets.current[index] -= fallSpeed.current * delta;
            const currentY = item.baseY + monitorOffsets.current[index];

            if (currentY < rowMin - layout.rowGap && fallSpeed.current > 0) {
                monitorOffsets.current[index] += totalHeight;
            } else if (currentY > rowMax + layout.rowGap && fallSpeed.current < 0) {
                monitorOffsets.current[index] -= totalHeight;
            }

            const ref = monitorRefs.current[index];
            if (ref) {
                ref.position.y = item.baseY + monitorOffsets.current[index];
            }
        });
    });

    const paperTextures = useMemo(() => {
        const wall = createPaperTexture({ base: '#f7f2e8', line: 'rgba(118, 106, 86, 0.07)' });
        wall.repeat.set(5, 3);
        const floor = createPaperTexture({ base: '#e9e1d2', line: 'rgba(110, 99, 81, 0.06)' });
        floor.repeat.set(6, 5);
        return { wall, floor, shadow: createShadowTexture(), topFade: createTopFadeTexture() };
    }, []);

    useEffect(() => () => {
        Object.values(paperTextures).forEach((texture) => texture.dispose());
    }, [paperTextures]);

    if (!heroItem || !stageFrame) {
        return <group ref={groupRef} position={[0, -1.2, 0]} />;
    }

    const benchWidth = Math.max(heroItem.width + 1.2, 3.0);
    const benchDepth = Math.max(heroItem.depth + 0.6, 1.9);
    const signWidth = layout.kind === 'mobile' ? 3.0 : 4.0;
    const signHeight = layout.kind === 'mobile' ? 0.85 : 0.95;
    const signY = heroItem.baseY + heroItem.height / 2 + (layout.kind === 'mobile' ? 1.42 : 2.0);
    const labelWidth = Math.min(Math.max(heroItem.width * 0.66, 1.0), 2.7);
    const labelHeight = labelWidth < 1.5 ? 0.44 : 0.48;
    const labelY = heroItem.baseY - heroItem.height / 2 + labelHeight / 2 + 0.15;
    const labelZ = heroItem.depth / 2 + 0.03;
    const title = heroItem.title || '最新作品';
    const meta = [
        heroItem.category,
        heroItem.durationSeconds ? `${heroItem.durationSeconds} 秒` : null,
        layout.kind === 'mobile' ? '轻点主屏 · 看详情' : '点主屏 · 看详情',
    ]
        .filter(Boolean)
        .join(' · ');
    const titleSize = Math.min(0.125, Math.max(0.075, (labelWidth - 0.62) / Math.max(title.length, 1) * 1.05));
    const metaSize = Math.max(0.058, titleSize * 0.6);
    const heroVisible = !selectedMonitor || selectedMonitor.isHero;

    const stage = (
        <group
            ref={stageRef}
            position={stageFrame.position}
            rotation={[0, stageFrame.yaw, 0]}
            onPointerDown={handlePointerDown}
        >
                {!isWarmup && (
                    <PositionalAudio
                        ref={audioRef}
                        url="/sounds/szummonitorow.mp3"
                        distanceModel="exponential"
                        refDistance={AUDIO_SETTINGS.distance}
                        rolloffFactor={AUDIO_SETTINGS.rolloff}
                        loop
                        autoplay
                        volume={effectiveVolume}
                        position={[0, heroItem.baseY, 0]}
                    />
                )}

                {/* 墙面 */}
                <mesh position={[0, 6.2, -5.8]} raycast={() => null}>
                    <planeGeometry args={[26, 13]} />
                    <meshBasicMaterial map={paperTextures.wall} toneMapped={false} />
                </mesh>

                {/* 地面 */}
                <mesh position={[0, 0, 3.5]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                    <planeGeometry args={[26, 24]} />
                    <meshBasicMaterial map={paperTextures.floor} toneMapped={false} />
                </mesh>

                {/* 顶部柔化：让片墙自然消失在纸雾里，而不是被视口硬切 */}
                <mesh position={[0, 10.5, -3.95]} raycast={() => null} renderOrder={10}>
                    <planeGeometry args={[26, 7]} />
                    <meshBasicMaterial
                        map={paperTextures.topFade}
                        transparent
                        depthWrite={false}
                        toneMapped={false}
                    />
                </mesh>

                {/* 踢脚线 */}
                <mesh position={[0, 0.1, -5.74]}>
                    <boxGeometry args={[26, 0.2, 0.12]} />
                    <meshBasicMaterial color="#d9d0c1" />
                    <Edges color="#8a8070" threshold={20} />
                </mesh>

                {/* 空白墙面/地面也响应上下拖动 */}
                <mesh position={[0, 5, -4.9]}>
                    <planeGeometry args={[30, 14]} />
                    <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                </mesh>
                <mesh position={[0, 0.004, 2]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[30, 20]} />
                    <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                </mesh>

                {/* 墙面标签 */}
                <group position={[0, signY, -3.35]}>
                    <WallPlaque
                        width={signWidth}
                        height={signHeight}
                        isMobile={layout.kind === 'mobile'}
                        currentIndex={activePlaylistIndex}
                        totalCount={totalWorks}
                    />
                </group>

                {/* 矮柜 */}
                <group>
                    <mesh position={[0, 0.55, -0.85]}>
                        <boxGeometry args={[benchWidth, 0.14, benchDepth]} />
                        <meshBasicMaterial color="#e7decf" />
                        <Edges color="#756b5b" threshold={20} />
                    </mesh>
                    <mesh position={[0, 0.29, -0.85]}>
                        <boxGeometry args={[benchWidth * 0.92, 0.42, benchDepth * 0.88]} />
                        <meshBasicMaterial color="#ded4c2" />
                        <Edges color="#756b5b" threshold={20} />
                    </mesh>
                    <mesh position={[0, 0.3, -0.85 + benchDepth / 2 + 0.008]}>
                        <boxGeometry args={[benchWidth * 0.74, 0.016, 0.014]} />
                        <meshBasicMaterial color="#9b8f7b" />
                    </mesh>
                    <mesh position={[-0.38, 0.3, -0.85 + benchDepth / 2 + 0.03]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.028, 0.028, 0.035, 12]} />
                        <meshBasicMaterial color="#8e816d" />
                    </mesh>
                    <mesh position={[0.38, 0.3, -0.85 + benchDepth / 2 + 0.03]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.028, 0.028, 0.035, 12]} />
                        <meshBasicMaterial color="#8e816d" />
                    </mesh>
                    <mesh position={[0, 0.012, -0.8]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                        <planeGeometry args={[benchWidth + 2.4, benchDepth + 2.2]} />
                        <meshBasicMaterial map={paperTextures.shadow} transparent depthWrite={false} />
                    </mesh>
                </group>

                {/* 场记板 */}
                <group
                    position={[benchWidth / 2 - 0.85, 0.24, -0.85 + benchDepth / 2 + 0.12]}
                    rotation={[-0.12, -0.1, 0.03]}
                >
                    <Clapperboard />
                </group>

                {/* 主屏 */}
                <group visible={heroVisible}>
                    <MonitorBlock
                        item={heroItem}
                        meshRef={heroRef}
                        isSelected={selectedMonitor?.isHero === true}
                        onMonitorClick={handleHeroClick}
                        disabled={isAnimating}
                        paintOnBeforeCompile={paintOnBeforeCompile}
                        paintUniforms={paintUniforms}
                    />

                    <HeroVideoScreen
                        src={heroItem.preview}
                        width={heroItem.width}
                        height={heroItem.height}
                        depth={heroItem.depth}
                        position={[0, heroItem.baseY, 0]}
                        active={!selectedMonitor && !overlayContent && !isExiting && !isTeleporting}
                    />

                    {/* 主屏下三分之一信息条 */}
                    <group position={[0, labelY, labelZ]}>
                        <HeroCaption
                            width={labelWidth}
                            height={labelHeight}
                            title={title}
                            meta={meta}
                            titleSize={titleSize}
                            metaSize={metaSize}
                        />
                    </group>
                </group>

                {/* 两侧片墙 */}
                <group>
                    {backgroundItems.map((item, index) => (
                        <MonitorBlock
                            key={`${item.id}-${index}`}
                            item={item}
                            meshRef={(element) => { monitorRefs.current[index] = element; }}
                            isSelected={activeWallSlot === index}
                            isCurrent={activeWallSlot === index}
                            playlistIndex={playlistPositions.get(item.id) || 1}
                            totalCount={totalWorks}
                            onMonitorClick={(clickedItem) => handleBackgroundClick(clickedItem, index)}
                            disabled={isAnimating}
                            paintOnBeforeCompile={paintOnBeforeCompile}
                            paintUniforms={paintUniforms}
                        />
                    ))}
                </group>
        </group>
    );

    return (
        <>
            <group ref={groupRef} position={[0, -1.2, 0]} />
            {createPortal(stage, scene)}
        </>
    );
};

export default StudioRoom;
