import { useState, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, PositionalAudio } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import SkyChunk, { CHUNK_LENGTH, ROOM_Z } from './SkyChunk';
import '../../shaders/RevealBasicMaterial'; // Registers brush-stroke reveal for BasicMaterial
import { isTouchDevice } from '../../../../utils/deviceDetect';
import { useColorTexture } from '../../../../utils/colorTexture';
import { BALLOON_CONFIG, balloonSketchUrl } from '../../../../data/balloonConfig';

// Reusable Vector3 to avoid allocations in event handlers
const _tempVec3 = new THREE.Vector3();

/**
 * InfiniteSkyManager Component
 * 
 * Manages dynamic generation/removal of sky chunks for infinite scroll.
 * World group moves with scroll, chunks stay at fixed positions relative to group.
 * Includes Story Milestones that loop with the content!
 */

import { useAudio } from '../../../../context/useAudio';

// 本文件内部使用，无需导出
const BALLOON_AUDIO_SETTINGS = {
    volume: 1.0,
    distance: 2,
    rolloff: 2
};

// Story milestones configuration
// Each milestone appears once per "story cycle" (4 chunks = 160 units)
const STORY_CYCLE_LENGTH = 160;

// === TWARDA LINIA ZANIKANIA DLA MILESTONES (WORLD SPACE) ===
// About 房间在 Z=-25，所以 -25 是房门位置
// -27 = 门内 2 米（房间深处）——须与 SkyChunk 的 CORRIDOR_CLIP_Z 一致
const MILESTONE_CORRIDOR_CLIP_Z = -8.0;

const InfiniteSkyManager = ({ scrollProgressRef }) => {
    // 房间级分批挂载：首帧只挂当前天空块与当前故事周期，其余随滚动/首帧后补
    const [activeChunks, setActiveChunks] = useState([0, 1]);
    // currentStoryCycle = floor(0/160) = 0 -> [0]
    const [activeStoryCycles, setActiveStoryCycles] = useState([0]);
    // 首帧稳定后再补邻接块/周期，避免房间首次编译带满
    const [warm, setWarm] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setWarm(true), 1200);
        return () => clearTimeout(timer);
    }, []);
    const worldRef = useRef();

    // Track current chunk for recycling
    const getCurrentChunk = (worldZ) => {
        return Math.floor(worldZ / CHUNK_LENGTH);
    };

    // Track current story cycle
    const getCurrentStoryCycle = (worldZ) => {
        return Math.floor(worldZ / STORY_CYCLE_LENGTH);
    };

    // Update chunks based on world position
    useFrame(() => {
        if (!worldRef.current) return;

        const scrollProgress = scrollProgressRef?.current || 0;

        // Move world directly
        worldRef.current.position.z = scrollProgress;

        // Figure out which chunk we're in
        const currentChunk = getCurrentChunk(scrollProgress);
        const shouldBeActiveChunks = warm
            ? [currentChunk - 1, currentChunk, currentChunk + 1, currentChunk + 2]
            : [currentChunk, currentChunk + 1];

        const chunksNeedUpdate = shouldBeActiveChunks.some(c => !activeChunks.includes(c)) ||
            activeChunks.some(c => !shouldBeActiveChunks.includes(c));

        if (chunksNeedUpdate) {
            setActiveChunks(shouldBeActiveChunks);
        }

        // Update story cycles
        const currentStoryCycle = getCurrentStoryCycle(scrollProgress);
        const shouldBeActiveCycles = warm
            ? [currentStoryCycle - 1, currentStoryCycle, currentStoryCycle + 1]
            : [currentStoryCycle];

        const cyclesNeedUpdate = shouldBeActiveCycles.some(c => !activeStoryCycles.includes(c)) ||
            activeStoryCycles.some(c => !shouldBeActiveCycles.includes(c));

        if (cyclesNeedUpdate) {
            setActiveStoryCycles(shouldBeActiveCycles);
        }
    });

    return (
        <group ref={worldRef}>
            {/* === SKY CHUNKS WITH CLOUDS === */}
            {activeChunks.map((chunkIndex) => (
                <SkyChunk
                    key={`sky-chunk-${chunkIndex}`}
                    chunkIndex={chunkIndex}
                    seed={42}
                    scrollProgressRef={scrollProgressRef}
                />
            ))}

            {/* === STORY MILESTONES (loop every 160 units) === */}
            {activeStoryCycles.map((cycleIndex) => (
                <group key={`story-cycle-${cycleIndex}`}>
                    {/* === INTRO MILESTONE === */}
                    <IntroMilestone
                        z={-(cycleIndex * STORY_CYCLE_LENGTH + 15)}
                        scrollProgressRef={scrollProgressRef}
                    />

                    {/* === JOURNEY MILESTONE === */}
                    <JourneyMilestone
                        z={-(cycleIndex * STORY_CYCLE_LENGTH + 95)}
                        scrollProgressRef={scrollProgressRef}
                    />

                    {/* === SKILLS MILESTONE === */}

                    <SkillsMilestone
                        z={-(cycleIndex * STORY_CYCLE_LENGTH + 135)}
                        scrollProgressRef={scrollProgressRef}
                    />
                </group>
            ))}
        </group>
    );
};

