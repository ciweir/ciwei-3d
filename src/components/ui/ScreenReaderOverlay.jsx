import { useScene } from '../../context/useScene';
import { useGalleryProjects, useStudioContent, useAwards } from '../../hooks/useSanityData';
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
    const awards = useAwards();

    return (
        <div className="sr-overlay" role="complementary" aria-label="Accessible navigation for 3D portfolio">
            {/* Skip to content link */}
            <a href="#sr-main-nav" className="sr-only sr-focusable">
                跳到无障碍导航
            </a>

            {/* Main accessible navigation */}
            <nav id="sr-main-nav" className="sr-only" aria-label="Portfolio rooms">
                <h1>此唯 · 视频导演作品集</h1>
                <h2>作品集导航</h2>

                {!hasEntered && (
                    <p>欢迎来到此唯的 3D 作品集世界。点击门，或聚焦门后按回车键进入。</p>
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
                                <p>这个房间用互动气球展示我的个人故事、获奖经历、里程碑与技术技能。</p>
                                
                                {awards && (
                                    <section>
                                        <h4>我的获奖</h4>
                                        <ul>
                                            {awards.sotd && awards.sotd.items && awards.sotd.items.map((a, i) => (
                                                <li key={i}>{a.label} - {a.date} {a.url && <a href={a.url}>查看</a>}</li>
                                            ))}
                                            {awards.sotm && awards.sotm.items && awards.sotm.items.map((a, i) => (
                                                <li key={i}>{a.label} - {a.date} {a.url && <a href={a.url}>查看</a>}</li>
                                            ))}
                                            {awards.other && awards.other.items && awards.other.items.map((a, i) => (
                                                <li key={i}>{a.label} - {a.date} {a.url && <a href={a.url}>查看</a>}</li>
                                            ))}
                                        </ul>
                                    </section>
                                )}
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
                                <p>社交媒体链接漂浮在木桶上。点击访问我的 LinkedIn、GitHub 等平台主页。</p>
                            </div>
                        )}
                        {currentRoom === 'studio' && (
                            <div aria-label="Studio room content">
                                <h3>工作室</h3>
                                <p>在旋转的显示器上探索我的经历与技能。点击显示器阅读详细内容。</p>

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
