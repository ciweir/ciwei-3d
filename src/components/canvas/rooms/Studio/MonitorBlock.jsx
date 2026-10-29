import { memo, useRef, useMemo, useEffect, useCallback, useState } from 'react';
import { useLoader } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { TextureLoader } from 'three';
import { PLATFORM_CONFIG } from './contentData';
import { isTouchDevice } from '../../../../utils/deviceDetect';
import { useColorEnabled } from '../../../../utils/colorMode';
import { useColorOnlyTexture, useTexturePair, smallSrc } from '../../../../utils/colorTexture';
import { STUDIO_PAINT_CONFIG } from './studioPaintConfig';
import '../../../../styles/StudioProgramTag.scss';
import '../../shaders/RevealMaterial';

const shellSrc = (src) => smallSrc(src);
const pad2 = (value) => String(value || 0).padStart(2, '0');

/* 侧屏悬停时才挂载的纸质片签；固定像素尺寸，远端侧屏也能读清。 */
const ProgramHoverTag = ({ item, index, total, isCurrent }) => (
    <Html
        position={[0, -item.height / 2 - 0.2, item.depth / 2 + 0.08]}
        center
        zIndexRange={[140, 110]}
        style={{ pointerEvents: 'none' }}
    >
        <div className={`studio-program-tag ${isCurrent ? 'is-current' : ''}`}>
            <span className="studio-program-tag__index">{pad2(index)}</span>
            <span className="studio-program-tag__copy">
                <strong>{item.title}</strong>
                <em>
                    {isCurrent
                        ? `正在主屏放映 · ${pad2(index)} / ${pad2(total)}`
                        : `点击换到主屏 · ${pad2(index)} / ${pad2(total)}`}
                </em>
            </span>
        </div>
    </Html>
);

