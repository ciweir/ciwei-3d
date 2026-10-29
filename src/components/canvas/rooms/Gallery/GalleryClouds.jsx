import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCloudTexture } from '../../../../utils/colorTexture';
import { isTouchDevice } from '../../../../utils/deviceDetect';
import { applyCloudAlphaKey, CLOUD_ALPHA_KEY } from '../../cloudAlphaKey';

// Available cloud textures
const CLOUD_TEXTURES = [
    '/textures/clouds/1131c3eb-dfae-423f-924b-ff39d8ccd6dc.webp',
    '/textures/clouds/254b8ec8-d6f7-4275-956f-7bab65b2ce2d.webp',
    '/textures/clouds/2cc88dd1-483c-466d-b07e-f8308c61ccbe.webp',
    '/textures/clouds/5606fcc0-3252-447d-a58a-7bcbac73229a.webp',
    '/textures/clouds/7882dc72-3d01-41fb-ac0e-d07b0184ebc1.webp',
    '/textures/clouds/9b2ca72f-7bd0-473b-ba6e-dd9e0eb79d35.webp',
    '/textures/clouds/c83293c6-d90c-4a32-8d9d-5ac9af7e2296.webp',
    '/textures/clouds/f6e358bc-d27c-41dd-95f4-6787a835c41e.webp',
];

/**
 * GalleryClouds Component
 * Static clouds scattered randomly above the gallery room
 */
const GalleryClouds = ({
    count = 12,
    seed = 42,
    rotationOffset = [0, -Math.PI / 3, 0],
    keyBackground = false,
    initialCount = count,
    batchSize = 6,
    batchDelay = 400,
}) => {
    // Movement boundaries - must match StaticCloud
    const startX = 40;
    const endX = -40;
    const totalDistance = startX - endX;
    // 房间级分批挂载：先挂一部分云，其余在首帧后分批补
    const [mounted, setMounted] = useState(() => Math.min(initialCount, count));

    useEffect(() => {
        let current = Math.min(initialCount, count);
        setMounted(current);
        const timers = [];
        const step = () => {
            current = Math.min(count, current + batchSize);
            setMounted(current);
            if (current < count) timers.push(setTimeout(step, batchDelay));
        };
        if (current < count) timers.push(setTimeout(step, batchDelay));
        return () => timers.forEach((timer) => clearTimeout(timer));
    }, [count, initialCount, batchSize, batchDelay]);

    const clouds = useMemo(() => {
        const items = [];
        const random = seededRandom(seed);

        for (let i = 0; i < count; i++) {
            const y = 6 + random() * 8; // High above
            const z = -5 - random() * 30; // Depth variation
            const driftSpeed = 0.1 + random() * 0.15;

            // 每朵云均匀错开偏移，铺满整个宽度
            // 每朵云在 X 轴上的起始位置不同
            const initialOffset = (i / count) * totalDistance + random() * 3;

            // 按云已在运动的状态计算初始 X
            const initialX = startX - (initialOffset % (totalDistance + 10)) + 5;

            items.push({
                id: i,
                position: [initialX, y, z],  // 位置已计算好！
                scale: 0.5 + random() * 1.2,
                opacity: 0.4 + random() * 0.3,
                textureIndex: Math.floor(random() * CLOUD_TEXTURES.length),
                driftSpeed: driftSpeed,
                initialOffset: initialOffset,  // 记录偏移供动画使用
            });
        }

        return items;
    }, [count, seed]);

    return (
        <group>
            {clouds.slice(0, mounted).map((cloud) => (
                <StaticCloud
                    key={cloud.id}
                    position={cloud.position}
                    scale={cloud.scale}
                    opacity={cloud.opacity}
                    textureIndex={cloud.textureIndex}
                    driftSpeed={cloud.driftSpeed}
                    initialOffset={cloud.initialOffset}
                    rotationOffset={rotationOffset}
                    keyBackground={keyBackground}
                />
            ))}
        </group>
    );
};

// Static cloud component (billboard with continuous drift)
const StaticCloud = ({ position, scale, opacity, textureIndex, driftSpeed, initialOffset, rotationOffset, keyBackground = false }) => {
    const meshRef = useRef();
    const isTouch = isTouchDevice();
    const keyCloud = isTouch || keyBackground;
    const basePosition = useRef(position);

    // Movement boundaries
    const startX = 40;  // Start from right
    const endX = -40;   // Exit to left
    const totalDistance = startX - endX;

    // Load the specific cloud texture
    const texture = useCloudTexture(CLOUD_TEXTURES[textureIndex]);

    // LEGACY FIX: Use original aspect ratios to prevent stretching after POT conversion
    const legacyCloudAspects = {
        '1131c3eb-dfae-423f-924b-ff39d8ccd6dc.webp': 1.894,
        '254b8ec8-d6f7-4275-956f-7bab65b2ce2d.webp': 2.459,
        '2cc88dd1-483c-466d-b07e-f8308c61ccbe.webp': 3.577,
        '5606fcc0-3252-447d-a58a-7bcbac73229a.webp': 1.794,
        '7882dc72-3d01-41fb-ac0e-d07b0184ebc1.webp': 1.997,
        '9b2ca72f-7bd0-473b-ba6e-dd9e0eb79d35.webp': 1.905,
        'c83293c6-d90c-4a32-8d9d-5ac9af7e2296.webp': 3,
        'f6e358bc-d27c-41dd-95f4-6787a835c41e.webp': 1.875
    };

    const cloudFile = CLOUD_TEXTURES[textureIndex].split('/').pop();
    const aspectRatio = legacyCloudAspects[cloudFile] || 1.8;
    const width = 2.5 * scale;
    const height = width / aspectRatio;

    useFrame(({ camera, clock }) => {
        if (!meshRef.current) return;

        // Continuous linear movement from right to left with looping
        // initialOffset 保证每朵云起始位置不同
        const time = clock.getElapsedTime();
        const progress = ((time * driftSpeed + initialOffset) % (totalDistance + 10)) - 5;
        const currentX = startX - progress;

        meshRef.current.position.x = currentX;
        meshRef.current.position.y = basePosition.current[1];
        meshRef.current.position.z = basePosition.current[2];

        // Billboard - always face camera with rotation offset
        const offsetRotation = new THREE.Euler(rotationOffset[0], rotationOffset[1], rotationOffset[2]);
        const offsetQuaternion = new THREE.Quaternion().setFromEuler(offsetRotation);
        meshRef.current.quaternion.copy(camera.quaternion).multiply(offsetQuaternion);
    });

    return (
        <mesh ref={meshRef} position={position}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial color="#e0e0e0"
                map={texture}
                transparent
                opacity={opacity}
                depthWrite={false}
                side={THREE.DoubleSide}
                onBeforeCompile={keyCloud ? applyCloudAlphaKey : undefined}
                customProgramCacheKey={keyCloud ? () => CLOUD_ALPHA_KEY : undefined}
            />
        </mesh>
    );
};

function seededRandom(seed) {
    let s = seed;
    return function () {
        s = Math.sin(s * 9999) * 10000;
        return s - Math.floor(s);
    };
}

export default GalleryClouds;
