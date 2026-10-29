import { useEffect, useState } from 'react';
import { useScene } from '../../context/useScene';
import { useGalleryProjects, useStudioContent } from '../../hooks/useSanityData';
import '../../styles/ScreenReaderOverlay.scss';

/**
 * ScreenReaderOverlay — A7 Accessibility
 * 
 * Invisible HTML layer providing screen reader access to 3D canvas content.
 * Contains buttons/links matching interactive 3D elements (doors, rooms).
 * Visually hidden via .sr-only but fully accessible to assistive tech.
 */
const ScreenReaderOverlay = () => {
    const { hasEntered, isInRoom, currentRoom, teleportTo, requestExit } = useScene();
    
    // 取数据生成给 SEO / 爬虫的隐藏 HTML
    const projects = useGalleryProjects();
    const studio = useStudioContent();
    const [studioProgram, setStudioProgram] = useState(null);

    useEffect(() => {
        const handleProgram = (event) => setStudioProgram(event.detail);
        window.addEventListener('ciwei:studio-program', handleProgram);
        return () => window.removeEventListener('ciwei:studio-program', handleProgram);
    }, []);

    return (
        <div className="sr-overlay" role="complementary" aria-label="Accessible navigation for 3D portfolio">
            {/* Skip to content link */}
            <a href="#sr-main-nav" className="sr-only sr-focusable">
                跳到无障碍导航
            </a>

            {/* 3D 门只能由指针点击，键盘与读屏通过这个焦点按钮进入同一流程 */}
            {!hasEntered && (
                <button
                    type="button"
                    className="sr-only sr-focusable sr-enter-door"
                    onClick={() => window.dispatchEvent(new CustomEvent('ciwei:manual-enter'))}
                >
                    推门进入 3D 世界
                </button>
            )}

            {/* Main accessible navigation */}
            <nav id="sr-main-nav" className="sr-only" aria-label="Portfolio rooms">
                <h1>此唯 · 视频导演作品集</h1>
                <h2>作品集导航</h2>

                {!hasEntered && (
                    <p>欢迎来到此唯的 3D 作品集世界。点击画面里的门，或按 Tab 找到“推门进入 3D 世界”按钮后按回车。</p>
                )}

                {hasEntered && !isInRoom && (
                    <>
                        <p>你正在走廊里。选择一个房间探索：</p>
                        <ul>
                            <li>
                                <button onClick={() => teleportTo('about')} type="button">
                                    关于 —— 我的故事、技能与经历
                                </button>
                            </li>
                            <li>
                                <button onClick={() => teleportTo('gallery')} type="button">
                                    画廊 —— 我的项目与作品
                                </button>
                            </li>
                            <li>
                                <button onClick={() => teleportTo('contact')} type="button">
                                    联系 —— 与我取得联系
                                </button>
                            </li>
                            <li>
                                <button onClick={() => teleportTo('studio')} type="button">
                                    工作室 —— 技术与经历
                                </button>
                            </li>
                        </ul>
                    </>
                )}

                {hasEntered && isInRoom && (
                    <>
                        <p>
                            你正在{currentRoom === 'about' ? '关于房间' :
                                currentRoom === 'gallery' ? '画廊房间' :
                                    currentRoom === 'contact' ? '联系房间' :
                                        currentRoom === 'studio' ? '工作室' : currentRoom}。
                        </p>
                        <button onClick={requestExit} type="button">
                            返回走廊
                        </button>

                        {/* Room-specific content descriptions */}
                        {currentRoom === 'about' && (
                            <div aria-label="About room content">
                                <h3>关于我</h3>
                                <p>这个房间用三段云端故事介绍我。用滚轮、上下滑动，或方向键和 PageUp/PageDown 前进与后退。</p>
                                <ol>
                                    <li>此唯：视频导演、剪辑与调色。</li>
                                    <li>经历：商业影片与自媒体长期供稿，时间线为 2023 至今和 2025 至今。</li>
                                    <li>手艺：剪辑、调色与影像叙事。</li>
                                </ol>
                            </div>
                        )}
                        {currentRoom === 'gallery' && (
                            <div aria-label="Gallery room content">
                                <h3>我的项目</h3>
                                <p>浏览展示在纸卡上的作品。点击项目卡片查看详情，或访问线上站点。</p>
                                
                                {projects && projects.length > 0 && (
                                    <ul>
                                        {projects.map((p, i) => (
                                            <li key={i}>
                                                <h4>{p.title}</h4>
                                                <p>{p.description}</p>
                                                {p.url && <a href={p.url}>访问 {p.title}</a>}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                        {currentRoom === 'contact' && (
                            <div aria-label="Contact room content">
                                <h3>联系我</h3>
                                <p>联系房间里有纸张联系卡：可以复制邮箱，或直接打开邮件客户端写信。</p>
                            </div>
                        )}
                        {currentRoom === 'studio' && (
                            <div aria-label="Studio room content">
                                <h3>工作室</h3>
                                <p>在放映墙前浏览作品片单；上下拖动翻片单，点击侧屏换到主屏，点击主屏查看项目详情。</p>
                                <p id="sr-studio-program" aria-live="polite">
                                    {studioProgram
                                        ? `当前主屏放映：${studioProgram.title}，第 ${studioProgram.index} / ${studioProgram.total} 部。`
                                        : '主屏正在准备放映。'}
                                </p>

                                {studio && studio.length > 0 && (
                                    <ul>
                                        {studio.map((s, i) => (
                                            <li key={i}>
                                                <h4>{s.title}（{s.platform}）</h4>
                                                <p>{s.description}</p>
                                                {s.url && <a href={s.url}>查看内容</a>}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {/* Quick navigation to other rooms */}
                        <h3>快速导航</h3>
                        <ul>
                            {currentRoom !== 'about' && (
                                <li><button onClick={() => teleportTo('about')} type="button">去关于房间</button></li>
                            )}
                            {currentRoom !== 'gallery' && (
                                <li><button onClick={() => teleportTo('gallery')} type="button">去画廊房间</button></li>
                            )}
                            {currentRoom !== 'contact' && (
                                <li><button onClick={() => teleportTo('contact')} type="button">去联系房间</button></li>
                            )}
                            {currentRoom !== 'studio' && (
                                <li><button onClick={() => teleportTo('studio')} type="button">去工作室</button></li>
                            )}
                        </ul>
                    </>
                )}
            </nav>

            {/* Live region for state changes */}
            <div aria-live="polite" aria-atomic="true" className="sr-only">
                {isInRoom && `已进入${currentRoom === 'about' ? '关于' :
                    currentRoom === 'gallery' ? '画廊' :
                        currentRoom === 'contact' ? '联系' :
                            currentRoom === 'studio' ? '工作室' : currentRoom}房间`}
            </div>
        </div>
    );
};

export default ScreenReaderOverlay;
