import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
// 全站彩色：桌面端自动取 _painted 彩色版（见 utils/colorTexture.js）
import { useColorTexture as useTexture } from '../../../utils/colorTexture';

// Import constants to match CorridorSegment logic
// Note: In a real project these might be in a shared config file.
// For now, we duplicate the values to avoid circular dependencies or complex imports if check is not rigorous.
const WALL_X_OUTER = 3.5;
const WALL_X_INNER = 1.7;
// Note: DOOR_Z_SPAN = 4 (from CorridorSegment)

/**
 * DoorWallSegment - Dynamic wall segment that tilts towards camera
 * Used for the angled walls next to doors
 */
const DoorWallSegment = ({ position, baseRotationY, width, corridorHeight, wallTexture, side }) => {
    const meshRef = useRef();
    const { camera } = useThree();

    // Tilt state
    const currentTilt = useRef(0);

    // Tilt parameters - adjust these to change the effect
    const BASE_TILT = 0.02;   // ~1 degree base tilt
    const MAX_TILT = 0.20;    // ~12 degrees max tilt when camera is close
    const TILT_START = 12;    // Start tilting when camera is 12 units away
    const TILT_PEAK = 2;      // Max tilt at 2 units

    useFrame(() => {
        if (!meshRef.current) return;

        const distance = Math.abs(camera.position.z - position[2]);
        let targetTilt = BASE_TILT;

        if (distance < TILT_START && distance > TILT_PEAK) {
            // Approaching: ramp up tilt
            const t = (TILT_START - distance) / (TILT_START - TILT_PEAK);
            const easedT = t * (2 - t); // easeOutQuad
            targetTilt = BASE_TILT + (MAX_TILT - BASE_TILT) * easedT;
        } else if (distance <= TILT_PEAK) {
            // Very close: max tilt
            targetTilt = MAX_TILT;
        }

        // Smooth interpolation
        currentTilt.current = THREE.MathUtils.lerp(currentTilt.current, targetTilt, 0.06);

        // Apply tilt - direction based on side
        const tiltDirection = side === 'left' ? -1 : 1;
        meshRef.current.rotation.y = baseRotationY + (currentTilt.current * tiltDirection);
    });

    // Clone texture for independent repeat
    const segTexture = useMemo(() => {
        const tex = wallTexture.clone();
        tex.needsUpdate = true;
        tex.repeat.set(width / 2, corridorHeight / 2);
        return tex;
    }, [wallTexture, width, corridorHeight]);

    return (
        <mesh ref={meshRef} position={position}>
            <planeGeometry args={[width, corridorHeight]} />
            <meshBasicMaterial color="#e0e0e0" map={segTexture} roughness={1} metalness={0} />
        </mesh>
    );
};

/**
 * CorridorWalls Component
 * 
 * Renders the floor, ceiling, and the Sawtooth Walls.
 * 
 * @param {Array} doorPositions - Array of door objects with { relativeZ, side, ... }
 * @param {number} zClip - Optional Z value to clip geometry (hide anything with Z > zClip)
 */
