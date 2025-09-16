// packages/polyglot-app/src/scripts/run-indexeddb-migrations.ts
import fs from 'fs';
import path from 'path';
import Dexie from 'dexie';

type MigrationModule = {
  id: string;
  description?: string;
  up: (db: Dexie) => Promise<void>;
  down?: (db: Dexie) => Promise<void>;
};

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');
const MIGRATIONS_STORE = 'appliedMigrations';

/**
 * Boot a Dexie instance with a migrations store that tracks applied migrations.
 * NOTE: The schema for the app's real stores should match your runtime AppDatabase.
 */
function makeMigrationDb(name = 'PolyglotDB_migrations_check') {
  const db = new Dexie(name);
  // minimal stores for migration tracking; real schema must also exist if you modify data
  db.version(1).stores({
    [MIGRATIONS_STORE]: 'id, appliedAt'
    // You may also want to define `conversations` etc. matching runtime schema if migration code touches them.
  });
  return db;
}

async function loadMigrationFiles(): Promise<string[]> {
  const files = await fs.promises.readdir(MIGRATIONS_DIR);
  return files
    .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
    .sort(); // sort by filename (prefix ensures ordering)
}

async function importMigration(file: string): Promise<MigrationModule> {
  const full = path.join(MIGRATIONS_DIR, file);
  // Dynamic import requires either compiled JS or ts-node in CI; examples assume compiled or using ts-node/register.
  const mod = await import(full);
  if (!mod.id || !mod.up) {
    throw new Error(`Migration ${file} missing 'id' or 'up' export`);
  }
  return mod as MigrationModule;
}

/**
 * Run pending up migrations.
 */
export async function runMigrations({ dbName, dryRun = false } : { dbName?: string; dryRun?: boolean } = {}) {
  const db = makeMigrationDb(dbName || 'PolyglotDB_migrations_check');
  await db.open();

  try {
    const migrationFiles = await loadMigrationFiles();
    const allMigrations = await Promise.all(migrationFiles.map(importMigration));

    // Ensure migrations table exists by Dexie version; use the same database instance used in your app
    // For each migration, check if applied and run if not.
    for (const mig of allMigrations) {
      const applied = await (db as any)[MIGRATIONS_STORE].get(mig.id);
      if (applied) {
        console.log(`[migrations] already applied: ${mig.id}`);
        continue;
      }
      console.log(`[migrations] applying: ${mig.id} - ${mig.description ?? ''}`);
      if (dryRun) {
        console.log(`[migrations] dry run - skipping actual up()`);
      } else {
        // NOTE: The migration's up() expects a Dexie instance that includes your real app stores
        // For tests, you should create a Dexie instance that matches your app schema (or import AppDatabase)
        await mig.up(db);
        await (db as any)[MIGRATIONS_STORE].put({ id: mig.id, appliedAt: new Date() });
      }
    }

    console.log('[migrations] complete');
  } finally {
    await db.close();
  }
}

/**
 * Rollback the last applied migration (runs down for the latest applied migration).
 */
export async function rollbackLast({ dbName } : { dbName?: string } = {}) {
  const db = makeMigrationDb(dbName || 'PolyglotDB_migrations_check');
  await db.open();
  try {
    const last = await (db as any)[MIGRATIONS_STORE].orderBy('appliedAt').last();
    if (!last) {
      console.log('[migrations] no applied migrations to rollback');
      return;
    }
    const files = await loadMigrationFiles();
    const allMigrations = await Promise.all(files.map(importMigration));
    const mig = allMigrations.find(m => m.id === last.id);
    if (!mig || !mig.down) throw new Error(`No down() provided for migration ${last.id}`);
    console.log(`[migrations] rolling back: ${mig.id}`);
    await mig.down(db);
    await (db as any)[MIGRATIONS_STORE].delete(mig.id);
    console.log('[migrations] rollback complete');
  } finally {
    await db.close();
  }
}

// If run directly, execute runMigrations()
if (require.main === module) {
  const arg = process.argv[2];
  if (arg === 'rollback') {
    rollbackLast().catch(err => { console.error(err); process.exit(1); });
  } else {
    const dry = process.argv.includes('--dry');
    runMigrations({ dryRun: dry }).catch(err => { console.error(err); process.exit(1); });
  }
}
