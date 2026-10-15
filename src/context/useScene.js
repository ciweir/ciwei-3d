import { useContext } from 'react';
import SceneContext from './SceneContext';

/* 从 SceneContext.jsx 拆出（2026-10-15）：
   Provider 组件与配套 hook 写在同一个文件里会破坏 Vite Fast Refresh 边界
   （dev 控制台持续报 "Could not Fast Refresh"）。拆分后 context 目录的
   组件文件只导出组件/context 对象，hook 走本文件。 */
export const useScene = () => {
    const context = useContext(SceneContext);
    if (!context) {
        throw new Error('useScene must be used within a SceneProvider');
    }
    return context;
};
