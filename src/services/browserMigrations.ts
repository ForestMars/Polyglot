import { runMigrations } from '../scripts/run-indexeddb-migrations';

export async function runClientMigrations() {
  try {
    await runMigrations();
    console.log('[migrations] All client migrations applied');
  } catch (err) {
    console.error('[migrations] Failed to run client migrations:', err);
  }
}
