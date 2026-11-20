import { createDatabase } from '../src/database.js';
import { backfillThumbnails } from './report-files.js';

// Same default as the API server, so a local run finds the development uploads.
const root = process.env.UPLOAD_DIR ?? './uploads';
const db = createDatabase(process.env.DATABASE_URL ?? '');
try {
    console.info(JSON.stringify(await backfillThumbnails(db, root)));
} finally {
    await db.$disconnect();
}
