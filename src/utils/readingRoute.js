const READING_PATH = /^\/read\/([^/]+)\/?$/;

export function getReadingSlugFromUrl(pathname = window.location.pathname) {
    const match = pathname.match(READING_PATH);
    if (!match) return null;

    try {
        return decodeURIComponent(match[1]);
    } catch {
        return null;
    }
}

export function getReadingPath(slug) {
    return `/read/${encodeURIComponent(slug)}`;
}
