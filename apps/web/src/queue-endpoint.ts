// Reads shared by the panel screens and the warm-up, so both use the same cache keys.
export const queuePageSize = 6;
export const defaultQueueEndpoint = '/api/v1/reports/queue?' + new URLSearchParams({ limit: String(queuePageSize) });
export const overviewEndpoint = '/api/v1/reports/overview';
export const recentReportsEndpoint = '/api/v1/reports/queue?ordem=recentes&limit=3';
export const categoriesEndpoint = '/api/v1/categories';
export const reportEndpoint = (id: string) => '/api/v1/reports/' + encodeURIComponent(id);
export const reportHistoryEndpoint = (id: string) => reportEndpoint(id) + '/history?order=newest&limit=4';