/**
 * INTRO Milestone - Special detailed layout
 * Elements spread apart as they approach camera
 */
const IntroMilestone = ({ z, scrollProgressRef }) => {
    const avatarTexture = useColorTexture('/textures/about/awatarnachmurce.webp');
    const groupRef = useRef();

    const avatarWidth = 5.2;
    const avatarHeight = avatarWidth / (2816 / 1536);

    useFrame((state) => {
        if (!groupRef.current) return;

        const scrollProgress = scrollProgressRef?.current || 0;
        const worldZ = ROOM_Z + scrollProgress + z;
        groupRef.current.visible = worldZ < MILESTONE_CORRIDOR_CLIP_Z;
        if (!groupRef.current.visible) return;

        const time = state.clock.elapsedTime;
        groupRef.current.position.y = Math.sin(time * 0.5) * 0.1;
        groupRef.current.rotation.z = Math.sin(time * 0.3) * 0.006;
    });

    return (
        <group ref={groupRef} position={[0, 0, z]}>
            <mesh position={[0, 2.1, 0]} renderOrder={25}>
                <planeGeometry args={[avatarWidth, avatarHeight]} />
                <meshBasicMaterial color="#e0e0e0"
                    map={avatarTexture}
                    transparent
                    side={THREE.DoubleSide}
                    depthTest={false}
                    depthWrite={false}
                    alphaTest={0.01}
                    fog={false}
                    toneMapped={false}
                />
            </mesh>
        </group>
    );
};


/**
 * JOURNEY Milestone - Floating Islands
 * UO Island (left) and Freelance Island (right) floating in clouds
 */
