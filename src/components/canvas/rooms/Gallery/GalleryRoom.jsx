import React, { Suspense, useRef, useState, useMemo, useEffect, useLayoutEffect, useCallback, forwardRef, useImperativeHandle, memo } from 'react';
import { Text as TroikaText } from 'troika-three-text';
import { useThree, useFrame } from '@react-three/fiber';
// 全站彩色：桌面端自动取 _painted 彩色版（见 utils/colorTexture.js）
import { useColorTexture as useTexture, paintedSrc, COLOR_DEFAULT } from '../../../../utils/colorTexture';
import * as THREE from 'three';
import gsap from 'gsap';
import { Observer } from 'gsap/all';
import { useScene } from '../../../../context/useScene';

gsap.registerPlugin(Observer);
import { useAchievements } from '../../../../context/useAchievements';
import PaperMaterial from './PaperMaterial';
import GalleryClouds from './GalleryClouds';
import { useAudio } from '../../../../context/useAudio';
import { usePaintMaterial } from './usePaintMaterial';
import { useGalleryProjects } from '../../../../hooks/useSanityData';

// Reusable Vector3 to avoid allocations in useFrame
const _tempScale = new THREE.Vector3();

// ============================================
// ⚙️ AUDIO SETTINGS - TWEAK HERE
// 调整这些值可改变城市环境音的音量与可听范围
// ============================================
// 本文件内部使用，无需导出
const AUDIO_SETTINGS = {
    volume: 0.6,
    distance: 2,
    rolloff: 1.5
};

const GALLERY_INTERACTION_AUDIO_SETTINGS = {
    volume: 0.6,      // Volume for the paper clicking sound
    distance: 2,      // Reference distance for spatial audio before it starts dropping off
    rolloff: 2        // How fast the sound fades away (exponential)
};

// 数据兜底（2026-10-12 换血）：原 ITom 英文长文 fallback 已废弃——
// 数据加载失败时会冒出「别人的项目」，正是用户点名「为什么还存在」的内容。
// 现与本地数据同源：直接取 ciwei-projects.json 前 4 个（形状一致）。
import ciweiProjectsFallback from '../../../../data/ciwei-projects.json';
const FALLBACK_PROJECTS = ciweiProjectsFallback.slice(0, 4);

// PROJECT_COUNT 已移至组件内动态计算（长廊分段：卡片 + 类间隔断，见 GalleryRoom 内）
const GAP = 2.5;

// 调整这些值以匹配小鸟比例（旧比例 1.41）
const BIRD_WIDTH = 0.49;
const BIRD_HEIGHT = 0.35;

// Adjust this value (0.0 to 1.0) to crop the right side of the "Houses" graphic.
// 0.0 = No crop
// 0.2 = 20% crop from the right (corridor side)
const RIGHT_CROP_AMOUNT = 0.2;

// 与 drei <Text> 相同的 troika 文本，但不走 suspend 字体预载。
// 30 张卡 × 多处文字若逐个 suspend，进画廊会串行等字体约 8 秒（纸张一直不合）。
const GalleryText = forwardRef(({ children, ...props }, ref) => {
    const invalidate = useThree(({ invalidate }) => invalidate);
    const [troikaMesh] = useState(() => new TroikaText());
    const [nodes, text] = useMemo(() => {
        const n = [];
        let t = '';
        React.Children.forEach(children, (child) => {
            if (typeof child === 'string' || typeof child === 'number') t += child;
            else n.push(child);
        });
        return [n, t];
    }, [children]);

    useLayoutEffect(() => {
        troikaMesh.sync(() => invalidate());
    });
    useEffect(() => () => troikaMesh.dispose(), [troikaMesh]);

    return (
        <primitive
            object={troikaMesh}
            ref={ref}
            text={text}
            {...props}
        >
            {nodes}
        </primitive>
    );
});
GalleryText.displayName = 'GalleryText';

