// Shared by the queue screen and the warm-up, so both use the same cache key.
export const queuePageSize = 6;
export const defaultQueueEndpoint = '/api/v1/reports/queue?' + new URLSearchParams({ limit: String(queuePageSize) });
