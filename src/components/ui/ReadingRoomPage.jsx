import { useEffect } from 'react';
import ciweiProjects from '../../data/ciwei-projects.json';
import { SITE } from '../../config/site-config';
import ReadingRoomView from './ReadingRoomView';

const goGallery = () => {
    window.location.assign('/gallery');
};

const setMeta = (property, content, attribute = 'property') => {
    let tag = document.head.querySelector(`meta[${attribute}="${property}"]`);
    if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attribute, property);
        document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
};

const setCanonical = (url) => {
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
    }
    link.setAttribute('href', url);
};

const realDomain = SITE.url && !/example\.(com|org|net)|your-domain|ciwei\.example/i.test(SITE.url);

const ReadingRoomPage = ({ slug }) => {
    const project = ciweiProjects.find((item) => item.id === slug);

    useEffect(() => {
        if (!project) {
            document.title = '未找到作品 —— 此唯作品集';
            setMeta('description', '这个阅读室页面不存在，作品可能已被移动。', 'name');
            setMeta('robots', 'noindex, follow', 'name');
            return;
        }

        const title = `${project.title} · 阅读室 —— 此唯作品集`;
        const description = project.description
            || `${project.title} 的创作背景、问题、过程、方案与反思。`;
        const url = `${SITE.url}/read/${encodeURIComponent(project.id)}`;
        const image = project.painted || project.front;

        document.title = title;
        setMeta('description', description, 'name');
        setMeta('robots', 'index, follow', 'name');
        setMeta('og:title', title);
        setMeta('og:description', description);
        setMeta('twitter:title', title);
        setMeta('twitter:description', description);

        if (realDomain) {
            setMeta('og:url', url);
            setCanonical(url);
            if (image) {
                const absoluteImage = image.startsWith('http') ? image : `${SITE.url}${image}`;
                setMeta('og:image', absoluteImage);
                setMeta('twitter:image', absoluteImage);
                setMeta('twitter:card', 'summary_large_image');
            }
        }
    }, [project]);

    if (!project) {
        return (
            <div className="reading-room reading-room--flat reading-missing">
                <div className="reading-missing__pane">
                    <div className="reading-room__eyebrow">阅读室 · 深读档案</div>
                    <h1 className="reading-missing__title">这一页不在档案里</h1>
                    <p className="reading-missing__text">
                        没有找到「{slug}」对应的作品。档案可能在整理中被移动了，
                        也可能你打开的是一条旧链接。
                    </p>
                    <a className="reading-missing__link" href="/gallery">← 返回画廊</a>
                </div>
            </div>
        );
    }

    return <ReadingRoomView project={project} onClose={goGallery} />;
};

export default ReadingRoomPage;
