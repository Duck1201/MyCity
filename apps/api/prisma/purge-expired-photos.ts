import { createDatabase } from '../src/database.js';
import { purgeExpiredPhotos } from '../src/modules/reports/index.js';

const db = createDatabase(process.env.DATABASE_URL ?? '');
try {
    console.info(JSON.stringify(await purgeExpiredPhotos(db, process.env.UPLOAD_DIR ?? './uploads')));
} finally {
    await db.$disconnect();
}
