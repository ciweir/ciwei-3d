import { useState, Suspense, useEffect, useCallback, lazy } from 'react';

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
import ReadingRoomPage from './components/ui/ReadingRoomPage';
import ScreenReaderOverlay from './components/ui/ScreenReaderOverlay';
import { useDocumentMeta } from './hooks/useDocumentMeta';
import posthog from 'posthog-js';
import { loadSanityData } from './hooks/useSanityData';
import { hasWebGL } from './utils/webglSupport';
import { getReadingSlugFromUrl } from './utils/readingRoute';

// Initialize PostHog（仅在配置了 key 时；未配置不 init，避免无 token 控制台报错）
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST,
    person_profiles: 'identified_only',
  });
}

// Lazy load the whole 3D scene (three/drei stays out of the initial bundle)
const SceneCanvas = lazy(() => import('./components/canvas/SceneCanvas'));

import './styles/main.scss';

// --- CONDITIONAL ASSET PRELOADING ---
// On high-end devices, preloads everything for zero stutter.
// On mobile/low-end devices, only preloads core textures to prevent Out Of Memory crashes.
import { IMAGE_ASSETS, filterTexturesByDevice } from './config/texturePreloadList';

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

// 3D 核心贴图预载在懒加载的 SceneCanvas 内，避免把 three/drei 拉进主包。
// 图片类资产仍在这里用浏览器 Image 预载（用于 DOM <img>）。

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

// Bridge component to use hooks inside SceneProvider
// Handles dynamic meta tags + deep link auto-teleport
function DocumentMetaBridge({ ready }) {
  useDocumentMeta();

  const { initialRoom, deeplinkHandled, teleportTo, markEntered } = useScene();

  // Deep linking: e.g. /gallery or /read/... closing back to /gallery lands inside the room
  useEffect(() => {
    if (!initialRoom || !ready || deeplinkHandled.current) return undefined;
    deeplinkHandled.current = true;

    const timer = window.setTimeout(() => {
      // 先完成“进门”状态，否则传送后房间 UI 与退回按钮仍处于入口模式
      markEntered();
      teleportTo(initialRoom);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [initialRoom, ready, teleportTo, markEntered, deeplinkHandled]);

  return null;
}

function AppContent() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneProgress, setSceneProgress] = useState(0);
  const [sceneActive, setSceneActive] = useState(true);

  const force2D = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('2d');
  const [webglAvailable] = useState(() => hasWebGL());
  const readingSlug = getReadingSlugFromUrl();
  const [bootMode, setBootMode] = useState(() => {
    if (readingSlug) return 'read';
    return force2D || !webglAvailable ? '2d' : '3d';
  });
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

  const handleSceneProgress = useCallback(({ progress, active }) => {
    setSceneProgress(progress);
    setSceneActive(active);
  }, []);

  const switchTo2D = useCallback(() => setBootMode('2d'), []);
  const retry3D = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('2d');
    window.location.href = url.toString();
  }, []);

  if (bootMode === 'read') {
    return <ReadingRoomPage slug={readingSlug} />;
  }

  if (bootMode === '2d') {
    return <StaticPortfolio canRetry3D={webglAvailable} onRetry={retry3D} />;
  }

  return (
    <AudioProvider>
      <SceneProvider>
        <DocumentMetaBridge ready={isLoaded} />
        <GlobalAudioEnabler />
        <div className="app">
          {/* Full screen 3D Canvas (lazy chunk) */}
          <div className="canvas-wrapper">
            <SceneErrorBoundary onError={switchTo2D}>
              <Suspense fallback={null}>
                <SceneCanvas
                  settings={settings}
                  tier={tier}
                  isLoaded={isLoaded}
                  onSceneReady={handleSceneReady}
                  downgradeTier={downgradeTier}
                  onProgress={handleSceneProgress}
                />
              </Suspense>
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
            progress={sceneProgress}
            active={sceneActive}
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
