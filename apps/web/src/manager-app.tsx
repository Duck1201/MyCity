import { lazy, useEffect } from 'react';
import { ManagerAccess } from './manager-access';
import type { QueueNavigation } from './manager-shell';
import { categoriesEndpoint, defaultQueueEndpoint, overviewEndpoint, recentReportsEndpoint } from './queue-endpoint';
import { useWarmUp } from './use-live-query';

// Each section is a separate chunk. Every round trip to the server costs about
// 150 ms from Brazil, so the chunks load right after the session is confirmed
// instead of when the manager first clicks a section.
const sections = {
    overview: () => import('./manager-overview').then((module) => ({ default: module.ManagerOverview })),
    categories: () => import('./category-manager').then((module) => ({ default: module.CategoryManager })),
    queue: () => import('./management-reports').then((module) => ({ default: module.ManagementReports })),
    detail: () => import('./manager-detail').then((module) => ({ default: module.ManagerDetail })),
};
const ManagerOverview = lazy(sections.overview);
const CategoryManager = lazy(sections.categories);
const ManagementReports = lazy(sections.queue);
const ManagerDetail = lazy(sections.detail);

let preloaded = false;
function preloadSections() {
    if (preloaded) return;
    preloaded = true;
    for (const load of Object.values(sections)) void load().catch(() => {});
}

// While the manager is on one section, the entry reads of the others are fetched
// into the session cache, so switching sections shows data at once and only revalidates.
const sectionReads: Record<QueueNavigation['section'], readonly string[]> = {
    overview: [overviewEndpoint, recentReportsEndpoint],
    queue: [defaultQueueEndpoint, categoriesEndpoint],
    categories: [categoriesEndpoint],
};
function WarmUp({ navigation }: { navigation: QueueNavigation }) {
    useEffect(preloadSections, []);
    const current = navigation.id ? undefined : navigation.section;
    useWarmUp((Object.keys(sectionReads) as QueueNavigation['section'][]).filter((section) => section !== current).flatMap((section) => sectionReads[section]));
    return null;
}

function renderSection(onSessionExpired: () => void, navigation: QueueNavigation) {
    const section = navigation.id ? <ManagerDetail key={navigation.id} id={navigation.id} onSessionExpired={onSessionExpired} /> : navigation.section === 'overview' ? <ManagerOverview onSessionExpired={onSessionExpired} /> : navigation.section === 'categories' ? <CategoryManager onSessionExpired={onSessionExpired} /> : <ManagementReports onSessionExpired={onSessionExpired} />;
    return (
        <>
            <WarmUp navigation={navigation} />
            {section}
        </>
    );
}

export function ManagerApp() {
    return <ManagerAccess>{renderSection}</ManagerAccess>;
}
