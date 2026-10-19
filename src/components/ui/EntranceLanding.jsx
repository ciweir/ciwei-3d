const EntranceLanding = ({ onEnter }) => (
    <button
        type="button"
        className="entrance-landing"
        onClick={onEnter}
        aria-label="进入 3D 世界"
    >
        <span className="entrance-landing__hint">点击门 · 开始布景</span>
    </button>
);

export default EntranceLanding;
