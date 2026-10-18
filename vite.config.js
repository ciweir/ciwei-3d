import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteCompression from 'vite-plugin-compression';
import { generateSeoHtml } from './seo-plugin.js';

const START_PAGE_PATHS = new Set(['/start', '/start/']);

function redirectStartPage(req, res, next) {
  const [pathname] = req.url.split('?');

  if (START_PAGE_PATHS.has(pathname)) {
    res.statusCode = 302;
    res.setHeader('Location', '/');
    res.end();
    return;
  }

  next();
}

function redirectStartPagePlugin() {
  return {
    name: 'redirect-start-page',
    configureServer(server) {
      server.middlewares.use(redirectStartPage);
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirectStartPage);
    }
  };
}

/* 占位兜底中间件已于 2026-10-15 撤除（D5）：
   全部引用路径均已对齐磁盘（scripts 内 _d5_audit 逐条核对 257 条引用 0 缺失），
   缺图缺音恢复为正常 404，不再被静默掩盖。
   原实现见 _archive_20261013/。 */

// https://vite.dev/config/
export default defineConfig({
  plugins: [redirectStartPagePlugin(), react(), viteCompression(), generateSeoHtml()],
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('preload-helper')) {
            return 'vite-helper';
          }
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }
          if (
            id.includes('node_modules/three/') ||
            id.includes('node_modules/@react-three/') ||
            id.includes('node_modules/troika')
          ) {
            return 'scene-vendor';
          }
        }
      }
    }
  }
})

