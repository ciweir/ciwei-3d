import { useEffect, useRef } from 'react';
import { useScene } from '../context/useScene';
import { SITE } from '../config/site-config';
import ciweiProjects from '../data/ciwei-projects.json';
import { getReadingPath } from '../utils/readingRoute';

/**
 * useDocumentMeta — Dynamic Meta Tags & Virtual Routing (History API)
 *
 * Updates the browser URL, page title, and meta description
 * whenever the user enters/exits a 3D room or opens the reading room.
 * Also handles the browser back/forward buttons for seamless navigation.
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

const normalizePath = (path) => path.replace(/\/+$/, '') || '/';

const getReadingMeta = (project) => ({
    path: getReadingPath(project.id),
    title: `${project.title} · 阅读室 —— 此唯作品集`,
    description: project.description || `${project.title} 的创作背景、问题、过程、方案与反思。`,
});

const applyMeta = (meta) => {
    document.title = meta.title;

    const descTag = document.querySelector('meta[name="description"]');
    if (descTag) descTag.setAttribute('content', meta.description);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', meta.title);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', meta.description);

    if (!isPlaceholderUrl(SITE.url)) {
        const ogUrl = document.querySelector('meta[property="og:url"]');
        if (ogUrl) ogUrl.setAttribute('content', `${SITE.url}${meta.path}`);
        const canonicalTag = document.querySelector('link[rel="canonical"]');
        if (canonicalTag) canonicalTag.setAttribute('href', `${SITE.url}${meta.path}`);
    }
};

/**
 * Returns the room ID that the initial URL points to (for deep linking).
 * Call this once at app startup to determine if we need to auto-teleport.
 */
export function getInitialRoomFromUrl() {
    const path = normalizePath(window.location.pathname);
    return PATH_TO_ROOM[path] !== undefined ? PATH_TO_ROOM[path] : null;
}

export function useDocumentMeta() {
    const {
        currentRoom,
        teleportTo,
        hasEntered,
        requestExit,
        readingProject,
        openReadingRoom,
        closeReadingRoom,
    } = useScene();
    const historyReady = useRef(false);
    const lastPushedRoom = useRef(undefined);
    const lastReadingSlug = useRef(null);
    // 浏览器前进/后退后，房间退出动画可能还没完成；等目标房间落地再同步 URL。
    const pendingPopRoom = useRef(undefined);

    useEffect(() => {
        const roomMeta = ROOM_META[currentRoom === null ? 'null' : currentRoom] || ROOM_META.null;
        const reading = readingProject?.id ? readingProject : null;
        const readingSlug = reading?.id ?? null;
        const meta = reading ? getReadingMeta(reading) : roomMeta;

        applyMeta(meta);

        const currentPath = normalizePath(window.location.pathname);

        if (!historyReady.current) {
            // 首屏保留 URL：深链 /gallery 不能被改写成 /
            historyReady.current = true;
            lastPushedRoom.current = currentRoom;
            lastReadingSlug.current = readingSlug;
            return;
        }

        if (pendingPopRoom.current !== undefined) {
            if (pendingPopRoom.current === currentRoom) {
                pendingPopRoom.current = undefined;
                lastPushedRoom.current = currentRoom;
                lastReadingSlug.current = readingSlug;
            }
            return;
        }

        if (reading) {
            if (lastReadingSlug.current !== readingSlug) {
                const state = { room: currentRoom, read: readingSlug };
                if (currentPath === meta.path) {
                    window.history.replaceState(state, '', meta.path);
                } else {
                    window.history.pushState(state, '', meta.path);
                }
                lastReadingSlug.current = readingSlug;
            }
            lastPushedRoom.current = currentRoom;
            return;
        }

        if (lastReadingSlug.current !== null) {
            // 阅读室通过按钮关闭：当前历史项是 /read/...，替换回所在房间
            lastReadingSlug.current = null;
            lastPushedRoom.current = currentRoom;
            window.history.replaceState({ room: currentRoom }, '', roomMeta.path);
            return;
        }

        if (lastPushedRoom.current !== currentRoom) {
            if (currentRoom === null && lastPushedRoom.current != null) {
                // 应用内返回走廊：替换当前房间 entry，避免浏览器后退又回到房间
                window.history.replaceState({ room: null }, '', '/');
            } else if (currentPath === roomMeta.path) {
                // 深链进入：URL 已是目标路径，不新增历史记录
                window.history.replaceState({ room: currentRoom }, '', roomMeta.path);
            } else {
                window.history.pushState({ room: currentRoom }, '', roomMeta.path);
            }
            lastPushedRoom.current = currentRoom;
        }
    }, [currentRoom, readingProject]);

    // Handle browser back/forward buttons
    useEffect(() => {
        const handlePopState = (event) => {
            const targetRoom = event.state?.room ?? null;
            const targetRead = event.state?.read ?? null;

            if (targetRead) {
                const project = ciweiProjects.find((item) => item.id === targetRead);
                pendingPopRoom.current = undefined;
                if (project) {
                    openReadingRoom(project);
                    return;
                }
                // 失效的阅读室深链：退回目标房间
            }

            pendingPopRoom.current = targetRoom === currentRoom ? undefined : targetRoom;

            if (readingProject) closeReadingRoom();

            if (targetRoom === null) {
                document.title = ROOM_META.null.title;
                if (currentRoom !== null) requestExit();
            } else if (hasEntered) {
                teleportTo(targetRoom);
            } else {
                pendingPopRoom.current = undefined;
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [currentRoom, readingProject, teleportTo, hasEntered, requestExit, openReadingRoom, closeReadingRoom]);
}
