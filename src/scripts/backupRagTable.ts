// src/scripts/backupRagTable.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';

// For ES modules __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const backupDirectory = process.env.BACKUP_DIRECTORY || path.join(__dirname, 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(backupDirectory, `rag_table_backup_${timestamp}.sql`);

const dbConfig = {
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'polyglut_user',
  password: process.env.PGPASSWORD || 'polyglut',
  database: process.env.PGDATABASE || 'polyglut_rag',
};

const ensureDirectoryExists = async (dirPath) => {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
};

const backupTable = async () => {
  try {
    console.log('Starting backup process...');
    
    // Ensure backup directory exists
    await ensureDirectoryExists(backupDirectory);
    
    // Create write stream for the backup file
    const outputStream = fs.createWriteStream(backupFile);
    
    // Spawn pg_dump process
    const pgDump = spawn('pg_dump', [
      '-h', dbConfig.host,
      '-p', dbConfig.port.toString(),
      '-U', dbConfig.user,
      '-d', dbConfig.database,
      '-t', 'rag_documents',
      '--verbose'
    ], {
      env: { 
        ...process.env, 
        PGPASSWORD: dbConfig.password 
      }
    });
    
    // Pipe stdout to file
    pgDump.stdout.pipe(outputStream);
    
    // Log stderr (verbose output and errors)
    pgDump.stderr.on('data', (data) => {
      console.log(`pg_dump: ${data.toString().trim()}`);
    });
    
    // Handle process completion
    return new Promise((resolve, reject) => {
      pgDump.on('close', (code) => {
        outputStream.end();
        
        if (code === 0) {
          console.log(`✅ Backup successfully created: ${backupFile}`);
          
          // Check file size to verify backup worked
          fs.stat(backupFile, (err, stats) => {
            if (err) {
              console.warn('Could not check backup file size:', err);
            } else {
              console.log(`📁 Backup file size: ${(stats.size / 1024).toFixed(2)} KB`);
            }
          });
          
          resolve(backupFile);
        } else {
          const error = new Error(`pg_dump process exited with code ${code}`);
          console.error('❌ Backup failed:', error.message);
          reject(error);
        }
      });
      
      pgDump.on('error', (error) => {
        console.error('❌ pg_dump process error:', error);
        reject(error);
      });
    });
    
  } catch (error) {
    console.error('❌ Error during backup:', error);
    throw error;
  }
};

// Run the backup
backupTable()
  .then((filePath) => {
    console.log(`🎉 Backup process completed successfully!`);
    console.log(`📂 File location: ${filePath}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Backup process failed:', error);
    process.exit(1);
  });