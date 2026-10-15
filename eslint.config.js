import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],

      // —— 项目级调音（2026-10-15）——
      // 以下 4 条 react-hooks v7 规则对 R3F / Three.js 习语系统性误报，共约 84 条，
      // 会淹没真实告警：
      //  · useFrame 回调里直接改 ref.current.position/rotation 是 Three.js 标准写法；
      //  · 每帧读取 clock.elapsedTime、命令式创建 gsap 时间轴被 purity 误判；
      //  · 在 effect 中同步 setState 用于驱动一次性入场动画亦为刻意设计。
      // 均为误报而非真实的 Hook 规则违反，故项目级关闭（不改动业务语义）。
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
    },
  },
  {
    // Context 文件天然同时导出 Provider 组件与配套 hook（useScene / useAudio /
    // useAchievements / usePerformance），该模式下 react-refresh 规则必然报错。
    // 该规则只影响 HMR 粒度，不会引入运行时问题，故仅对 context 目录关闭；
    // 其余目录保持开启，以保护普通组件文件的 Fast Refresh 边界。
    files: ['src/context/**/*.{js,jsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
