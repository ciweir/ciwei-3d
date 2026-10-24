import { useEffect, useState } from 'react';
import { useScene } from '../../context/useScene';
import { isTouchDevice } from '../../utils/deviceDetect';
import '../../styles/GallerySwipeHint.scss';

const SEEN_KEY = 'ciwei-gallery-swipe-seen';

const GallerySwipeHint = () => {
    const { currentRoom } = useScene();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!isTouchDevice() || currentRoom !== 'gallery') {
            setVisible(false);
            return undefined;
        }
        try {
            if (window.sessionStorage.getItem(SEEN_KEY)) return undefined;
        } catch {
            // ignore storage failures
        }

        let dismissed = false;
        const dismiss = () => {
            if (dismissed) return;
            dismissed = true;
            setVisible(false);
            try {
                window.sessionStorage.setItem(SEEN_KEY, '1');
            } catch {
                // ignore storage failures
            }
        };
        const showTimer = window.setTimeout(() => setVisible(true), 900);
        const hideTimer = window.setTimeout(dismiss, 6500);

        window.addEventListener('pointerdown', dismiss, { once: true });
        window.addEventListener('touchstart', dismiss, { once: true, passive: true });

        return () => {
            window.clearTimeout(showTimer);
            window.clearTimeout(hideTimer);
            window.removeEventListener('pointerdown', dismiss);
            window.removeEventListener('touchstart', dismiss);
            setVisible(false);
        };
    }, [currentRoom]);

    if (!visible) return null;

    return (
        <div className="gallery-swipe-hint" role="status" aria-live="polite">
            ← 左右滑动 →
        </div>
    );
};

export default GallerySwipeHint;
