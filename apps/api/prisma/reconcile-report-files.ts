import { createDatabase } from '../src/database.js';
import { reconcileReportFiles, reconcileUnlinkedPhotos } from './report-files.js';

const root = process.env.UPLOAD_DIR;
const args = process.argv.slice(2);
const files = args[0] === '--list-files' || args[0] === '--remove-file';
if (!root || !(args.length === 0 || (args.length === 1 && args[0] === '--list-files') || (args.length === 2 && ['--remove', '--remove-file'].includes(args[0]!)))) throw new Error('Defina UPLOAD_DIR e use inventário sem argumentos, --list-files, --remove ID ou --remove-file ID/ARQUIVO.');
const db = createDatabase(process.env.DATABASE_URL ?? '');
try {
    const ids = files ? await reconcileUnlinkedPhotos(db, root, args[1]) : await reconcileReportFiles(db, root, args[1]);
    console.info(JSON.stringify(args[1] ? { removed: ids } : files ? { orphanFiles: ids } : { orphanDirectories: ids }));
} finally {
    await db.$disconnect();
}
