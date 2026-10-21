import { createContext, useState } from "react";

// Performance Tiers（仅本文件内部使用，无需导出）
const TIERS = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

// Settings for each tier
const SETTINGS = {
  [TIERS.HIGH]: {
    dpr: [1, 2], // Allow up to 2x pixel density
    shadows: true, // Enable shadows
    antialias: true,
    powerPreference: "high-performance",
    physicsStep: 1 / 60,
    textureQuality: "high",
    particleCount: 1.0, // 100% particles
  },
  [TIERS.MEDIUM]: {
    dpr: [1, 1.5], // Cap at 1.5x on mobile to balance quality and GPU fillrate
    shadows: false, // Disable shadows for better mobile performance
    antialias: true,
    powerPreference: "default",
    physicsStep: 1 / 60,
    textureQuality: "medium",
    particleCount: 0.6, // 60% particles
  },
  [TIERS.LOW]: {
    dpr: [0.8, 1], // Minimum 0.8x pixel density to avoid extreme pixelation
    shadows: false, // Disable shadows completely
    antialias: false, // Disable AA to maximize FPS
    powerPreference: "low-power",
    physicsStep: 1 / 45, // Slower physics updates if needed
    textureQuality: "low",
    particleCount: 0.3, // 30% particles
  },
};

const rank = { LOW: 0, MEDIUM: 1, HIGH: 2 };

const detectGpuTier = () => {
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") || probe.getContext("webgl");
    if (!gl) return TIERS.LOW;

    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(
      debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || ""
    );
    gl.getExtension("WEBGL_lose_context")?.loseContext();

    if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) return TIERS.LOW;
    // Apple Silicon 是集显但性能足够，保持 HIGH
    if (/apple m\d/i.test(renderer)) return TIERS.HIGH;
    if (/intel|uhd|iris|mali|adreno|powervr/i.test(renderer)) return TIERS.MEDIUM;
  } catch {
    // 探针失败时按中档处理，避免误伤可用的独显
    return TIERS.MEDIUM;
  }
  return null;
};

const detectTier = () => {
  let detectedTier = TIERS.HIGH;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  // 深链进房间沿用旧的高档位与完整预热，避免房间上色卡在 0%
  if (/^\/(gallery|about|studio|contact)\/?$/.test(window.location.pathname) && !isMobile) {
    return TIERS.HIGH;
  }
  if (isMobile) detectedTier = TIERS.MEDIUM;

  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
    detectedTier = isMobile ? TIERS.LOW : TIERS.MEDIUM;
  }

  if (navigator.deviceMemory && navigator.deviceMemory <= 4) {
    detectedTier = TIERS.LOW;
  }

  const gpuTier = detectGpuTier();
  if (gpuTier && rank[gpuTier] < rank[detectedTier]) detectedTier = gpuTier;

  return detectedTier;
};

// 导出 context 对象供 usePerformance.js 使用；本文件只导出组件与 context 对象
export const PerformanceContext = createContext(null);

export const PerformanceProvider = ({ children }) => {
  // 同步探测，Canvas 首帧就拿到正确档位（不先用 HIGH 再降级）
  const [tier, setTier] = useState(detectTier);

  // Function to manually downgrade tier (called by PerformanceMonitor)
  const downgradeTier = () => {
    setTier((current) => {
      if (current === TIERS.HIGH) return TIERS.MEDIUM;
      if (current === TIERS.MEDIUM) return TIERS.LOW;
      return TIERS.LOW;
    });
  };

  const value = {
    tier,
    settings: SETTINGS[tier],
    isDetecting: false,
    downgradeTier,
  };

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
};
