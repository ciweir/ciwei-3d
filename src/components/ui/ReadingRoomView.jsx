import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import ProjectVideo from './ProjectVideo';
import SceneErrorBoundary from '../dom/SceneErrorBoundary';
import { hasWebGL } from '../../utils/webglSupport';
import { useEscapeLayer } from '../../utils/escapeLayer';

const ReadingRoomAtmosphere = lazy(() => import('./ReadingRoomAtmosphere'));

const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'video[controls]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

const isVisible = (el) => {
    const style = window.getComputedStyle(el);
    return el.getClientRects().length > 0 && style.visibility !== 'hidden' && style.display !== 'none';
};

const ReadingRoomView = ({ project, onClose, returnLabel = '返回画廊' }) => {
    const [use3D] = useState(() => hasWebGL());
    const [sceneOn, setSceneOn] = useState(false);
    const [sceneFailed, setSceneFailed] = useState(false);
    const showScene = use3D && !sceneFailed;
    const dialogRef = useRef(null);
    const restoreFocusRef = useRef(null);
    const titleId = useId();

    // 阅读室是最上层：Esc 只关它，不再冒泡去触发走廊的退房
    useEscapeLayer(true, () => {
        // 全屏视频里先让浏览器退出全屏，避免一次 Esc 同时关阅读室
        if (document.fullscreenElement) return false;
        onClose();
    });

    useEffect(() => {
        if (!use3D) return undefined;
        // 先让文字排完，再挂载 3D 背景，避免抢首帧
        const timer = window.setTimeout(() => setSceneOn(true), 80);
        return () => window.clearTimeout(timer);
    }, [use3D]);

    useEffect(() => {
        const root = dialogRef.current;
        const previous = document.activeElement;
        restoreFocusRef.current = previous instanceof HTMLElement ? previous : null;
        root?.focus({ preventScroll: true });

        const handleKey = (e) => {
            if (e.key !== 'Tab' || !root) return;

            const items = [...root.querySelectorAll(FOCUSABLE)].filter(isVisible);
            if (!items.length) {
                e.preventDefault();
                root.focus({ preventScroll: true });
                return;
            }

            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement;

            if (active === root) {
                e.preventDefault();
                (e.shiftKey ? last : first).focus();
            } else if (e.shiftKey) {
                if (active === first || !root.contains(active)) {
                    e.preventDefault();
                    last.focus();
                }
            } else if (active === last || !root.contains(active)) {
                e.preventDefault();
                first.focus();
            }
        };

        window.addEventListener('keydown', handleKey);
        return () => {
            window.removeEventListener('keydown', handleKey);

            // 触发按钮在浮层收起后不可见，此时把焦点交给房间导航
            const target = restoreFocusRef.current;
            const canRestore = target
                && target !== document.body
                && !target.matches?.('[data-reading-trigger]')
                && target.isConnected
                && isVisible(target);

            if (canRestore) {
                target.focus({ preventScroll: true });
                return;
            }

            const fallback = document.querySelector('.back-btn:not(.exiting), .hamburger-btn');
            if (fallback && isVisible(fallback)) {
                fallback.focus({ preventScroll: true });
            }
        };
    }, [onClose]);

    const p = project;

    const sections = [
        ['背景', p.background],
        ['问题', p.problem],
        ['过程', p.process],
        ['方案', p.solution],
        ['反思', p.reflection],
    ].filter(([, text]) => text && text.trim());

    const paras = (text) => text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const hasVideo = p.videos?.[0]?.url || p.preview;

    return (
        <div
            ref={dialogRef}
            className={`reading-room ${showScene ? 'reading-room--atmosphere' : 'reading-room--flat'}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
        >
            {showScene && (
                <div className="reading-room__scene" aria-hidden="true">
                    {sceneOn && (
                        <SceneErrorBoundary onError={() => setSceneFailed(true)}>
                            <Suspense fallback={null}>
                                <ReadingRoomAtmosphere />
                            </Suspense>
                        </SceneErrorBoundary>
                    )}
                </div>
            )}
            <div className="reading-room__vignette" aria-hidden="true" />

            <div className="reading-room__topbar">
                <div className="reading-room__eyebrow">阅读室 · 深读档案</div>
                <button type="button" className="reading-room__close" onClick={onClose}>
                    ← {returnLabel}
                </button>
            </div>

            <div className="reading-room__sheet">
                <article className="reading-room__pane">
                    <header>
                        <h1 id={titleId} className="reading-room__title">{p.title}</h1>
                        <div className="reading-room__meta">
                            {p.client && <span>{p.client}</span>}
                            {p.year && <span> · {p.year}</span>}
                            {p.category && <span> · {p.category}</span>}
                            {p.durationSeconds && <span> · 片长 {p.durationSeconds} 秒</span>}
                        </div>
                        {p.description && (
                            <p className="reading-room__lede">{p.description}</p>
                        )}
                    </header>

                    {hasVideo && (
                        <div className="reading-room__video">
                            <ProjectVideo
                                preview={p.preview}
                                src={p.videos?.[0]?.url || ''}
                                poster={p.front}
                                autoPlay={false}
                                defaultFull
                            />
                        </div>
                    )}

                    {p.role?.length > 0 && (
                        <div className="reading-room__roles">
                            {p.role.map((role) => (
                                <span key={role} className="reading-room__role">{role}</span>
                            ))}
                        </div>
                    )}

                    {sections.map(([label, text], i) => (
                        <section key={label} className="reading-room__section">
                            <div className="reading-room__section-head">
                                <span className="reading-room__section-index">
                                    {String(i + 1).padStart(2, '0')}
                                </span>
                                <h2 className="reading-room__section-title">{label}</h2>
                            </div>
                            {paras(text).map((para, j) => (
                                <p key={j} className="reading-room__para">{para}</p>
                            ))}
                        </section>
                    ))}

                    {p.results?.length > 0 && (
                        <section className="reading-room__section">
                            <div className="reading-room__section-head">
                                <h2 className="reading-room__section-title">结果</h2>
                            </div>
                            <ul className="reading-room__results">
                                {p.results.map((result, i) => (
                                    <li key={i}>
                                        — {typeof result === 'string' ? result : result.value || result.label || ''}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <footer className="reading-room__footer">
                        <button type="button" className="reading-room__close" onClick={onClose}>
                            ← {returnLabel}
                        </button>
                    </footer>
                </article>
            </div>
        </div>
    );
};

export default ReadingRoomView;
