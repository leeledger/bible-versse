const { Pool } = require('pg');

// The DATABASE_URL environment variable will be automatically used by the Pool
// if it's set, which we configured in docker-compose.yml.
// For local development outside Docker, you might need to set these explicitly or use a .env file.
const pool = new Pool({
  // Example of explicit connection string if DATABASE_URL is not set:
  // connectionString: 'postgresql://user:password@localhost:5432/bible_db',

  // Or individual parameters (less common if DATABASE_URL is available):
  // user: process.env.PGUSER || 'user',
  // host: process.env.PGHOST || 'localhost',
  // database: process.env.PGDATABASE || 'bible_db',
  // password: process.env.PGPASSWORD || 'password',
  // port: process.env.PGPORT || 5432,
});

pool.on('connect', () => {
  console.log('Connected to the PostgreSQL database!');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

const initializeDatabase = async () => {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createReadingProgressTable = `
    CREATE TABLE IF NOT EXISTS reading_progress (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      last_read_book VARCHAR(255),
      last_read_chapter INTEGER,
      last_read_verse INTEGER,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createCompletedChaptersTable = `
    CREATE TABLE IF NOT EXISTS completed_chapters (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      book_name VARCHAR(255) NOT NULL,
      chapter_number INTEGER NOT NULL,
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, book_name, chapter_number)
    );
  `;

  // Reading history for more granular tracking
  const createReadingHistoryTable = `
    CREATE TABLE IF NOT EXISTS reading_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      book_name VARCHAR(255) NOT NULL,
      chapter_number INTEGER NOT NULL,
      verse_number INTEGER NOT NULL, 
      read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      session_id VARCHAR(255) 
    );
  `;

  try {
    await pool.query(createUsersTable);
    await pool.query(createReadingProgressTable);
    await pool.query(createCompletedChaptersTable);
    await pool.query(createReadingHistoryTable);
    console.log('Database tables checked/created successfully.');
  } catch (err) {
    console.error('Error creating database tables:', err);
    process.exit(1); // Exit if tables can't be created
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initializeDatabase,
};
