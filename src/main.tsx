import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// @ts-ignore
const isElectron = !!window.electronAPI || navigator.userAgent.toLowerCase().includes('electron');

if (window.location.pathname === '/') {
  if (isElectron) {
    window.location.replace("/teacher");
  } else {
    window.location.replace("/join");
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
