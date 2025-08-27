import fs from "fs/promises";
import path from "path";
import { Pool } from "pg";
import dotenv from "dotenv";
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { getEmbedding } from "../services/rag/embeddings";

// For ES modules __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const configPath = path.resolve("config/rag.json");
const configRaw = await fs.readFile(configPath, "utf-8");
const config = JSON.parse(configRaw);

const ragFolder = config.folderPath;
const CHUNK_SIZE = 200;
const OVERLAP_SIZE = 20;
const RECURSIVE = true;

// Backup configuration
const backupDirectory = process.env.BACKUP_DIRECTORY || path.join(__dirname, '../backups');

const dbConfig = {
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432"),
  user: process.env.PGUSER || "polyglut_user",
  password: process.env.PGPASSWORD || "polyglut",
  database: process.env.PGDATABASE || "polyglut_rag",
};

const pool = new Pool(dbConfig);

// Backup functionality
const ensureDirectoryExists = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
};

const createBackup = async () => {
  console.log('Creating pre-ingestion backup...');
  
  await ensureDirectoryExists(backupDirectory);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDirectory, `pre_ingest_backup_${timestamp}.sql`);
  
  return new Promise((resolve, reject) => {
    const pgDump = spawn('pg_dump', [
      '-h', dbConfig.host,
      '-p', dbConfig.port.toString(),
      '-U', dbConfig.user,
      '-d', dbConfig.database,
      '-t', 'rag_documents',
      '--data-only',  // Only backup data, not schema
      '--file', backupFile
    ], {
      env: { ...process.env, PGPASSWORD: dbConfig.password }
    });
    
    pgDump.stderr.on('data', (data) => {
      console.log(`pg_dump: ${data.toString().trim()}`);
    });
    
    pgDump.on('close', (code) => {
      if (code === 0) {
        console.log(`Backup created: ${backupFile}`);
        resolve(backupFile);
      } else {
        reject(new Error(`Backup failed with code ${code}`));
      }
    });
    
    pgDump.on('error', (error) => {
      reject(new Error(`Backup process error: ${error.message}`));
    });
  });
};

const restoreBackup = async (backupFile) => {
  console.log(`Restoring from backup: ${backupFile}`);
  
  return new Promise((resolve, reject) => {
    // First clear the table
    pool.query('DELETE FROM rag_documents')
      .then(() => {
        // Then restore from backup
        const psql = spawn('psql', [
          '-h', dbConfig.host,
          '-p', dbConfig.port.toString(),
          '-U', dbConfig.user,
          '-d', dbConfig.database,
          '-f', backupFile
        ], {
          env: { ...process.env, PGPASSWORD: dbConfig.password }
        });
        
        psql.stderr.on('data', (data) => {
          console.log(`psql: ${data.toString().trim()}`);
        });
        
        psql.on('close', (code) => {
          if (code === 0) {
            console.log('Backup restored successfully');
            resolve();
          } else {
            reject(new Error(`Restore failed with code ${code}`));
          }
        });
        
        psql.on('error', (error) => {
          reject(new Error(`Restore process error: ${error.message}`));
        });
      })
      .catch(reject);
  });
};

