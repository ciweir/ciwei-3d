import { useState, useEffect } from 'react';
import ciweiProjects from '../data/ciwei-projects.json';
import { STUDIO_SHOWCASE } from '../data/studio-showcase';

/* 数据源说明（本地数据模式）
   --------------------------
   22 个项目由 scripts/export-ciwei.mjs 从 src/data/placeholder.ts
   导出为 ciwei-projects.json，本文件只做装配与分发，不发网络请求。

   若将来恢复 Sanity CMS 模式：
   1. 恢复 _archive_20261013/deadcode-round4/sanity-fetch-block.js 到 loadSanityData
   2. 恢复 _archive_20261013/deadcode-round4/sanity.js 到 src/config/
   3. npm i @sanity/client @sanity/image-url
   4. 在 src/config/sanity.js 填入真实 projectId */

// 全局数据缓存（模块级，三个 hook 共享一份）
const cache = {
    projects: null,
    content: null,
    awards: null,
    loading: false,
    loaded: false,
};

let fetchPromise = null;
const listeners = new Set();

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function notifyUpdate() {
    listeners.forEach(l => l());
}

export function loadSanityData() {
    if (fetchPromise === null) {
        cache.projects = ciweiProjects;
        // 工作室展示数据同样来自 ciwei-projects.json 的派生（单一数据源）
        cache.content = STUDIO_SHOWCASE;
        cache.awards = null;
        cache.loaded = true;
        cache.loading = false;
        fetchPromise = Promise.resolve(cache);
        notifyUpdate();
    }
    return fetchPromise;
}

export function isSanityDataLoaded() {
    return cache.loaded;
}

export function useGalleryProjects() {
    const [projects, setProjects] = useState(cache.projects);

    useEffect(() => {
        loadSanityData();

        if (cache.loaded) {
            setProjects(cache.projects);
            return;
        }

        const handleUpdate = () => {
            setProjects(cache.projects);
        };

        return subscribe(handleUpdate);
    }, []);

    return projects;
}

export function useStudioContent() {
    const [content, setContent] = useState(cache.content);

    useEffect(() => {
        loadSanityData();

        if (cache.loaded) {
            setContent(cache.content);
            return;
        }

        const handleUpdate = () => {
            setContent(cache.content);
        };

        return subscribe(handleUpdate);
    }, []);

    return content;
}

export function useAwards() {
    const [awardsData, setAwardsData] = useState(cache.awards);

    useEffect(() => {
        loadSanityData();

        if (cache.loaded) {
            setAwardsData(cache.awards);
            return;
        }

        const handleUpdate = () => {
            setAwardsData(cache.awards);
        };

        return subscribe(handleUpdate);
    }, []);

    return awardsData;
}

// JS 模块加载时自动装配本地数据
loadSanityData();
