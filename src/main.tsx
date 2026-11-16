import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (import.meta.env.PROD && window.location.protocol !== 'file:') {
  registerSW({immediate: true});
} else if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol !== 'file:') {
  void navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((r) => void r.unregister()))
    .catch(() => {});
}

createRoot(document.getElementById('root')!).render(<App />);
