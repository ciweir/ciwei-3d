import React, { useEffect } from 'react';
import { useScene } from '../../context/SceneContext';
import ProjectVideo from './ProjectVideo';

/**
 * 阅读室（批次 2 · 2026-10-12 / 排版重做 10-12 晚）
 * ---------------------------------------------------------------
 * 深读层：画廊摘要浮层的「进入阅读室」→ 全屏暗色阅读空间。
 * 案例五段式（数据同源：ciwei-projects.json → placeholder.ts）。
 *
 * 排版原则（回应用户反馈：很长 / 字体不清晰 / 不分段）：
 * - 真分段：段落文本按空行拆成独立 <p>，段间距 1.4em（不再是 pre-wrap 一大块）；
 * - 导语：description 一句话置于标题下，大字号提亮——先给结论再展开；
 * - 清晰度：正文 17px / 行高 2 / #D8D2C4（对比度 ≈ 11:1）/ 字距 0.015em；
 * - 阅读宽度：660px（中文一行 ≈ 36 字的舒适宽度）。
 */
const ReadingRoom = () => {
    const { readingProject, closeReadingRoom } = useScene();

    /* Esc 关闭 */
    useEffect(() => {
        if (!readingProject) return;
        const h = (e) => { if (e.key === 'Escape') closeReadingRoom(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [readingProject, closeReadingRoom]);

    if (!readingProject) return null;
    const p = readingProject;

    /* 五段（空段跳过） */
    const sections = [
        ['背景', p.background],
        ['问题', p.problem],
        ['过程', p.process],
        ['方案', p.solution],
        ['反思', p.reflection],
    ].filter(([, t]) => t && t.trim());

    /* 真分段：按空行 / 单换行拆段 */
    const paras = (t) => t.split(/\n+/).map((s) => s.trim()).filter(Boolean);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3000,
            background: '#0A0A0A',
            overflowY: 'auto',
            fontFamily: "'Noto Sans SC', sans-serif",
            color: '#D8D2C4',
            WebkitFontSmoothing: 'antialiased',
        }}>
            {/* 顶栏 */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 10,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '1.2rem 2rem',
                background: 'linear-gradient(to bottom, #0A0A0A 70%, rgba(10,10,10,0))',
            }}>
                <div style={{ fontSize: '0.85rem', color: '#8a8578', letterSpacing: '0.1em' }}>
                    阅读室
                </div>
                <button onClick={closeReadingRoom} style={btnStyle}>
                    ← 返回画廊
                </button>
            </div>

            {/* 内容窄栏（中文舒适阅读宽度 ≈ 36 字/行） */}
            <div style={{ maxWidth: 660, margin: '0 auto', padding: '2.5rem 1.5rem 6rem' }}>
                {/* 项目头 */}
                <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#F2EEE6', margin: '0 0 0.6rem', lineHeight: 1.3 }}>
                    {p.title}
                </h1>
                <div style={{ fontSize: '0.9rem', color: '#8a8578', marginBottom: '1.6rem' }}>
                    {p.client && <span>{p.client}</span>}
                    {p.year && <span> · {p.year}</span>}
                    {p.category && <span> · {p.category}</span>}
                    {p.durationSeconds && <span> · 片长 {p.durationSeconds} 秒</span>}
                </div>

                {/* 导语：一句话说清这部片子（大字号 · 提亮） */}
                {p.description && (
                    <p style={{
                        fontSize: '1.25rem', lineHeight: 1.85, color: '#EDE8DE',
                        margin: '0 0 2.2rem', fontWeight: 500,
                        borderLeft: '2px solid #4a453b', paddingLeft: '1rem',
                    }}>
                        {p.description}
                    </p>
                )}

                {/* 主视频：优先正片（有声、完整、可全屏）；无正片回退 6 秒预览 */}
                {(p.videos?.[0]?.url || p.preview) && (
                    <div style={{
                        position: 'relative', width: '100%', paddingBottom: '56.25%',
                        background: '#000', marginBottom: '2.2rem', border: '1px solid #2a2a2a',
                    }}>
                        <div style={{ position: 'absolute', inset: 0 }}>
                            <ProjectVideo
                                preview={p.preview}
                                src={p.videos?.[0]?.url || ''}
                                poster={p.front}
                                autoPlay={false}
                                defaultFull
                            />
                        </div>
                    </div>
                )}

                {/* 署名（诚实性原则） */}
                {p.role?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '3rem' }}>
                        {p.role.map((r, i) => (
                            <span key={i} style={{
                                fontSize: '0.82rem', padding: '0.25rem 0.8rem',
                                border: '1px solid #3a3a3a', borderRadius: 2, color: '#C8C2B4',
                            }}>{r}</span>
                        ))}
                    </div>
                )}

                {/* 五段（编号分幕——剧本排版语言；段内真分段） */}
                {sections.map(([label, text], i) => (
                    <section key={label} style={{ marginBottom: '3rem' }}>
                        <div style={{
                            display: 'flex', alignItems: 'baseline', gap: '0.8rem',
                            marginBottom: '1.2rem', borderBottom: '1px solid #2a2a2a', paddingBottom: '0.5rem',
                        }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#6a6558' }}>
                                {String(i + 1).padStart(2, '0')}
                            </span>
                            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#F2EEE6', margin: 0 }}>{label}</h2>
                        </div>
                        {paras(text).map((para, j) => (
                            <p key={j} style={{
                                fontSize: '1.0625rem', lineHeight: 2, letterSpacing: '0.015em',
                                color: '#D8D2C4', margin: '0 0 1.4em',
                            }}>
                                {para}
                            </p>
                        ))}
                    </section>
                ))}

                {/* 结果点 */}
                {p.results?.length > 0 && (
                    <section style={{ marginBottom: '3rem' }}>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#F2EEE6', borderBottom: '1px solid #2a2a2a', paddingBottom: '0.5rem', marginBottom: '1.2rem' }}>
                            结果
                        </h2>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {p.results.map((r, i) => (
                                <li key={i} style={{ lineHeight: 1.9, color: '#D8D2C4', fontSize: '1.0625rem', marginBottom: '0.6rem' }}>
                                    — {typeof r === 'string' ? r : r.value || r.label || ''}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* 底部返回 */}
                <div style={{ marginTop: '4rem', textAlign: 'center' }}>
                    <button onClick={closeReadingRoom} style={btnStyle}>← 返回画廊</button>
                </div>
            </div>
        </div>
    );
};

const btnStyle = {
    fontSize: '0.85rem',
    padding: '0.5rem 1.1rem',
    background: 'transparent',
    border: '1px solid #3a3a3a',
    color: '#C8C2B4',
    cursor: 'pointer',
    borderRadius: 2,
};

export default ReadingRoom;
