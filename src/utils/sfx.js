/**
 * 界面层合成音效（WebAudio）
 *
 * 门、纸张转场等 3D 音效走 AudioManager 的 play() 读资源文件；
 * 这里只补「没有对应素材、也不值得为此新增网络请求」的界面反馈音：
 * 按钮轻点（tick）与成就解锁（unlock）。
 *
 * 音量与静音跟 AudioManager 共用同一组 localStorage 键，
 * 因此界面音效同样受音量滑块与静音开关控制。
 */

let ctx = null;
let tickBuffer = null;

const readMix = () => {
    try {
        if (localStorage.getItem('audio_muted') === 'true') return 0;
        const raw = parseFloat(localStorage.getItem('audio_volume'));
        return Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0.5;
    } catch {
        return 0.5;
    }
};

const ensureContext = () => {
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) {
        try {
            ctx = new Ctor();
        } catch {
            return null;
        }
    }
    return ctx;
};

// 首次调用时上下文常处于 suspended，需等 resume 完成后再合成，
// 否则第一次点击会静默失败（后续点击正常）。
const withContext = (render) => {
    const audio = ensureContext();
    if (!audio) return;
    if (audio.state === 'suspended') {
        audio.resume().then(() => render(audio)).catch(() => {});
        return;
    }
    render(audio);
};

// 纸张轻点：极短噪声过带通，衰减很快，听感像指尖敲纸
export const playTick = (volume = 0.5) => {
    const mix = readMix();
    if (mix <= 0) return;

    withContext((audio) => {
        if (!tickBuffer) {
            const length = Math.floor(audio.sampleRate * 0.045);
            tickBuffer = audio.createBuffer(1, length, audio.sampleRate);
            const data = tickBuffer.getChannelData(0);
            for (let i = 0; i < length; i += 1) {
                data[i] = (Math.random() * 2 - 1) * (1 - i / length);
            }
        }

        const source = audio.createBufferSource();
        source.buffer = tickBuffer;

        const band = audio.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 2600;
        band.Q.value = 0.7;

        const gain = audio.createGain();
        const peak = Math.max(0.02, volume * mix);
        gain.gain.setValueAtTime(0, audio.currentTime);
        gain.gain.linearRampToValueAtTime(peak, audio.currentTime + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0008, audio.currentTime + 0.085);

        source.connect(band).connect(gain).connect(audio.destination);
        source.start(audio.currentTime);
        source.stop(audio.currentTime + 0.1);
    });
};

// 成就解锁：两音上行的短叮声（A4 → E5）
export const playUnlock = (volume = 0.9) => {
    const mix = readMix();
    if (mix <= 0) return;

    withContext((audio) => {
        const gain = audio.createGain();
        gain.connect(audio.destination);

        const peak = Math.max(0.02, volume * mix);
        gain.gain.setValueAtTime(0, audio.currentTime);
        gain.gain.linearRampToValueAtTime(peak, audio.currentTime + 0.05);
        gain.gain.setValueAtTime(peak, audio.currentTime + 0.16);
        gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.62);

        const osc = audio.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audio.currentTime);
        osc.frequency.setValueAtTime(659.25, audio.currentTime + 0.16);
        osc.connect(gain);
        osc.start(audio.currentTime);
        osc.stop(audio.currentTime + 0.65);
    });
};
