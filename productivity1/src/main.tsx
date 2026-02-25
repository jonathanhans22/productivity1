import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// FIX PENTING: Polyfill untuk react-beautiful-dnd di Vite
// Menggunakan (window as any) di pengecekan agar TypeScript tidak error
if (typeof (window as any).global === 'undefined') {
  (window as any).global = window;
}
if (typeof (window as any).process === 'undefined') {
  (window as any).process = { env: {} };
}

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)