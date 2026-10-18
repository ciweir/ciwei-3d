import { useState, Suspense, useEffect, useCallback, lazy } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Preload, Text, PerformanceMonitor } from '@react-three/drei';
// 全站彩色：桌面端自动取 _painted 彩色版（见 utils/colorTexture.js）
import { useColorTexture as useTexture } from './utils/colorTexture';
import * as THREE from 'three';

import Preloader from './components/dom/Preloader';
import SceneErrorBoundary from './components/dom/SceneErrorBoundary';
import SlowBootNotice from './components/dom/SlowBootNotice';
import StaticPortfolio from './components/dom/StaticPortfolio';
import PaperTransition from './components/dom/PaperTransition';
import { AudioProvider } from './context/AudioManager';
import { useAudio } from './context/useAudio';
import { initAudio } from './utils/audioManager';
import { PerformanceProvider } from './context/PerformanceContext';
import { usePerformance } from './context/usePerformance';
import { SceneProvider } from './context/SceneContext';
import { useScene } from './context/useScene';
import NavigationUI from './components/ui/NavigationUI';
import GlobalOverlay from './components/ui/GlobalOverlay';
import ReadingRoom from './components/ui/ReadingRoom';
import ScreenReaderOverlay from './components/ui/ScreenReaderOverlay';
import { useDocumentMeta } from './hooks/useDocumentMeta';
import posthog from 'posthog-js';
import { loadSanityData } from './hooks/useSanityData';
import { hasWebGL } from './utils/webglSupport';

// Initialize PostHog（仅在配置了 key 时；未配置不 init，避免无 token 控制台报错）
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST,
    person_profiles: 'identified_only',
  });
}

// Lazy load the heavy 3D experience
const Experience = lazy(() => import('./components/canvas/Experience'));

import './styles/main.scss';

// --- CONDITIONAL ASSET PRELOADING ---
// On high-end devices, preloads everything for zero stutter.
// On mobile/low-end devices, only preloads core textures to prevent Out Of Memory crashes.
import { 
  ENTRANCE_TEXTURES, 
  CORRIDOR_TEXTURES, 
  UI_TEXTURES,
  IMAGE_ASSETS,
  filterTexturesByDevice
} from './config/texturePreloadList';

// Standard Browser-level Image Preloader (for <img> tags)
const preloadBrowserImage = (path) => {
  if (typeof window === 'undefined') return;
  const img = new Image();
  img.src = path;
};

// （1d 减负 2026-10-12：设备分级预载已统一为核心集——原 isLowEnd 全量/分级分支随之移除）

// Refined check for "hover capability" (non-touch devices should have hover: hover)
// Laptops with touch screens (which also have a mouse/trackpad) will return true here.
const supportsHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

// Trigger Three.js preloads at module level (as standard for Drei)
/* === 预载策略 ===
   核心集 = 入口 + 走廊 + 头像动画 + 图片。
   深层房间（画廊 / 联系 / 工作室 / 关于）进入或预热时加载，不进开机预载。
   清单由 scripts/gen-preload-list.mjs 扫描磁盘生成（占位块不计入），
   因此项数会随资产补齐自动增长。 */

const CORE_TEXTURES = [...ENTRANCE_TEXTURES, ...CORRIDOR_TEXTURES, ...UI_TEXTURES, ...IMAGE_ASSETS];
const filteredCore = filterTexturesByDevice(CORE_TEXTURES, supportsHover);

filteredCore.forEach(path => useTexture.preload(path));

// 中文化（2026-10-12）：英文字体（Inter woff 外网 + 无中文字形）→ 本地 Noto Sans SC
const FONT_URL = '/fonts/NotoSansSC.ttf';

// Helper component to handle global audio enable on interaction
const GlobalAudioEnabler = () => {
  const { enableAudio } = useAudio();
  useEffect(() => {
    const handleInteraction = () => enableAudio();
    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('touchstart', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, [enableAudio]);
  return null;
};

// Scene background using corridor wall texture (static, no animation)
const PaperSceneBackground = () => {
  const { scene } = useThree();
  const texture = useTexture('/textures/paper-texture.webp');

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    scene.background = texture;

    return () => {
      scene.background = null;
    };
  }, [scene, texture]);

  return null;
};