const JourneyMilestone = ({ z, scrollProgressRef }) => {
    const groupRef = useRef();
    const uoRef = useRef();
    const freelanceRef = useRef();

    // Load textures
    const uoTexture = useColorTexture('/textures/about/uowyspa.webp');
    const freelanceTexture = useColorTexture('/textures/about/freelancewyspa.webp');

    // Texture settings
    uoTexture.colorSpace = THREE.SRGBColorSpace;
    freelanceTexture.colorSpace = THREE.SRGBColorSpace;

    // Calculate aspect ratios to keep images 1:1 (not stretched)
    // LEGACY FIX: Use original dimensions (2816x1536)
    const islandLegacyAspect = 2816 / 1536;
    const uoAspect = islandLegacyAspect;
    const freelanceAspect = islandLegacyAspect;

    // Base height for islands - width will adjust automatically
    const islandHeight = 4.5;

    useFrame((state) => {
        if (!groupRef.current) return;

        // === 硬裁剪线（手动计算世界 Z）===
        const scrollProgress = scrollProgressRef?.current || 0;
        const worldZ = ROOM_Z + scrollProgress + z;
        groupRef.current.visible = worldZ < MILESTONE_CORRIDOR_CLIP_Z;
        if (!groupRef.current.visible) return;

        const time = state.clock.elapsedTime;

        // FIX: Use consistent distance based on scrollProgress + offset
        const distanceZ = z + scrollProgress - 55;

        // Reveal effect (islands float up from below clouds)
        // === 此处调整（JOURNEY）===
        const revealStart = -100; // 更早开始
        const revealEnd = -20;
        let revealFactor = 0;

        if (distanceZ > revealStart && distanceZ < revealEnd) {
            revealFactor = (distanceZ - revealStart) / (revealEnd - revealStart);
            revealFactor = Math.min(1, Math.max(0, revealFactor));
            revealFactor = 1 - Math.pow(1 - revealFactor, 2);
        } else if (distanceZ >= revealEnd) {
            revealFactor = 1;
        }

        // Floating animation (bobbing)
        // UO Island (Left)
        if (uoRef.current) {
            // === 此处调整位置（UO）===
            const startY = -2;
            const endY = 1.5;

            const currentBaseY = startY + revealFactor * (endY - startY);
            uoRef.current.position.y = currentBaseY + Math.sin(time * 0.5) * 0.2;
            uoRef.current.rotation.z = Math.sin(time * 0.3) * 0.05;
        }

        // Freelance Island (Right)
        if (freelanceRef.current) {
            // === 此处调整位置（Freelance）===
            const startY = -1;
            const endY = 2.5;

            const currentBaseY = startY + revealFactor * (endY - startY);
            freelanceRef.current.position.y = currentBaseY + Math.sin(time * 0.4 + 2) * 0.25;
            freelanceRef.current.rotation.z = Math.sin(time * 0.2 + 1) * -0.05;
        }
    });

    return (
        <group ref={groupRef} position={[0, 0, z]}>
            <mesh position={[0, 4.6, 0.1]}>
                <planeGeometry args={[7, 1.8]} />
                <meshBasicMaterial color="#f7f1e5" transparent opacity={0.94} side={THREE.DoubleSide} toneMapped={false} fog={false} />
            </mesh>
            <Text
                position={[-3.15, 5.25, 0.4]}
                fontSize={0.16}
                color="#6a6256"
                anchorX="left"
                anchorY="middle"
                font="/fonts/NotoSansSC-3D.woff"
            >
                02 / 03
            </Text>
            <Text
                position={[0, 4.85, 0.4]}
                fontSize={1.1}
                color="#1a1a1a"
                anchorX="center"
                anchorY="middle"
                font="/fonts/NotoSansSC-3D.woff"
            >
                经历
            </Text>
            <Text
                position={[0, 4.05, 0.4]}
                fontSize={0.33}
                color="#4a4a4a"
                anchorX="center"
                anchorY="middle"
                font="/fonts/NotoSansSC-3D.woff"
            >
                商业影片 · 自媒体长期供稿
            </Text>

            {/* === UO ISLAND (Left) === */}
            <group ref={uoRef} position={[-3.5, -1, 0]}>
                <mesh>
                    <planeGeometry args={[islandHeight * uoAspect, islandHeight]} />
                    <meshBasicMaterial color="#e0e0e0"
                        map={uoTexture}
                        transparent
                        side={THREE.DoubleSide}
                        alphaTest={0.01}
                        toneMapped={false}
                        fog={false}
                    />
                </mesh>
                {/* 岛上文字（UO）—— 此处调整 */}
                <Text
                    position={[0.1, -0.85, 0.1]} // 位置 (X, Y, Z)
                    fontSize={0.4}           // 字号
                    color="#1a1a1a"
                    anchorX="center"
                    anchorY="middle"
                    font="/fonts/NotoSansSC-3D.woff"
                >
                    2025-NOW
                </Text>
            </group>

            {/* === FREELANCE ISLAND (Right) === */}
            <group ref={freelanceRef} position={[3.5, -2, 0.5]}>
                <mesh>
                    <planeGeometry args={[islandHeight * freelanceAspect, islandHeight]} />
                    <meshBasicMaterial color="#e0e0e0"
                        map={freelanceTexture}
                        transparent
                        side={THREE.DoubleSide}
                        alphaTest={0.01}
                        toneMapped={false}
                        fog={false}
                    />
                </mesh>
                {/* 岛上文字（Freelance）—— 此处调整 */}
                <Text
                    position={[0, -0.65, 0.1]} // 位置 (X, Y, Z)
                    fontSize={0.5}           // 字号
                    color="#1a1a1a"
                    anchorX="center"
                    anchorY="middle"
                    font="/fonts/NotoSansSC-3D.woff"
                >
                    2023-NOW
                </Text>
            </group>
        </group>
    );
};

