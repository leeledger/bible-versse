const path = require('path');
const fs = require('fs');

// This script no longer connects to the DB, it just generates a SQL script file.

// Use the hierarchical bible data which has full book names as keys
const bibleDataPath = path.join(__dirname, 'bible_hierarchical.json');
const BIBLE_DATA = JSON.parse(fs.readFileSync(bibleDataPath, 'utf8'));

// The order of books is determined by the keys in the hierarchical JSON file
const BIBLE_BOOKS_IN_ORDER = Object.keys(BIBLE_DATA);

const generateUpdateSQL = (userId, bookFullName, chapterNumber) => {
    if (!userId || !bookFullName || !chapterNumber) {
        console.error('Usage: node admin-bulk-update.cjs <userId> "<bookFullName>" <chapterNumber> > output.sql');
        console.error('Example: node admin-bulk-update.cjs 29 "에스겔" 36 > update_user_29.sql');
        process.exit(1);
    }

    const targetBookIndex = BIBLE_BOOKS_IN_ORDER.indexOf(bookFullName);
    if (targetBookIndex === -1) {
        console.error(`Error: Book "${bookFullName}" not found in bible_hierarchical.json. Please check the spelling.`);
        process.exit(1);
    }

    const chaptersToComplete = [];
    for (let i = 0; i <= targetBookIndex; i++) {
        const currentBookName = BIBLE_BOOKS_IN_ORDER[i];
        const chaptersInBook = Object.keys(BIBLE_DATA[currentBookName]).length;
        
        let endChapter = chaptersInBook;
        if (currentBookName === bookFullName) {
            endChapter = parseInt(chapterNumber, 10);
            if (isNaN(endChapter) || endChapter < 1 || endChapter > chaptersInBook) {
                console.error(`Error: Invalid chapter number ${chapterNumber} for ${bookFullName}.`);
                process.exit(1);
            }
        }

        for (let chapter = 1; chapter <= endChapter; chapter++) {
            chaptersToComplete.push({ book: currentBookName, chapter });
        }
    }

    // Generate the SQL script and print it to standard output
    console.log('-- SQL Script to bulk update reading progress');
    console.log(`-- Generated on: ${new Date().toISOString()}`);
    console.log(`-- User ID: ${userId}, Target: ${bookFullName} ${chapterNumber}`);
    console.log('');
    console.log('BEGIN;');
    
    console.log('');
    console.log(`-- Step 1: Clear any previous completed chapters for user ${userId} to ensure a clean slate.`);
    console.log(`DELETE FROM completed_chapters WHERE user_id = ${userId};`);
    
    console.log('');
    console.log(`-- Step 2: Insert all ${chaptersToComplete.length} completed chapters.`);
    for (const item of chaptersToComplete) {
        const safeBookName = item.book.replace(/'/g, "''");
        console.log(`INSERT INTO completed_chapters (user_id, book, chapter, completed_at) VALUES (${userId}, '${safeBookName}', ${item.chapter}, NOW());`);
    }

    console.log('');
    console.log('-- Step 3: Update the main reading_progress tracker to the latest chapter.');
    const lastVerseOfChapter = 35; // Defaulting
    const safeTargetBookName = bookFullName.replace(/'/g, "''");
    console.log(`
INSERT INTO reading_progress (user_id, last_read_book, last_read_chapter, last_read_verse, updated_at)
VALUES (${userId}, '${safeTargetBookName}', ${chapterNumber}, ${lastVerseOfChapter}, NOW())
ON CONFLICT (user_id)
DO UPDATE SET
    last_read_book = EXCLUDED.last_read_book,
    last_read_chapter = EXCLUDED.last_read_chapter,
    last_read_verse = EXCLUDED.last_read_verse,
    updated_at = NOW();
    `);

    console.log('COMMIT;');
    console.log('');
    console.log('-- Script generation complete.');
};

const [,, userId, bookFullName, chapterNumber] = process.argv;
generateUpdateSQL(userId, bookFullName, chapterNumber);