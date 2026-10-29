import { useEffect } from 'react';
import '../../styles/BootFallback.scss';
import ciweiProjects from '../../data/ciwei-projects.json';
import { SITE, SOCIAL } from '../../config/site-config';

const EMAIL = SOCIAL.email || '26397767570@qq.com';

const groups = [];
for (const project of ciweiProjects) {
    const last = groups[groups.length - 1];
    if (last?.category === project.category) {
        last.items.push(project);
    } else {
        groups.push({ category: project.category, items: [project] });
    }
}

const StaticPortfolio = ({ canRetry3D, onRetry }) => {
    useEffect(() => {
        const { body } = document;
        const previous = body.style.overflow;
        body.style.overflow = 'auto';
        return () => {
            body.style.overflow = previous;
        };
    }, []);

    return (
        <div className="static-portfolio">
        <header className="sp-hero">
            <p className="sp-eyebrow">2D 目录 · 影像作品集</p>
            <h1 className="sp-title">{SITE.author}</h1>
            <p className="sp-role">{SITE.jobTitle} · 剪辑 · 调色 · 济南</p>
            <p className="sp-intro">{SITE.aboutMe}</p>
            <div className="sp-actions">
                {canRetry3D && (
                    <button type="button" className="sp-button" onClick={onRetry}>
                        进入 3D 世界
                    </button>
                )}
                <a className="sp-button sp-button--ghost" href={`mailto:${EMAIL}`}>
                    邮件联系
                </a>
            </div>
            <p className="sp-count">
                {ciweiProjects.length} 部作品 · {groups.length} 个类别
            </p>
        </header>

        <main className="sp-groups">
            {groups.map((group, index) => (
                <section className="sp-group" key={group.category}>
                    <div className="sp-group-head">
                        <span className="sp-group-index">{String(index + 1).padStart(2, '0')}</span>
                        <h2 className="sp-group-title">{group.category}</h2>
                        <span className="sp-group-count">{group.items.length} 部</span>
                    </div>

                    {group.items.map((project, index) => {
                        const video = project.videos?.find((item) => item?.url)?.url;
                        const media = video || project.preview;
                        return (
                            <article
                                className="sp-row"
                                key={project.id}
                                style={{ '--row-index': index }}
                            >
                                <div className="sp-row-main">
                                    <h3 className="sp-row-title">{project.title}</h3>
                                    <p className="sp-row-desc">{project.description}</p>
                                </div>
                                <div className="sp-row-side">
                                    <p className="sp-row-meta">
                                        {[project.client, project.year, project.role?.join(' / ')]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                    {media && (
                                        <a
                                            className="sp-row-link"
                                            href={media}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {video ? '播放正片' : '查看预览'} ↗
                                        </a>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </section>
            ))}
        </main>

        <footer className="sp-footer">
            <p>2D 目录用于低带宽或当前浏览器不支持 WebGL 的环境。</p>
            <p>
                © {new Date().getFullYear()} {SITE.author} · 济南
            </p>
        </footer>
    </div>
    );
};

export default StaticPortfolio;