/**
 * SKILLS Milestone - Floating Balloons
 * Colorful balloons floating upward, each representing a skill
 */

// 气球配置与贴图路径推导来自共享数据源 src/data/balloonConfig.js
// （构建期 node pipeline/make-balloons.mjs 据其生成 webp，与运行期永远一致）
// 气球位置/尺寸倍率：SIZE_MULTIPLIERS 在下方按 size 分级。

// Size multipliers for balloon categories
const SIZE_MULTIPLIERS = {
    large: 3.0,
    medium: 2.2,
    small: 1.6,
};

// Individual balloon component
const SkillBalloon = ({ config, revealFactorRef, spreadFactorRef, timeRef }) => {
    const isTouch = isTouchDevice();

    // 构建期生成的 webp（pipeline/make-balloons.mjs）：素描版 + 上色版
    // 两版同一随机种子绘制，线稿与色块严格对齐，供 reveal 揭示
    // 彩色模式切换后 useColorTexture 会异步换成 painted 版本；线稿模式保持素描
    const texture = useColorTexture(balloonSketchUrl(config));
    const paintedTexture = texture;
    texture.colorSpace = THREE.SRGBColorSpace;
    paintedTexture.colorSpace = THREE.SRGBColorSpace;

    const [isPopping, setIsPopping] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [isFadingOutText, setIsFadingOutText] = useState(false);
    const popRef = useRef(0);
    const textFadeRef = useRef(1); // 1 = fully visible, 0 = hidden
    const respawnOffsetRef = useRef(0); // For floating back up after respawn
    const balloonRevealRef = useRef(); // RevealBasicMaterial ref for sketch
    const paintedMeshRef = useRef(); // Painted balloon mesh visibility
    const paintedMatRef = useRef(); // Painted balloon material opacity control
    const hideDelayRef = useRef(); // Track pending gsap.delayedCall
    const textRef = useRef();

    // Audio Ref
    const balloonAudioRef = useRef();
    const { globalVolume, isMuted } = useAudio();

    const playBalloonSound = () => {
        if (balloonAudioRef.current) {
            const vol = isMuted ? 0 : BALLOON_AUDIO_SETTINGS.volume * globalVolume;
            balloonAudioRef.current.setVolume(vol);
            if (balloonAudioRef.current.isPlaying) balloonAudioRef.current.stop();
            balloonAudioRef.current.play();
        }
    };

    // 宽高比由配置直接给出（自绘气球不再需要按原图文件名查表）
    const aspect = config.aspect;
    const baseHeight = SIZE_MULTIPLIERS[config.size];

    const outerGroupRef = useRef();
    const innerGroupRef = useRef();
    const targetScale = useRef(1.0);
    const currentScale = useRef(1.0);
    const targetMagnet = useRef({ x: 0, y: 0 });
    const currentMagnet = useRef({ x: 0, y: 0 });

    // === 响应式 ===
    // 移动端（窄视口）气球更靠近中心
    const positionScale = isTouch ? 0.5 : 1; // 移动端位置压缩程度
    const spreadScale = isTouch ? 0.4 : 1;   // 移动端散布收缩比例
    const sizeScale = isTouch ? 0.85 : 1;    // 移动端气球略小

    // Cursor handling
    useEffect(() => {
        if (hovered && !isPopping) {
            document.body.style.cursor = 'pointer';
        } else {
            document.body.style.cursor = 'auto';
        }
    }, [hovered, isPopping]);

    // Handle text fade out timer
    useEffect(() => {
        if (isPopping) {
            // Start fading out text after 3 seconds
            const timer = setTimeout(() => {
                setIsFadingOutText(true);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isPopping]);

    // Hover handlers for brush-stroke reveal
    const handlePointerOver = (e) => {
        if (isTouch) return;
        e.stopPropagation();
        if (!isPopping) setHovered(true);

        // Brush-stroke reveal: show painted balloon
        if (balloonRevealRef.current) {
            gsap.to(balloonRevealRef.current, {
                uProgress: 1.0,
                duration: 0.8,
                ease: 'power2.out',
                overwrite: true
            });
        }
        if (hideDelayRef.current) hideDelayRef.current.kill();
        if (paintedMeshRef.current) paintedMeshRef.current.visible = true;
        if (paintedMatRef.current) paintedMatRef.current.opacity = 1;
    };

    const handlePointerOut = (e) => {
        if (isTouch) return;
        e.stopPropagation();
        setHovered(false);

        // Reverse reveal
        if (balloonRevealRef.current) {
            gsap.to(balloonRevealRef.current, {
                uProgress: 0.0,
                duration: 0.5,
                ease: 'power2.out',
                overwrite: true
            });
        }
        hideDelayRef.current = gsap.delayedCall(0.55, () => {
            if (paintedMatRef.current) paintedMatRef.current.opacity = 0;
        });
    };

    // Animation update loop
    useFrame((state, delta) => {
        if (hovered && !isPopping) {
            targetScale.current = 1.05; // 轻微放大
        } else {
            targetScale.current = 1.0;
            targetMagnet.current.x = 0;
            targetMagnet.current.y = 0;
        }

        currentScale.current = THREE.MathUtils.lerp(currentScale.current, targetScale.current, 8 * delta);
        currentMagnet.current.x = THREE.MathUtils.lerp(currentMagnet.current.x, targetMagnet.current.x, 8 * delta);
        currentMagnet.current.y = THREE.MathUtils.lerp(currentMagnet.current.y, targetMagnet.current.y, 8 * delta);

        if (isPopping) {
            // Smooth, slow pop animation
            popRef.current = THREE.MathUtils.lerp(popRef.current, 1, 2.5 * delta);

            // Also hide painted mesh during pop (kill any pending reveals)
            if (hideDelayRef.current) hideDelayRef.current.kill();
            if (balloonRevealRef.current) {
                balloonRevealRef.current.uProgress = 0;
            }
        }

        if (isFadingOutText) {
            // Fade out the text slowly
            textFadeRef.current = THREE.MathUtils.lerp(textFadeRef.current, 0, 2 * delta);

            // Once fully faded, respawn the balloon from below
            if (textFadeRef.current < 0.05) {
                setIsPopping(false);
                setHovered(false);
                setIsFadingOutText(false);
                popRef.current = 0;
                textFadeRef.current = 1;
                respawnOffsetRef.current = -12; // Teleport below to float up again

                // Immediately teleport the mesh to prevent pointer events at the old location
                if (outerGroupRef.current) {
                    outerGroupRef.current.position.y -= 12;
                }

                // Immediately reset opacities to prevent flashing
                if (balloonRevealRef.current) balloonRevealRef.current.opacity = 1;
                if (textRef.current) textRef.current.fillOpacity = 0;
                // Reset reveal state on respawn
                if (balloonRevealRef.current) balloonRevealRef.current.uProgress = 0;
                if (paintedMatRef.current) paintedMatRef.current.opacity = 0;
                if (paintedMeshRef.current) paintedMeshRef.current.visible = false;
            }
        }

        // Float back up if respawning
        if (respawnOffsetRef.current < -0.01) {
            respawnOffsetRef.current = THREE.MathUtils.lerp(respawnOffsetRef.current, 0, 1.5 * delta);
        }

        // Apply opacities if not fully respawned
        if (balloonRevealRef.current && isPopping) {
            balloonRevealRef.current.opacity = 1 - popRef.current;
        }
        if (paintedMatRef.current && isPopping) {
            paintedMatRef.current.opacity = 1 - popRef.current;
        }
        if (textRef.current && isPopping) {
            // Combine pop-in and fade-out opacities
            textRef.current.fillOpacity = popRef.current * textFadeRef.current;
            textRef.current.outlineOpacity = popRef.current * textFadeRef.current;
        }
    });

    // Floating animation with unique phase — now computed inside useFrame
    // Moved from render body to avoid re-renders

    // Bazowa pozycja X (skalowana na mobile)
    const baseX = config.x * positionScale;

    // P2: Compute position/scale/rotation imperatively inside useFrame
    useFrame(() => {
        if (!outerGroupRef.current) return;

        const time = timeRef.current;
        const revealFactor = revealFactorRef.current;
        const spreadFactor = spreadFactorRef.current;

        // Floating animation with unique phase
        const floatY = Math.sin(time * 0.6 + config.phase) * 0.3;
        const floatX = Math.sin(time * 0.4 + config.phase * 0.7) * 0.15;
        const rotation = Math.sin(time * 0.3 + config.phase) * 0.08;

        // Reveal: balloons float up from below, including respawn offset
        const startY = config.y - 8;
        const endY = config.y;
        const currentY = startY + revealFactor * (endY - startY) + floatY + respawnOffsetRef.current;

        // Scale up as they reveal
        let scale = revealFactor * sizeScale;
        const popScaleEffect = currentScale.current + popRef.current * 0.4;
        scale *= popScaleEffect;

        // === SPREAD EFFECT (ROZSUWANIE) ===
        const maxSpread = 15 * spreadScale;
        let spreadX = 0;

        if (config.x < -0.5) {
            spreadX = -spreadFactor * maxSpread * (0.5 + Math.abs(config.x) / 6);
        } else if (config.x > 0.5) {
            spreadX = spreadFactor * maxSpread * (0.5 + Math.abs(config.x) / 6);
        } else {
            spreadX = config.phase > 3.5
                ? spreadFactor * maxSpread * 0.8
                : -spreadFactor * maxSpread * 0.8;
        }

        // Apply imperatively
        outerGroupRef.current.position.set(baseX + floatX + spreadX, currentY, config.z);
        outerGroupRef.current.rotation.z = rotation;
        const s = Math.max(0.001, scale); // Avoid zero scale
        outerGroupRef.current.scale.set(s, s, s);

        // Update magnet position on inner group imperatively
        if (innerGroupRef.current) {
            innerGroupRef.current.position.set(currentMagnet.current.x, currentMagnet.current.y, 0);
        }
    });

    return (
        <group
            ref={outerGroupRef}
            position={[baseX, config.y - 8, config.z]}
        >
            <group ref={innerGroupRef}>
                {/* Painted balloon (behind) - hidden until hover */}
                <mesh ref={paintedMeshRef} visible={true}>
                    <planeGeometry args={[baseHeight * aspect, baseHeight]} />
                    <meshBasicMaterial color="#e0e0e0"
                        ref={paintedMatRef}
                        map={paintedTexture}
                        transparent
                        opacity={0}
                        side={THREE.DoubleSide}
                        alphaTest={0.01}
                        depthWrite={false}
                        toneMapped={false}
                        fog={false}
                    />
                </mesh>

                {/* Sketch balloon (front) with brush-stroke reveal */}
                <mesh
                    position={[0, 0, 0.001]}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!isPopping) {
                            setIsPopping(true);
                            playBalloonSound();
                        }
                    }}
                    onPointerOver={handlePointerOver}
                    onPointerOut={handlePointerOut}
                    onPointerMove={(e) => {
                        if (hovered && !isPopping && outerGroupRef.current) {
                            outerGroupRef.current.getWorldPosition(_tempVec3);
                            // Reduced magnetic pull from 0.5 to 0.15 for gentler effect
                            targetMagnet.current.x = (e.point.x - _tempVec3.x) * 0.15;
                            targetMagnet.current.y = (e.point.y - _tempVec3.y) * 0.15;
                        }
                    }}
                    visible={popRef.current < 0.99}
                >
                    <planeGeometry args={[baseHeight * aspect, baseHeight]} />
                    <revealBasicMaterial
                        ref={balloonRevealRef}
                        map={texture}
                        transparent
                        side={THREE.DoubleSide}
                        depthWrite={false}
                        alphaTest={0.01}
                        toneMapped={false}
                        fog={false}
                        uProgress={0.0}
                    />
                </mesh>

                {/* Stack Name Text that fades in then out */}
                {isPopping && textFadeRef.current > 0.01 && (
                    <Text
                        ref={textRef}
                        position={[0, 0, 0.1]}
                        fontSize={baseHeight * 0.4}
                        color="#1a1a1a"
                        anchorX="center"
                        anchorY="middle"
                        font="/fonts/NotoSansSC-3D.woff"
                        fillOpacity={0}
                        outlineWidth={0.02}
                        outlineColor="#fff"
                        outlineOpacity={0}
                    >
                        {config.label}
                    </Text>
                )}

                <PositionalAudio
                    ref={balloonAudioRef}
                    url="/sounds/baloonpoop.mp3"
                    distanceModel="exponential"
                    rolloffFactor={BALLOON_AUDIO_SETTINGS.rolloff}
                    refDistance={BALLOON_AUDIO_SETTINGS.distance}
                    loop={false}
                />
            </group>
        </group>
    );
};

