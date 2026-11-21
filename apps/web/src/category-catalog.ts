import { categoriesEndpoint } from './queue-endpoint';
import { useLiveQuery } from './use-live-query';

import type { ReportCategoryOption } from '@mycity/contracts';

export function useCategoryCatalog(onSessionExpired: () => void) {
    return useLiveQuery<{ data: ReportCategoryOption[] }>(categoriesEndpoint, onSessionExpired);
}
