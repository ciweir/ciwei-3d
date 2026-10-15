import { useContext } from 'react';
import { AudioContext } from './AudioManager';

// 从 AudioManager.jsx 拆出（原因见 useScene.js 的说明）
export const useAudio = () => useContext(AudioContext);