const SkillsMilestone = ({ z, scrollProgressRef }) => {
    const groupRef = useRef();
    // P2: Use refs instead of state to avoid 60 re-renders/sec inside useFrame
    const revealFactorRef = useRef(0);
    const spreadFactorRef = useRef(0);
    const timeRef = useRef(0);

    useFrame((state) => {
        if (!groupRef.current) return;

        // === 硬裁剪线（手动计算世界 Z）===
        const scrollProgress = scrollProgressRef?.current || 0;
        const worldZ = ROOM_Z + scrollProgress + z;
        groupRef.current.visible = worldZ < MILESTONE_CORRIDOR_CLIP_Z;
        if (!groupRef.current.visible) return;

        timeRef.current = state.clock.elapsedTime;

        // FIX: Use consistent distance based on scrollProgress + offset
        const distanceZ = z + scrollProgress - 55;

        // Reveal effect (balloons float up)
        // === 此处调整（SKILLS REVEAL）===
        const revealStart = -100;
        const revealEnd = -25;
        let newRevealFactor = 0;

        if (distanceZ > revealStart && distanceZ < revealEnd) {
            newRevealFactor = (distanceZ - revealStart) / (revealEnd - revealStart);
            newRevealFactor = Math.min(1, Math.max(0, newRevealFactor));
            newRevealFactor = 1 - Math.pow(1 - newRevealFactor, 3); // ease out cubic
        } else if (distanceZ >= revealEnd) {
            newRevealFactor = 1;
        }

        revealFactorRef.current = newRevealFactor;

        // === 散布效果（此处调整 SKILLS SPREAD）===
        // 越靠近相机，气球散开越明显
        // 范围越大 = 动画越长越明显
        const spreadStart = -70; // 动画开始时机（更早）
        const spreadEnd = -40;    // 动画完成时机（更晚）
        let newSpreadFactor = 0;

        if (distanceZ > spreadStart && distanceZ < spreadEnd) {
            newSpreadFactor = (distanceZ - spreadStart) / (spreadEnd - spreadStart);
            newSpreadFactor = Math.min(1, Math.max(0, newSpreadFactor));
            newSpreadFactor = newSpreadFactor * newSpreadFactor; // ease in
        } else if (distanceZ >= spreadEnd) {
            newSpreadFactor = 1;
        }

        spreadFactorRef.current = newSpreadFactor;
    });

    return (
        <group ref={groupRef} position={[0, 0, z]}>
            <mesh position={[0, 5.6, 0.1]}>
                <planeGeometry args={[7, 1.8]} />
                <meshBasicMaterial color="#f7f1e5" transparent opacity={0.94} side={THREE.DoubleSide} toneMapped={false} fog={false} />
            </mesh>
            <Text
                position={[-3.15, 6.25, 0.4]}
                fontSize={0.16}
                color="#6a6256"
                anchorX="left"
                anchorY="middle"
                font="/fonts/NotoSansSC-3D.woff"
            >
                03 / 03
            </Text>
            <Text
                position={[0, 5.85, 0.4]}
                fontSize={1.1}
                color="#1a1a1a"
                anchorX="center"
                anchorY="middle"
                font="/fonts/NotoSansSC-3D.woff"
            >
                手艺
            </Text>
            <Text
                position={[0, 5.05, 0.4]}
                fontSize={0.33}
                color="#4a4a4a"
                anchorX="center"
                anchorY="middle"
                font="/fonts/NotoSansSC-3D.woff"
            >
                剪辑 · 调色 · 影像叙事
            </Text>

            {/* === FLOATING BALLOONS === */}
            {BALLOON_CONFIG.map((config, index) => (
                <SkillBalloon
                    key={index}
                    config={config}
                    revealFactorRef={revealFactorRef}
                    spreadFactorRef={spreadFactorRef}
                    timeRef={timeRef}
                />
            ))}
        </group>
    );
};

// =========================================
// NOTE: Use this component inside the loop!
// =========================================

export default InfiniteSkyManager;