// Bridge component to use hooks inside SceneProvider
// Handles dynamic meta tags + deep link auto-teleport
function DocumentMetaBridge() {
  useDocumentMeta();

  const { initialRoom, deeplinkHandled, hasEntered, teleportTo } = useScene();

  // Deep linking: if user lands on e.g. /gallery, auto-teleport after scene loads
  useEffect(() => {
    if (initialRoom && hasEntered && !deeplinkHandled.current) {
      deeplinkHandled.current = true;
      // Small delay to let the corridor render first
      setTimeout(() => teleportTo(initialRoom), 300);
    }
  }, [initialRoom, hasEntered, teleportTo, deeplinkHandled]);

  return null;
}

function AppContent() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);

  const force2D = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('2d');
  const [webglAvailable] = useState(() => hasWebGL());
  const [bootMode, setBootMode] = useState(() => (force2D || !webglAvailable ? '2d' : '3d'));
  const [slowBoot, setSlowBoot] = useState(false);

  // Use Performance Context
  const { settings, downgradeTier, tier } = usePerformance();

  // Force initialize audio in the background on mount (3D only)
  useEffect(() => {
    if (bootMode === '3d') initAudio();
  }, [bootMode]);

  // 启动 watchdog：场景长时间未就绪时给出 2D 出口，避免无限停在 90%
  useEffect(() => {
    if (bootMode !== '3d' || sceneReady) return undefined;
    const timer = window.setTimeout(() => setSlowBoot(true), 20000);
    return () => window.clearTimeout(timer);
  }, [bootMode, sceneReady]);

  const handleSceneReady = useCallback(() => {
    requestAnimationFrame(() => {
      setSceneReady(true);
    });
  }, []);

  const switchTo2D = useCallback(() => setBootMode('2d'), []);
  const retry3D = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('2d');
    window.location.href = url.toString();
  }, []);

  if (bootMode === '2d') {
    return <StaticPortfolio canRetry3D={webglAvailable} onRetry={retry3D} />;
  }

  return (
    <AudioProvider>
      <SceneProvider>
        <DocumentMetaBridge />
        <GlobalAudioEnabler />
        <div className="app">
          {/* Full screen 3D Canvas */}
          <div className="canvas-wrapper">
            <SceneErrorBoundary onError={switchTo2D}>
              <Canvas
              camera={{
                position: [0, 0.2, 28],
                fov: 60,
                near: 0.1,
                far: 150
              }}
              gl={{
                antialias: settings.antialias,
                alpha: false,
                powerPreference: settings.powerPreference,
                localClippingEnabled: true,
                failIfMajorPerformanceCaveat: false
              }}
              dpr={settings.dpr}
              shadows={settings.shadows}
            >
              <color attach="background" args={['#fafafa']} />
              <fog attach="fog" args={['#fafafa', 15, 50]} />

              {/* Scale performance down if fps drops */}
              <PerformanceMonitor
                onDecline={() => downgradeTier()}
                flipflops={3}
                onFallback={() => downgradeTier()}
              />

              {/* Advanced FPS & Performance Monitor */}
              {/* <Perf position="top-left" minimal={false} /> */}

              <Suspense fallback={null}>
                <Experience
                  isLoaded={isLoaded}
                  onSceneReady={handleSceneReady}
                  performanceTier={tier}
                />
                <Preload all />
              </Suspense>
              </Canvas>
            </SceneErrorBoundary>
          </div>

          {/* Navigation UI - Hamburger, Map, Back, Audio */}
          {isLoaded && (
            <>
              <NavigationUI />
              <GlobalOverlay />
              <ReadingRoom />
              <PaperTransition />
              <ScreenReaderOverlay />
            </>
          )}

          {/* 2D Preloader */}
          <Preloader
            ready={sceneReady}
            onComplete={() => setIsLoaded(true)}
          />

          {slowBoot && !sceneReady && (
            <SlowBootNotice
              onContinue={() => setSlowBoot(false)}
              onRetry={() => window.location.reload()}
              onUse2D={switchTo2D}
            />
          )}
        </div>
      </SceneProvider>
    </AudioProvider>
  );
}

import { AchievementsProvider } from './context/AchievementsContext';

export default function App() {
  // Preload browser-based images (for standard <img> tags) immediately upon mounting App
  // This ensures they are in the network waterfall during the initial loading phase.
  useEffect(() => {
    // Eagerly preload Sanity CMS data and images
    loadSanityData();

    const filteredImages = filterTexturesByDevice(IMAGE_ASSETS, supportsHover);
    // console.log(`[Preload] Triggering browser-level image preloads for ${filteredImages.length} assets.`);
    filteredImages.forEach(path => preloadBrowserImage(path));
  }, []);

  return (
    <PerformanceProvider>
      <AchievementsProvider>
        <AppContent />
      </AchievementsProvider>
    </PerformanceProvider>
  );
}
