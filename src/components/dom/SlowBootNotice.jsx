import '../../styles/BootFallback.scss';

const SlowBootNotice = ({ onContinue, onRetry, onUse2D }) => (
    <aside className="boot-notice" role="status" aria-live="polite">
        <p className="boot-notice__text">
            3D 世界加载时间较长，或当前浏览器不支持 WebGL。
        </p>
        <div className="boot-notice__actions">
            <button type="button" className="boot-notice__button boot-notice__button--primary" onClick={onUse2D}>
                进入 2D 目录
            </button>
            <button type="button" className="boot-notice__button" onClick={onContinue}>
                继续等待
            </button>
            <button type="button" className="boot-notice__button" onClick={onRetry}>
                重试
            </button>
        </div>
    </aside>
);

export default SlowBootNotice;