const GalleryRoom = ({ showRoom, onReady, isExiting, isWarmup }) => {
    const { isTeleporting } = useScene();
    const { showTutorial, unlockAchievement, hidePopup } = useAchievements();
    const { play, audioEnabled } = useAudio();
    const playRef = useRef(play);
    playRef.current = play;

    // 环境声改用 HTMLAudio（原 drei PositionalAudio 会用 useLoader 挂起整个房间，
    // 深链进画廊时纸张要等音频解码完才打开）。
    // 深链没有用户手势，首播可能被浏览器拦截；首次交互后 audioEnabled 变真，重试一次。
    useEffect(() => {
        if (isWarmup) return undefined;
        const handle = playRef.current('szummiasta', { loop: true, volume: AUDIO_SETTINGS.volume });
        return () => handle?.stop();
    }, [isWarmup, audioEnabled]);

    const groupRef = useRef();
    const targetScroll = useRef(0);
    const currentScroll = useRef(0);
    const [selectedCard, setSelectedCard] = useState(null);
    const [globalIsAnimating, setGlobalIsAnimating] = useState(false);
    const cardRefs = useRef([]);

    useEffect(() => {
        if (isExiting || isTeleporting) {
            hidePopup();
        }
    }, [isExiting, isTeleporting, hidePopup]);

    // Setup Paint Transition
    const { onBeforeCompile, animatePaint, resetPaint, uniformsData, updateRoomOrigin } = usePaintMaterial();
    
    // Track transition state to disable interactions
    const [isTransitioning, setIsTransitioning] = useState(false);
    
    // Track if user teleported into this room 
    const wasTeleportedRef = useRef(false);
    useEffect(() => {
        if (isTeleporting) wasTeleportedRef.current = true;
    }, [isTeleporting]);

    useEffect(() => {
        // When the room officially shows up (doors open and user flies in)
        if (showRoom && !isWarmup) {
            if (wasTeleportedRef.current || isTeleporting) {
                // Skip the painting transition entirely if teleporting via map
                uniformsData.uPaintProgress.value = 1.0;
                setIsTransitioning(false);
            } else {
                setIsTransitioning(true);
                // resetPaint() in case we re-enter
                resetPaint();
                // Start the paint animation with a slight delay so it happens *during* fly-in
                animatePaint(0.2, 2.5);
                
                // Re-enable interactions once painting finishes
                setTimeout(() => {
                    setIsTransitioning(false);
                }, 2700); // 0.2 + 2.5
            }
        } else {
            // Immediately reveal for warmup or hide if not showing
            uniformsData.uPaintProgress.value = 1.0;
        }
    }, [showRoom, isWarmup, isTeleporting]);

    const handleCardClick = async (clickedIndex) => {
        if (globalIsAnimating || isTransitioning) return;

        // Unlock inspect achievement
        unlockAchievement('gallery_inspect');

        if (selectedCard === clickedIndex) {
            setGlobalIsAnimating(true);
            await cardRefs.current[clickedIndex].closeCard();
            setSelectedCard(null);
            setGlobalIsAnimating(false);
        } else if (selectedCard !== null) {
            setGlobalIsAnimating(true);
            await cardRefs.current[selectedCard].closeCard();
            setSelectedCard(null);
            await cardRefs.current[clickedIndex].openCard();
            setSelectedCard(clickedIndex);
            setGlobalIsAnimating(false);
        } else {
            setGlobalIsAnimating(true);
            await cardRefs.current[clickedIndex].openCard();
            setSelectedCard(clickedIndex);
            setGlobalIsAnimating(false);
        }
    };

    // Track if we've signaled ready
    const hasSignaledReady = useRef(false);
    const frameCount = useRef(0);
    const FRAMES_TO_WAIT = 5;

    useFrame(() => {
        // Update room origin each frame so the paint shader knows where.
        // This is cheap (one getWorldPosition) and critical for far chunks.
        updateRoomOrigin(groupRef);

        if (hasSignaledReady.current) return;
        frameCount.current++;
        if (frameCount.current >= FRAMES_TO_WAIT) {
            hasSignaledReady.current = true;
            onReady?.();

            // Wait for the DoorSection 1.5s camera fly-in to finish before showing tutorial
            setTimeout(() => {
                if (!isWarmup) showTutorial('gallery_inspect');
            }, 2000);

            // 画廊可见后再分批补齐其余卡片，避免首帧一次性编译 30 张卡
            if (!isWarmup && EXTRA_CARD_TOTAL > 0) {
                let mounted = 0;
                const step = () => {
                    extraMountTimer.current = setTimeout(() => {
                        mounted = Math.min(mounted + 6, EXTRA_CARD_TOTAL);
                        setExtraMountedCount(mounted);
                        if (mounted < EXTRA_CARD_TOTAL) step();
                    }, mounted === 0 ? 1600 : 600);
                };
                step();
            }
        }
    });

    // Config
    const BALCONY_WIDTH = 5;
    const BALCONY_DEPTH = 3;
    const RAILING_HEIGHT = 1.25; // Legacy ratio 20/(7 segments * 2.287)

    // --- TEXTURES AND RESPONSIVENESS ---
    // User requested: painted on desktop, regular on touch/phones (even if laptop has touch screen)
    // We use matchMedia('(hover: hover)') to detect devices with a cursor/hover capability
    const [canHover, setCanHover] = useState(() => typeof window !== 'undefined' ? window.matchMedia('(hover: hover)').matches : true);

    // Pobieranie danych z Sanity.io (fallback do starych danych)
    const sanityProjects = useGalleryProjects();
    const activeProjects = sanityProjects || FALLBACK_PROJECTS;

    useEffect(() => {
        const mq = window.matchMedia('(hover: hover)');
        const handleHoverChange = (e) => setCanHover(e.matches);
        mq.addEventListener('change', handleHoverChange);
        return () => mq.removeEventListener('change', handleHoverChange);
    }, []);

    /* === 1d-ii 长廊分段（2026-10-12）：类边界插入隔断项（须先于 textureUrls 定义） === */
    const projectsWithDividers = useMemo(() => {
        const result = [];
        let lastCat = null;
        activeProjects.forEach((p) => {
            if (p.category !== lastCat) {
                result.push({
                    isDivider: true,
                    id: 'divider-' + (p.category || 'other'),
                    dividerLabel: p.category || '作品',
                    dividerCount: activeProjects.filter((x) => x.category === p.category).length,
                });
                lastCat = p.category;
            }
            result.push(p);
        });
        return result;
    }, [activeProjects]);

    /* 槽位数 = 卡片 + 隔断（分段后动态） */
    const PROJECT_COUNT = projectsWithDividers.length;

    // 手机首屏只容得下一张卡：从第一张作品开始，避免停在不可点击的分类隔断
    const didInitTouchScroll = useRef(false);
    useEffect(() => {
        if (canHover || didInitTouchScroll.current) return;
        const firstProjectIndex = projectsWithDividers.findIndex((p) => !p.isDivider);
        if (firstProjectIndex > 0) {
            targetScroll.current = firstProjectIndex * GAP;
            currentScroll.current = firstProjectIndex * GAP;
        }
        didInitTouchScroll.current = true;
    }, [canHover, projectsWithDividers]);

    // 首屏只挂载视野内的卡片（开头 6 张 + 环绕到左侧的末尾 3 张），
    // 房间就绪后再分批补齐其余卡片：30 张卡的几何/材质/标题文字是首次编译的大头。
    const initialCardSet = useMemo(() => {
        const set = new Set();
        for (let i = 0; i < Math.min(6, PROJECT_COUNT); i++) set.add(i);
        for (let i = Math.max(0, PROJECT_COUNT - 3); i < PROJECT_COUNT; i++) set.add(i);
        return set;
    }, [PROJECT_COUNT]);
    const [extraMountedCount, setExtraMountedCount] = useState(0);
    const extraMountTimer = useRef(null);
    const EXTRA_CARD_START = Math.min(6, PROJECT_COUNT);
    const EXTRA_CARD_END = Math.max(EXTRA_CARD_START, PROJECT_COUNT - 3);
    const EXTRA_CARD_TOTAL = EXTRA_CARD_END - EXTRA_CARD_START;
    useEffect(() => () => {
        if (extraMountTimer.current) clearTimeout(extraMountTimer.current);
    }, []);

    // 封面贴图下沉到每张卡自己加载：房间就绪只等首批卡片，
    // 不再被全部 44 张封面拖住（此前 63 张画廊贴图要全齐才渲染任何一张卡）。
    const backTextureRaw = useTexture(canHover ? '/textures/gallery/tylkartki_painted.webp' : '/textures/gallery/tylkartki.webp');
    const overlayTextureRaw = useTexture(canHover ? '/textures/gallery/przyciskdotylukartki_painted.webp' : '/textures/gallery/przyciskdotylukartki.webp');

    // Construct the full list of projects (repeated)
    const projects = useMemo(() => {
        return Array.from({ length: PROJECT_COUNT }).map((_, i) => {
            const projectIndex = i % projectsWithDividers.length;
            const projectData = projectsWithDividers[projectIndex];

            if (backTextureRaw) {
                backTextureRaw.colorSpace = THREE.SRGBColorSpace;
            }
            if (overlayTextureRaw) {
                overlayTextureRaw.colorSpace = THREE.SRGBColorSpace;
            }

            // Map tech stack logos to the correct version (painted or regular)
            // 1d-ii：隔断项无 techStack——兜底空数组
            const techStack = (projectData.techStack || []).map(path => {
                if (!canHover) return path; // Keep regular
                const name = path.split('/').pop().replace('.webp', '');
                if (name === 'csslogo') return '/textures/gallery/css3logo_painted.webp';
                return `/textures/gallery/${name}_painted.webp`;
            });

            return {
                ...projectData,
                index: i,
                backTexture: backTextureRaw,
                buttonTexture: overlayTextureRaw,
                techStack: techStack
            };
        });
    }, [projectsWithDividers, backTextureRaw, overlayTextureRaw, canHover]);

    // Function to scroll to a specific project index
    const scrollToIndex = (index, onComplete) => {
        const totalWidth = PROJECT_COUNT * GAP;
        const targetScrollValue = index * GAP;
        const currentScrollValue = currentScroll.current;

        let diff = targetScrollValue - currentScrollValue;
        const halfWidth = totalWidth / 2;
        while (diff > halfWidth) diff -= totalWidth;
        while (diff < -halfWidth) diff += totalWidth;

        const finalTarget = currentScrollValue + diff;

        gsap.to(targetScroll, {
            current: finalTarget,
            duration: 0.5,
            ease: 'power2.inOut'
        });

        gsap.to(currentScroll, {
            current: finalTarget,
            duration: 0.5,
            ease: 'power2.inOut',
            onComplete: onComplete
        });
    };

    // --- INTERACTION ---
    const lastTouchX = useRef(0);
    useEffect(() => {
        // Observers enable us to normalize wheel, touch, and pointer events
        const scrollObserver = Observer.create({
            target: window,
            type: "wheel,touch,pointer",
            wheelSpeed: -1,
            onWheel: (e) => {
                if (!showRoom || selectedCard !== null || globalIsAnimating || isTransitioning) return;
                const orig = e.event;
                orig.preventDefault();
                targetScroll.current += orig.deltaY * 0.005;
            },
            onPress: (e) => {
                if (!showRoom || selectedCard !== null || globalIsAnimating || isTransitioning) return;
                const orig = e.event;
                if (orig.touches && orig.touches.length === 1) {
                    lastTouchX.current = orig.touches[0].clientX;
                }
            },
            onDrag: (e) => {
                if (!showRoom || selectedCard !== null || globalIsAnimating || isTransitioning) return;
                const orig = e.event;
                if (orig.touches && orig.touches.length === 1) {
                    const deltaX = lastTouchX.current - orig.touches[0].clientX;
                    lastTouchX.current = orig.touches[0].clientX;
                    targetScroll.current += deltaX * 0.008;
                }
            }
        });

        return () => scrollObserver.kill();
    }, [showRoom, selectedCard, globalIsAnimating]);

    useFrame((state, delta) => {
        currentScroll.current = THREE.MathUtils.lerp(currentScroll.current, targetScroll.current, delta * 5);
    });

    // --- GEOMETRY & MATERIALS ---
    const floorTexture = useTexture('/textures/gallery/floor.webp');
    const railingTexture = useTexture('/textures/gallery/railing.webp');
    const housesTexture = useTexture('/textures/gallery/domki.webp');
    const cityTexture = useTexture('/textures/gallery/miastotlo.webp');
    const birdTexture = useTexture('/textures/gallery/bird_gray.webp');
    const clothespinTexture = useTexture('/textures/gallery/klamerka.webp');

    useEffect(() => {
        if (floorTexture) {
            floorTexture.wrapS = THREE.MirroredRepeatWrapping;
            floorTexture.wrapT = THREE.MirroredRepeatWrapping;
            floorTexture.repeat.set(0.5, 0.5 * 1.835); // Adjust repeat to keep scale with legacy 1.835 ratio
            floorTexture.needsUpdate = true;
        }
        if (railingTexture) {
            railingTexture.wrapS = railingTexture.wrapT = THREE.RepeatWrapping;
            railingTexture.repeat.set(7, 1);
            railingTexture.needsUpdate = true;
        }
    }, [floorTexture, railingTexture]);

    const materials = useMemo(() => {
        const floorMat = new THREE.MeshBasicMaterial({
            map: floorTexture,
            color: '#e0e0e0',
            side: THREE.DoubleSide
        });
        floorMat.onBeforeCompile = onBeforeCompile;
        floorMat.transparent = true;
        floorMat.needsUpdate = true;
        
        const ropeMat = new THREE.MeshBasicMaterial({ color: '#666666' });
        ropeMat.onBeforeCompile = onBeforeCompile;
        ropeMat.transparent = true;
        ropeMat.needsUpdate = true;

        const thresholdMat = new THREE.MeshBasicMaterial({
            color: '#e0e0e0',
            map: (() => {
                const t = new THREE.TextureLoader().load(paintedSrc('/textures/corridor/texturadoprogow.webp'));
                t.colorSpace = THREE.SRGBColorSpace;
                t.wrapS = t.wrapT = THREE.RepeatWrapping;
                t.repeat.set(15 / 2.524, 1);
                return t;
            })(),
            side: THREE.DoubleSide
        });
        thresholdMat.onBeforeCompile = onBeforeCompile;
        thresholdMat.transparent = true;
        thresholdMat.needsUpdate = true;

        return {
            floor: floorMat,
            rope: ropeMat,
            threshold: thresholdMat
        };
    }, [floorTexture, onBeforeCompile]);

    const curve = useMemo(() => {
        return new THREE.CatmullRomCurve3([
            new THREE.Vector3(-16, 3.5, -6),
            new THREE.Vector3(-8, 2.5, -4.5),
            new THREE.Vector3(0, 1.8, -3),
            new THREE.Vector3(8, 2.5, -4.5),
            new THREE.Vector3(16, 3.5, -6),
        ]);
    }, []);

    const ropeGeometry = useMemo(() => {
        return new THREE.TubeGeometry(curve, 64, 0.015, 8, false);
    }, [curve]);

    const floorShape = useMemo(() => {
        const shape = new THREE.Shape();
        shape.moveTo(-1.1, -2.0);
        shape.lineTo(1.1, -2.0);
        shape.lineTo(7.5, 4);
        shape.lineTo(-7.5, 4);
        shape.lineTo(-1.1, -2.0);
        return shape;
    }, []);

    return (
        <group ref={groupRef}>
            {/* 房间本体独立 Suspense：任何一张卡/云/文字的异步依赖都不再拖住房间就绪 */}
            <Suspense fallback={null}>
            <group position={[0, -0.7, -2]}>
                {/* Floor */}
                <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, 0, 0]}
                >
                    <shapeGeometry args={[floorShape]} />
                    <primitive object={materials.floor} />
                </mesh>

                {/* Floor Outline */}
                <line rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                    <bufferGeometry>
                        <float32BufferAttribute
                            attach="attributes-position"
                            count={2}
                            array={new Float32Array([7.5, 4, 0, -7.5, 4, 0])}
                            itemSize={3}
                        />
                    </bufferGeometry>
                    <lineBasicMaterial color="#999999" onBeforeCompile={onBeforeCompile} transparent={true} needsUpdate={true} />
                </line>

                {/* Railing */}
                <mesh position={[0, RAILING_HEIGHT / 2, -3.9]}>
                    <planeGeometry args={[20, RAILING_HEIGHT]} />
                    <meshBasicMaterial color="#e0e0e0"
                        map={railingTexture}
                        transparent={true}
                        side={THREE.DoubleSide}
                        alphaTest={0.1}
                        onBeforeCompile={onBeforeCompile}
                        customProgramCacheKey={() => 'railing-paint'}
                    />
                </mesh>

                {/* === THRESHOLD (At the end of the floor) === */}
                <mesh
                    position={[0, 0.01, -3.9]}
                    rotation={[-Math.PI / 2, 0, 0]}
                >
                    <planeGeometry args={[15, 0.15]} />
                    <primitive object={materials.threshold} />
                </mesh>

                {/* === CLOTHESLINE SYSTEM === */}
                <group position={[0, 1.6, -4]}>
                    <mesh geometry={ropeGeometry} material={materials.rope} />

                    {/* Proj Cards：每张卡独立 Suspense，单卡依赖（字体/视频/技术栈图标）不阻塞整个房间 */}
                    {projects.map((project, i) => {
                        const inExtraWindow = i >= EXTRA_CARD_START && i < EXTRA_CARD_END
                            && (i - EXTRA_CARD_START) < extraMountedCount;
                        if (!initialCardSet.has(i) && !inExtraWindow) return null;
                        return (
                        <Suspense key={i} fallback={null}>
                            <ProjectCard
                                index={i}
                                ref={el => cardRefs.current[i] = el}
                                project={project}
                                clothespinTexture={clothespinTexture}
                                total={PROJECT_COUNT}
                                currentScroll={currentScroll}
                                materials={materials}
                                curve={curve}
                                isSelected={selectedCard === i}
                                scrollToIndex={scrollToIndex}
                                onClick={handleCardClick}
                                isMobile={!canHover} // Use hover capability for mobile behavior logic
                                isTransitioning={isTransitioning} // Pass down to lock out individual pointer events just in case
                                paintProgress={uniformsData.uPaintProgress}
                                roomOrigin={uniformsData.uRoomOrigin}
                                skipVideo={isWarmup} // 预热期不建视频元素：离屏卸载会中断下载、污染浏览器缓存（ERR_CACHE_READ_FAILURE）
                            />
                        </Suspense>
                        );
                    })}
                </group>

                {/* === SCENERY LAYERS === */}
                {/* Houses - center */}
                <mesh position={[0, -1, -9]} scale={[1, 1, 1]}>
                    <planeGeometry args={[15, 15 / 2.357]} />
                    <meshBasicMaterial color="#e0e0e0"
                        map={housesTexture}
                        transparent={true}
                        alphaTest={0.1}
                        side={THREE.DoubleSide}
                        onBeforeCompile={onBeforeCompile}
                    />
                </mesh>
                {/* Houses - left side (mirrored) */}
                <mesh position={[-15, -1, -9]} scale={[-1, 1, 1]}>
                    <planeGeometry args={[15, 15 / 2.357]} />
                    <meshBasicMaterial color="#e0e0e0"
                        map={housesTexture}
                        transparent={true}
                        alphaTest={0.1}
                        side={THREE.DoubleSide}
                        onBeforeCompile={onBeforeCompile}
                    />
                </mesh>
                {/* Houses - right side (mirrored) - CROPPED */}
                <RightSideHouses
                    texture={housesTexture}
                    baseWidth={15}
                    baseHeight={15 / 2.357}
                    cropAmount={RIGHT_CROP_AMOUNT}
                />

                {/* City skyline - center */}
                <mesh position={[0, 3.4, -17]} scale={[1, 1, 1]}>
                    <planeGeometry args={[30, 30 / 2.357]} />
                    <meshBasicMaterial color="#e0e0e0"
                        map={cityTexture}
                        transparent={true}
                        alphaTest={0.1}
                        side={THREE.DoubleSide}
                        onBeforeCompile={onBeforeCompile}
                    />
                </mesh>
                {/* City skyline - left (mirrored) */}
                <mesh position={[-30, 3.4, -17]} scale={[-1, 1, 1]}>
                    <planeGeometry args={[30, 30 / 2.357]} />
                    <meshBasicMaterial color="#e0e0e0"
                        map={cityTexture}
                        transparent={true}
                        alphaTest={0.1}
                        side={THREE.DoubleSide}
                        onBeforeCompile={onBeforeCompile}
                    />
                </mesh>
                {/* City skyline - right (mirrored) */}
                <mesh position={[30, 3.4, -17]} scale={[-1, 1, 1]}>
                    <planeGeometry args={[30, 30 / 2.357]} />
                    <meshBasicMaterial color="#e0e0e0"
                        map={cityTexture}
                        transparent={true}
                        alphaTest={0.1}
                        side={THREE.DoubleSide}
                        onBeforeCompile={onBeforeCompile}
                    />
                </mesh>

                {/* Flying Bird */}
                <FlyingBird texture={birdTexture} />

                {/* Clouds scattered above（独立 Suspense：云贴图不阻塞房间就绪） */}
                <Suspense fallback={null}>
                    <GalleryClouds count={24} seed={123} />
                </Suspense>

                {/* Skybox/Environment */}
                <mesh position={[0, 5, -20]}>
                    <sphereGeometry args={[40, 32, 32]} />
                    <meshBasicMaterial color="#f0f0f0" side={THREE.BackSide} transparent opacity={0.5} onBeforeCompile={onBeforeCompile} />
                </mesh>
            </group>
            </Suspense>
        </group>
    );
};

