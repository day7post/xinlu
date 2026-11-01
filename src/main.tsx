import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

const updateSW = registerSW({
  onNeedRefresh() {
    if (document.getElementById('pwa-update-bar')) return
    const bar = document.createElement('div')
    bar.id = 'pwa-update-bar'
    bar.setAttribute('role', 'status')
    bar.style.cssText =
      'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:80;display:flex;align-items:center;gap:12px;max-width:calc(100vw - 28px);padding:10px 10px 10px 16px;border-radius:14px;background:#315b55;color:#fff;box-shadow:0 18px 55px rgba(67,58,45,0.28);font-size:13px'
    const text = document.createElement('span')
    text.textContent = '心络有新版本了'
    const apply = document.createElement('button')
    apply.type = 'button'
    apply.textContent = '立即刷新'
    apply.style.cssText =
      'border:0;border-radius:9px;padding:7px 12px;background:#fff;color:#315b55;font-weight:700;cursor:pointer;white-space:nowrap'
    apply.addEventListener('click', () => {
      void updateSW(true)
    })
    const dismiss = document.createElement('button')
    dismiss.type = 'button'
    dismiss.textContent = '稍后'
    dismiss.style.cssText =
      'border:0;background:transparent;color:rgba(255,255,255,0.85);cursor:pointer;padding:7px 4px;white-space:nowrap'
    dismiss.addEventListener('click', () => bar.remove())
    bar.append(text, apply, dismiss)
    document.body.appendChild(bar)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
