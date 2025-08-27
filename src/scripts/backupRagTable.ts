import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { exec } from 'child_process';

dotenv.config();

const backupDirectory = process.env.BACKUP_DIRECTORY || path.join(__dirname, 'backups');
const backupFile = path.join(backupDirectory, 'rag_table_backup.sql');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'polyglut_user',
  password: process.env.PGPASSWORD || 'polyglut',
  database: process.env.PGDATABASE || 'polyglut_rag',
});

const backupTable = async () => {
  try {
    const query = `pg_dump -U ${pool.user} -d ${pool.database} -t rag_documents > ${backupFile}`;
    await exec(query);
    console.log(`Backup created: ${backupFile}`);
  } catch (error) {
    console.error('Error creating backup:', error);
  }
};

backupTable();