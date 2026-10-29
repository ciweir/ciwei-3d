import { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { playTick, playUnlock } from '../utils/sfx';

// 导出 context 对象供 useAudio.js 使用；本文件只导出组件与 context 对象
export const AudioContext = createContext({
    isMuted: false,
    toggleMute: () => { },
    play: () => { },
    enableAudio: () => { },
    audioEnabled: false,
    globalVolume: 0.5,
    setGlobalVolume: () => { },
});

export const AudioProvider = ({ children }) => {
    // Persist mute preference
    const [isMuted, setIsMuted] = useState(() => {
        const saved = localStorage.getItem('audio_muted');
        return saved === 'true';
    });

    // Persist volume preference (0.0 to 1.0)
    const [globalVolume, setGlobalVolume] = useState(() => {
        const saved = localStorage.getItem('audio_volume');
        return saved !== null ? parseFloat(saved) : 0.5;
    });

    const [audioEnabled, setAudioEnabled] = useState(false);

    // Track active sounds to stop them later
    const activeSounds = useRef({});

    useEffect(() => {
        localStorage.setItem('audio_muted', isMuted);
        localStorage.setItem('audio_volume', globalVolume);

        // Update all active sounds
        Object.values(activeSounds.current).forEach(audio => {
            if (audio) {
                audio.muted = isMuted;
                // Scale effective volume by global volume
                // We stored the requested "base" volume on the object as _baseVolume
                const base = audio._baseVolume !== undefined ? audio._baseVolume : 1.0;
                let targetVol = base * globalVolume;
                audio.volume = Math.max(0, Math.min(1, targetVol));
            }
        });

    }, [isMuted, globalVolume]);

    const toggleMute = () => setIsMuted(prev => !prev);

    // Enhanced setter that auto-unmutes if user manually drags slider above 0
    const enhancedSetGlobalVolume = useCallback((vol) => {
        if (typeof vol === 'function') {
            setGlobalVolume(prev => {
                const newVol = vol(prev);
                if (newVol > 0) setIsMuted(false);
                return newVol;
            });
        } else {
            setGlobalVolume(vol);
            if (vol > 0) setIsMuted(false);
        }
    }, []);

    // Call this on first interaction
    const enableAudio = useCallback(() => {
        if (!audioEnabled) {
            // Create a dummy context or just flip the switch to say "we tried"
            // Real web audio unlock usually needs a context resume, 
            // but for HTML5 Audio elements, just a user interaction event is enough 
            // to "bless" the document for subsequent plays.
            setAudioEnabled(true);
        }
    }, [audioEnabled]);

    const play = useCallback((soundName, { loop = false, volume = 1.0 } = {}) => {
        // 界面层合成音：没有素材文件，也不值得为此新增网络请求。
        // 与资源音效共用同一套静音/音量状态（见 utils/sfx.js）。
        if (soundName === 'tick') {
            playTick();
            return { stop: () => { }, fade: () => { } };
        }
        if (soundName === 'unlock') {
            playUnlock();
            return { stop: () => { }, fade: () => { } };
        }

        // Graceful degradation if files missing
        const soundPaths = {
            'szumwiatru': '/sounds/szumwiatru.mp3', // 风声（关于房间）
            'szummiasta': '/sounds/szummiasta.mp3', // 城市声（画廊房间）
            'uchyleniedrzwi': '/sounds/uchyleniedrzwi.mp3', // 门缝吱呀（悬停）
            'otwarciedrzwi': '/sounds/otwarciedrzwi.mp3',   // 开门
            'zamknieciedrzwi': '/sounds/zamknieciedrzwi.mp3', // 关门
            'pencil': '/sounds/papersound.mp3',   // 预加载沙沙声 → 纸张摩擦（原作者未提供 pencil.mp3，一直 404）
            // 撕纸转场 → 纸张摩擦声：原先与 BGM 共用同一个 1.79MB 的 .ogg，
            // 预载退出时会抢占该大文件、且请求被中断即出现 ERR_ABORTED 噪声，故改用 145KB 短音效。
            'tear': '/sounds/papersound.mp3'
        };
        const path = soundPaths[soundName] || `/sounds/${soundName}.mp3`;

        // 同一个音频文件只创建一次 Audio 元素（pencil / tear 共用 papersound），
        // 避免重复请求与多个 Audio 实例叠加；再次播放时重置时间与参数。
        const pathKey = path;
        let audio = activeSounds.current[pathKey];
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        } else {
            audio = new Audio(path);
            activeSounds.current[pathKey] = audio;
        }

        // Store metadata
        audio.loop = loop;
        audio._baseVolume = volume; // Custom prop to remember intended relative mix

        // Apply current global state
        audio.muted = isMuted;
        let targetVol = volume * globalVolume;
        audio.volume = Math.max(0, Math.min(1, targetVol));

        // Store reference (clearing old one if exists with same path for simplicity)
        activeSounds.current[pathKey] = audio;

        // Attempt to play
        const playPromise = audio.play();

        if (playPromise !== undefined) {
            playPromise.catch(error => {
                if (error.name === 'NotAllowedError') {
                    // console.warn('[Audio] Auto-play blocked. Waiting for interaction.');
                } else if (error.name === 'NotSupportedError' || error.message.includes('404')) {
                    // Silently fail if file is missing for SOTD clean console
                } else {
                    // console.warn('[Audio] Play error:', error);
                }
            });
        }

        // Return a handle to stop it
        return {
            stop: () => {
                audio.pause();
                audio.currentTime = 0;
                delete activeSounds.current[pathKey];
            },
            fade: () => {
                // For now just stop
                audio.pause();
                delete activeSounds.current[pathKey];
            }
        };
    }, [isMuted, globalVolume]);

    return (
        <AudioContext.Provider value={{
            isMuted,
            toggleMute,
            globalVolume,
            setGlobalVolume: enhancedSetGlobalVolume,
            play,
            enableAudio,
            audioEnabled
        }}>
            {children}
        </AudioContext.Provider>
    );
};