const MonitorBlock = memo(({ item, meshRef, isSelected, isCurrent, playlistIndex, totalCount, onMonitorClick, disabled, paintOnBeforeCompile, paintUniforms }) => {
    const paintedBoxRef = useRef();
    const hideDelayRef = useRef();
    const matRef0 = useRef();
    const matRef1 = useRef();
    const matRef2 = useRef();
    const matRef3 = useRef();
    const matRef4 = useRef();
    const matRef5 = useRef();
    const matRefs = useMemo(() => [matRef0, matRef1, matRef2, matRef3, matRef4, matRef5], []);

    const deviceShape = item.device || (PLATFORM_CONFIG[item.platform]?.shape) || 'monitor';
    const isBlogMonitor = deviceShape === 'monitor';
    const isTvMonitor = deviceShape === 'tv';
    const isPhoneMonitor = deviceShape === 'phone';

    const frontTextureUrl = item.frontTexture || (
        isBlogMonitor ? '/textures/studio/monitor_front.webp' :
            isTvMonitor ? '/textures/studio/tv_front.webp' :
                '/textures/studio/phone_front.webp'
    );

    const paintedFrontTextureUrl = item.paintedFrontTexture || (
        isBlogMonitor ? '/textures/studio/monitor_front_painted.webp' :
            isTvMonitor ? '/textures/studio/tv_front_painted.webp' :
                '/textures/studio/phone_front_painted.webp'
    );

    // 线稿/彩色成对：移动端默认线稿，上色按钮触发彩色版
    const frontTex = useTexturePair(frontTextureUrl, paintedFrontTextureUrl);
    const isCover = frontTextureUrl.startsWith('/covers/');

    // 竖版封面铺到横向屏幕时按 cover 居中裁切；改 UV，不复制贴图（避免移动端重复上传）
    const boxGeometry = useMemo(() => {
        const geometry = new THREE.BoxGeometry(item.width, item.height, item.depth);
        if (!isCover || !frontTex?.image) return geometry;
        const imageAspect = frontTex.image.width / frontTex.image.height;
        const faceAspect = item.width / item.height;
        if (!Number.isFinite(imageAspect) || !Number.isFinite(faceAspect)) return geometry;
        const repeatX = imageAspect > faceAspect ? faceAspect / imageAspect : 1;
        const repeatY = imageAspect < faceAspect ? imageAspect / faceAspect : 1;
        if (repeatX === 1 && repeatY === 1) return geometry;
        const uv = geometry.attributes.uv;
        if (!uv || uv.count < 20) return geometry;
        const offsetX = (1 - repeatX) / 2;
        const offsetY = (1 - repeatY) / 2;
        for (let i = 16; i < 20; i += 1) {
            uv.setXY(i, offsetX + uv.getX(i) * repeatX, offsetY + uv.getY(i) * repeatY);
        }
        uv.needsUpdate = true;
        return geometry;
    }, [item.width, item.height, item.depth, isCover, frontTex]);

    useEffect(() => () => boxGeometry.dispose(), [boxGeometry]);

    const monitorBack = useLoader(TextureLoader, shellSrc('/textures/studio/monitor_back.webp'));
    const monitorTop = useLoader(TextureLoader, shellSrc('/textures/studio/monitor_top.webp'));
    const monitorBottom = useLoader(TextureLoader, shellSrc('/textures/studio/monitor_bottom.webp'));
    const monitorLeft = useLoader(TextureLoader, shellSrc('/textures/studio/monitor_left.webp'));
    const monitorRight = useLoader(TextureLoader, shellSrc('/textures/studio/monitor_right.webp'));
    const monitorBackPainted = useColorOnlyTexture('/textures/studio/monitor_back_painted.webp');
    const monitorTopPainted = useColorOnlyTexture('/textures/studio/monitor_top_painted.webp');
    const monitorBottomPainted = useColorOnlyTexture('/textures/studio/monitor_bottom_painted.webp');
    const monitorLeftPainted = useColorOnlyTexture('/textures/studio/monitor_left_painted.webp');
    const monitorRightPainted = useColorOnlyTexture('/textures/studio/monitor_right_painted.webp');

    const tvBack = useLoader(TextureLoader, shellSrc('/textures/studio/tv_back.webp'));
    const tvTop = useLoader(TextureLoader, shellSrc('/textures/studio/tv_top.webp'));
    const tvBottom = useLoader(TextureLoader, shellSrc('/textures/studio/tv_bottom.webp'));
    const tvSide = useLoader(TextureLoader, shellSrc('/textures/studio/tv_side.webp'));
    const tvBackPainted = useColorOnlyTexture('/textures/studio/tv_back_painted.webp');
    const tvTopPainted = useColorOnlyTexture('/textures/studio/tv_top_painted.webp');
    const tvBottomPainted = useColorOnlyTexture('/textures/studio/tv_bottom_painted.webp');
    const tvSidePainted = useColorOnlyTexture('/textures/studio/tv_side_painted.webp');

    const phoneBack = useLoader(TextureLoader, shellSrc('/textures/studio/phone_back.webp'));
    const phoneSide = useLoader(TextureLoader, shellSrc('/textures/studio/phone_side.webp'));
    const phoneBackPainted = useColorOnlyTexture('/textures/studio/phone_back_painted.webp');
    const phoneSidePainted = useColorOnlyTexture('/textures/studio/phone_side_painted.webp');

    const isTouch = isTouchDevice();
    const colorEnabled = useColorEnabled();

    // 前面已经通过 useTexturePair 取当前模式封面，不再叠加第二次 reveal
    const faceConfig = useMemo(() => {
        if (isBlogMonitor) {
            return [
                { sketch: monitorRight, painted: monitorRightPainted },
                { sketch: monitorLeft, painted: monitorLeftPainted },
                { sketch: monitorTop, painted: monitorTopPainted },
                { sketch: monitorBottom, painted: monitorBottomPainted },
                { sketch: frontTex, painted: null },
                { sketch: monitorBack, painted: monitorBackPainted },
            ];
        }
        if (isTvMonitor) {
            return [
                { sketch: tvSide, painted: tvSidePainted },
                { sketch: tvSide, painted: tvSidePainted },
                { sketch: tvTop, painted: tvTopPainted },
                { sketch: tvBottom, painted: tvBottomPainted },
                { sketch: frontTex, painted: null },
                { sketch: tvBack, painted: tvBackPainted },
            ];
        }
        if (isPhoneMonitor) {
            return [
                { sketch: phoneSide, painted: phoneSidePainted },
                { sketch: phoneSide, painted: phoneSidePainted },
                { sketch: phoneSide, painted: phoneSidePainted },
                { sketch: phoneSide, painted: phoneSidePainted },
                { sketch: frontTex, painted: null },
                { sketch: phoneBack, painted: phoneBackPainted },
            ];
        }
        return null;
    }, [
        isBlogMonitor, isTvMonitor, isPhoneMonitor,
        frontTex,
        monitorBack, monitorTop, monitorBottom, monitorLeft, monitorRight,
        monitorBackPainted, monitorTopPainted, monitorBottomPainted, monitorLeftPainted, monitorRightPainted,
        tvBack, tvTop, tvBottom, tvSide,
        tvBackPainted, tvTopPainted, tvBottomPainted, tvSidePainted,
        phoneBack, phoneSide, phoneBackPainted, phoneSidePainted,
    ]);

    const paintedMaterials = useMemo(() => {
        if (!faceConfig) return null;
        return faceConfig.map((face) => {
            const mat = new THREE.MeshBasicMaterial({
                color: '#e0e0e0',
                map: face.painted || face.sketch,
            });
            if (paintOnBeforeCompile) {
                mat.onBeforeCompile = paintOnBeforeCompile;
                mat.customProgramCacheKey = () => 'paintOnBeforeCompile_studio_painted';
                mat.transparent = true;
                mat.needsUpdate = true;
            }
            return mat;
        });
    }, [faceConfig, paintOnBeforeCompile]);

    const sketchMaterials = useMemo(() => {
        if (!faceConfig) return null;
        return faceConfig.map((face) => {
            if (face.painted) return null;
            const mat = new THREE.MeshBasicMaterial({ color: '#e0e0e0', map: face.sketch });
            if (paintOnBeforeCompile) {
                mat.onBeforeCompile = paintOnBeforeCompile;
                mat.customProgramCacheKey = () => 'paintOnBeforeCompile_studio_sketch';
                mat.transparent = true;
                mat.needsUpdate = true;
            }
            return mat;
        });
    }, [faceConfig, paintOnBeforeCompile]);

    const isHoveredRef = useRef(false);
    const [isHovered, setIsHovered] = useState(false);
    const groupRef = useRef();
    const setGroupRef = useCallback((node) => {
        groupRef.current = node;
        if (typeof meshRef === 'function') meshRef(node);
        else if (meshRef) meshRef.current = node;
    }, [meshRef]);

    const updatePaintState = useCallback(() => {
        if (!faceConfig) return;

        const shouldPaint = colorEnabled || (!isTouch && (isHoveredRef.current || isSelected));
        const targetProgress = shouldPaint ? 1.0 : 0.0;
        const duration = shouldPaint ? 0.8 : 0.5;

        matRefs.forEach((ref) => {
            if (ref.current) {
                gsap.to(ref.current, {
                    uProgress: targetProgress,
                    duration,
                    ease: 'power2.out',
                    overwrite: true,
                });
            }
        });

        if (shouldPaint) {
            if (hideDelayRef.current) hideDelayRef.current.kill();
            if (paintedBoxRef.current) paintedBoxRef.current.visible = true;
        } else {
            const delay = hideDelayRef.current === undefined ? 0.05 : (duration + 0.05);
            hideDelayRef.current = gsap.delayedCall(delay, () => {
                if (paintedBoxRef.current) paintedBoxRef.current.visible = false;
            });
        }
    }, [faceConfig, isSelected, isTouch, colorEnabled, matRefs]);

    useEffect(() => {
        updatePaintState();
    }, [isSelected, colorEnabled, updatePaintState]);

    if (!faceConfig) {
        return (
            <group ref={meshRef} position={[item.x, item.baseY, item.z]} rotation={[0, item.rot, 0]}>
                <mesh frustumCulled={false}>
                    <primitive object={boxGeometry} attach="geometry" />
                    <meshBasicMaterial color={item.platformConfig.color} />
                </mesh>
            </group>
        );
    }

    return (
        <group
            ref={setGroupRef}
            position={[item.x, item.baseY, item.z]}
            rotation={[0, item.rot, 0]}
            onPointerOver={(e) => {
                if (disabled) return;
                e.stopPropagation();
                isHoveredRef.current = true;
                setIsHovered(true);
                updatePaintState();
                document.body.style.cursor = 'pointer';
                if (!item.isHero && groupRef.current) {
                    gsap.to(groupRef.current.scale, {
                        x: 1.055,
                        y: 1.055,
                        z: 1.055,
                        duration: 0.28,
                        ease: 'power2.out',
                        overwrite: true,
                    });
                }
            }}
            onPointerOut={() => {
                isHoveredRef.current = false;
                setIsHovered(false);
                updatePaintState();
                document.body.style.cursor = 'auto';
                if (!item.isHero && groupRef.current) {
                    gsap.to(groupRef.current.scale, {
                        x: 1,
                        y: 1,
                        z: 1,
                        duration: 0.3,
                        ease: 'power2.out',
                        overwrite: true,
                    });
                }
            }}
            onPointerUp={(e) => {
                if (disabled) return;
                e.stopPropagation();
                onMonitorClick(item);
            }}
        >
            <mesh position={[0, 0, -item.depth / 2 - 0.02]} raycast={() => null}>
                <planeGeometry args={[item.width * 1.06 + 0.03, item.height * 1.06 + 0.03]} />
                <meshBasicMaterial color="#1f1b15" transparent opacity={0.13} depthWrite={false} />
            </mesh>

            {item.isHero && (
                <mesh position={[0, 0, item.depth / 2 - 0.009]} raycast={() => null}>
                    <planeGeometry args={[item.width * 1.16 + 0.04, item.height * 1.16 + 0.04]} />
                    <meshBasicMaterial color="#efe6d6" />
                </mesh>
            )}
            <mesh position={[0, 0, item.depth / 2 - 0.004]} raycast={() => null}>
                <planeGeometry args={[item.width * 1.07 + 0.02, item.height * 1.07 + 0.02]} />
                <meshBasicMaterial color="#2b2620" />
            </mesh>

            <mesh ref={paintedBoxRef} visible={true} frustumCulled={false}>
                <primitive object={boxGeometry} attach="geometry" />
                {paintedMaterials.map((mat, i) => (
                    <primitive key={`p${i}`} attach={`material-${i}`} object={mat} />
                ))}
            </mesh>

            <mesh frustumCulled={false}>
                <primitive object={boxGeometry} attach="geometry" />
                {faceConfig.map((face, i) => {
                    if (face.painted) {
                        return (
                            <revealMaterial
                                color="#e0e0e0"
                                key={`s${i}`}
                                ref={matRefs[i]}
                                attach={`material-${i}`}
                                map={face.sketch}
                                transparent={true}
                                alphaTest={0.1}
                                paintUniforms={paintUniforms}
                                paintConfig={STUDIO_PAINT_CONFIG}
                                uProgress={0.0}
                            />
                        );
                    }
                    return (
                        <primitive key={`s${i}`} attach={`material-${i}`} object={sketchMaterials[i]} />
                    );
                })}
            </mesh>

            {isCurrent && (
                <group position={[item.width / 2 + 0.035, item.height / 2 - 0.035, item.depth / 2 + 0.07]}>
                    <mesh raycast={() => null} renderOrder={26}>
                        <circleGeometry args={[0.06, 24]} />
                        <meshBasicMaterial color="#f7f0e3" depthWrite={false} />
                    </mesh>
                    <mesh position={[0, 0, 0.002]} raycast={() => null} renderOrder={27}>
                        <circleGeometry args={[0.032, 20]} />
                        <meshBasicMaterial color="#9a3b2c" depthWrite={false} />
                    </mesh>
                </group>
            )}

            {isHovered && !item.isHero && !disabled && (
                <ProgramHoverTag
                    item={item}
                    index={playlistIndex}
                    total={totalCount}
                    isCurrent={isCurrent}
                />
            )}
        </group>
    );
});

export default MonitorBlock;
