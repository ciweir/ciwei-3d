import { SITE } from '../../config/site-config';
import ciweiProjects from '../../data/ciwei-projects.json';
import '../../styles/AboutCard.scss';

const bio = SITE.aboutMe.replace(/^我是此唯，一名/, '');
const projectCount = ciweiProjects.length;
const categoryCount = new Set(ciweiProjects.map((project) => project.category).filter(Boolean)).size;

const AboutCard = () => (
    <section className="about-card" aria-label="关于此唯">
        <p className="about-card__eyebrow">关于 / 01 / 03</p>
        <h2>此唯</h2>
        <p className="about-card__role">视频导演 / 剪辑 / 调色</p>
        <p className="about-card__bio">{bio}</p>
        <p className="about-card__stats">{projectCount} 部作品 · {categoryCount} 个类别</p>
        <p className="about-card__cue">
            滚动 / 滑动 / 方向键 · 飞过故事
            <span aria-hidden="true">→</span>
        </p>
    </section>
);

export default AboutCard;
