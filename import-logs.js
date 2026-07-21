const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Database = require('better-sqlite3');

const logsDir = path.join(__dirname, 'logs');
const dbPath = path.join(__dirname, 'logs.db');

console.log('Initializing SQLite Database...');
const db = new Database(dbPath);

// Optimize SQLite for massive inserts
db.pragma('journal_mode = WAL');
db.pragma('synchronous = 0');
db.pragma('temp_store = memory');
db.pragma('mmap_size = 30000000000'); // 30GB

// Create FTS5 virtual table for ultra-fast full-text search
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS search_logs USING fts5(
    filename,
    content,
    tokenize="trigram"
  );
  
  CREATE TABLE IF NOT EXISTS processed_files (
    filename TEXT PRIMARY KEY,
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const insertStmt = db.prepare('INSERT INTO search_logs (filename, content) VALUES (?, ?)');
const markProcessedStmt = db.prepare('INSERT INTO processed_files (filename) VALUES (?)');
const checkProcessedStmt = db.prepare('SELECT 1 FROM processed_files WHERE filename = ?');

async function processFile(file) {
  if (checkProcessedStmt.get(file)) {
    console.log(`[SKIP] ${file} has already been imported.`);
    return;
  }

  const filePath = path.join(logsDir, file);
  console.log(`[START] Processing file: ${file}`);
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let inBlock = false;
  let currentBlock = [];
  let insertCount = 0;

  // We wrap the inserts for this file in a single massive transaction for speed
  const insertMany = db.transaction((lines) => {
    for (const line of lines) {
      insertStmt.run(line.file, line.content);
      insertCount++;
    }
  });

  let batch = [];
  const BATCH_SIZE = 50000;

  for await (let line of rl) {
    // Strip out Discord prefix
    line = line.replace(/\[#getback\] Captain Hook#0000:\s*/g, '');
    
    if (line.trim().startsWith('```')) {
      if (inBlock) {
        batch.push({ file, content: currentBlock.join('<br>') });
        inBlock = false;
        currentBlock = [];
      } else {
        inBlock = true;
        currentBlock = [];
      }
    } else if (inBlock) {
      currentBlock.push(line);
    } else {
      // Don't insert empty lines
      if (line.trim() !== '') {
        batch.push({ file, content: line });
      }
    }

    if (batch.length >= BATCH_SIZE) {
      insertMany(batch);
      batch = [];
    }
  }

  if (inBlock && currentBlock.length > 0) {
    batch.push({ file, content: currentBlock.join('<br>') });
  }

  if (batch.length > 0) {
    insertMany(batch);
  }
  
  markProcessedStmt.run(file);

  console.log(`[DONE] Finished ${file} - Inserted ${insertCount} records.`);
}

async function run() {
  try {
    const files = fs.readdirSync(logsDir).filter(f => !fs.statSync(path.join(logsDir, f)).isDirectory());
    console.log(`Found ${files.length} files to process.`);

    for (const file of files) {
      await processFile(file);
    }

    console.log('\n=========================================');
    console.log('IMPORT COMPLETE!');
    console.log('You can now use the ultra-fast SQLite search!');
    console.log('=========================================');
  } catch (err) {
    console.error('Fatal Error:', err);
  }
}

run();
