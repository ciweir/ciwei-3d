import { useScene } from '../../context/useScene';
import ReadingRoomView from './ReadingRoomView';

const ReadingRoom = () => {
    const { readingProject, closeReadingRoom } = useScene();

    if (!readingProject) return null;

    return <ReadingRoomView project={readingProject} onClose={closeReadingRoom} />;
};

export default ReadingRoom;
