const express = require('express');
// const fs = require('fs'); // No longer needed for database.json
// const path = require('path'); // No longer needed for database.json
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db'); // Import the new db module

const app = express();
const PORT = 3001;
// const DB_PATH = path.join(__dirname, 'database.json'); // No longer needed

app.use(cors());
app.use(bodyParser.json());

// Helper functions for database.json are no longer needed
// const readDatabase = () => { ... };
// const writeDatabase = (data) => { ... };


// Endpoint to ensure a user exists, creating if not. Called on login.
app.post('/api/users/ensure', async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ message: 'Username is required' });
  }

  try {
    let userResult = await db.query('SELECT id, username FROM users WHERE username = $1', [username]);
    let user;

    if (userResult.rows.length > 0) {
      user = userResult.rows[0];
      console.log(`[POST /api/users/ensure] User ${username} (ID: ${user.id}) already exists.`);
    } else {
      const newUserResult = await db.query(
        'INSERT INTO users (username) VALUES ($1) RETURNING id, username',
        [username]
      );
      user = newUserResult.rows[0];
      console.log(`[POST /api/users/ensure] Created new user ${username} with ID: ${user.id}`);
    }
    // Return the user object (or just a success message)
    res.status(200).json({ id: user.id, username: user.username, message: 'User ensured successfully.' });
  } catch (error) {
    console.error(`[POST /api/users/ensure] Error ensuring user ${username}:`, error);
    res.status(500).json({ message: 'Error ensuring user in database' });
  }
});

// Get user progress
app.get('/api/progress/:username', async (req, res) => {
  const { username } = req.params;
  try {
    // 1. Get user_id from username
    const userResult = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    let userId;

    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].id;
    } else {
      // If user not found by GET /api/progress, it means they haven't saved any progress yet.
      // User creation is handled by POST /api/users/ensure on login or by POST /api/progress when saving.
      console.log(`[GET /api/progress] User ${username} not found or no progress recorded. Returning default progress.`);
      return res.json({ lastReadBook: '', lastReadChapter: 0, lastReadVerse: 0, history: [], completedChapters: [], lastProgressUpdateDate: null });
    }

    // 2. Get reading_progress
    const progressResult = await db.query(
      'SELECT last_read_book, last_read_chapter, last_read_verse, updated_at FROM reading_progress WHERE user_id = $1',
      [userId]
    );
    
    let userProgressData = { lastReadBook: '', lastReadChapter: 0, lastReadVerse: 0, lastProgressUpdateDate: null };
    if (progressResult.rows.length > 0) {
      const p = progressResult.rows[0];
      userProgressData = {
        lastReadBook: p.last_read_book,
        lastReadChapter: p.last_read_chapter,
        lastReadVerse: p.last_read_verse,
        lastProgressUpdateDate: p.updated_at
      };
    }

    // 3. Get completed_chapters
    const completedChaptersResult = await db.query(
      'SELECT book_name, chapter_number FROM completed_chapters WHERE user_id = $1',
      [userId]
    );
    const completedChapters = completedChaptersResult.rows.map(c => `${c.book_name}:${c.chapter_number}`);

    // 4. History: For now, returning empty. This needs specific logic based on how reading_history table is used.
    const finalProgress = {
      ...userProgressData,
      completedChapters: completedChapters,
      history: [] // Placeholder for history, to be implemented based on reading_history table
    };

    console.log(`[GET DB] Progress for ${username} (ID: ${userId}):`, finalProgress);
    res.json(finalProgress);

  } catch (error) {
    console.error(`[GET DB] Error fetching progress for ${username}:`, error);
    res.status(500).json({ message: 'Error fetching progress from database' });
  }
});

