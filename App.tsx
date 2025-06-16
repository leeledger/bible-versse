import React, { useState, useEffect, useMemo } from 'react';
import { progressService } from './services/progressService';
import { BibleVerse, SessionReadingProgress, ReadingState, User, UserProgress, UserSessionRecord } from './types';
import { AVAILABLE_BOOKS, getVersesForSelection, getNextReadingStart, BOOK_ABBREVIATIONS_MAP } from './constants';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import * as authService from './services/authService'; 
import RecognitionDisplay from './components/RecognitionDisplay';
import ProgressBar from './components/ProgressBar';
import AuthForm from './components/AuthForm'; 
import ChapterSelector from './components/ChapterSelector'; 
import Leaderboard from './components/Leaderboard'; 
import { calculateSimilarity } from './utils';
// import { BibleData, BibleBook, BibleChapter } from './types'; // Ensured this is commented out or removed
import rawBibleData from './bible_fixed.json';

// Define the type for the flat Bible data structure from bible_fixed.json
type RawBibleDataType = { [key: string]: string; };

// Make Bible data available globally in this module, cast to our correct local type
const bibleData: RawBibleDataType = rawBibleData as RawBibleDataType;

// Helper to normalize text for matching (simple version)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    // eslint-disable-next-line no-irregular-whitespace
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?　]/g, "") // remove punctuation, including full-width space
    .replace(/\s+/g, ""); // remove all whitespace
};

const FUZZY_MATCH_LOOKBACK_FACTOR = 1.8; 
const FUZZY_MATCH_SIMILARITY_THRESHOLD_DEFAULT = 60; // 기본 유사도 기준 (안드로이드, PC 등)
const FUZZY_MATCH_SIMILARITY_THRESHOLD_IOS = 50; // iOS를 위한 완화된 유사도 기준
const MINIMUM_READ_LENGTH_RATIO_DEFAULT = 0.9; // 기본 길이 비율
const MINIMUM_READ_LENGTH_RATIO_IOS = 0.8; // iOS를 위한 완화된 길이 비율
const ABSOLUTE_READ_DIFFERENCE_THRESHOLD = 5; // Or be within 5 characters of the end

const initialSessionProgress: SessionReadingProgress = {
  totalVersesInSession: 0,
  sessionCompletedVersesCount: 0,
  sessionInitialSkipCount: 0,
};

