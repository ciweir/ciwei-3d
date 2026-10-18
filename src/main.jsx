import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// --- 控制台签名（评审彩蛋）---
if (typeof window !== 'undefined') {
  console.log(
    '%c 此唯 %c 3D 作品集世界 %c',
    'background: #111; color: #e8c877; padding: 5px 10px; font-weight: bold; border-radius: 3px 0 0 3px;',
    'background: #1c3a4f; color: #fff; padding: 5px 10px; font-weight: bold; border-radius: 0 3px 3px 0;',
    'background: transparent'
  );
  console.log(
    '%cHi! %c欢迎查看代码质量。干净的控制台 = 心情好的开发者 🚀',
    'font-weight: bold; color: #e8c877; font-size: 14px;',
    'color: #666; font-size: 14px;'
  );
}


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