const CorridorWalls = ({ zStart = 10, length = 80, doorPositions = [], zClip = 100000 }) => {
    const corridorHeight = 3.5;

    // =============================================
    // 地板设置
    // =============================================
    // 地板块贴图——手绘木板
    const floorTexture = useTexture('/textures/corridor/kawalekpodlogi.webp');
    floorTexture.wrapS = floorTexture.wrapT = THREE.ClampToEdgeWrapping;

    // 踢脚线贴图
    // 图片尺寸：1582 x 94 px → 比例 16.83:1
    const baseboardTexture = useTexture('/textures/corridor/texturadoprogow.webp');
    baseboardTexture.wrapS = baseboardTexture.wrapT = THREE.RepeatWrapping;
    baseboardTexture.colorSpace = THREE.SRGBColorSpace;

    // Load wall texture
    const wallTexture = useTexture('/textures/corridor/wall_texture.webp');
    wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;

    // Load ceiling texture
    const ceilingTexture = useTexture('/textures/corridor/ceiling_texture.webp');
    ceilingTexture.wrapS = ceilingTexture.wrapT = THREE.RepeatWrapping;

    // Calculate effective geometry based on clipping
    // We only render from Math.min(zStart, zClip) down to (zStart - length)
    const effectiveStart = Math.min(zStart, zClip);
    const effectiveLength = effectiveStart - (zStart - length);

    // =============================================
    // 踢脚线在门洞处的裁切量
    // =============================================
    // 门框两侧踢脚线各缩短多少（3D 单位）。
    // 增大 → 踢脚线与门之间间隙更大；减小 → 更靠近门（可能压到门框）。
    const BASEBOARD_DOOR_MARGIN = 0.5;

    // Helper to generate wall segments for a side ('left' or 'right')
    const generateWallSegments = (side) => {
        const segments = [];
        const isLeft = side === 'left';
        const baseX = isLeft ? -WALL_X_OUTER : WALL_X_OUTER;
        const innerX = isLeft ? -WALL_X_INNER : WALL_X_INNER;

        // We build the wall from Start (High Z) to End (Low Z).
        // Current 'cursor' for Z
        let currentZ = effectiveStart;
        const endZ = effectiveStart - effectiveLength;

        // Sort doors by relativeZ descending (closest to start first) if needed
        // relativeZ is negative (-18, -32...). -18 > -32.
        const sideDoors = doorPositions
            .filter(d => d.side === side)
            .sort((a, b) => b.relativeZ - a.relativeZ);

        sideDoors.forEach(door => {
            const doorZ = zStart + door.relativeZ; // Use original zStart for correct world position
            const doorStartZ = doorZ + 2.0; // Start of angled section
            const doorEndZ = doorZ - 2.0;   // End of angled section

            // Skip doors that are completely clipped (starts "behind" us)
            if (doorStartZ > currentZ) return;
            // Also skip if door is fully "ahead" of us (shouldn't happen with standard logic but safe)
            if (doorEndZ < endZ) return;

            // 1. Straight Filler Segment (from currentZ to doorStartZ)
            if (currentZ > doorStartZ) {
                const segLength = currentZ - doorStartZ;
                const segCenterZ = currentZ - segLength / 2;
                segments.push({
                    type: 'filler',
                    position: [baseX, 0, segCenterZ],
                    rotation: [0, isLeft ? Math.PI / 2 : -Math.PI / 2, 0],
                    width: segLength,
                    isLeft,
                    // 该段在门处结束（较低 Z 一侧）
                    trimLowZ: true
                });
            }

            // 2. Connector (Step Out) - The wall that faces the camera
            // Wait, if we are at baseX (Outer), and we want to start angled wall?
            // Actually, the angled wall GOES from Outer to Inner.
            // So we are rightfully at Outer.
            // Wait, the "Filler" is at Outer (Recessed).
            // So we are already at the start point of the angled wall.
            // No connector needed BEFORE the door?
            // Let's trace Left Wall (-X):
            // Filler is at x = -3.5.
            // Angled wall starts at x = -3.5.
            // Angled wall ends at x = -1.7.
            // So continuous join. Good.

            // 3. Angled Wall (Door holder)
            // From (baseX, doorStartZ) to (innerX, doorEndZ).
            const dx = innerX - baseX;
            const dz = doorEndZ - doorStartZ; // Negative (-4)
            const dist = Math.sqrt(dx * dx + dz * dz);
            // atan2(dx, dz). Left: dx = 1.8, dz = -4. Angle ~ 155 deg.
            // Standard wall normal is 90 deg.
            // We want rotation around Y.
            // Center of segment:
            const midX = (baseX + innerX) / 2;
            const midZ = (doorStartZ + doorEndZ) / 2;

            // Rotation:
            // Plane defaults to facing +Z (if simple plane)? No planeGeometry defaults to XY plane.
            // LookAt approach is easiest.
            // Wall normal should point inwards?
            // Actually simpler: Position geometry center and rotate.
            // Vector from Start to End: (dx, 0, dz).
            // Rotation Y = -atan2(dz, dx).
            // Left: dx=1.8, dz=-4. atan2(-4, 1.8) = -1.14 rad ~ -65 deg.
            // -(-65) = 65 deg.
            // Check: 0 deg = +X alignment. 90 deg = -Z alignment.
            // 65 deg = Pointing mostly +X, slightly -Z.
            // This aligns with vector.
            // Normal is +90 deg from that?
            // Left: dx=1.8, dz=-4. atan2(-4, 1.8) = -1.14 rad. -(-1.14) = +1.14. 
            // Normal (+0.9, +0.4) -> Right/Back. Correct for Left Wall.
            // Right: dx=-1.8, dz=-4. atan2(-4, -1.8) = -1.9 rad (-110deg). -(-1.9) = +1.9. 
            // Normal (+0.3, -0.9)? No. Check Math.
            // We need Right Wall Normal to point (-X, +Z). 
            // Adding PI fixes the backface issue.

            const baseRotation = -Math.atan2(dz, dx);
            const finalRotation = isLeft ? baseRotation : baseRotation + Math.PI;

            segments.push({
                type: 'door',
                position: [midX, 0, midZ],
                rotationY: finalRotation,
                width: dist,
                side: side  // For dynamic tilt direction
            });

            // 4. Reset Connector (The hidden face)
            // We are now at (innerX, doorEndZ).
            // We need to return to (baseX, doorEndZ).
            // Or (baseX, doorEndZ - eps).
            // This is a straight wall segment facing AWAY (-Z direction).
            // Left: From -1.7 to -3.5. Vector (-1.8, 0).
            // Facing -Z? Normal should be -Z.
            // Only need to render it.
            const connWidth = Math.abs(baseX - innerX);
            const connX = (innerX + baseX) / 2;

            segments.push({
                type: 'connector',
                position: [connX, 0, doorEndZ],
                rotation: [0, 0, 0], // Plane facing +Z.
                // If Face +Z, and we view from +Z, we see it.
                // We want it facing -Z (Away).
                // So Rotation Y = PI.
                rotationY: Math.PI,
                width: connWidth
            });

            currentZ = doorEndZ;
        });

        // Final filler segment
        if (currentZ > endZ) {
            const segLength = currentZ - endZ;
            const segCenterZ = currentZ - segLength / 2;
            segments.push({
                type: 'filler',
                position: [baseX, 0, segCenterZ],
                rotation: [0, isLeft ? Math.PI / 2 : -Math.PI / 2, 0],
                width: segLength,
                isLeft,
                // 该段紧接门之后（较高 Z 一侧）
                trimHighZ: true
            });
        }

        return segments;
    };

    const leftSegments = useMemo(() => generateWallSegments('left'), [effectiveStart, effectiveLength, doorPositions]);
    const rightSegments = useMemo(() => generateWallSegments('right'), [effectiveStart, effectiveLength, doorPositions]);

    // If fully clipped, render nothing
    // 注意：必须放在 hooks 之后——原先位于 useMemo 之前会构成「条件式调用 Hook」，
    // 一旦 effectiveLength 在两次渲染间跨越 0，Hook 数量变化会导致 React 报错。
    if (effectiveLength <= 0) return null;

    return (
        <group>
            {/* =============================================
                地板砖
                =============================================
                每块砖是贴 kawalekpodlogi.png 的平面；
                每隔一块旋转 180° 并镜像，使拼缝更自然。

                手动调节项：
                - TILE_LENGTH: 单块砖长度（3D 单位）
                - CENTER_WIDTH: 中间主带宽度（应与走廊匹配 = 7 总宽）
                - FLOOR_START_OFFSET: 地板起始偏移
            */}
            {(() => {
                // ===== 地板砖参数 =====
                const TILE_LENGTH = 10;          // 单块砖沿走廊方向的长度
                const CENTER_WIDTH = 5;          // 中间主带宽（木板更窄更好看）
                const SIDE_WIDTH = 1;            // 左右两侧边带宽度
                const FLOOR_START_OFFSET = 2;    // 起始偏移（+ 更远，- 更靠近相机）

                // 侧边带裁切贴图（与中间同比例，不拉伸）
                // UV repeat = 显示贴图的比例（SIDE_WIDTH / CENTER_WIDTH）
                const uvFraction = SIDE_WIDTH / CENTER_WIDTH; // 如 1/5 = 0.2 → 显示贴图的 20%

                const leftSideTexture = floorTexture.clone();
                leftSideTexture.needsUpdate = true;
                leftSideTexture.repeat.set(1, uvFraction);    // 全长，宽度裁切
                leftSideTexture.offset.set(0, 0);             // 贴图左缘

                const rightSideTexture = floorTexture.clone();
                rightSideTexture.needsUpdate = true;
                rightSideTexture.repeat.set(1, uvFraction);
                rightSideTexture.offset.set(0, 1 - uvFraction); // 贴图右缘

                const tiles = [];
                const floorY = -corridorHeight / 2;
                const segmentEndZ = effectiveStart - effectiveLength;

                const firstTileIndex = Math.floor(effectiveStart / TILE_LENGTH);
                let tileZ = firstTileIndex * TILE_LENGTH - TILE_LENGTH / 2 + FLOOR_START_OFFSET;

                while (tileZ + TILE_LENGTH / 2 > segmentEndZ) {
                    const globalTileIndex = Math.round(tileZ / TILE_LENGTH);
                    const isMirrored = Math.abs(globalTileIndex) % 2 === 1;

                    // --- 地板中间主带 ---
                    tiles.push(
                        <mesh
                            key={`floor-center-${tileZ.toFixed(1)}`}
                            position={[0, floorY, tileZ]}
                            rotation={[-Math.PI / 2, 0, Math.PI / 2 + (isMirrored ? Math.PI : 0)]}
                            scale={[isMirrored ? -1 : 1, 1, 1]}
                        >
                            <planeGeometry args={[TILE_LENGTH, CENTER_WIDTH]} />
                            <meshBasicMaterial color="#e0e0e0"
                                map={floorTexture}
                                side={THREE.DoubleSide}
                                roughness={1}
                                metalness={0}
                            />
                        </mesh>
                    );

                    // --- 左侧边带（裁切贴图，不拉伸） ---
                    tiles.push(
                        <mesh
                            key={`floor-left-${tileZ.toFixed(1)}`}
                            position={[-(CENTER_WIDTH / 2 + SIDE_WIDTH / 2), floorY, tileZ]}
                            rotation={[-Math.PI / 2, 0, Math.PI / 2 + (isMirrored ? Math.PI : 0)]}
                            scale={[isMirrored ? -1 : 1, 1, 1]}
                        >
                            <planeGeometry args={[TILE_LENGTH, SIDE_WIDTH]} />
                            <meshBasicMaterial color="#e0e0e0"
                                map={leftSideTexture}
                                side={THREE.DoubleSide}
                                roughness={1}
                                metalness={0}
                            />
                        </mesh>
                    );

                    // --- 右侧边带（裁切贴图，不拉伸） ---
                    tiles.push(
                        <mesh
                            key={`floor-right-${tileZ.toFixed(1)}`}
                            position={[(CENTER_WIDTH / 2 + SIDE_WIDTH / 2), floorY, tileZ]}
                            rotation={[-Math.PI / 2, 0, Math.PI / 2 + (isMirrored ? Math.PI : 0)]}
                            scale={[isMirrored ? -1 : 1, 1, 1]}
                        >
                            <planeGeometry args={[TILE_LENGTH, SIDE_WIDTH]} />
                            <meshBasicMaterial color="#e0e0e0"
                                map={rightSideTexture}
                                side={THREE.DoubleSide}
                                roughness={1}
                                metalness={0}
                            />
                        </mesh>
                    );

                    tileZ -= TILE_LENGTH;
                }
                return tiles;
            })()}


            {/* Ceiling with texture - alternating tiles for seamless pattern */}
            {(() => {
                const tileLength = 10; // Match floor tile length
                const tileWidth = 7;   // Ceiling width (matching corridor)
                const tiles = [];
                const ceilingY = corridorHeight / 2;

                // Use same global Z alignment as floor
                const segmentEndZ = effectiveStart - effectiveLength;

                // First tile position with fine-tuned offset (same as floor)
                const CEILING_START_OFFSET = 2; // Match floor offset
                const firstTileIndex = Math.floor(effectiveStart / tileLength);
                let tileZ = firstTileIndex * tileLength - tileLength / 2 + CEILING_START_OFFSET;

                while (tileZ + tileLength / 2 > segmentEndZ) {
                    // Use global tile index for alternating pattern
                    const globalTileIndex = Math.round(tileZ / tileLength);
                    const isMirrored = Math.abs(globalTileIndex) % 2 === 1;

                    tiles.push(
                        <mesh
                            key={`ceiling-tile-${tileZ.toFixed(1)}`}
                            position={[0, ceilingY, tileZ]}
                            rotation={[Math.PI / 2, 0, isMirrored ? Math.PI : 0]}
                            scale={[isMirrored ? -1 : 1, 1, 1]}
                        >
                            <planeGeometry args={[tileWidth, tileLength]} />
                            <meshBasicMaterial color="#e0e0e0"
                                map={ceilingTexture}
                                map-repeat={[tileWidth / 2, tileLength / 2]}
                                side={THREE.DoubleSide}
                                roughness={1}
                                metalness={0}
                            />
                        </mesh>
                    );
                    tileZ -= tileLength;
                }
                return tiles;
            })()}

            {/* Render Wall Segments with texture */}
            {/* Skip 'connector' and 'door' segments - door segments are now handled by DoorSection */}
            {[...leftSegments, ...rightSegments]
                .filter(seg => seg.type === 'filler')
                .map((seg, i) => {
                    // Wall texture clone (same pattern for wall + baseboard)
                    const segTexture = wallTexture.clone();
                    segTexture.needsUpdate = true;
                    segTexture.repeat.set(seg.width / 2, corridorHeight / 2);

                    // Baseboard texture clone
                    // Texture: 1582x94 px. Natural tile = (1582/94)*0.15 = 2.524 units wide
                    const bbTexture = baseboardTexture.clone();
                    bbTexture.needsUpdate = true;
                    bbTexture.wrapS = bbTexture.wrapT = THREE.RepeatWrapping;
                    bbTexture.rotation = 0; // CRITICAL: reset rotation (shared texture may have PI/2 from threshold)
                    bbTexture.offset.set(0, 0);
                    const NATURAL_TILE_W = (1582 / 94) * 0.15;
                    bbTexture.repeat.set(seg.width / NATURAL_TILE_W, 1);

                    // =============================================
                    // 踢脚线在门洞处的裁切
                    // =============================================
                    // 与门相邻的段（trimStart / trimEnd），踢脚线两端各缩短 BASEBOARD_DOOR_MARGIN。
                    // 同时偏移踢脚线中心以对齐墙面。
                    // trimHighZ = 从较高 Z 一侧裁切（门洞起点）
                    // trimLowZ  = 从较低 Z 一侧裁切（门洞终点）
                    const bbMarginHighZ = seg.trimHighZ ? BASEBOARD_DOOR_MARGIN : 0;
                    const bbMarginLowZ = seg.trimLowZ ? BASEBOARD_DOOR_MARGIN : 0;
                    const bbWidth = seg.width - bbMarginHighZ - bbMarginLowZ;

                    // 踢脚线中心沿本地轴（组空间内的 X 轴）的偏移。
                    // 该段经过旋转，本地 X 轴沿墙方向：
                    // 左墙旋转 +PI/2：本地 +X → 世界 -Z（较低 Z）
                    // 右墙旋转 -PI/2：本地 +X → 世界 +Z（较高 Z）
                    // 因此左右墙的偏移方向相反。
                    let bbOffsetX;
                    if (seg.isLeft) {
                        // 本地 +X = 世界 -Z = lowZ 侧
                        bbOffsetX = (bbMarginLowZ - bbMarginHighZ) / 2;
                    } else {
                        // 本地 +X = 世界 +Z = highZ 侧
                        bbOffsetX = (bbMarginHighZ - bbMarginLowZ) / 2;
                    }

                    return (
                        <group key={i} position={seg.position} rotation={seg.rotation || [0, seg.rotationY, 0]}>
                            {/* Main Wall Segment */}
                            <mesh>
                                <planeGeometry args={[seg.width, corridorHeight]} />
                                <meshBasicMaterial color="#e0e0e0"
                                    map={segTexture}
                                    roughness={1}
                                    metalness={0}
                                />
                            </mesh>

                            {/* 踢脚线（门洞处裁切） */}
                            <mesh position={[bbOffsetX, -corridorHeight / 2 + 0.075, 0.01]}>
                                <planeGeometry args={[bbWidth, 0.15]} />
                                <meshBasicMaterial color="#e0e0e0"
                                    map={bbTexture}
                                    roughness={0.8}
                                    side={THREE.DoubleSide}
                                />
                            </mesh>
                        </group>
                    );
                })}



            {/* Baseboards (Approximated or skip for complex geo for now) */}
            {/* Simplified: Just skip baseboards on zigzag for MVP efficiency */}
        </group>
    );
};

export default CorridorWalls;
