const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3001;
const DB_PATH = path.join(__dirname, 'database.json');

app.use(cors());
app.use(bodyParser.json());

// Helper function to read the database
const readDatabase = () => {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({}));
  }
  const data = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(data);
};

// Helper function to write to the database
const writeDatabase = (data) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
};

// Get user progress
app.get('/api/progress/:username', (req, res) => {
  const db = readDatabase();
  const { username } = req.params;
  const userProgress = db[username] || { lastReadBook: '', lastReadChapter: 0, lastReadVerse: 0, history: [] };
  console.log(`[GET] Progress for ${username}:`, userProgress);
  res.json(userProgress);
});

// Save user progress
app.post('/api/progress/:username', (req, res) => {
  const db = readDatabase();
  const { username } = req.params;
  // In App.tsx, the whole state is sent, so we extract it from `req.body` directly
  const progress = req.body; 

  db[username] = progress;
  writeDatabase(db);
  console.log(`[POST] Saved progress for ${username}:`, progress);

  res.status(200).json({ message: 'Progress saved successfully.' });
});

// Get all users and their progress
app.get('/api/users/all', (req, res) => {
  const db = readDatabase();
  console.log('[GET] All users data:', db);
  res.json(db);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
