import { useEffect, useRef } from 'react';
import { useScene } from '../context/SceneContext';
import { SITE } from '../config/site-config';

/**
 * useDocumentMeta — Dynamic Meta Tags & Virtual Routing (History API)
 *
 * Updates the browser URL, page title, and meta description
 * whenever the user enters/exits a 3D room. Also handles the
 * browser back/forward buttons for seamless navigation.
 *
 * 域名：读取 src/config/site-config.js 的 SITE.url（与构建期 SEO 插件同一来源）。
 * 占位符（example.com）时自动跳过 og:url / canonical 注入，避免占位 URL 上线。
 */
const isPlaceholderUrl = (url) => /example\.(com|org|net)|your-domain|ciwei\.example/i.test(url || '');

const ROOM_META = {
    null: {
        path: '/',
        title: '此唯 —— 3D 作品集',
        description: '欢迎走进此唯的 3D 作品集世界：作品画廊、工作室、关于与联系，都在一个可以走进去的手绘空间里。',
    },
    about: {
        path: '/about',
        title: '关于我 —— 此唯作品集',
        description: '关于此唯：视频导演 / 剪辑创作者的技能、工具与经历。',
    },
    gallery: {
        path: '/gallery',
        title: '画廊与作品 —— 此唯作品集',
        description: '浏览此唯的 3D 作品画廊：19 个项目以手绘纸卡呈现，点击可查看详情。',
    },
    studio: {
        path: '/studio',
        title: '工作室 —— 此唯作品集',
        description: '此唯的工作室：创作工具、流程与幕后。',
    },
    contact: {
        path: '/contact',
        title: '联系 —— 此唯作品集',
        description: '与此唯取得联系：社交媒体、邮箱与联系方式，都在 3D 世界的联系房间里。',
    },
};

// Map URL paths back to room IDs for deep linking
const PATH_TO_ROOM = {
    '/': null,
    '/about': 'about',
    '/gallery': 'gallery',
    '/studio': 'studio',
    '/contact': 'contact',
};

/**
 * Returns the room ID that the initial URL points to (for deep linking).
 * Call this once at app startup to determine if we need to auto-teleport.
 */
export function getInitialRoomFromUrl() {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    return PATH_TO_ROOM[path] !== undefined ? PATH_TO_ROOM[path] : null;
}

export function useDocumentMeta() {
    const { currentRoom, teleportTo, hasEntered } = useScene();
    const isHandlingPopState = useRef(false);
    const lastPushedRoom = useRef(undefined); // Track what we last pushed to avoid duplicates

    // Update document meta and URL when room changes
    useEffect(() => {
        const roomKey = currentRoom === null ? 'null' : currentRoom;
        const meta = ROOM_META[roomKey] || ROOM_META['null'];

        // Update the page title
        document.title = meta.title;

        // Update meta description
        const descTag = document.querySelector('meta[name="description"]');
        if (descTag) {
            descTag.setAttribute('content', meta.description);
        }

        // Update OG meta tags
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute('content', meta.title);

        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.setAttribute('content', meta.description);

        // og:url / canonical 需要绝对地址；正式域名确定后（填 site-config.js 的 SITE.url）
        // 自动生效；仍是占位符时跳过注入，避免带着占位 URL 上线
        if (!isPlaceholderUrl(SITE.url)) {
            const ogUrl = document.querySelector('meta[property="og:url"]');
            if (ogUrl) ogUrl.setAttribute('content', `${SITE.url}${meta.path}`);
            const canonicalTag = document.querySelector('link[rel="canonical"]');
            if (canonicalTag) canonicalTag.setAttribute('href', `${SITE.url}${meta.path}`);
        }

        // Push to browser history (only if not handling a popstate event and room actually changed)
        if (!isHandlingPopState.current && lastPushedRoom.current !== currentRoom) {
            // Use replaceState for the very first load, pushState for subsequent navigations
            if (lastPushedRoom.current === undefined) {
                window.history.replaceState({ room: currentRoom }, '', meta.path);
            } else {
                window.history.pushState({ room: currentRoom }, '', meta.path);
            }
            lastPushedRoom.current = currentRoom;
        }

        isHandlingPopState.current = false;
    }, [currentRoom]);

    // Handle browser back/forward buttons
    useEffect(() => {
        const handlePopState = (event) => {
            isHandlingPopState.current = true;
            const targetRoom = event.state?.room ?? null;
            lastPushedRoom.current = targetRoom;

            if (targetRoom === null) {
                // Going back to corridor — we don't teleport, just need to trigger exit
                // The SceneContext requestExit will handle the animation
                // For now, we update meta immediately
                const meta = ROOM_META['null'];
                document.title = meta.title;
            } else if (hasEntered) {
                // Teleport to the target room
                teleportTo(targetRoom);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [teleportTo, hasEntered]);
}
