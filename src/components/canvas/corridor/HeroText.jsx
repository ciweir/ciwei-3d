import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

// Local fonts for sketch-style typography (TTF format required by troika)
// 中文化（2026-10-12）：英文字体（Rubik Scribble/Cabin Sketch）无中文字形，
// 统一换开源 Noto Sans SC（OFL 许可，可变字体，17.7MB 本地加载）
const NOTO_SC_URL = '/fonts/NotoSansSC.ttf';

// Global flag - draw animation only happens ONCE per page load

/**
 * HeroText Component - Hand-drawn Style with Sketch Fonts
 * 
 * WOW Effects for Awwwards SOTD:
 * - 「此唯」in Rubik Scribble font (splits into letters during scroll)
 * - Creative developer in Cabin Sketch font (also splits)
 * - Floating micro-animations
 * - Parallax split effect
 * - RESPONSIVE: scales down on mobile
 */
const HeroText = ({ position = [0, 0.3, 0] }) => {
    const groupRef = useRef();
    const letterRefs = useRef([]);
    const taglineRefs = useRef([]);
    const { camera } = useThree();

    // Responsive scale based on screen width - FLUID (no breakpoints)
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const updateScale = () => {
            const width = window.innerWidth;
            const minWidth = 320;
            const maxWidth = 1200;
            const minScale = 0.65;
            const maxScale = 1.0;

            const clampedWidth = Math.max(minWidth, Math.min(maxWidth, width));
            const t = (clampedWidth - minWidth) / (maxWidth - minWidth);
            setScale(minScale + t * (maxScale - minScale));
        };

        updateScale();
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, []);

    // Split and dodge state
    const splitAmount = useRef(0);
    const targetSplit = useRef(0);
    const floatY = useRef(0);
    // Pre-allocate Vector3 to avoid per-frame garbage collection
    const worldPosVec = useRef(new THREE.Vector3());

    // 2026-10-13：署名缩小 50%（0.9→0.45）并移到 Avatar 方块右外侧。
    // 右列中心 x=1.62（头像右缘 1.15，到达视角可见半宽 ≈2.3）；两字 ±0.225。
    const NAME_X = 1.62;
    const NAME_Y = 0.42;
    const letters = useMemo(() => [
        { char: '此', baseX: NAME_X - 0.225, splitDir: -1.0, delay: 0 },
        { char: '唯', baseX: NAME_X + 0.225, splitDir: 1.0, delay: 0 },
    ], []);

    // 2026-10-13：字幕由「< 视频导演 />」改为三行职业标签：剪辑 / 拍摄 / 运营
    // 竖排在署名下方（同靠右列，不压头像、不被边缘裁切）。
    const taglineWords = useMemo(() => [
        { text: '剪辑', baseX: NAME_X, baseY: 0.02, size: 0.2 },
        { text: '拍摄', baseX: NAME_X, baseY: -0.28, size: 0.2 },
        { text: '运营', baseX: NAME_X, baseY: -0.58, size: 0.2 },
    ], []);

    // Animation loop
    useFrame((state) => {
        if (!groupRef.current) return;

        const time = state.clock.elapsedTime;

        // === SPLIT LOGIC based on camera distance ===
        groupRef.current.getWorldPosition(worldPosVec.current);
        const distance = camera.position.z - worldPosVec.current.z;

        const SPLIT_START = 3;
        const SPLIT_PEAK = 0;
        const SPLIT_END = -2;
        // 署名缩小 50% 后，靠近对开幅度同步减半
        const SPLIT_AMOUNT = 0.45;

        if (distance > SPLIT_PEAK && distance < SPLIT_START) {
            const t = (SPLIT_START - distance) / (SPLIT_START - SPLIT_PEAK);
            targetSplit.current = SPLIT_AMOUNT * easeOutQuad(t);
        } else if (distance <= SPLIT_PEAK && distance > SPLIT_END) {
            const t = (distance - SPLIT_END) / (SPLIT_PEAK - SPLIT_END);
            targetSplit.current = SPLIT_AMOUNT * easeOutQuad(t);
        } else {
            targetSplit.current = 0;
        }

        splitAmount.current = THREE.MathUtils.lerp(splitAmount.current, targetSplit.current, 0.08);

        // Apply split to each letter of 「此唯」
        letterRefs.current.forEach((ref, i) => {
            if (ref) {
                // Ensure opacity is 1
                if (ref.material) ref.material.opacity = 1;
                ref.scale.setScalar(1); // Ensure scale is 1, no lingering pop effect

                const letter = letters[i];
                ref.position.x = letter.baseX + letter.splitDir * splitAmount.current;
                ref.position.y = NAME_Y + Math.sin(time * 0.7 + i * 0.5) * 0.015;
                ref.rotation.z = Math.sin(time * 0.5 + i) * 0.02 * (1 + splitAmount.current);
            }
        });

        // 三行职业标签：仅轻微浮动，不做对开
        taglineRefs.current.forEach((ref, i) => {
            if (ref) {
                if (ref.material) ref.material.opacity = 1;
                const word = taglineWords[i];
                ref.position.x = word.baseX;
                ref.position.y = word.baseY + Math.sin(time * 0.6 + i * 0.3) * 0.008;
            }
        });

        // === FLOATING ANIMATION ===
        floatY.current = Math.sin(time * 0.5) * 0.02;
        // Don't override Y position entirely, add to base
        groupRef.current.position.y = position[1] + floatY.current;
    });

    return (
        <group ref={groupRef} position={position} scale={[scale, scale, 1]}>
            {/* 署名「此唯」——缩小 50%，头像右外侧 */}
            {letters.map((letter, i) => (
                <Text
                    key={letter.char}
                    ref={(el) => (letterRefs.current[i] = el)}
                    position={[letter.baseX, NAME_Y, 0]}
                    fontSize={0.45}
                    font={NOTO_SC_URL}
                    color="#2f2b26"
                    anchorX="center"
                    anchorY="middle"
                    letterSpacing={0}
                >
                    {letter.char}
                </Text>
            ))}

            {/* 职业标签三行：剪辑 / 拍摄 / 运营（署名下方） */}
            {taglineWords.map((word, i) => (
                <Text
                    key={word.text}
                    ref={(el) => (taglineRefs.current[i] = el)}
                    position={[word.baseX, word.baseY, 0.3]}
                    fontSize={word.size}
                    font={NOTO_SC_URL}
                    color="#555046"
                    anchorX="center"
                    anchorY="middle"
                    letterSpacing={0.06}
                >
                    {word.text}
                </Text>
            ))}

            {/* 小装饰星全部收在头像左侧（右列是署名/标签区，不放装饰） */}
            <SmallStar position={[-1.2, 0.55, 0]} scale={0.07} />
            <SmallStar position={[-1.45, 0.2, 0]} scale={0.05} />
            <SmallStar position={[-1.0, -0.6, 0]} scale={0.04} />
            <SmallStar position={[-1.3, -0.95, 0]} scale={0.035} />
        </group>
    );
};

// Easing function
const easeOutQuad = (t) => t * (2 - t);

/**
 * Small decorative star - STATIC to avoid useFrame overhead
 * Parent HeroText already handles all animations
 */
const SmallStar = ({ position, scale = 0.1 }) => {
    return (
        <group position={position} scale={scale}>
            {[0, 1, 2, 3].map((i) => (
                <mesh key={i} rotation={[0, 0, (i * Math.PI) / 4]}>
                    <planeGeometry args={[1, 0.12]} />
                    <meshBasicMaterial color="#333" transparent opacity={0.6} side={2} />
                </mesh>
            ))}
        </group>
    );
};

export default HeroText;
