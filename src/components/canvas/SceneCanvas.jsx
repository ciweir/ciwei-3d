import { Suspense, useEffect } from 'react';
import { configureTextBuilder } from 'troika-three-text';
import { Canvas } from '@react-three/fiber';
import { Preload, PerformanceMonitor, useProgress } from '@react-three/drei';
import Experience from './Experience';
import { useColorTexture as useTexture } from '../../utils/colorTexture';
import {
    ENTRANCE_TEXTURES,
    CORRIDOR_TEXTURES,
    UI_TEXTURES,
    filterTexturesByDevice,
} from '../../config/texturePreloadList';

// 文本排版放主线程：避免生产构建下 worker 序列化/字体 URL 解析导致的启动挂起
configureTextBuilder({ useWorker: false });

const supportsHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
const CORE_TEXTURES = [...ENTRANCE_TEXTURES, ...CORRIDOR_TEXTURES, ...UI_TEXTURES];
const filteredCore = filterTexturesByDevice(CORE_TEXTURES, supportsHover);

filteredCore.forEach((path) => useTexture.preload(path));

const SceneLoadingProgress = ({ onProgress }) => {
    const { progress, active } = useProgress();

    useEffect(() => {
        onProgress?.({ progress, active });
    }, [progress, active, onProgress]);

    return null;
};

const SceneCanvas = ({
    settings,
    tier,
    isLoaded,
    onSceneReady,
    downgradeTier,
    onProgress,
}) => (
    <Canvas
        camera={{
            position: [0, 0.2, 28],
            fov: 60,
            near: 0.1,
            far: 150,
        }}
        gl={{
            antialias: settings.antialias,
            alpha: false,
            powerPreference: settings.powerPreference,
            localClippingEnabled: true,
            failIfMajorPerformanceCaveat: false,
        }}
        dpr={settings.dpr}
        shadows={settings.shadows}
    >
        <color attach="background" args={['#fafafa']} />
        <fog attach="fog" args={['#fafafa', 15, 50]} />

        <PerformanceMonitor
            onDecline={() => downgradeTier()}
            flipflops={3}
            onFallback={() => downgradeTier()}
        />

        <SceneLoadingProgress onProgress={onProgress} />

        <Suspense fallback={null}>
            <Experience
                isLoaded={isLoaded}
                onSceneReady={onSceneReady}
                performanceTier={tier}
            />
            <Preload all />
        </Suspense>
    </Canvas>
);

export default SceneCanvas;