// Save user progress
app.post('/api/progress/:username', async (req, res) => {
  const { username } = req.params;
  const { 
    lastReadBook, 
    lastReadChapter, 
    lastReadVerse, 
    history, // This is expected to be versesReadInSession from the client
    completedChapters // Array of strings like "Genesis:1"
  } = req.body;

  const client = await db.pool.connect(); // Get a client from the pool for transaction

  try {
    await client.query('BEGIN'); // Start transaction

    // 1. Find or create user
    let userResult = await client.query('SELECT id FROM users WHERE username = $1', [username]);
    let userId;

    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].id;
    } else {
      const newUserResult = await client.query(
        'INSERT INTO users (username) VALUES ($1) RETURNING id',
        [username]
      );
      userId = newUserResult.rows[0].id;
      console.log(`[POST DB] Created new user ${username} with ID: ${userId}`);
    }

    // 2. Save/Update reading_progress
    // ON CONFLICT on user_id (primary key) DO UPDATE
    const progressQuery = `
      INSERT INTO reading_progress (user_id, last_read_book, last_read_chapter, last_read_verse, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        last_read_book = EXCLUDED.last_read_book,
        last_read_chapter = EXCLUDED.last_read_chapter,
        last_read_verse = EXCLUDED.last_read_verse,
        updated_at = NOW();
    `;
    await client.query(progressQuery, [userId, lastReadBook, lastReadChapter, lastReadVerse]);

    // 3. Save completed_chapters
    if (completedChapters && completedChapters.length > 0) {
      const chapterInsertQuery = `
        INSERT INTO completed_chapters (user_id, book_name, chapter_number, completed_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, book_name, chapter_number) DO NOTHING;
      `;
      for (const chapterStr of completedChapters) {
        const [book, chapterNumStr] = chapterStr.split(':');
        const chapterNum = parseInt(chapterNumStr, 10);
        if (book && !isNaN(chapterNum)) {
          await client.query(chapterInsertQuery, [userId, book, chapterNum]);
        }
      }
    }

    // 4. Save reading_history (versesReadInSession)
    // The 'history' from client is an array of {date, book, startChapter, startVerse, endChapter, endVerse, versesRead}
    if (history && history.length > 0) {
      const historyInsertQuery = `
        INSERT INTO reading_history (user_id, book_name, chapter_number, verse_number, read_at)
        VALUES ($1, $2, $3, $4, $5);
      `;
      // Client sends 'date' in history objects, which we use here.
      for (const entry of history) {
        await client.query(historyInsertQuery, [
          userId, 
          entry.book, 
          entry.startChapter, // Use startChapter from client data
          entry.startVerse,   // Use startVerse from client data
          new Date(entry.date)  // Use date from client data
        ]);
      }
    }

    await client.query('COMMIT'); // Commit transaction
    console.log(`[POST DB] Saved progress for ${username} (ID: ${userId})`);
    res.status(200).json({ message: 'Progress saved successfully.' });

  } catch (error) {
    await client.query('ROLLBACK'); // Rollback transaction on error
    console.error(`[POST DB] Error saving progress for ${username}:`, error);
    res.status(500).json({ message: 'Error saving progress to database' });
  } finally {
    client.release(); // Release client back to the pool
  }
});

// Get completed chapters for a user
app.get('/api/progress/:username/completedChapters', async (req, res) => {
  const { username } = req.params;
  try {
    const userResult = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      console.log(`[GET DB] User ${username} not found for completed chapters. Returning empty array.`);
      return res.json([]);
    }
    const userId = userResult.rows[0].id;

    const completedChaptersResult = await db.query(
      'SELECT book_name, chapter_number FROM completed_chapters WHERE user_id = $1 ORDER BY book_name, chapter_number',
      [userId]
    );
    
    const completedChapters = completedChaptersResult.rows.map(c => `${c.book_name}:${c.chapter_number}`);
    console.log(`[GET DB] Completed chapters for ${username} (ID: ${userId}):`, completedChapters);
    res.json(completedChapters);

  } catch (error) {
    console.error(`[GET DB] Error fetching completed chapters for ${username}:`, error);
    res.status(500).json({ message: 'Error fetching completed chapters' });
  }
});

// Mark a chapter as completed for a user
app.post('/api/progress/:username/markChapterCompleted', (req, res) => {
  const db = readDatabase();
  const { username } = req.params;
  const { book, chapter } = req.body;

  if (!book || typeof chapter !== 'number') {
    return res.status(400).json({ message: 'Book and chapter are required and chapter must be a number.' });
  }

  if (!db[username]) {
    // Initialize user if not exists, though ideally user should exist from login/progress save
    db[username] = { lastReadBook: '', lastReadChapter: 0, lastReadVerse: 0, history: [], completedChapters: [] };
  }
  
  if (!db[username].completedChapters) {
    db[username].completedChapters = [];
  }

  const chapterKey = `${book}:${chapter}`;
  if (!db[username].completedChapters.includes(chapterKey)) {
    db[username].completedChapters.push(chapterKey);
    writeDatabase(db);
    console.log(`[POST] Marked chapter ${chapterKey} as completed for ${username}.`);
    res.status(200).json({ message: 'Chapter marked as completed.', completedChapters: db[username].completedChapters });
  } else {
    console.log(`[POST] Chapter ${chapterKey} already marked as completed for ${username}.`);
    res.status(200).json({ message: 'Chapter already completed.', completedChapters: db[username].completedChapters });
  }
});

// Get all users' progress summary for leaderboard
app.get('/api/users/all', async (req, res) => {
try {
const query = `
  SELECT
    u.username,
    COALESCE(rp.last_read_book, '') AS "lastReadBook",
    COALESCE(rp.last_read_chapter, 0) AS "lastReadChapter",
    COALESCE(rp.last_read_verse, 0) AS "lastReadVerse",
    rp.updated_at AS "lastProgressUpdateDate",
    (SELECT COUNT(*) FROM completed_chapters cc WHERE cc.user_id = u.id) AS "completedChaptersCount"
  FROM
    users u
  LEFT JOIN
    reading_progress rp ON u.id = rp.user_id
  ORDER BY
    u.username;
`;
const { rows } = await db.query(query);
console.log('[GET DB] All users summary for leaderboard:', rows);
res.json(rows);
} catch (error) {
console.error('[GET DB] Error fetching all users summary:', error);
res.status(500).json({ message: 'Error fetching users summary for leaderboard' });
}
});

const startServer = async () => {
  await db.initializeDatabase(); // Initialize DB before starting the server
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
};

startServer().catch(err => {
  console.error('Failed to start the server:', err);
  process.exit(1);
});
