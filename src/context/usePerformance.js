import { useContext } from 'react';
import { PerformanceContext } from './PerformanceContext';

// 从 PerformanceContext.jsx 拆出（原因见 useScene.js 的说明）
export const usePerformance = () => {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error("usePerformance must be used within a PerformanceProvider");
  }
  return context;
};