// Flying bird animation component
const FlyingBird = ({ texture }) => {
    const birdRef = useRef();
    const startX = -25;
    const endX = 25;
    const speed = 2.5; // 降低飞行速度

    // 跳跃物理变量
    const velocityY = useRef(0);
    const gravity = -12.0; // 降低重力使动作更流畅
    const jumpStrength = 5.5; // Delikatniejszy skok
    const jumpInterval = useRef(0);

    useFrame((state, delta) => {
        if (!birdRef.current) return;

        // 防止 delta 在卡顿帧时过大
        const safeDelta = Math.min(delta, 0.05);

        // Ruch w poziomie
        birdRef.current.position.x += speed * safeDelta;

        if (birdRef.current.position.x > endX) {
            birdRef.current.position.x = startX;
            birdRef.current.position.y = 4.5;
            velocityY.current = 0;
            jumpInterval.current = 0;
            birdRef.current.rotation.z = 0;
        }

        // Fizyka spadania
        velocityY.current += gravity * safeDelta;
        birdRef.current.position.y += velocityY.current * safeDelta;

        // 跳跃（更平滑、更可预测）
        jumpInterval.current -= safeDelta;

        // 到达下次点击所需时间后才跳
        if (jumpInterval.current <= 0 || birdRef.current.position.y < 3.2) {
            velocityY.current = jumpStrength;
            // 更稀疏、更有节奏的跳跃（如每整秒一次）
            jumpInterval.current = 0.9 + Math.random() * 0.3;
        }

        // 地板下边界
        if (birdRef.current.position.y < 3.0) {
            birdRef.current.position.y = 3.0;
            velocityY.current = jumpStrength;
        }

        // 天花板上边界
        if (birdRef.current.position.y > 6.5) {
            birdRef.current.position.y = 6.5;
            velocityY.current = 0;
        }

        // Rotacja ptaka
        // 像 Flappy Bird：下落时鸟嘴微垂，上跳时抬头
        const targetRotationZ = THREE.MathUtils.clamp(velocityY.current * 0.05, -Math.PI / 6, Math.PI / 8);

        // 极平滑的旋转（lerp）
        birdRef.current.rotation.z = THREE.MathUtils.lerp(birdRef.current.rotation.z, targetRotationZ, safeDelta * 8);
    });

    return (
        <mesh ref={birdRef} position={[startX, 4.5, -10]} scale={[BIRD_WIDTH, BIRD_HEIGHT, 1]}>
            <planeGeometry args={[1.5, 1.5]} />
            <meshBasicMaterial color="#e0e0e0"
                map={texture}
                transparent={true}
                alphaTest={0.1}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
};

// Sub-component for individual project cards
const ProjectCard = memo(forwardRef(({ index, project, clothespinTexture, currentScroll, curve, isSelected, scrollToIndex, onClick, isMobile, isTransitioning, paintProgress, roomOrigin, total, skipVideo = false }, ref) => {
    const cardRef = useRef();
    const { openOverlay } = useScene();
    const paperRef = useRef(); // Ref for the moving part (Paper)
    const materialRef = useRef();
    const textRef = useRef(); // Ref for the text that sticks to the paper
    const labelMetaTextRef = useRef(); // 卡片下方纸签的“分类 · 年份”
    const buttonGroupRef = useRef(); // Ref for the interactive back button
    const detailsGroupRef = useRef(); // Ref for the project details on the back
    const techStackGroupRef = useRef(); // Ref for the tech stack section on the back
    const detailsTextRef1 = useRef();
    const detailsTextRef2 = useRef();
    const metaTextRefs = useRef([]);
    const techTextRef = useRef();
    const noteTextRef = useRef();
    const noteMetaRef = useRef();
    const openTextRef = useRef();

    /* 2026-10-13：卡片背面整齐字段——片长由秒数格式化为 m:ss（不再从描述句里断行） */
    const durationLabel = (() => {
        const s = project.durationSeconds;
        if (!s) return '';
        const m = Math.floor(s / 60);
        const sec = Math.round(s % 60);
        return sec === 60 ? `${m + 1}:00` : `${m}:${String(sec).padStart(2, '0')}`;
    })();
    const backMeta = [
        project.client && `客户  ${project.client}`,
        project.category && `分类  ${project.category}`,
        durationLabel && `片长  ${durationLabel}`,
    ].filter(Boolean);
    const [hovered, setHovered] = useState(false);
    const [btnHovered, setBtnHovered] = useState(false);
    // 背面文字只在首次悬停/打开时创建：30 张卡一次性建 100+ 个 troika 文本，
    // 首次进画廊要等它们逐个建网格，是房间就绪慢的另一主因。
    const [detailsMounted, setDetailsMounted] = useState(false);
    // 每张卡自己加载封面，房间不必等所有作品贴图
    const frontTexture = useTexture(project.isDivider ? '/textures/paper-texture.webp' : project.front);
    const paintedTextureRaw = useTexture(
        project.isDivider
            ? '/textures/paper-texture.webp'
            : (!isMobile && project.painted ? project.painted : project.front)
    );
    const paintedTexture = project.isDivider ? null : paintedTextureRaw;
    useMemo(() => {
        if (frontTexture) frontTexture.colorSpace = THREE.SRGBColorSpace;
        if (paintedTextureRaw) paintedTextureRaw.colorSpace = THREE.SRGBColorSpace;
    }, [frontTexture, paintedTextureRaw]);
    const [isAnimating, setIsAnimating] = useState(false);  // True ONLY during flip animation
    const [, setIsScrolling] = useState(false);  // True during scroll phase

    /* === 1c 会动的画（2026-10-12）：hover 上色完成后，画"活"过来 ===
       实现：把 PaperMaterial 的 painted 槽位（mapPainted）在 hover 中途
       换成 VideoTexture——上色动画照走，完成瞬间画面已是流动的片子。
       2026-10-21：视频改为首次悬停才创建/下载。此前 9 条预览在房间挂载时
       一起 preload=auto（约 5MB），与封面/首帧编译抢带宽，是进画廊慢的主因之一。 */
    const [useVideo, setUseVideo] = useState(false);
    const [videoTexture, setVideoTexture] = useState(null);
    const videoElRef = useRef(null);
    const videoTextureRef = useRef(null);
    const videoSwapTimer = useRef(null);
    const hoveredRef = useRef(false);
    const paintDoneRef = useRef(false);
    const videoReadyRef = useRef(false);

    const maybeSwitchToVideo = useCallback(() => {
        const v = videoElRef.current;
        if (!v || !hoveredRef.current || !paintDoneRef.current || !videoReadyRef.current) return;
        setUseVideo(true);
        v.play().catch(() => {});
    }, []);

    const handleVideoReady = useCallback(() => {
        videoReadyRef.current = true;
        maybeSwitchToVideo();
    }, [maybeSwitchToVideo]);

    const ensureVideo = useCallback(() => {
        if (skipVideo || !project.preview) return;
        if (videoElRef.current) {
            videoReadyRef.current = videoElRef.current.readyState >= 2;
            return;
        }
        const v = document.createElement('video');
        v.src = project.preview;
        v.loop = true;
        v.muted = true;
        v.playsInline = true;
        v.preload = 'auto';
        videoElRef.current = v;
        const t = new THREE.VideoTexture(v);
        t.colorSpace = THREE.SRGBColorSpace;
        videoTextureRef.current = t;
        setVideoTexture(t);
        v.addEventListener('loadeddata', handleVideoReady, { once: true });
        v.load();
    }, [project.preview, skipVideo, handleVideoReady]);

    /* 卸载清理：停播 + 释放（房间切换时防泄漏） */
    useEffect(() => () => {
        if (videoSwapTimer.current) clearTimeout(videoSwapTimer.current);
        const v = videoElRef.current;
        if (v) {
            v.pause();
            v.removeAttribute('src');
            v.load();
        }
        videoTextureRef.current?.dispose();
        videoTextureRef.current = null;
    }, []);

    // Random sway properties
    const swaySpeed = useRef(Math.random() * 0.2 + 0.3); // Slower sway speed
    const swayOffset = useRef(Math.random() * 100);

    // 纸张音效走全局 HTMLAudio，避免 drei PositionalAudio 在 30 张卡上逐个挂起
    const { play } = useAudio();

    const playPaperSound = () => {
        play('pencil', { volume: GALLERY_INTERACTION_AUDIO_SETTINGS.volume });
    };

    useImperativeHandle(ref, () => ({
        closeCard: () => {
            return new Promise((resolve) => {
                setIsAnimating(true);
                playPaperSound();

                const timeline = gsap.timeline({
                    onComplete: () => {
                        setIsAnimating(false);
                        resolve();

                        // Unpaint the card after it returns to the clothespin
                        if (paintedTexture && materialRef.current) {
                            gsap.to(materialRef.current, {
                                uProgress: 0.0,
                                duration: 0.5,
                                ease: 'power2.out',
                                overwrite: 'auto'
                            });
                        }
                    }
                });

                const localBaseY = -1.1;

                timeline.to(paperRef.current.position, {
                    y: localBaseY + 0.6,
                    x: 0,
                    z: 1,
                    duration: 0.35,
                    ease: 'power2.in'
                });

                timeline.to(paperRef.current.rotation, {
                    x: 0.5,
                    z: -0.05,
                    y: 0,
                    duration: 0.35,
                    ease: 'power2.in'
                }, '<');

                if (materialRef.current) {
                    timeline.to(materialRef.current, {
                        bend: 0.6,
                        duration: 0.3,
                        ease: 'power2.in'
                    }, '<');
                }

                timeline.to(paperRef.current.scale, {
                    x: 1, y: 1, z: 1,
                    duration: 0.3, ease: 'sine.inOut'
                }, '<');

                timeline.to(paperRef.current.position, {
                    y: localBaseY,
                    x: 0,
                    z: 0,
                    duration: 0.25,
                    ease: 'power3.out'
                });

                timeline.to(paperRef.current.rotation, {
                    x: 0, y: 0, z: 0,
                    duration: 0.25,
                    ease: 'power3.out'
                }, '<');

                if (materialRef.current) {
                    timeline.to(materialRef.current, {
                        bend: 0,
                        duration: 0.3,
                        ease: 'power2.out'
                    }, '<');
                }
            });
        },
        openCard: () => {
            setDetailsMounted(true);
            return new Promise((resolve) => {
                setIsScrolling(true);
                scrollToIndex(index, () => {
                    setIsScrolling(false);
                    setIsAnimating(true);
                    playPaperSound();

                    const isMobile = window.innerWidth < 768;
                    const targetX_World = 0;
                    const targetY_World = isMobile ? -0.2 : 0.1;
                    const targetZ_World = isMobile ? 0.5 : 1.5;

                    const parentPos = cardRef.current.position;
                    const targetX = targetX_World - parentPos.x;
                    const targetY = targetY_World - parentPos.y;
                    const targetZ = targetZ_World - parentPos.z;

                    const timeline = gsap.timeline({
                        onComplete: () => {
                            setIsAnimating(false);
                            resolve();
                        }
                    });

                    timeline.to(cardRef.current.rotation, {
                        x: 0, y: 0, z: 0,
                        duration: 0.3,
                        ease: 'power2.out'
                    }, 0);

                    if (materialRef.current) materialRef.current.bend = 0;

                    const localBaseY = -1.1;

                    timeline.to(paperRef.current.position, {
                        y: localBaseY - 0.5,
                        duration: 0.15,
                        ease: 'power2.out'
                    });

                    timeline.to(paperRef.current.rotation, {
                        x: 0.5,
                        z: -0.05,
                        duration: 0.15,
                        ease: 'power2.out'
                    }, '<');

                    if (materialRef.current) {
                        timeline.to(materialRef.current, {
                            bend: 0.8,
                            duration: 0.15,
                            ease: 'power2.out'
                        }, '<');

                        // Keep painted or finish painting to 1.0 when opened
                        // Running with gsap.to independently to avoid blocking the timeline duration
                        if (paintedTexture) {
                            gsap.to(materialRef.current, {
                                uProgress: 1.0,
                                duration: 0.3,
                                ease: 'power2.out',
                                overwrite: 'auto'
                            });
                        }
                    }

                    timeline.to(paperRef.current.position, {
                        y: localBaseY + 1.5,
                        x: targetX * 0.2,
                        z: targetZ * 0.2,
                        duration: 0.4,
                        ease: 'power1.out'
                    });

                    timeline.to(paperRef.current.rotation, {
                        x: Math.PI * 0.8,
                        z: 0.05,
                        y: -0.02,
                        duration: 0.4,
                        ease: 'power1.inOut'
                    }, '<');

                    if (materialRef.current) {
                        timeline.to(materialRef.current, {
                            bend: -0.3,
                            duration: 0.4,
                            ease: 'power1.inOut'
                        }, '<');
                    }

                    timeline.to(paperRef.current.position, {
                        y: targetY,
                        x: targetX,
                        z: targetZ,
                        duration: 0.4,
                        ease: 'power3.out'
                    });

                    timeline.to(paperRef.current.rotation, {
                        x: Math.PI,
                        y: 0,
                        z: 0,
                        duration: 0.4,
                        ease: 'power3.out'
                    }, '<');

                    if (materialRef.current) {
                        timeline.to(materialRef.current, {
                            bend: 0,
                            duration: 0.5,
                            ease: 'power2.out'
                        }, '<');
                    }

                    timeline.to(paperRef.current.scale, {
                        x: 1.1,
                        y: 1.1,
                        z: 1.1,
                        duration: 0.3,
                        ease: 'sine.out'
                    }, '-=0.4');
                });
            });
        }
    }));

    const handleClick = (e) => {
        e.stopPropagation();
        if (onClick) onClick(index);
    };

    // Cursor change on hover
    useEffect(() => {
        if (btnHovered && isSelected) {
            document.body.style.cursor = 'pointer';
        } else if (hovered && !isSelected) {
            document.body.style.cursor = 'pointer';
        } else {
            document.body.style.cursor = 'auto';
        }
        return () => { document.body.style.cursor = 'auto'; };
    }, [hovered, isSelected, btnHovered]);

    useFrame((state) => {
        if (!cardRef.current) return;

        // Custom GSAP Paint logic for texts
        // We delay the text reveal slightly so the card paints first (p > 0.4)
        if (paintProgress) {
            const p = paintProgress.value;
            // Instantly reveal if we teleported
            const expectedOpacity = p >= 1.0 ? 1.0 : THREE.MathUtils.clamp((p - 0.3) * 2.0, 0.0, 1.0);

            // 逐项判断：背面文字可能在翻开时才挂载，不能只看正面标题是否已更新
            const applyOpacity = (ref) => {
                const text = ref.current;
                if (!text || text.fillOpacity === expectedOpacity) return;
                text.fillOpacity = expectedOpacity;
                if (text.material) {
                    text.material.opacity = expectedOpacity;
                    text.material.transparent = true;
                }
            };
            applyOpacity(textRef);
            applyOpacity(labelMetaTextRef);
            applyOpacity(detailsTextRef1);
            applyOpacity(detailsTextRef2);
            metaTextRefs.current.forEach(applyOpacity);
            applyOpacity(techTextRef);
            applyOpacity(noteTextRef);
            applyOpacity(noteMetaRef);
            applyOpacity(openTextRef);
        }

        // --- 让文字 Z 跟随纸面弯曲/波浪动画（正面）---
        if (textRef.current && materialRef.current) {
            const y = textRef.current.position.y;
            const uBend = materialRef.current.bend;
            const uWindStrength = materialRef.current.windStrength || 0;
            const uTime = state.clock.getElapsedTime();

            const bendAmount = Math.pow(y, 2.0) * uBend;
            const totalWind = 0.02 + uWindStrength;
            const flutter = Math.sin(uTime * 2.0 + y * 2.0) * totalWind * (1.0 + Math.abs(uBend * 3.0));

            textRef.current.position.z = bendAmount + flutter + 0.055;

            // 旋转文字以贴合曲面（dz/dy 导数）
            const dz_dy = 2.0 * y * uBend + 2.0 * Math.cos(uTime * 2.0 + y * 2.0) * totalWind * (1.0 + Math.abs(uBend * 3.0));
            textRef.current.rotation.x = Math.atan(dz_dy);
        }

        // --- 让按钮 Z 跟随背面动画（背面）---
        if (buttonGroupRef.current && materialRef.current) {
            const y = buttonGroupRef.current.position.y;
            const uBend = materialRef.current.bend;
            const uWindStrength = materialRef.current.windStrength || 0;
            const uTime = state.clock.getElapsedTime();

            const bendAmount = Math.pow(y, 2.0) * uBend;
            const totalWind = 0.02 + uWindStrength;
            const flutter = Math.sin(uTime * 2.0 + y * 2.0) * totalWind * (1.0 + Math.abs(uBend * 3.0));

            // 注意！整个平面向前弯曲（相对父级 +Z）。
            // 我们在平面外侧（背面），需要位于平面之后一点点，如 -0.03
            // 之前误把整个等式取反（-(bendAmount...)）导致波浪反向，正确写法如下：
            buttonGroupRef.current.position.z = bendAmount + flutter - 0.03;

            // 在相反一侧旋转按钮以贴合曲面（额外旋转 Pi）
            const dz_dy = 2.0 * y * uBend + 2.0 * Math.cos(uTime * 2.0 + y * 2.0) * totalWind * (1.0 + Math.abs(uBend * 3.0));
            buttonGroupRef.current.rotation.x = Math.PI + Math.atan(dz_dy);

            // 按钮 hover 放大动画（文字放大）
            const targetScale = btnHovered ? 1.08 : 1;
            buttonGroupRef.current.scale.lerp(_tempScale.set(targetScale, targetScale, 1), 0.15);
        }

        // --- 让顶部描述（PROJECT DETAILS）跟随 ---
        if (detailsGroupRef.current && materialRef.current) {
            const y = detailsGroupRef.current.position.y;
            const uBend = materialRef.current.bend;
            const uWindStrength = materialRef.current.windStrength || 0;
            const uTime = state.clock.getElapsedTime();

            const bendAmount = Math.pow(y, 2.0) * uBend;
            const totalWind = 0.02 + uWindStrength;
            const flutter = Math.sin(uTime * 2.0 + y * 2.0) * totalWind * (1.0 + Math.abs(uBend * 3.0));

            // 在背面（同按钮）
            detailsGroupRef.current.position.z = bendAmount + flutter - 0.03;

            // 旋转
            const dz_dy = 2.0 * y * uBend + 2.0 * Math.cos(uTime * 2.0 + y * 2.0) * totalWind * (1.0 + Math.abs(uBend * 3.0));
            detailsGroupRef.current.rotation.x = Math.PI + Math.atan(dz_dy);
        }

        // --- 让 Tech Stack 区跟随 ---
        if (techStackGroupRef.current && materialRef.current) {
            const y = techStackGroupRef.current.position.y;
            const uBend = materialRef.current.bend;
            const uWindStrength = materialRef.current.windStrength || 0;
            const uTime = state.clock.getElapsedTime();

            const bendAmount = Math.pow(y, 2.0) * uBend;
            const totalWind = 0.02 + uWindStrength;
            const flutter = Math.sin(uTime * 2.0 + y * 2.0) * totalWind * (1.0 + Math.abs(uBend * 3.0));

            techStackGroupRef.current.position.z = bendAmount + flutter - 0.03;

            const dz_dy = 2.0 * y * uBend + 2.0 * Math.cos(uTime * 2.0 + y * 2.0) * totalWind * (1.0 + Math.abs(uBend * 3.0));
            techStackGroupRef.current.rotation.x = Math.PI + Math.atan(dz_dy);
        }

        // Skip position updates ONLY during flip animation, NOT during scroll
        if (isAnimating || isSelected) return;

        const totalWidth = total * GAP;
        let rawX = (index * GAP) - currentScroll.current;
        const halfWidth = totalWidth / 2;
        let displayX = ((rawX + halfWidth) % totalWidth + totalWidth) % totalWidth - halfWidth;

        const u = (displayX + 16) / 32;
        const safeU = THREE.MathUtils.clamp(u, 0, 1);
        const pointOnCurve = curve.getPointAt(safeU);

        cardRef.current.position.set(pointOnCurve.x, pointOnCurve.y, pointOnCurve.z);

        // Wind / Sway Animation
        const time = state.clock.getElapsedTime();
        const wind = Math.sin(time * swaySpeed.current + swayOffset.current) * 0.05;

        cardRef.current.rotation.z = wind;
        cardRef.current.rotation.x = 0;

        // Visibility Check (fade out if too far)
        const dist = Math.abs(displayX);
        const scale = THREE.MathUtils.clamp(1 - (dist / 50), 0.7, 1);
        cardRef.current.scale.setScalar(scale);
    });

    /* === 1d-ii 隔断渲染分支（长廊分段的"门楣"）——无交互、无贴图、无视频 === */
    if (project.isDivider) {
        return (
            <group ref={cardRef}>
                {/* 分类标签：横向纸牌 + 木夹 + 栏目小字，避免被误读成作品卡 */}
                <mesh position={[0, -0.07, 0.15]} rotation={[0, 0, Math.PI]}>
                    <planeGeometry args={[0.3, 0.2]} />
                    <meshBasicMaterial color="#ffffff"
                        map={clothespinTexture}
                        transparent={true}
                        alphaTest={0.1}
                        side={THREE.DoubleSide}
                    />
                </mesh>
                <mesh position={[0, -0.35, -0.03]}>
                    <planeGeometry args={[1.76, 0.94]} />
                    <meshBasicMaterial color="#1a1a1a" transparent opacity={0.16} />
                </mesh>
                <mesh position={[0, -0.35, -0.02]}>
                    <planeGeometry args={[1.7, 0.88]} />
                    <meshBasicMaterial color="#f5efe0" transparent={true} />
                </mesh>
                <GalleryText
                    position={[0, -0.04, 0.01]}
                    fontSize={0.065}
                    color="#8a7a5e"
                    font="/fonts/NotoSansSC.ttf"
                    anchorX="center"
                    anchorY="middle"
                >
                    分 类
                </GalleryText>
                <GalleryText
                    position={[0, -0.25, 0.01]}
                    fontSize={0.25}
                    color="#1a1a1a"
                    font="/fonts/NotoSerifSC-Headings.ttf"
                    anchorX="center"
                    anchorY="middle"
                >
                    {project.dividerLabel}
                </GalleryText>
                <GalleryText
                    position={[0, -0.48, 0.01]}
                    fontSize={0.08}
                    color="#4d4a43"
                    font="/fonts/NotoSansSC.ttf"
                    anchorX="center"
                    anchorY="middle"
                >
                    {`${project.dividerCount || 0} 部作品`}
                </GalleryText>
                <mesh position={[0, -0.69, 0.01]}>
                    <planeGeometry args={[1.3, 0.022]} />
                    <meshBasicMaterial color="#1a1a1a" transparent={true} opacity={0.6} />
                </mesh>
            </group>
        );
    }

    return (
        <group
            ref={cardRef}
            onClick={handleClick}
            onPointerEnter={(e) => {
                if (isMobile || isTransitioning) return;
                e.stopPropagation();
                setHovered(true);
                setDetailsMounted(true);

                // Brush reveal animation
                if (materialRef.current && paintedTexture && !isSelected) {
                    gsap.to(materialRef.current, {
                        uProgress: 1.0,
                        duration: 0.8,
                        ease: 'power2.out',
                        overwrite: 'auto'
                    });
                }
                /* 1c：上色完成（800ms，与 uProgress 动画同步）时把 painted 槽位换成视频——"刷完 → 活" */
                if (project.preview && !isSelected) {
                    hoveredRef.current = true;
                    paintDoneRef.current = false;
                    videoReadyRef.current = false;
                    ensureVideo();
                    if (videoSwapTimer.current) clearTimeout(videoSwapTimer.current);
                    videoSwapTimer.current = setTimeout(() => {
                        paintDoneRef.current = true;
                        maybeSwitchToVideo();
                    }, 800);
                }
            }}
            onPointerLeave={(e) => {
                if (isMobile || isTransitioning) return;
                e.stopPropagation();
                setHovered(false);

                // Reverse brush reveal animation ONLY if NOT selected
                if (materialRef.current && paintedTexture && !isSelected) {
                    gsap.to(materialRef.current, {
                        uProgress: 0.0,
                        duration: 0.5,
                        ease: 'power2.out',
                        overwrite: 'auto'
                    });
                }
                /* 1c：还原静态 painted（视频停播 + 槽位换回） */
                hoveredRef.current = false;
                paintDoneRef.current = false;
                if (videoSwapTimer.current) clearTimeout(videoSwapTimer.current);
                videoElRef.current?.pause();
                setUseVideo(false);
            }}
        >
            {/* Clothespin (Top Center) - Does NOT move with paperRef */}
            <mesh position={[0, -0.08, 0.15]} rotation={[0, 0, Math.PI]}>
                <planeGeometry args={[0.3, 0.2]} />
                <meshBasicMaterial color="#ffffff"
                    map={clothespinTexture}
                    transparent={true}
                    alphaTest={0.1}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* The Paper / Card hanging down - This moves independently now */}
            <group
                ref={paperRef}
                position={[0, -1.1, 0]}
            >
                <mesh>
                    <planeGeometry args={[1.5, 2, 16, 16]} />
                    {/* 全站彩色：桌面端卡片正面直接挂彩色版
                        （悬停揭示因此退化为「刷完 → 活」的视频切换，其余逻辑不变） */}
                    <PaperMaterial
                        ref={materialRef}
                        color="#ffffff"
                        map={COLOR_DEFAULT ? (paintedTexture || frontTexture) : frontTexture}
                        mapBack={project.backTexture}
                        mapPainted={useVideo && videoTexture ? videoTexture : paintedTexture}
                        side={THREE.DoubleSide}
                        roughness={0.6}
                        paintProgress={paintProgress}
                        roomOrigin={roomOrigin}
                    />
                </mesh>

                {/* === PRZYCISK: OPEN NA PLECACH KARTKI === */}
                {detailsMounted && (
                <>
                <group
                    ref={buttonGroupRef}
                    position={[0, 0.75, 0]}
                    rotation={[Math.PI, 0, 0]}
                    visible={isSelected || isAnimating}
                >
                    {/* 层 1：按钮视觉边框（不接收事件） */}
                    <mesh>
                        <planeGeometry args={[1.2, 1.2 / 3.613]} />
                        <meshBasicMaterial color="#ffffff"
                            map={project.buttonTexture}
                            transparent={true}
                            alphaTest={0.05}
                        />
                    </mesh>

                    {/* Warstwa 2: 背面按钮文字（中文化） */}
                    <GalleryText
                        ref={openTextRef}
                        position={[0, 0, 0.01]}
                        fontSize={0.13}
                        color={btnHovered ? "#333333" : "#1c1c1c"}
                        font="/fonts/NotoSansSC.ttf"
                        anchorX="center"
                        anchorY="middle"
                        fillOpacity={0} // Start hidden
                    >
                        打开作品
                    </GalleryText>

                    {/* 层 3：覆盖整个按钮的隐形点击区——拦截所有事件 */}
                    <mesh
                        position={[0, 0, 0.02]}
                        onClick={(e) => {
                            if (isSelected && !isTransitioning) {
                                e.stopPropagation();
                                openOverlay(project); // 世界内闭环：背面按钮 → 摘要浮层
                            }
                        }}
                        onPointerEnter={(e) => {
                            if (isSelected && !isTransitioning) {
                                e.stopPropagation();
                                setBtnHovered(true);
                            }
                        }}
                        onPointerLeave={(e) => {
                            if (isSelected && !isTransitioning) {
                                e.stopPropagation();
                            }
                            setBtnHovered(false);
                        }}
                    >
                        <planeGeometry args={[1.2, 1.2 / 3.613]} />
                        <meshBasicMaterial color="#e0e0e0" transparent={true} opacity={0} />
                    </mesh>
                </group>

                {/* === 卡片背面：整齐信息（2026-10-13 重排） ===
                    原来把整句 description 塞进 maxWidth=1.1 让 troika 按字自动断行，
                    中文断行不均、片长被拆碎且与标题重叠。改为：
                    标题 + 等宽左对齐的客户/分类/片长三条；长摘要由摘要浮层承接。 */}
                <group
                    ref={detailsGroupRef}
                    position={[0, -0.45, 0]}
                    rotation={[Math.PI, 0, 0]}
                    visible={isSelected || isAnimating}
                >
                    <GalleryText
                        ref={detailsTextRef1}
                        position={[0, 0.32, 0.01]}
                        fontSize={0.15}
                        color="#1c1c1c"
                        font="/fonts/NotoSerifSC-Headings.ttf"
                        anchorX="center"
                        anchorY="middle"
                        fillOpacity={0}
                    >
                        项目详情
                    </GalleryText>

                    {/* 整齐字段：同一左缘 x=-0.42、等行距 0.22，左对齐不自动换行 */}
                    {backMeta.map((line, i) => (
                        <GalleryText
                            key={line}
                            ref={(el) => { if (i === 0) detailsTextRef2.current = el; metaTextRefs.current[i] = el; }}
                            position={[-0.42, 0.06 - i * 0.22, 0.01]}
                            fontSize={0.095}
                            color="#444444"
                            font="/fonts/NotoSansSC.ttf"
                            anchorX="left"
                            anchorY="middle"
                            maxWidth={0.95}
                            fillOpacity={0}
                        >
                            {line}
                        </GalleryText>
                    ))}
                </group>

                {/* === SEKCJA TECH STACK NA PLECACH KARTKI === */}
                <group
                    ref={techStackGroupRef}
                    position={[0, 0.30, 0]} // 在 Project Details 与 Open Project 按钮之间
                    rotation={[Math.PI, 0, 0]}
                    visible={isSelected || isAnimating}
                >
                    {/* 1d：TECH STACK 标题移除——视频项目无技术栈（logo 组保留结构，techStack 空则不渲染） */}

                    {project.techStack && project.techStack.length > 0 ? (
                        /* 有技术栈时保留原有 logo 排布 */
                        <group position={[0, -0.05, 0.01]}>
                            {project.techStack.map((logoPath, idx) => {
                                const spacing = 0.30;
                                const startX = -((project.techStack.length - 1) * spacing) / 2;
                                const xPos = startX + (idx * spacing);
                                return (
                                    <TechStackLogo key={idx} path={logoPath} position={[xPos, 0, 0]} />
                                );
                            })}
                        </group>
                    ) : (
                        /* 没有技术栈时，用一张项目便签填满四个空框，避免背面像未完成 */
                        <group position={[0, -0.02, 0.005]}>
                            <mesh>
                                <planeGeometry args={[1.32, 0.44]} />
                                <meshBasicMaterial color="#f7f0e1" transparent opacity={0.96} />
                            </mesh>
                            <mesh position={[0, 0.2, 0.002]}>
                                <planeGeometry args={[0.3, 0.055]} />
                                <meshBasicMaterial color="#e4d8bf" transparent opacity={0.85} />
                            </mesh>
                            <GalleryText
                                ref={noteTextRef}
                                position={[0, 0.02, 0.004]}
                                fontSize={0.057}
                                color="#4c4438"
                                font="/fonts/NotoSansSC.ttf"
                                anchorX="center"
                                anchorY="middle"
                                maxWidth={1.18}
                                fillOpacity={0}
                            >
                                {project.description}
                            </GalleryText>
                            <GalleryText
                                ref={noteMetaRef}
                                position={[0, -0.17, 0.004]}
                                fontSize={0.045}
                                color="#7b705f"
                                font="/fonts/NotoSansSC.ttf"
                                anchorX="center"
                                anchorY="middle"
                                maxWidth={1.2}
                                fillOpacity={0}
                            >
                                {[project.role?.join(' · '), project.year].filter(Boolean).join('   /   ')}
                            </GalleryText>
                        </group>
                    )}
                </group>
                </>
                )}

                {/* 卡片内底部纸签：裁成照片下缘的说明条，保证每张卡都看得到标题 */}
                <group visible={!isSelected && !isAnimating}>
                    <mesh position={[0, -0.8, 0.008]}>
                        <planeGeometry args={[1.5, 0.3]} />
                        <meshBasicMaterial color="#f5eedf" transparent opacity={0.94} />
                    </mesh>
                    <mesh position={[0, -0.655, 0.012]}>
                        <planeGeometry args={[1.5, 0.012]} />
                        <meshBasicMaterial color="#d8ccb6" transparent opacity={0.7} />
                    </mesh>

                    <GalleryText
                        ref={textRef}
                        position={[0, -0.76, 0.022]}
                        fontSize={0.12}
                        color="#1c1c1c"
                        font="/fonts/NotoSerifSC-Headings.ttf"
                        anchorX="center"
                        anchorY="middle"
                        maxWidth={1.38}
                        fillOpacity={0}
                    >
                        {project.title}
                    </GalleryText>
                    <GalleryText
                        ref={labelMetaTextRef}
                        position={[0, -0.875, 0.06]}
                        fontSize={0.055}
                        color="#6b6254"
                        font="/fonts/NotoSansSC.ttf"
                        anchorX="center"
                        anchorY="middle"
                        maxWidth={1.4}
                        fillOpacity={0}
                    >
                        {`${project.category} · ${project.year}`}
                    </GalleryText>
                </group>

            </group>
        </group>
    );
}));


