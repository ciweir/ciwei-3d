import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteCompression from 'vite-plugin-compression';
import { generateSeoHtml } from './seo-plugin.js';

const START_PAGE_PATHS = new Set(['/start', '/start/']);

function rewriteStartPage(req, _res, next) {
  const [pathname, query = ''] = req.url.split('?');

  if (START_PAGE_PATHS.has(pathname)) {
    req.url = `/start/index.html${query ? `?${query}` : ''}`;
  }

  next();
}

function serveStaticStartPage() {
  return {
    name: 'serve-static-start-page',
    configureServer(server) {
      server.middlewares.use(rewriteStartPage);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewriteStartPage);
    }
  };
}

/* 占位兜底中间件已于 2026-10-15 撤除（D5）：
   全部引用路径均已对齐磁盘（scripts 内 _d5_audit 逐条核对 257 条引用 0 缺失），
   缺图缺音恢复为正常 404，不再被静默掩盖。
   原实现见 _archive_20261013/。 */

// https://vite.dev/config/
export default defineConfig({
  plugins: [serveStaticStartPage(), react(), viteCompression(), generateSeoHtml()]
})
