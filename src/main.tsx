import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installNetworkMonitor } from './utils/networkMonitor';
import './index.css';

installNetworkMonitor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