// Ensure table exists (using your existing schema)
const ensureTableExists = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS rag_documents (
      id SERIAL PRIMARY KEY,
      file_name TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT, -- Keep as TEXT since your format works
      file_last_modified TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(file_name, chunk_index)
    );
  `;
  
  await pool.query(createTableQuery);
};

// Validation function
const validateIngestion = async () => {
  console.log('Validating ingestion...');
  
  // Check if we have data
  const countResult = await pool.query('SELECT COUNT(*) as count FROM rag_documents');
  const totalRows = parseInt(countResult.rows[0].count);
  
  if (totalRows === 0) {
    throw new Error('Validation failed: No data found after ingestion');
  }
  
  // Check for null embeddings
  const nullEmbeddingsResult = await pool.query(
    'SELECT COUNT(*) as count FROM rag_documents WHERE embedding IS NULL'
  );
  const nullEmbeddings = parseInt(nullEmbeddingsResult.rows[0].count);
  
  if (nullEmbeddings > 0) {
    throw new Error(`Validation failed: ${nullEmbeddings} rows have null embeddings`);
  }
  
  // Check for duplicate chunks
  const duplicatesResult = await pool.query(`
    SELECT file_name, chunk_index, COUNT(*) as count 
    FROM rag_documents 
    GROUP BY file_name, chunk_index 
    HAVING COUNT(*) > 1
  `);
  
  if (duplicatesResult.rows.length > 0) {
    console.warn(`Warning: Found ${duplicatesResult.rows.length} duplicate chunks`);
  }
  
  console.log(`Validation passed: ${totalRows} total documents`);
  return true;
};

// Your existing functions (with improvements)
function chunkText(text, chunkSize, overlapSize) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    
    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }
    
    const nextStart = start + chunkSize - overlapSize;
    start = Math.max(nextStart, start + 1);
    
    if (end >= text.length) break;
  }
  
  return chunks;
}

async function getAllFiles(dir, recursive = true) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory() && recursive) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.vscode') {
        continue;
      }
      const subFiles = await getAllFiles(fullPath, recursive);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.txt' || ext === '.md') {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

async function getExistingFiles() {
  const result = await pool.query("SELECT DISTINCT file_name FROM rag_documents");
  return new Set(result.rows.map(row => row.file_name));
}

async function getFileModificationTime(filePath) {
  const stats = await fs.stat(filePath);
  return stats.mtime;
}

async function getStoredModificationTime(fileName) {
  const result = await pool.query(
    "SELECT file_last_modified FROM rag_documents WHERE file_name = $1 LIMIT 1",
    [fileName]
  );
  return result.rows.length > 0 ? result.rows[0].file_last_modified : null;
}

async function removeExistingFile(fileName) {
  console.log(`  Removing existing chunks for ${fileName}`);
  await pool.query("DELETE FROM rag_documents WHERE file_name = $1", [fileName]);
}

async function processFile(filePath, fileName) {
  console.log(`Processing file: ${fileName}`);
  
  // Check file size limit (e.g., 1MB)
  const stats = await fs.stat(filePath);
  if (stats.size > 1024 * 1024) {
    console.warn(`Skipping ${fileName}: File too large (${stats.size} bytes)`);
    return;
  }
  
  const content = await fs.readFile(filePath, "utf-8");
  const fileModTime = await getFileModificationTime(filePath);
  
  const chunks = chunkText(content, CHUNK_SIZE, OVERLAP_SIZE);
  console.log(`  Split into ${chunks.length} chunks`);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`  Processing chunk ${i + 1}/${chunks.length}`);
    
    try {
      const embedding = await getEmbedding(chunk);
      
      // Use ON CONFLICT to handle duplicates
      await pool.query(`
        INSERT INTO rag_documents (file_name, chunk_index, content, embedding, file_last_modified, created_at) 
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (file_name, chunk_index) 
        DO UPDATE SET 
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          file_last_modified = EXCLUDED.file_last_modified,
          created_at = NOW()
      `, [fileName, i, chunk, `[${embedding.join(",")}]`, fileModTime]);
      
    } catch (error) {
      console.error(`Error processing chunk ${i + 1} of ${fileName}:`, error);
      throw error; // Re-throw to trigger backup restore
    }
  }
}

async function ingestFiles(mode = 'incremental') {
  console.log(`\n=== Starting ${mode} ingestion ===`);
  
  let backupFile = null;
  
  try {
    // Step 1: Create backup
    backupFile = await createBackup();
    
    // Step 2: Ensure table exists
    await ensureTableExists();
    
    // Step 3: Get files and process
    const allFiles = await getAllFiles(ragFolder, RECURSIVE);
    console.log(`Found ${allFiles.length} files total`);
    
    if (mode === 'full') {
      console.log("Full mode: Clearing all existing data...");
      await pool.query("DELETE FROM rag_documents");
    }
    
    const existingFiles = await getExistingFiles();
    console.log(`Found ${existingFiles.size} files already in database`);
    
    let processed = 0;
    let skipped = 0;
    let updated = 0;
    
    // Process files in transaction for better error handling
    await pool.query('BEGIN');
    
    try {
      for (const filePath of allFiles) {
        const fileName = path.relative(ragFolder, filePath);
        
        if (mode === 'incremental' && existingFiles.has(fileName)) {
          const fileModTime = await getFileModificationTime(filePath);
          const storedModTime = await getStoredModificationTime(fileName);
          
          if (storedModTime && fileModTime <= storedModTime) {
            console.log(`Skipping ${fileName} (unchanged)`);
            skipped++;
            continue;
          } else {
            console.log(`File ${fileName} has been modified, updating...`);
            await removeExistingFile(fileName);
            updated++;
          }
        }
        
        await processFile(filePath, fileName);
        processed++;
      }
      
      await pool.query('COMMIT');
      console.log('Transaction committed successfully');
      
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error('Transaction rolled back due to error:', error);
      throw error;
    }
    
    // Step 4: Validate the ingestion
    await validateIngestion();
    
    console.log(`\n=== Ingestion complete ===`);
    console.log(`Files processed: ${processed}`);
    console.log(`Files updated: ${updated}`);
    console.log(`Files skipped: ${skipped}`);
    
    return { success: true, backupFile };
    
  } catch (error) {
    console.error('Ingestion failed:', error);
    
    if (backupFile) {
      console.log('Attempting to restore from backup...');
      try {
        await restoreBackup(backupFile);
        console.log('Successfully restored from backup');
      } catch (restoreError) {
        console.error('Failed to restore backup:', restoreError);
        console.error('Manual intervention required!');
      }
    }
    
    throw error;
  }
}

// Main execution
const mode = process.argv[2] === '--full' ? 'full' : 'incremental';

console.log(`Mode: ${mode}`);
console.log(`Folder: ${ragFolder}`);

try {
  const result = await ingestFiles(mode);
  console.log("RAG ingestion finished successfully.");
  
  // Optionally clean up old backups (keep last 5)
  // await cleanupOldBackups();
  
} catch (error) {
  console.error("RAG ingestion failed:", error);
  process.exit(1);
} finally {
  await pool.end();
}