/**
 * 动效适配工具
 * ---------------------------------------------------------------
 * 全站动效统一遵循系统「减少动态效果」偏好：
 *   · DOM 动画在 SCSS 的 prefers-reduced-motion 媒体查询里关闭；
 *   · 3D 动画通过本文件读取同一偏好，跳过笔刷揭幕、悬停视频与飞行倾斜。
 *
 * 只在运行期读取 matchMedia，不引入任何 3D 依赖，因此 DOM 层可安全引用。
 */
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export const prefersReducedMotion = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(QUERY).matches;
};

/** 订阅系统偏好变化；SSR/无 matchMedia 环境返回 false */
export const useReducedMotion = () => {
    const [reduced, setReduced] = useState(prefersReducedMotion);

    useEffect(() => {
        const mq = window.matchMedia?.(QUERY);
        if (!mq) return undefined;

        const handleChange = (event) => setReduced(event.matches);
        if (mq.addEventListener) mq.addEventListener('change', handleChange);
        else mq.addListener(handleChange);

        return () => {
            if (mq.removeEventListener) mq.removeEventListener('change', handleChange);
            else mq.removeListener(handleChange);
        };
    }, []);

    return reduced;
};
