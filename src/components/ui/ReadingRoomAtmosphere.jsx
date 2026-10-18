import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';

const WARM = '#ffb26b';
const COOL = '#6d8fa8';
const PAPER = '#efe6d5';

const Desk = () => (
    <group>
        <mesh position={[0, -0.08, 0]} receiveShadow>
            <boxGeometry args={[8.4, 0.16, 3.6]} />
            <meshStandardMaterial color="#332419" roughness={0.82} metalness={0.02} />
        </mesh>
        <mesh position={[0, -0.22, 0]}>
            <boxGeometry args={[8.2, 0.12, 3.4]} />
            <meshStandardMaterial color="#1b1410" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.7, -2.9]}>
            <boxGeometry args={[9, 4.4, 0.12]} />
            <meshStandardMaterial color="#16120e" roughness={0.95} />
        </mesh>

        {/* papers */}
        <mesh position={[-1.7, 0.02, 0.55]} rotation={[0, -0.14, 0]} receiveShadow>
            <boxGeometry args={[0.9, 0.012, 1.15]} />
            <meshStandardMaterial color={PAPER} roughness={0.95} />
        </mesh>
        <mesh position={[-1.62, 0.035, 0.52]} rotation={[0, 0.08, 0]}>
            <boxGeometry args={[0.86, 0.01, 1.1]} />
            <meshStandardMaterial color="#e8ddc9" roughness={0.95} />
        </mesh>
        <mesh position={[-2.1, 0.04, 0.7]} rotation={[0, 0.4, 0.04]}>
            <boxGeometry args={[0.05, 0.05, 0.7]} />
            <meshStandardMaterial color="#c9a46a" roughness={0.7} />
        </mesh>

        {/* open notebook */}
        <group position={[1.55, 0.04, 0.6]} rotation={[0, -0.18, 0]}>
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[1.0, 0.02, 0.72]} />
                <meshStandardMaterial color="#d8c9ae" roughness={0.95} />
            </mesh>
            <mesh position={[-0.24, 0.018, 0]}>
                <boxGeometry args={[0.5, 0.012, 0.68]} />
                <meshStandardMaterial color={PAPER} roughness={0.96} />
            </mesh>
            <mesh position={[0.24, 0.018, 0]}>
                <boxGeometry args={[0.5, 0.012, 0.68]} />
                <meshStandardMaterial color={PAPER} roughness={0.96} />
            </mesh>
        </group>
    </group>
);

const Lamp = () => (
    <group position={[-2.55, 0, -0.25]}>
        <mesh position={[0, 0.035, 0]}>
            <cylinderGeometry args={[0.26, 0.3, 0.07, 32]} />
            <meshStandardMaterial color="#2b2822" roughness={0.4} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.58, 0]}>
            <cylinderGeometry args={[0.022, 0.03, 1.08, 16]} />
            <meshStandardMaterial color="#6a6254" roughness={0.32} metalness={0.6} />
        </mesh>
        <mesh position={[0, 1.24, 0]} rotation={[0.28, 0, 0]}>
            <coneGeometry args={[0.34, 0.42, 32, 1, true]} />
            <meshStandardMaterial
                color="#b66b2e"
                emissive={WARM}
                emissiveIntensity={0.45}
                roughness={0.45}
                side={2}
            />
        </mesh>
        <mesh position={[0, 1.13, 0]}>
            <sphereGeometry args={[0.055, 16, 16]} />
            <meshBasicMaterial color={WARM} />
        </mesh>
        <pointLight
            position={[0, 1.12, 0]}
            color={WARM}
            intensity={2.6}
            distance={7}
            decay={2}
        />
    </group>
);

const Books = () => {
    const books = [
        { p: [2.45, 0.06, -0.35], s: [0.82, 0.09, 0.56], c: '#2f4548', r: 0.06 },
        { p: [2.38, 0.145, -0.37], s: [0.76, 0.08, 0.52], c: '#7a5a35', r: -0.04 },
        { p: [2.5, 0.225, -0.3], s: [0.7, 0.075, 0.48], c: '#8c7a5c', r: 0.12 },
        { p: [2.2, 0.06, 0.48], s: [0.62, 0.08, 0.44], c: '#3f4d50', r: -0.16 },
    ];
    return (
        <group>
            {books.map((b, i) => (
                <group key={i} position={b.p} rotation={[0, b.r, 0]}>
                    <mesh>
                        <boxGeometry args={b.s} />
                        <meshStandardMaterial color={b.c} roughness={0.8} />
                    </mesh>
                    <mesh position={[0, 0.005, b.s[2] / 2 + 0.004]}>
                        <boxGeometry args={[b.s[0] * 0.92, b.s[1] * 0.55, 0.008]} />
                        <meshStandardMaterial color="#d9cdb7" roughness={0.95} />
                    </mesh>
                </group>
            ))}
        </group>
    );
};

