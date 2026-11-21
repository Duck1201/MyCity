import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './panel.css';

import { ManagerApp } from './manager-app';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ManagerApp />
    </StrictMode>,
);