// Component to handle the cropped right-side houses
const RightSideHouses = ({ texture, baseWidth, baseHeight, cropAmount }) => {
    // Clone texture to allow independent UV manipulation
    const croppedTexture = useMemo(() => {
        const t = texture.clone();
        // Because scale.x is -1 (mirrored), the "Right" side in world space
        // corresponds to the "Left" side of the texture (U=0).
        // To crop the world-right side, we need to crop the texture-left side.
        // So we increase offset.x.
        t.offset.x = cropAmount;
        t.repeat.x = 1 - cropAmount;
        t.needsUpdate = true;
        return t;
    }, [texture, cropAmount]);

    // Calculate new width and position
    const newWidth = baseWidth * (1 - cropAmount);

    // Original Inner Edge (World Left of this mesh) was at CenterX - Width/2
    // For the Right Side Mesh: 
    // Original Pos = 15. Width = 15.
    // Inner Edge = 15 - 7.5 = 7.5.
    // We want to keep Inner Edge at 7.5.
    // New Center = Inner Edge + NewWidth / 2
    const newX = 7.5 + (newWidth / 2);

    return (
        <mesh position={[newX, -1, -9]} scale={[-1, 1, 1]}>
            <planeGeometry args={[newWidth, baseHeight]} />
            <meshBasicMaterial color="#e0e0e0"
                map={croppedTexture}
                transparent={true}
                alphaTest={0.1}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
};

// Sub-component for individual tech stack logos
const TechStackLogo = ({ path, position }) => {
    const texture = useTexture(path);

    return (
        <mesh position={position}>
            <planeGeometry args={[0.17, 0.17]} />
            <meshBasicMaterial color="#ffffff"
                map={texture}
                transparent={true}
            />
        </mesh>
    );
};

export default GalleryRoom;
