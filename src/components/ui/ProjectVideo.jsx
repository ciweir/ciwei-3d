import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * ProjectVideo —— 世界内统一作品视频播放器（2026-10-13）
 * ---------------------------------------------------------------
 *  - 有 6 秒预览：进卡片静音自动循环（会动的封面），右上提供常驻
 *    「🔇开声音」「⛶全屏」按钮；点开声音切到有声正片。
 *  - 无预览、只有正片：直接显示正片 + 原生 controls（含音量/全屏），
 *    并额外提供常驻大「全屏」按钮（原生小图标不明显）。
 *  - 阅读室 defaultFull：一上来就是正片。
 *
 * 全屏：优先标准 Fullscreen API（作用在 <video> 自身，兼容性最好，
 *  即使祖先有 transform/backdrop-filter 也能把 video 提升到顶层）；
 *  失败/不支持时回退 iOS Safari 的 webkitEnterFullscreen；再失败给提示。
 */
const ProjectVideo = ({ preview, src, poster, autoPlay = true, defaultFull = false }) => {
    const videoRef = useRef(null);
    const [useFull, setUseFull] = useState(defaultFull || !preview);
    const [muted, setMuted] = useState(!defaultFull && !!preview);
    const [fsError, setFsError] = useState(false);
    const currentSrc = useFull ? (src || preview) : preview;

    useEffect(() => {
        const v = videoRef.current;
        if (!v || !currentSrc) return;
        v.load();
        if (autoPlay) v.play().catch(() => {});
    }, [currentSrc, autoPlay]);

    const toggleSound = useCallback(() => {
        const v = videoRef.current;
        if (!v) return;
        if (!useFull && src) {
            setUseFull(true);
            setMuted(false);
            setTimeout(() => { v.muted = false; v.play().catch(() => {}); }, 0);
            return;
        }
        const next = !v.muted;
        v.muted = next;
        setMuted(next);
        if (!next) v.play().catch(() => {});
    }, [useFull, src]);

    const requestFs = useCallback((el) => {
        setFsError(false);
        const fail = (reason) => {
            // 真全屏不可用：不静默——回退用当前正片 URL 新标签打开（浏览器原生播放，必可全屏）
            const url = (videoRef.current?.currentSrc) || src || preview;
            if (url) {
                const w = window.open(url, '_blank', 'noopener');
                if (!w) setFsError(reason || '浏览器拦截了全屏/弹窗，请用播放器右下角全屏按钮');
            } else {
                setFsError(reason || '无法全屏');
            }
        };
        // ① 标准 API
        if (el.requestFullscreen) {
            const p = el.requestFullscreen();
            if (p && p.then) {
                p.catch((err) => {
                    // ② 先试 webkit，再回退新标签页
                    if (el.webkitEnterFullscreen) { try { el.webkitEnterFullscreen(); return; } catch {} }
                    if (el.webkitRequestFullscreen) {
                        try { el.webkitRequestFullscreen(); return; } catch {}
                    }
                    fail('全屏被拒绝：' + (err?.name || '未知') + '（已尝试新标签页打开）');
                });
                return;
            }
            // 无 Promise 返回值：直接监听 fullscreenchange 判定；同时视为已发起
            return;
        }
        // ③ 旧 webkit
        if (el.webkitEnterFullscreen) { try { el.webkitEnterFullscreen(); return; } catch {} }
        if (el.webkitRequestFullscreen) {
            try { el.webkitRequestFullscreen(); return; } catch {}
        }
        fail('当前浏览器不支持网页全屏');
    }, [src, preview]);

    const goFullscreen = useCallback(() => {
        const v = videoRef.current;
        if (!v) return;
        // 关键：全屏请求必须在「点击手势的同步调用栈」内发起。
        // 不能先切源再 setTimeout（切源重载会脱离用户激活态 → 浏览器拒绝全屏）。
        // 所以先对当前 <video> 同步请求全屏；进全屏后再由 effect/下方逻辑换有声正片。
        requestFs(v);
        // 全屏已发起（同步），此时再切换到正片是安全的：
        if (!useFull && src) {
            setUseFull(true);
            setMuted(false);
        }
    }, [requestFs, useFull, src]);

    if (!currentSrc) return null;

    const isPreviewLoop = !useFull && !!preview;

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden' }}>
            <video
                ref={videoRef}
                src={currentSrc}
                poster={poster}
                controls={!isPreviewLoop}
                autoPlay={autoPlay}
                muted={muted}
                loop={isPreviewLoop}
                playsInline
                preload="metadata"
                style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', display: 'block' }}
            />

            {/* 常驻控制条（预览/正片都在）：右上角，醒目 */}
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 6, display: 'flex', gap: 8 }}>
                {/* 开声音：仅在「有正片且当前静音」时有意义 */}
                {muted && src && (
                    <button type="button" title="打开声音（播放正片）" aria-label="打开声音"
                        onClick={toggleSound} style={ctrlBtn}>🔊 开声音</button>
                )}
                <button type="button" title="全屏观看" aria-label="全屏观看"
                    onClick={goFullscreen} style={ctrlBtn}>⛶ 全屏</button>
                <button type="button" title="在新标签页打开（一定可全屏、有声）" aria-label="新标签页打开"
                    onClick={() => { const u = src || preview || videoRef.current?.currentSrc; if (u) window.open(u, '_blank', 'noopener'); }}
                    style={ctrlBtn}>↗ 新窗</button>
            </div>

            {fsError && (
                <div style={{
                    position: 'absolute', left: '50%', bottom: 14, transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: 12,
                    padding: '6px 10px', borderRadius: 6, whiteSpace: 'nowrap', zIndex: 7, maxWidth: '92%',
                }}>{fsError}</div>
            )}
        </div>
    );
};

const ctrlBtn = {
    height: 32,
    padding: '0 12px',
    borderRadius: 16,
    border: '1.5px solid rgba(255,255,255,0.9)',
    background: 'rgba(0,0,0,0.5)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    backdropFilter: 'blur(2px)',
};

export default ProjectVideo;