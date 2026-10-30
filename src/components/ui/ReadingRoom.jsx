import { useScene } from '../../context/useScene';
import ReadingRoomView from './ReadingRoomView';

const RETURN_LABELS = {
    gallery: '返回画廊',
    studio: '返回工作室',
    about: '返回关于',
    contact: '返回联系',
};

const ReadingRoom = () => {
    const { readingProject, closeReadingRoom, currentRoom } = useScene();

    if (!readingProject) return null;

    return (
        <ReadingRoomView
            project={readingProject}
            onClose={closeReadingRoom}
            returnLabel={RETURN_LABELS[currentRoom] || '返回画廊'}
        />
    );
};

export default ReadingRoom;
