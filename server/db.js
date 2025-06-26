const { Pool } = require('pg');

// The DATABASE_URL environment variable will be automatically used by the Pool
// if it's set, which we configured in docker-compose.yml.
// For local development outside Docker, you might need to set these explicitly or use a .env file.
const pool = new Pool({
  // By explicitly setting these, we ensure that the connection works both in
  // a Docker environment (which might set DATABASE_URL) and in a local environment
  // using a .env file loaded by our admin script.
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
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

  // Hall of Fame 테이블 - 성경 완독자 기록
  const createHallOfFameTable = `
    CREATE TABLE IF NOT EXISTS hall_of_fame (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      round INTEGER NOT NULL,
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, round)
    );
  `;

  try {
    await pool.query(createUsersTable);
    await pool.query(createReadingProgressTable);
    await pool.query(createCompletedChaptersTable);
    await pool.query(createReadingHistoryTable);
    await pool.query(createHallOfFameTable);

    // Add password column if it doesn't exist
    const passwordColExists = await pool.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='users' AND column_name='password' AND table_schema = 'public'
    `);
    if (passwordColExists.rowCount === 0) {
      await pool.query('ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL');
      console.log("Column 'password' added to 'users' table.");
    }

    // Add must_change_password column if it doesn't exist
    const mustChangePasswordColExists = await pool.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='users' AND column_name='must_change_password' AND table_schema = 'public'
    `);
    if (mustChangePasswordColExists.rowCount === 0) {
      await pool.query('ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT TRUE');
      console.log("Column 'must_change_password' added to 'users' table.");
    }

    console.log('Database tables checked/created/altered successfully.');
  } catch (err) {
    console.error('Error initializing database (creating/altering tables):', err);
    process.exit(1); // Exit if tables can't be created/altered
  }
};

async function handleBibleCompletion(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 1. 현재까지의 완독 횟수 확인
    const { rows } = await client.query(
      'SELECT COALESCE(MAX(round), 0) as last_round FROM hall_of_fame WHERE user_id = $1',
      [userId]
    );
    const nextRound = rows[0].last_round + 1;

    // 2. hall_of_fame에 insert (중복 방지)
    await client.query(
      'INSERT INTO hall_of_fame (user_id, round) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, nextRound]
    );

    // 3. users.completed_count 업데이트
    await client.query(
      'UPDATE users SET completed_count = COALESCE(completed_count,0) + 1 WHERE id = $1',
      [userId]
    );

    // 4. completed_chapters 리셋
    await client.query(
      'DELETE FROM completed_chapters WHERE user_id = $1',
      [userId]
    );

    // 5. reading_progress 리셋 (선택)
    await client.query(
      'UPDATE reading_progress SET last_read_book = NULL, last_read_chapter = NULL, last_read_verse = NULL WHERE user_id = $1',
      [userId]
    );

    await client.query('COMMIT');
    return { success: true, round: nextRound };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initializeDatabase,
  handleBibleCompletion,
};
