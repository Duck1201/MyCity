import { ManagerDetail } from '../src/manager-detail';
import { ManagerShell } from '../src/manager-shell';
import { ManagementReports } from '../src/management-reports';

const expire = () => {
    throw new Error('Sessão de teste inesperadamente expirada.');
};
export function QueueJourney() {
    return <ManagerShell leave={expire}>{({ id }) => (id ? <ManagerDetail id={id} onSessionExpired={expire} /> : <ManagementReports onSessionExpired={expire} />)}</ManagerShell>;
}
