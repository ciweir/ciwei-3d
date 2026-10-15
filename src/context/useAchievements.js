import { useContext } from 'react';
import { AchievementsContext } from './AchievementsContext';

// 从 AchievementsContext.jsx 拆出（原因见 useScene.js 的说明）
export const useAchievements = () => useContext(AchievementsContext);
