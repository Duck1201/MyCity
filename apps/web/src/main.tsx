import { lazy, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './prototype/console.css';

import { ManagerAccess } from './manager-access';
import type { QueueNavigation } from './manager-shell';

const ManagerOverview = lazy(() => import('./manager-overview').then((module) => ({ default: module.ManagerOverview })));
const CategoryManager = lazy(() => import('./category-manager').then((module) => ({ default: module.CategoryManager })));
const ManagementReports = lazy(() => import('./management-reports').then((module) => ({ default: module.ManagementReports })));
const ManagerDetail = lazy(() => import('./manager-detail').then((module) => ({ default: module.ManagerDetail })));

function renderSection(onSessionExpired: () => void, navigation: QueueNavigation) {
    if (navigation.id) return <ManagerDetail key={navigation.id} id={navigation.id} onSessionExpired={onSessionExpired} />;
    if (navigation.section === 'overview') return <ManagerOverview onSessionExpired={onSessionExpired} />;
    if (navigation.section === 'categories') return <CategoryManager onSessionExpired={onSessionExpired} />;
    return <ManagementReports onSessionExpired={onSessionExpired} />;
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ManagerAccess>{renderSection}</ManagerAccess>
    </StrictMode>,
);
