import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import posthog from 'posthog-js';
import { ACHIEVEMENTS } from './achievementsData';
import { playUnlock } from '../utils/sfx';

/* 默认值：多个 Canvas 子树内的组件会直接解构本 context 的属性
   （例如 useInfiniteCamera 里的 unlockAchievement）。R3F 的上下文桥接
   在首帧可能尚未就绪，此时 useContext 返回 undefined 会抛 TypeError。
   给出 no-op 默认值，使桥接缺失时优雅降级，而不是让整棵子树崩溃。 */
const NOOP = () => {};
// 导出 context 对象供 useAchievements.js 使用；本文件只导出组件与 context 对象
export const AchievementsContext = createContext({
    completed: [],
    activePopup: null,
    showTutorial: false,
    unlockAchievement: NOOP,
    hidePopup: NOOP,
});

export const AchievementsProvider = ({ children }) => {
    // Synchronous ref to prevent double-firing on rapid events (like wheel scroll)
    const completedRef = useRef([]);

    // Load completed achievements from local storage
    const [completed, setCompleted] = useState(() => {
        try {
            const saved = localStorage.getItem('ciwei_achievements');
            if (saved) {
                const parsed = JSON.parse(saved);
                // 放入集合，但忽略 'corridor_enter'，使进门提示始终出现
                const filtered = parsed.filter(id => id !== 'corridor_enter');
                completedRef.current = [...filtered];
                return filtered;
            }
            return [];
        } catch {
            return [];
        }
    });

    // Currently displayed popup
    // Structure: { id: 'corridor_enter', status: 'pending' | 'completed' | 'hiding' }
    const [activePopup, setActivePopup] = useState(null);

    // Save to localStorage when completed changes
    useEffect(() => {
        const toSave = completed.filter(id => id !== 'corridor_enter');
        localStorage.setItem('ciwei_achievements', JSON.stringify(toSave));
    }, [completed]);

    const showTutorial = useCallback((id) => {
        // Only show if it's a valid achievement, not already completed, and no popup currently active
        // Also ensure we're not currently hiding another popup
        if (ACHIEVEMENTS[id] && !completed.includes(id) && (!activePopup || activePopup.status === 'hiding')) {
            // Slight delay to ensure previous hiding finished
            setTimeout(() => {
                setActivePopup({ id, status: 'pending' });
            }, 50);
        }
    }, [completed, activePopup]);

    const unlockAchievement = useCallback((id) => {
        // Use synchronous ref check to avoid 100x fires during continuous scroll events
        if (!completedRef.current.includes(id)) {
            completedRef.current.push(id);

            setCompleted(prev => {
                const updated = [...prev, id];
                // Save locally excluding corridor_enter
                const toSave = updated.filter(item => item !== 'corridor_enter');
                localStorage.setItem('ciwei_achievements', JSON.stringify(toSave));
                return updated;
            });

            // Send event to PostHog（未配置 key / 未 init 时跳过）
            const achievementData = ACHIEVEMENTS[id];
            if (achievementData && import.meta.env.VITE_POSTHOG_KEY && posthog.__loaded) {
                posthog.capture('achievement_unlocked', {
                    achievement_id: id,
                    achievement_title: achievementData.title,
                });
            }

            // Trigger sound effect
            playUnlock();

            setActivePopup(prev => {
                // If this is the current active popup, transition it to 'completed' then hide
                if (prev && prev.id === id) {
                    // Start timeouts for the hiding animations
                    setTimeout(() => {
                        setActivePopup(p => p && p.id === id ? { ...p, status: 'hiding' } : p);
                        setTimeout(() => {
                            setActivePopup(p => p && p.id === id ? null : p);
                        }, 500);
                    }, 2000);
                    return { ...prev, status: 'completed' };
                } else {
                    // Set as completed immediately to show unexpected unlock
                    setTimeout(() => {
                        setActivePopup(p => p && p.id === id ? { ...p, status: 'hiding' } : p);
                        setTimeout(() => {
                            setActivePopup(p => p && p.id === id ? null : p);
                        }, 500);
                    }, 3000);
                    return { id, status: 'completed' };
                }
            });
        }
    }, [playUnlock]);

    const hidePopup = useCallback(() => {
        if (activePopup && activePopup.status !== 'hiding') {
            setActivePopup(prev => prev ? { ...prev, status: 'hiding' } : null);
            setTimeout(() => {
                setActivePopup(null);
            }, 500);
        }
    }, [activePopup]);

    return (
        <AchievementsContext.Provider value={{
            completed,
            activePopup,
            showTutorial,
            unlockAchievement,
            hidePopup
        }}>
            {children}
        </AchievementsContext.Provider>
    );
};
