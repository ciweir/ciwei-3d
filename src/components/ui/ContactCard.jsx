import { useState } from 'react';
import { useAchievements } from '../../context/useAchievements';
import { SOCIAL } from '../../config/site-config';
import '../../styles/ContactCard.scss';

const EMAIL = SOCIAL.email;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SOCIAL_LABELS = {
    bilibili: 'B 站',
    douyin: '抖音',
    xiaohongshu: '小红书',
    weibo: '微博',
    youtube: 'YouTube',
    bcc: '必剪',
    linkedin: '领英',
    vimeo: 'Vimeo',
};

const ContactCard = () => {
    const { unlockAchievement } = useAchievements();
    const [formOpen, setFormOpen] = useState(false);
    const [replyEmail, setReplyEmail] = useState('');
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [errorField, setErrorField] = useState(null);

    const socials = Object.entries(SOCIAL).filter(
        ([key, value]) => key !== 'email' && typeof value === 'string' && value.startsWith('http')
    );
    const mailto = EMAIL
        ? `mailto:${EMAIL}?subject=${encodeURIComponent('合作咨询 · 来自作品集')}`
        : '';

    const markContacted = () => unlockAchievement('contact_choose');

    const handleCopy = async () => {
        if (!EMAIL) return;
        try {
            await navigator.clipboard.writeText(EMAIL);
            setStatus('邮箱已复制');
            markContacted();
        } catch {
            const field = document.createElement('textarea');
            field.value = EMAIL;
            field.style.cssText = 'position:fixed;left:-9999px;top:0;';
            document.body.appendChild(field);
            field.select();
            const copied = document.execCommand('copy');
            field.remove();
            setStatus(copied ? '邮箱已复制' : '复制失败，请手动选择邮箱');
            if (copied) markContacted();
        }
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        setError('');
        setErrorField(null);
        setStatus('');

        if (!EMAIL) {
            setError('邮箱暂未配置，请稍后再试。');
            return;
        }
        if (!EMAIL_RE.test(replyEmail.trim())) {
            setError('请留一个可回复的邮箱。');
            setErrorField('email');
            return;
        }
        if (message.trim().length < 4) {
            setError('再多写一句想聊的内容。');
            setErrorField('message');
            return;
        }

        const subject = `合作咨询 · ${replyEmail.trim()}`;
        const body = `${message.trim()}\n\n— ${replyEmail.trim()}`;
        window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        setStatus('已打开邮件客户端；发送后我就收到。');
        markContacted();
    };

    return (
        <section className="contact-card" aria-label="联系此唯">
            <p className="contact-card__eyebrow">合作 / 约片</p>
            <h2>直接聊聊你的项目</h2>
            <p className="contact-card__intro">拍摄、剪辑、调色合作，发邮件最快。</p>

            {EMAIL && (
                <a
                    className="contact-card__email"
                    href={mailto}
                    onClick={markContacted}
                >
                    {EMAIL}
                </a>
            )}

            <div className="contact-card__actions">
                {EMAIL && (
                    <a className="contact-card__primary" href={mailto} onClick={markContacted}>
                        写邮件 →
                    </a>
                )}
                {EMAIL && (
                    <button type="button" className="contact-card__secondary" onClick={handleCopy}>
                        复制邮箱
                    </button>
                )}
                <button
                    type="button"
                    className="contact-card__toggle"
                    aria-expanded={formOpen}
                    onClick={() => {
                        setFormOpen((open) => !open);
                        setError('');
                        setErrorField(null);
                        setStatus('');
                    }}
                >
                    {formOpen ? '收起表单' : '在这里写 →'}
                </button>
            </div>

            {socials.length > 0 && (
                <div className="contact-card__social" aria-label="社交主页">
                    {socials.map(([key, url]) => (
                        <a key={key} href={url} target="_blank" rel="noopener noreferrer">
                            {SOCIAL_LABELS[key] || key}
                        </a>
                    ))}
                </div>
            )}

            {formOpen && (
                <form className="contact-card__form" onSubmit={handleSubmit} noValidate>
                    <label>
                        你的邮箱
                        <input
                            type="email"
                            value={replyEmail}
                            onChange={(event) => setReplyEmail(event.target.value)}
                            placeholder="name@example.com"
                            autoComplete="email"
                            aria-invalid={errorField === 'email'}
                            aria-describedby={errorField === 'email' ? 'contact-form-error' : undefined}
                        />
                    </label>
                    <label>
                        想聊什么
                        <textarea
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                            placeholder="项目方向、周期或预算…"
                            maxLength={500}
                            aria-invalid={errorField === 'message'}
                            aria-describedby={errorField === 'message' ? 'contact-form-error' : undefined}
                        />
                    </label>
                    <button type="submit" className="contact-card__submit">
                        生成邮件 →
                    </button>
                    <p className="contact-card__note">会打开你的邮件应用，不会自动发送。</p>
                    {error && <p id="contact-form-error" className="contact-card__error" role="alert">{error}</p>}
                </form>
            )}

            <p className="contact-card__status" role="status" aria-live="polite">
                {status}
            </p>
        </section>
    );
};

export default ContactCard;