const Clapper = () => (
    <group position={[1.2, 0.03, 0.62]} rotation={[0, 0.22, 0]}>
        <mesh position={[0, 0.16, 0]}>
            <boxGeometry args={[0.56, 0.32, 0.035]} />
            <meshStandardMaterial color="#26221d" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.34, 0.01]} rotation={[0, 0, -0.08]}>
            <boxGeometry args={[0.6, 0.075, 0.04]} />
            <meshStandardMaterial color="#ded4c1" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.34, 0.035]} rotation={[0, 0, -0.08]}>
            <boxGeometry args={[0.08, 0.078, 0.012]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
        <mesh position={[0.22, 0.33, 0.01]} rotation={[0, 0, -0.08]}>
            <boxGeometry args={[0.08, 0.078, 0.04]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
        <mesh position={[-0.05, 0.02, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.05, 12]} />
            <meshStandardMaterial color="#8b8172" metalness={0.6} roughness={0.4} />
        </mesh>
    </group>
);

const FilmReel = () => (
    <group position={[2.05, 0.12, 0.46]} rotation={[Math.PI / 2, 0, 0.15]}>
        <mesh>
            <cylinderGeometry args={[0.3, 0.3, 0.06, 40]} />
            <meshStandardMaterial color="#6d6e6b" metalness={0.75} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.035, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.02, 24]} />
            <meshStandardMaterial color="#2a2a28" metalness={0.4} roughness={0.5} />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2;
            return (
                <mesh key={i} position={[Math.cos(a) * 0.17, 0.035, Math.sin(a) * 0.17]}>
                    <cylinderGeometry args={[0.055, 0.055, 0.07, 16]} />
                    <meshStandardMaterial color="#11100e" roughness={0.8} />
                </mesh>
            );
        })}
    </group>
);

const Window = () => (
    <group position={[2.35, 1.55, -2.82]}>
        <mesh>
            <boxGeometry args={[1.55, 1.2, 0.06]} />
            <meshStandardMaterial color="#0d1a22" roughness={0.5} emissive="#0a141b" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0, 0.07, 0.04]}>
            <circleGeometry args={[0.16, 32]} />
            <meshBasicMaterial color="#d8d2c4" transparent opacity={0.7} />
        </mesh>
        {[
            [0, 0.62, 0.045, 1.75, 0.07, 0.05],
            [0, -0.62, 0.045, 1.75, 0.07, 0.05],
            [-0.78, 0, 0.045, 0.07, 1.3, 0.05],
            [0.78, 0, 0.045, 0.07, 1.3, 0.05],
            [0, 0, 0.045, 0.05, 1.3, 0.04],
            [0, 0, 0.045, 1.55, 0.05, 0.04],
        ].map((b, i) => (
            <mesh key={i} position={[b[0], b[1], b[2]]}>
                <boxGeometry args={[b[3], b[4], b[5]]} />
                <meshStandardMaterial color="#241c14" roughness={0.8} />
            </mesh>
        ))}
        <pointLight position={[0, 0.2, 0.7]} color={COOL} intensity={0.65} distance={5} decay={2} />
    </group>
);

const Dust = () => {
    const ref = useRef();
    const positions = useMemo(() => {
        const arr = new Float32Array(80 * 3);
        for (let i = 0; i < 80; i++) {
            arr[i * 3] = (Math.random() - 0.5) * 8;
            arr[i * 3 + 1] = 0.2 + Math.random() * 2.6;
            arr[i * 3 + 2] = -1.8 + Math.random() * 3;
        }
        return arr;
    }, []);

    useFrame((state) => {
        if (!ref.current) return;
        const time = state.clock.elapsedTime;
        ref.current.rotation.y = Math.sin(time * 0.03) * 0.02;
        ref.current.position.y = Math.sin(time * 0.12) * 0.04;
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial
                size={0.014}
                color="#d8b98a"
                transparent
                opacity={0.28}
                sizeAttenuation
                depthWrite={false}
            />
        </points>
    );
};

const CameraRig = () => {
    const { camera, size } = useThree();
    const pointer = useRef({ x: 0, y: 0 });
    const base = useRef({ x: 0, y: 2.0, z: 5.6 });
    const target = useRef([0, 0.55, -0.35]);

    useEffect(() => {
        const portrait = size.width < 768;
        if (portrait) {
            // 竖屏取景：压低视线，让书桌、灯罩与窗一起落进顶部场景带
            base.current = { x: -0.8, y: 1.9, z: 9.2 };
            target.current = [0, -1.4, -0.35];
            camera.fov = 62;
        } else {
            base.current = { x: 0, y: 2.0, z: 5.6 };
            target.current = [0, 0.55, -0.35];
            camera.fov = 38;
        }
        camera.updateProjectionMatrix();
    }, [size.width, camera]);

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

        const move = (e) => {
            pointer.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
            pointer.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
        };
        window.addEventListener('pointermove', move);
        return () => window.removeEventListener('pointermove', move);
    }, []);

    useFrame((state, delta) => {
        const t = Math.min(1, delta * 2.5);
        const tx = base.current.x + pointer.current.x * 0.18;
        const ty = base.current.y - pointer.current.y * 0.1;
        camera.position.x += (tx - camera.position.x) * t;
        camera.position.y += (ty - camera.position.y) * t;
        camera.position.z += (base.current.z - camera.position.z) * t;
        camera.lookAt(...target.current);
    });

    return null;
};

const ReadingRoomAtmosphere = () => (
    <Canvas
        camera={{ position: [0, 2.0, 5.6], fov: 38, near: 0.1, far: 30 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }}
        dpr={[1, 1.5]}
        style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 0,
        }}
    >
        <color attach="background" args={['#080706']} />
        <fog attach="fog" args={['#080706', 8, 17]} />
        <ambientLight intensity={0.2} color="#70808e" />
        <directionalLight position={[3.6, 3.2, 2.4]} intensity={0.45} color="#9fb6c6" />
        <directionalLight position={[-2.4, 1.8, 2.8]} intensity={0.14} color="#ffc58f" />
        <Desk />
        <Lamp />
        <Books />
        <Clapper />
        <FilmReel />
        <Window />
        <Dust />
        <CameraRig />
    </Canvas>
);

export default ReadingRoomAtmosphere;