const App: React.FC = () => {
    const isIOS = useMemo(() => /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream, []);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userOverallProgress, setUserOverallProgress] = useState<UserProgress | null>(null);
  
  const [sessionTargetVerses, setSessionTargetVerses] = useState<BibleVerse[]>([]); // Verses for the current reading session
  const [currentVerseIndexInSession, setCurrentVerseIndexInSession] = useState(0); // Index within sessionTargetVerses
  
  const [transcriptBuffer, setTranscriptBuffer] = useState('');
  const [matchedVersesContentForSession, setMatchedVersesContentForSession] = useState<string>(''); // Accumulated for current session display
  const [isRetryingVerse, setIsRetryingVerse] = useState(false);
  const [readingState, setReadingState] = useState<ReadingState>(ReadingState.IDLE);
  
  const [sessionProgress, setSessionProgress] = useState<SessionReadingProgress>(initialSessionProgress);

  const [sessionCertificationMessage, setSessionCertificationMessage] = useState<string>('');
  const [appError, setAppError] = useState<string | null>(null);

  const [overallCompletedChaptersCount, setOverallCompletedChaptersCount] = useState(0);
  const [totalBibleChapters, setTotalBibleChapters] = useState(0);

  // State for ChapterSelector default values, dynamically updated by user progress
  const [selectedBookForSelector, setSelectedBookForSelector] = useState<string>(AVAILABLE_BOOKS[0]?.name || '');
  const [startChapterForSelector, setStartChapterForSelector] = useState<number>(1);
  const [endChapterForSelector, setEndChapterForSelector] = useState<number>(1);
  const [startVerseForSelector, setStartVerseForSelector] = useState<number>(1);

  const { 
    isListening, 
    transcript: sttTranscript, 
    error: sttError, 
    startListening, 
    stopListening, 
    browserSupportsSpeechRecognition,
    resetTranscript 
  } = useSpeechRecognition({ lang: 'ko-KR' });

  // Overall Bible Progress Effect (for initialization and total chapters)
  useEffect(() => {
    console.log('[Overall Progress Effect] currentUser:', currentUser);
    const fetchOverallProgress = async () => {
      if (currentUser && currentUser.username) {
        console.log('[Overall Progress Effect] Fetching chapters for username:', currentUser.username);
        setTotalBibleChapters(progressService.getTotalChaptersInScope());
        try {
          const completedChapters = await progressService.getCompletedChapters(currentUser.username);
          setOverallCompletedChaptersCount(completedChapters.length);
        } catch (error) {
          console.error('Error fetching overall completed chapters:', error);
          setOverallCompletedChaptersCount(0);
        }
      } else {
        console.log('[Overall Progress Effect] No currentUser or username, resetting counts.');
        setOverallCompletedChaptersCount(0);
        setTotalBibleChapters(0);
      }
    };
    fetchOverallProgress();
  }, [currentUser]);

  // Effect to handle retrying a verse after STT has fully stopped
  useEffect(() => {
    if (isRetryingVerse && !isListening) {
      startListening();
      setIsRetryingVerse(false);
    }
  }, [isRetryingVerse, isListening, startListening]);

  // Authentication Effect
  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      const loadProgress = async () => {
        const progress = await progressService.loadUserProgress(user.username);
        setUserOverallProgress(progress);
        setReadingState(ReadingState.IDLE); // Go to chapter selection after login
      };
      loadProgress();
    }
  }, []);

  // Effect to set default chapter selection based on user progress for "continue reading"
  useEffect(() => {
    if (currentUser) {
      const nextRead = getNextReadingStart(userOverallProgress && userOverallProgress.lastReadBook ? { book: userOverallProgress.lastReadBook, chapter: userOverallProgress.lastReadChapter, verse: userOverallProgress.lastReadVerse } : null);
      if (nextRead) {
        setSelectedBookForSelector(nextRead.book);
        setStartChapterForSelector(nextRead.chapter);
        setEndChapterForSelector(nextRead.chapter); // For "continue reading", start and end chapter are the same
        setStartVerseForSelector(nextRead.verse);
      } else {
        // End of Bible or AVAILABLE_BOOKS might be initially empty, default to first book/chapter
        const firstBook = AVAILABLE_BOOKS[0];
        if (firstBook) {
          setSelectedBookForSelector(firstBook.name);
          setStartChapterForSelector(1);
          setEndChapterForSelector(1);
          setStartVerseForSelector(1);
        }
      }
    } else {
      // No user logged in, default to Genesis 1 or first available book
      const firstBook = AVAILABLE_BOOKS[0];
      if (firstBook) {
        setSelectedBookForSelector(firstBook.name);
        setStartChapterForSelector(1);
        setEndChapterForSelector(1);
        setStartVerseForSelector(1);
      }
    }
  }, [userOverallProgress, currentUser]);

  const handleAuth = async (username: string) => {
    const user = authService.loginUser(username);
    if (user) {
      setCurrentUser(user);
      const progress = await progressService.loadUserProgress(user.username);
      setUserOverallProgress(progress);
      setAppError(null);
      setReadingState(ReadingState.IDLE); 
    } else {
      setAppError("로그인/등록에 실패했습니다.");
    }
  };

  const handleLogout = () => {
    if (readingState === ReadingState.LISTENING) {
      handleStopReadingAndSave();
    }
    
    authService.logoutUser();
    setCurrentUser(null);
    setUserOverallProgress(null);
    setReadingState(ReadingState.IDLE);
    setSessionTargetVerses([]);
    setCurrentVerseIndexInSession(0);
    setMatchedVersesContentForSession('');
    setSessionProgress(initialSessionProgress);
    setSessionCertificationMessage('');
  };

  const currentTargetVerseForSession = useMemo(() => {
    if (currentVerseIndexInSession < sessionTargetVerses.length) {
      return sessionTargetVerses[currentVerseIndexInSession];
    }
    return null;
  }, [currentVerseIndexInSession, sessionTargetVerses]);

  useEffect(() => {
    // Always update transcriptBuffer with the latest sttTranscript,
    // including when sttTranscript becomes empty after a reset.
    setTranscriptBuffer(sttTranscript);
  }, [sttTranscript]);
  
  useEffect(() => {
    if (!currentTargetVerseForSession || transcriptBuffer.length === 0 || readingState !== ReadingState.LISTENING) {
      return;
    }

    const similarityThreshold = isIOS ? FUZZY_MATCH_SIMILARITY_THRESHOLD_IOS : FUZZY_MATCH_SIMILARITY_THRESHOLD_DEFAULT;
    const minLengthRatio = isIOS ? MINIMUM_READ_LENGTH_RATIO_IOS : MINIMUM_READ_LENGTH_RATIO_DEFAULT;

    const normalizedTargetVerseText = normalizeText(currentTargetVerseForSession.text);
    const normalizedBuffer = normalizeText(transcriptBuffer);

    if (normalizedTargetVerseText.length === 0) return;

    const lookbackWindowSize = Math.floor(normalizedTargetVerseText.length * FUZZY_MATCH_LOOKBACK_FACTOR);
    const bufferPortionToCompare = normalizedBuffer.substring(
      Math.max(0, normalizedBuffer.length - lookbackWindowSize)
    );

    const similarity = calculateSimilarity(normalizedTargetVerseText, bufferPortionToCompare);

    // 매칭 성공 시에만 다음 절로 진행
    const isLengthSufficientByRatio = bufferPortionToCompare.length >= normalizedTargetVerseText.length * minLengthRatio;
    const isLengthSufficientByAbsoluteDiff = (normalizedTargetVerseText.length - bufferPortionToCompare.length) <= ABSOLUTE_READ_DIFFERENCE_THRESHOLD && bufferPortionToCompare.length > 0;

    console.log(`[App.tsx] Matching Details - Platform: ${isIOS ? 'iOS' : 'Other'}, Similarity: ${similarity} (Threshold: ${similarityThreshold}), LengthRatioSufficient: ${isLengthSufficientByRatio}, LengthAbsoluteSufficient: ${isLengthSufficientByAbsoluteDiff}`);
    console.log(`[App.tsx] Comparing Buffer: "${bufferPortionToCompare}" with Target: "${normalizedTargetVerseText}"`);
    if (similarity >= similarityThreshold && (isLengthSufficientByRatio || isLengthSufficientByAbsoluteDiff)) {
      console.log(`[App.tsx] Verse matched! Index: ${currentVerseIndexInSession}, Target length: ${sessionTargetVerses.length}`);
      setMatchedVersesContentForSession(prev => prev + `${currentTargetVerseForSession.book} ${currentTargetVerseForSession.chapter}:${currentTargetVerseForSession.verse} - ${currentTargetVerseForSession.text}\n`);
      
      const newTotalCompletedInSelection = currentVerseIndexInSession + 1; // Count from start of selection array
      
      let fullyCompletedChaptersInSession = 0;
      const chaptersEncountered = new Set<string>();
      for(let i = 0; i < newTotalCompletedInSelection; i++) {
        const verse = sessionTargetVerses[i];
        const chapterKey = `${verse.book}-${verse.chapter}`;
        chaptersEncountered.add(chapterKey);
      }
      setSessionProgress(prev => ({
        ...prev,
        sessionCompletedVersesCount: newTotalCompletedInSelection,
      }));

      // We check against the current index. If it's the last one, the session is complete.
      if (currentVerseIndexInSession >= sessionTargetVerses.length - 1) { 
        setReadingState(ReadingState.SESSION_COMPLETED);
        stopListening();
        resetTranscript(); 
        setTranscriptBuffer(''); 

        const firstVerseActuallyReadInSession = sessionTargetVerses[sessionProgress.sessionInitialSkipCount] || sessionTargetVerses[0];
        const lastVerseOfSession = sessionTargetVerses[sessionTargetVerses.length - 1];
        const versesReadCountThisSession = sessionTargetVerses.length - sessionProgress.sessionInitialSkipCount;

        const certMsg = `${firstVerseActuallyReadInSession.book} ${firstVerseActuallyReadInSession.chapter}장 ${firstVerseActuallyReadInSession.verse}절 ~ ${lastVerseOfSession.book} ${lastVerseOfSession.chapter}장 ${lastVerseOfSession.verse}절 (총 ${versesReadCountThisSession}절) 읽기 완료!`;
        setSessionCertificationMessage(certMsg);
        setAppError(null);
        
        if (currentUser && versesReadCountThisSession > 0) {
            const historyEntry: UserSessionRecord = {
                date: new Date().toISOString(),
                book: firstVerseActuallyReadInSession.book,
                startChapter: firstVerseActuallyReadInSession.chapter,
                startVerse: firstVerseActuallyReadInSession.verse,
                endChapter: lastVerseOfSession.chapter,
                endVerse: lastVerseOfSession.verse,
                versesRead: versesReadCountThisSession
            };
            const newOverallProgress: UserProgress = {
                lastReadBook: lastVerseOfSession.book,
                lastReadChapter: lastVerseOfSession.chapter,
                lastReadVerse: lastVerseOfSession.verse,
                history: userOverallProgress?.history ? [...userOverallProgress.history, historyEntry] : [historyEntry]
            };
            // Calculate newly completed chapters from this session
            const actuallyReadVersesInSession = sessionTargetVerses.slice(sessionProgress.sessionInitialSkipCount);
            const uniqueChaptersTargeted = [...new Set(actuallyReadVersesInSession.map(v => `${v.book}:${v.chapter}`))];
            
            const chaptersToMarkAsComplete = uniqueChaptersTargeted.filter(chapterKey => {
                const [book, chapterStr] = chapterKey.split(':');
                const chapter = parseInt(chapterStr, 10);

                // All verses for this chapter that were part of the session target
                const versesForThisChapterInTarget = sessionTargetVerses.filter(v => v.book === book && v.chapter === chapter);

                // Check if every single one of them was read in this session
                return versesForThisChapterInTarget.length > 0 && versesForThisChapterInTarget.every(targetVerse => 
                    actuallyReadVersesInSession.some(readVerse => 
                        readVerse.book === targetVerse.book && 
                        readVerse.chapter === targetVerse.chapter &&
                        readVerse.verse === targetVerse.verse
                    )
                );
            });
            
            // Merge with existing completed chapters
            const existingCompletedSet = new Set(userOverallProgress?.completedChapters || []);
            chaptersToMarkAsComplete.forEach(chKey => existingCompletedSet.add(chKey));
            const updatedCompletedChapters = Array.from(existingCompletedSet);

            const updatedUserProgress: UserProgress = {
              ...newOverallProgress, // This already has lastRead and history updated
              completedChapters: updatedCompletedChapters,
            };

            console.log('[App.tsx] Preparing to save user progress. Full data:', JSON.stringify(updatedUserProgress, null, 2));
            progressService.saveUserProgress(currentUser.username, updatedUserProgress)
              .then(() => {
                console.log('[App.tsx] Successfully saved updated user progress.');
                setUserOverallProgress(updatedUserProgress);
                setOverallCompletedChaptersCount(updatedUserProgress.completedChapters?.length || 0);
              })
              .catch(error => {
                console.error('[App.tsx] Error saving updated user progress:', error);
              });
        } // This closes: if (currentUser && versesReadCountThisSession > 0)
      } else { // This is the 'else' for: if (newTotalCompletedInSelection >= sessionTargetVerses.length)
         setCurrentVerseIndexInSession(prevIdx => prevIdx + 1); // 다음 절로 이동

         setTranscriptBuffer(''); // Clear buffer for next verse
         resetTranscript(); // Reset STT for next verse
      }
    }
    // 매칭 실패 시 인덱스 증가/세션 종료 없음
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcriptBuffer, readingState, currentTargetVerseForSession, currentUser, sessionTargetVerses, userOverallProgress, isIOS]);



  useEffect(() => {
    if (sttError) {
      setAppError(`음성인식 오류: ${sttError}`);
      // Consider stopping listening here or letting the user retry.
      // stopListening(); // Potentially stop if error is critical
    }
  }, [sttError]);

  useEffect(() => {
    if (readingState === ReadingState.LISTENING && browserSupportsSpeechRecognition) {
      startListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingState]);

  const handleSelectChaptersAndStartReading = (book: string, startCh: number, endCh: number) => {
    const verses = getVersesForSelection(book, startCh, endCh);
    if (verses.length > 0) {
      let initialSkip = 0;
      // Check if this is a "continue reading" session for the recommended chapter
      if (
        book === selectedBookForSelector &&
        startCh === startChapterForSelector &&
        endCh === startChapterForSelector && // Continue reading is always a single chapter
        startVerseForSelector > 1
      ) {
        // Find the index of the first verse to read.
        // The verse number is 1-based, array index is 0-based.
        const firstVerseIndex = verses.findIndex(v => v.verse === startVerseForSelector);
        if (firstVerseIndex !== -1) {
          initialSkip = firstVerseIndex;
        }
      }

      // Reset session-related states before starting
      setSessionTargetVerses(verses);
      setReadingState(ReadingState.READING);
      setCurrentVerseIndexInSession(initialSkip); // Start from the correct verse
      setMatchedVersesContentForSession('');
      setTranscriptBuffer('');
      resetTranscript();
      setSessionProgress({
        totalVersesInSession: verses.length,
        sessionCompletedVersesCount: initialSkip, // Pre-mark skipped verses as "completed" for progress bar
        sessionInitialSkipCount: initialSkip,
      });
      setSessionCertificationMessage(""); // Clear previous certification message
      setAppError(null); // Clear previous errors
    } else {
      setAppError('선택한 범위에 대한 성경 데이터를 찾을 수 없습니다.');
    }
  };

  const handleStopReadingAndSave = () => {
    stopListening(); 
    
    // sessionProgress.sessionCompletedVersesCount is the total count of verses "done" from start of sessionTargetVerses
    // sessionProgress.sessionInitialSkipCount is how many were skipped at the start
    const versesActuallyReadThisSessionCount = sessionProgress.sessionCompletedVersesCount - sessionProgress.sessionInitialSkipCount;
    
    let firstEffectivelyReadVerse: BibleVerse | null = null;
    if (versesActuallyReadThisSessionCount > 0 && sessionTargetVerses.length > sessionProgress.sessionInitialSkipCount) {
        firstEffectivelyReadVerse = sessionTargetVerses[sessionProgress.sessionInitialSkipCount];
    }
    
    let lastEffectivelyReadVerse: BibleVerse | null = null;
    if (versesActuallyReadThisSessionCount > 0 && sessionProgress.sessionCompletedVersesCount > 0) {
        lastEffectivelyReadVerse = sessionTargetVerses[sessionProgress.sessionCompletedVersesCount - 1];
    }


    if (currentUser && lastEffectivelyReadVerse && firstEffectivelyReadVerse && versesActuallyReadThisSessionCount > 0) {
      const certMsg = `${firstEffectivelyReadVerse.book} ${firstEffectivelyReadVerse.chapter}장 ${firstEffectivelyReadVerse.verse}절 ~ ${lastEffectivelyReadVerse.book} ${lastEffectivelyReadVerse.chapter}장 ${lastEffectivelyReadVerse.verse}절 (총 ${versesActuallyReadThisSessionCount}절) 읽음 (세션 중지).`;
      setSessionCertificationMessage(certMsg);

      const historyEntry: UserSessionRecord = {
          date: new Date().toISOString(),
          book: firstEffectivelyReadVerse.book,
          startChapter: firstEffectivelyReadVerse.chapter,
          startVerse: firstEffectivelyReadVerse.verse,
          endChapter: lastEffectivelyReadVerse.chapter,
          endVerse: lastEffectivelyReadVerse.verse,
          versesRead: versesActuallyReadThisSessionCount
      };
      const newCompletedChaptersInSession = new Set<string>(userOverallProgress?.completedChapters || []);

    // Determine newly completed chapters in this session
    const versesReadInSession = sessionTargetVerses.slice(
      sessionProgress.sessionInitialSkipCount,
      sessionProgress.sessionCompletedVersesCount
    );

    const chaptersTouchedInSession: { [key: string]: { count: number, book: string, chapterNum: number } } = {};

    for (const verse of versesReadInSession) {
      const chapterKey = `${verse.book}:${verse.chapter}`;
      if (!chaptersTouchedInSession[chapterKey]) {
        chaptersTouchedInSession[chapterKey] = { count: 0, book: verse.book, chapterNum: verse.chapter };
      }
      chaptersTouchedInSession[chapterKey].count++;
    }

    for (const chapterKeyFromSession in chaptersTouchedInSession) {
      const { book, chapterNum } = chaptersTouchedInSession[chapterKeyFromSession];

      // Find the abbreviation for the book, which is used as the key in bibleData
      const bookAbbr = Object.keys(BOOK_ABBREVIATIONS_MAP).find(key => BOOK_ABBREVIATIONS_MAP[key] === book);

      if (!bookAbbr) {
        console.error(`Could not find abbreviation for book: ${book}`);
        continue; // Skip to the next chapter if no abbreviation found
      }

      // Get all canonical verses for this chapter from the flat bibleData
      const canonicalVersesForChapter: BibleVerse[] = [];
      for (const bibleKey in bibleData) {
        const parts = bibleKey.match(/^(\D+)(\d+):(\d+)$/); // e.g., "창1:1" -> "창", "1", "1"
        if (parts && parts[1] === bookAbbr && parseInt(parts[2], 10) === chapterNum) {
          canonicalVersesForChapter.push({
            book: book, // Use the original full book name for matching against sessionTargetVerses
            chapter: parseInt(parts[2], 10),
            verse: parseInt(parts[3], 10),
            text: bibleData[bibleKey]
          });
        }
      }

      if (canonicalVersesForChapter.length > 0) {
        // Check if all canonical verses of this chapter were part of the session's target and were read/skipped.
        let allCanonicalChapterVersesReadOrSkipped = true;
        for (const canonicalVerse of canonicalVersesForChapter) {
          const indexInSessionTarget = sessionTargetVerses.findIndex(
            sv => sv.book === canonicalVerse.book && 
                  sv.chapter === canonicalVerse.chapter && 
                  sv.verse === canonicalVerse.verse
          );

          if (indexInSessionTarget === -1) {
            // A canonical verse of this chapter was not even targeted in the session.
            allCanonicalChapterVersesReadOrSkipped = false;
            break;
          }

          // Check if this targeted verse (at indexInSessionTarget) was covered by the session's progress.
          if (indexInSessionTarget >= sessionProgress.sessionCompletedVersesCount) {
            allCanonicalChapterVersesReadOrSkipped = false;
            break;
          }
        }

        if (allCanonicalChapterVersesReadOrSkipped) {
          newCompletedChaptersInSession.add(chapterKeyFromSession); // Use the original chapterKey e.g. "BookName:ChapterNum"
        }
      }
    }

    const newOverallProgress: UserProgress = {
        lastReadBook: lastEffectivelyReadVerse.book,
        lastReadChapter: lastEffectivelyReadVerse.chapter,
        lastReadVerse: lastEffectivelyReadVerse.verse,
        history: userOverallProgress?.history ? [...userOverallProgress.history, historyEntry] : [historyEntry],
        completedChapters: Array.from(newCompletedChaptersInSession)
    };
    progressService.saveUserProgress(currentUser.username, newOverallProgress);
    setUserOverallProgress(newOverallProgress);
      
    } else if (versesActuallyReadThisSessionCount <=0) {
         setSessionCertificationMessage("이번 세션에서 읽은 구절이 없습니다.");
    } else {
        setSessionCertificationMessage("사용자 정보 오류 또는 읽은 구절 기록 오류.");
    }
    
    setReadingState(ReadingState.IDLE); 
    // Do not reset transcriptBuffer or matchedVersesContentForSession here
    // so user can see what they read before session was stopped, if they go back.
    // It will be cleared when a new session starts.
  };

  const handleRetryVerse = () => {
    // The hook now handles the complexities. We just need to signal the intent.
    setReadingState(ReadingState.LISTENING);
    setMatchedVersesContentForSession(''); // Clear visual feedback in the app
    setTranscriptBuffer(''); // Clear app-level buffer
    setAppError(null);

    resetTranscript(); // STT 훅 내부의 이전 기록 초기화
    stopListening();
    setIsRetryingVerse(true);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 py-8 px-4 flex flex-col items-center justify-center">
        <header className="mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-indigo-700">포도나무교회 | 성경읽기 챌린지</h1>
        </header>
        <AuthForm onAuth={handleAuth} title="로그인 또는 사용자 등록" />
        {appError && <p className="mt-4 text-red-500">{appError}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-50 to-purple-100 py-8 px-4 flex flex-col items-center">
      <div className="w-full max-w-3xl bg-white shadow-xl rounded-lg p-6 md:p-8">
        <header className="mb-6 flex flex-col items-center sm:flex-row sm:justify-between sm:items-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-indigo-700 break-keep mb-2 sm:mb-0 text-center sm:text-left">성경읽기 챌린지</h1>
          <div className="text-sm sm:text-right">
            <p className="text-sm text-gray-600">환영합니다, {currentUser.username}님!</p>
            <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white text-xs font-semibold py-1 px-3 rounded-md shadow transition duration-150 ease-in-out">로그아웃</button>
          </div>
        </header>

        {userOverallProgress && (userOverallProgress.lastReadChapter > 0 || userOverallProgress.lastReadVerse > 0) && readingState === ReadingState.IDLE && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                마지막 읽은 곳: {userOverallProgress.lastReadBook} {userOverallProgress.lastReadChapter}장 {userOverallProgress.lastReadVerse}절.
                <span className="italic ml-2">(아래에서 이어서 읽거나 새로운 범위를 선택하여 읽으세요.)</span>
            </div>
        )}

        {(appError && (readingState === ReadingState.ERROR || readingState === ReadingState.IDLE || readingState === ReadingState.SESSION_COMPLETED || readingState === ReadingState.LISTENING)) && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
            <p className="font-semibold">오류 발생:</p>
            <p>{appError}</p>
          </div>
        )}
        
        {!browserSupportsSpeechRecognition && (
             <div className="mb-4 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md">
                <p className="font-semibold">음성 인식 미지원:</p>
                <p>현재 사용 중인 브라우저에서는 음성 인식 기능을 지원하지 않습니다. Chrome, Edge, Safari 최신 버전을 사용해 주세요.</p>
            </div>
        )}

{readingState === ReadingState.IDLE && (
          <>
            {/* Overall Bible Progress Display */}
            {currentUser && totalBibleChapters > 0 && (
              <div className="my-4 p-4 bg-sky-50 border border-sky-200 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-sky-700 mb-2">성경 전체 완독 진행률</h3>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-sky-500 h-4 rounded-full transition-all duration-300 ease-out relative"
                    style={{ width: `${totalBibleChapters > 0 ? (overallCompletedChaptersCount / totalBibleChapters) * 100 : 0}%` }}
                  >
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                      {totalBibleChapters > 0 ? ((overallCompletedChaptersCount / totalBibleChapters) * 100).toFixed(1) : '0.0'}%
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-1.5 text-right">
                  {overallCompletedChaptersCount} / {totalBibleChapters} 장 완독
                </p>
              </div>
            )}

            {/* Continue Reading Section */}
            <div className="my-4 p-4 bg-blue-50 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-blue-700">이어 읽기</h3>
              {userOverallProgress && userOverallProgress.lastReadBook ? (
                <p className="text-sm text-gray-600">
                  마지막 읽은 곳: {userOverallProgress.lastReadBook} {userOverallProgress.lastReadChapter}장 {userOverallProgress.lastReadVerse}절.
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  아직 읽기 기록이 없습니다. 아래에서 시작할 부분을 선택하세요.
                </p>
              )}
              {userOverallProgress && userOverallProgress.lastReadBook && selectedBookForSelector && (
                <p className="text-sm text-gray-500 mt-1">
                  추천 시작: {selectedBookForSelector} {startChapterForSelector}장 {startVerseForSelector}절. (아래에서 변경 가능)
                </p>
              )}
            </div>

            <ChapterSelector
              onStartReading={handleSelectChaptersAndStartReading}
              defaultBook={selectedBookForSelector}
              initialSelection={{ book: selectedBookForSelector, chapter: startChapterForSelector }}
              completedChapters={userOverallProgress?.completedChapters}
            />
            <Leaderboard key={userOverallProgress ? `lb-${userOverallProgress.lastReadBook}-${userOverallProgress.lastReadChapter}-${userOverallProgress.lastReadVerse}` : 'lb-no-progress'} />
          </>
        )}

        {readingState === ReadingState.READING && sessionTargetVerses.length > 0 && (
          <>
            <div className="my-6">
              <h2 className="text-xl font-bold mb-2">선택한 범위의 성경 본문</h2>
              <div className="bg-gray-50 border rounded-md p-4 max-h-96 overflow-y-auto">
                {sessionTargetVerses.map((v) => (
                  <div key={`${v.book}-${v.chapter}-${v.verse}`} className="py-1 border-b last:border-b-0">
                    <span className="font-semibold">{v.book} {v.chapter}:{v.verse}</span> <span>{v.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-4 mt-4">
              <button
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition"
                onClick={() => setReadingState(ReadingState.LISTENING)}
              >
                음성 인식 시작
              </button>
            </div>
          </>
        )}

        {(readingState === ReadingState.LISTENING || readingState === ReadingState.SESSION_COMPLETED) && sessionTargetVerses.length > 0 && (
          <>
            <ProgressBar progress={sessionProgress} />
            <RecognitionDisplay 
              currentVerseToRead={currentTargetVerseForSession}
              liveTranscript={sttTranscript} 
              matchedVersesText={matchedVersesContentForSession}
              readingTarget={currentTargetVerseForSession ? `${currentTargetVerseForSession.book} ${currentTargetVerseForSession.chapter}장 ${currentTargetVerseForSession.verse}절` : "읽기 목표 없음"}
            />
            {readingState === ReadingState.LISTENING && (
              <>
                <div className="flex gap-4 mt-4">
                  <button
                    className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition"
                    onClick={handleStopReadingAndSave}
                  >
                    중지
                  </button>
                  <button
                    className="px-6 py-2 bg-yellow-500 text-white rounded-lg font-bold hover:bg-yellow-600 transition"
                    onClick={handleRetryVerse}
                  >
                    다시 읽기
                  </button>
                </div>
                <p className="mt-3 text-xs text-center text-gray-600">※ 읽기를 마치면 '중지' 버튼을 눌러야 진행 상황이 저장됩니다.</p>
              </>
            )}
            {readingState === ReadingState.SESSION_COMPLETED && (
              <div className="text-center p-6 bg-green-50 border-2 border-green-500 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-green-700 mb-3">이번 세션 읽기 완료!</h2>
                <p className="text-lg text-gray-700 mb-4 whitespace-pre-wrap">{sessionCertificationMessage}</p>
                <button 
                  onClick={() => {
                      setReadingState(ReadingState.IDLE);
                  }}
                  className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg shadow transition duration-150 ease-in-out"
                >
                  다른 범위 읽기 또는 랭킹 보기
                </button>
              </div>
            )}
          </>
        )}
        
        <footer className="mt-12 pt-6 border-t border-gray-300 text-center text-sm text-gray-500">
            {new Date().getFullYear()} Bible Reading Companion | <span className="font-semibold">포도나무교회</span><br />
            <span>음성 인식 정확도를 위해 조용한 곳을 권장합니다.</span>
        </footer>
      </div>
    </div>
  );
};

export default App;
