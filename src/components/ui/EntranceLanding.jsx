import { useAudio } from '../../context/useAudio';

const EntranceLanding = ({ onEnter }) => {
    const { play } = useAudio();

    return (
        <button
            type="button"
            className="entrance-landing"
            onClick={() => {
                // 进入是用户与这个世界的第一下接触，先给纸面轻点再转场
                play('tick');
                onEnter();
            }}
            aria-label="进入 3D 世界"
        >
            <span className="entrance-landing__hint">点击进入布景</span>
        </button>
    );
};

export default EntranceLanding;
