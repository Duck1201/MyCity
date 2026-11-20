import { csvLine } from '@mycity/contracts';
import { statusNames, type DemoRecord } from './demo';

export function exportQueue(rows: DemoRecord[]) {
    const header = ['Protocolo', 'Categoria', 'Relato', 'Endereço', 'Situação', 'Data de registro', 'Confirmações'];
    const data = rows.map((row) => [row.id, row.categoryName, row.description, row.address, statusNames[row.status], row.date, row.count]);
    const csv = [header, ...data].map(csvLine).join('\r\n');
    const file = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(file);
    try {
        link.href = url;
        link.download = 'ocorrencias.csv';
        document.body.append(link);
        link.click();
    } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }
}
