import { createDatabase } from '../src/database.js';
import { reconcileReportFiles } from './report-files.js';

const root = process.env.UPLOAD_DIR;
const args = process.argv.slice(2);
if (!root || !(args.length === 0 || (args.length === 2 && args[0] === '--remove'))) throw new Error('Defina UPLOAD_DIR e use inventário sem argumentos ou --remove ID.');
const db = createDatabase(process.env.DATABASE_URL ?? '');
try {
    const ids = await reconcileReportFiles(db, root, args[1]);
    console.info(JSON.stringify(args.length ? { removed: ids } : { orphanDirectories: ids }));
} finally {
    await db.$disconnect();
}
