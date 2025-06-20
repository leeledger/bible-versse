import React, { useState, useEffect, useMemo } from 'react';
import { progressService } from './services/progressService';
import { BibleVerse, SessionReadingProgress, ReadingState, User, UserProgress, UserSessionRecord } from './types';
import { AVAILABLE_BOOKS, getVersesForSelection, getNextReadingStart, BOOK_ABBREVIATIONS_MAP, TOTAL_CHAPTERS_IN_BIBLE } from './constants';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import * as authService from './services/authService'; 
import RecognitionDisplay from './components/RecognitionDisplay';
import ProgressBar from './components/ProgressBar';
import AuthForm from './components/AuthForm'; 
import ChapterSelector from './components/ChapterSelector'; 
import Leaderboard from './components/Leaderboard';
import BibleProgressOverview from './components/BibleProgressOverview'; 
import BookCompletionStatus from './components/BookCompletionStatus'; // Added import
import HallOfFame from './components/HallOfFame';
import { calculateSimilarity, containsDifficultWord } from './utils';
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

const FUZZY_MATCH_LOOKBACK_FACTOR = 1.3; // 1.8에서 하향 조정. 이전 절 텍스트가 비교에 포함되는 것을 방지 
const FUZZY_MATCH_SIMILARITY_THRESHOLD_DEFAULT = 60; // 기본값
const FUZZY_MATCH_SIMILARITY_THRESHOLD_DIFFICULT = 50; // 어려운 단어 포함시
const MINIMUM_READ_LENGTH_RATIO = 0.9; // 항상 동일하게 적용
const ABSOLUTE_READ_DIFFERENCE_THRESHOLD = 5; // Or be within 5 characters of the end

const initialSessionProgress: SessionReadingProgress = {
  totalVersesInSession: 0,
  sessionCompletedVersesCount: 0,
  sessionInitialSkipCount: 0,
};

type ViewState = 'IDLE_SETUP' | 'LEADERBOARD';

const App: React.FC = () => {
  const [showHallOfFame, setShowHallOfFame] = useState(false);
  const [isRestartingForNextVerseOnIOS, setIsRestartingForNextVerseOnIOS] = useState(false);
  const [bibleResetLoading, setBibleResetLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userOverallProgress, setUserOverallProgress] = useState<UserProgress | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('IDLE_SETUP');
  
  const [sessionTargetVerses, setSessionTargetVerses] = useState<BibleVerse[]>([]); // Verses for the current reading session
  const [currentVerseIndexInSession, setCurrentVerseIndexInSession] = useState(0); // Index within sessionTargetVerses
  
  const [transcriptBuffer, setTranscriptBuffer] = useState('');
  const [matchedVersesContentForSession, setMatchedVersesContentForSession] = useState<string>(''); // Accumulated for current session display
  const [isRetryingVerse, setIsRetryingVerse] = useState(false);
  const [readingState, setReadingState] = useState<ReadingState>(ReadingState.IDLE);

  // Prevent pull-to-refresh on mobile during speech recognition
  useEffect(() => {
    let startY = 0;
    let maybePrevent = false;
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0 && e.touches.length === 1) {
        startY = e.touches[0].clientY;
        maybePrevent = true;
      } else {
        maybePrevent = false;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!maybePrevent) return;
      const currentY = e.touches[0].clientY;
      if (currentY - startY > 5) {
        // User is pulling down from the top
        e.preventDefault();
      }
    };
    if (readingState === ReadingState.LISTENING) {
      document.addEventListener('touchstart', onTouchStart, { passive: false });
      document.addEventListener('touchmove', onTouchMove, { passive: false });
    }
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, [readingState]);
  
  const [sessionProgress, setSessionProgress] = useState<SessionReadingProgress>(initialSessionProgress);

  const [sessionCertificationMessage, setSessionCertificationMessage] = useState<string>('');
  const [appError, setAppError] = useState<string | null>(null);
  const [showPasswordChangePrompt, setShowPasswordChangePrompt] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);

  const [overallCompletedChaptersCount, setOverallCompletedChaptersCount] = useState(0);
  const [totalBibleChapters, setTotalBibleChapters] = useState(0);

  // State for ChapterSelector default values, dynamically updated by user progress
  const [selectedBookForSelector, setSelectedBookForSelector] = useState<string>(AVAILABLE_BOOKS[0]?.name || '');
  const [startChapterForSelector, setStartChapterForSelector] = useState<number>(1);
  const [endChapterForSelector, setEndChapterForSelector] = useState<number>(1);
  const [startVerseForSelector, setStartVerseForSelector] = useState<number>(1);
  const [showBookCompletionStatus, setShowBookCompletionStatus] = useState(false);

  // iOS 기기 감지
  const isIOS = useMemo(() => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  }, []);

  const { 
    isListening, 
    transcript: sttTranscript, 
    error: sttError, 
    startListening, 
    stopListening, 
    browserSupportsSpeechRecognition,
    resetTranscript 
  } = useSpeechRecognition({ lang: 'ko-KR' });

  // Overall Bible Progress Effect (for initialization, total chapters, and FULL user progress)
  useEffect(() => {
    console.log('[Overall Progress Effect - Revised] Triggered. currentUser:', currentUser ? currentUser.username : 'null');
    
    const fetchAndSetFullProgress = async () => {
      if (currentUser && currentUser.username) {
        console.log('[Overall Progress Effect - Revised] User found. Fetching full progress for:', currentUser.username);
        setTotalBibleChapters(TOTAL_CHAPTERS_IN_BIBLE); // Using imported constant
        try {
          const progressData = await progressService.loadUserProgress(currentUser.username);
          console.log(`[Overall Progress Effect - Revised] Fetched progressData. Raw: ${JSON.stringify(progressData)}. Completed chapters count: ${progressData?.completedChapters?.length ?? 'N/A'}`);
          setUserOverallProgress(progressData);
          console.log('[Overall Progress Effect - Revised] setUserOverallProgress CALLED. Data passed:', progressData ? 'object' : String(progressData));
          setOverallCompletedChaptersCount(progressData?.completedChapters?.length || 0);
        } catch (error) {
          console.error('[Overall Progress Effect - Revised] Error fetching full user progress:', error);
          setUserOverallProgress(null);
          setOverallCompletedChaptersCount(0);
        }
      } else {
        console.log('[Overall Progress Effect - Revised] No currentUser, resetting progress states.');
        setUserOverallProgress(null);
        setOverallCompletedChaptersCount(0);
        setTotalBibleChapters(0); 
      }
    };

    fetchAndSetFullProgress();

    // Handle password change prompt visibility
    if (currentUser && currentUser.must_change_password) {
      setShowPasswordChangePrompt(true);
    } else {
      setShowPasswordChangePrompt(false);
    }
  }, [currentUser]);

  // Effect to handle retrying a verse after STT has fully stopped
  useEffect(() => {
    if (isRetryingVerse && !isListening) {
      startListening();
      setIsRetryingVerse(false);
    }
  }, [isRetryingVerse, isListening, startListening]);

  // Authentication Effect (runs once on mount)
  useEffect(() => {
    console.log('[AuthEffect - Revised] Running on mount.');
    const user = authService.getCurrentUser();
    if (user) {
      console.log('[AuthEffect - Revised] User found in authService. Setting currentUser:', user.username);
      setCurrentUser(user);
      // The useEffect dependent on 'currentUser' (Overall Progress Effect - Revised) 
      // will now handle loading the progress.
    } else {
      console.log('[AuthEffect - Revised] No user found in authService on mount.');
    }
  }, []); // Empty dependency array - runs once on mount

  // Effect to set default values for ChapterSelector based on user progress
  useEffect(() => {
    console.log('[ChapterSelectorDefaultsEffect] Triggered. currentUser:', currentUser ? currentUser.username : 'null', 'userOverallProgress:', userOverallProgress ? 'exists' : 'null');
    if (currentUser && userOverallProgress) {
      const lastReadInfo = userOverallProgress && userOverallProgress.lastReadBook && userOverallProgress.lastReadChapter && userOverallProgress.lastReadVerse
        ? { book: userOverallProgress.lastReadBook, chapter: userOverallProgress.lastReadChapter, verse: userOverallProgress.lastReadVerse }
        : null;
      const nextRead = getNextReadingStart(lastReadInfo);
      if (nextRead) {
        console.log('[ChapterSelectorDefaultsEffect] User has progress. Next read:', nextRead);
        setSelectedBookForSelector(nextRead.book);
        setStartChapterForSelector(nextRead.chapter);
        setEndChapterForSelector(nextRead.chapter); // For "continue reading", start and end chapter are the same
        setStartVerseForSelector(nextRead.verse);
      } else {
        // End of Bible or no specific next read, default to first book/chapter
        console.log('[ChapterSelectorDefaultsEffect] User has progress, but no specific nextRead. Defaulting.');
        const firstBook = AVAILABLE_BOOKS[0];
        if (firstBook) {
          setSelectedBookForSelector(firstBook.name);
          setStartChapterForSelector(1);
          setEndChapterForSelector(1);
          setStartVerseForSelector(1);
        }
      }
    } else {
      // No user logged in or no progress, default to Genesis 1 or first available book
      console.log('[ChapterSelectorDefaultsEffect] No user or no progress. Defaulting.');
      const firstBook = AVAILABLE_BOOKS[0];
      if (firstBook) {
        setSelectedBookForSelector(firstBook.name);
        setStartChapterForSelector(1);
        setEndChapterForSelector(1);
        setStartVerseForSelector(1);
      }
    }
  }, [userOverallProgress, currentUser]);

  useEffect(() => {
    console.log('[App.tsx userOverallProgress Monitor useEffect] userOverallProgress CHANGED to:', userOverallProgress ? 'set with ' + (userOverallProgress.completedChapters?.length || 0) + ' completed chapters' : 'null', userOverallProgress?.completedChapters ? JSON.stringify(userOverallProgress.completedChapters) : '');
  }, [userOverallProgress]);

  const handleRegister = async (username: string, password_provided: string): Promise<{ success: boolean; message: string; user?: User }> => {
    console.log(`App.tsx handleRegister called for ${username}`);
    const result = await authService.registerUser(username, password_provided);
    if (result.success) {
      // Optionally, you could auto-login the user here or prompt them to login
      setAppError(null); // Clear any previous login errors
    } else {
      setAppError(result.message || "Registration failed from App.tsx");
    }
    return result; // Return the full result object to AuthForm
  };

  const handlePasswordChangeSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordChangeError(''); // Clear previous errors
    setPasswordChangeSuccess('');

    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPassword.length < 4) { // Basic validation, align with backend if different
      setPasswordChangeError('비밀번호는 최소 4자 이상이어야 합니다.');
      return;
    }
    if (newPassword === '1234') {
      setPasswordChangeError('새 비밀번호는 기본 비밀번호와 다르게 설정해야 합니다.');
      return;
    }

    if (!currentUser) {
      setPasswordChangeError('사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
      return;
    }

    if (typeof currentUser.id !== 'number') {
      setPasswordChangeError('사용자 ID가 유효하지 않습니다. 다시 로그인해주세요.');
      return;
    }

    try {
      const result = await authService.changePassword(currentUser.id, newPassword);
      if (result && result.user) {
        setPasswordChangeSuccess('비밀번호가 성공적으로 변경되었습니다! 이제 이 알림은 닫으셔도 됩니다.');
        setCurrentUser({ ...currentUser, ...result.user, must_change_password: false }); // Update user state from backend response
        setShowPasswordChangePrompt(false); // Hide the prompt/form on success
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setPasswordChangeError(result?.message || '비밀번호 변경에 실패했습니다. 서버 응답을 확인해주세요.');
      }
    } catch (error) {
      console.error('Password change failed:', error);
      setPasswordChangeError('비밀번호 변경 중 오류가 발생했습니다. 네트워크 연결 또는 서버 상태를 확인해주세요.');
    }
  };

  const handleAuth = async (username: string, password_provided: string): Promise<boolean> => {
    const user = await authService.loginUser(username, password_provided);
    if (user) {
      setCurrentUser(user);
      setShowPasswordChangePrompt(user.must_change_password === true);
      setAppError(null);
      return true;
    } else {
      setAppError('비밀번호를 확인하세요.');
      return false;
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

    const normalizedTargetVerseText = normalizeText(currentTargetVerseForSession.text);
    const normalizedBuffer = normalizeText(transcriptBuffer);

    if (normalizedTargetVerseText.length === 0) return;

    const lookbackWindowSize = Math.floor(normalizedTargetVerseText.length * FUZZY_MATCH_LOOKBACK_FACTOR);
    const bufferPortionToCompare = normalizedBuffer.substring(
      Math.max(0, normalizedBuffer.length - lookbackWindowSize)
    );

    const similarity = calculateSimilarity(normalizedTargetVerseText, bufferPortionToCompare);

    // 절별 난이도 체크 (어려운 단어 포함시 임계치 완화)
    const isDifficult = containsDifficultWord(currentTargetVerseForSession.text);
    const similarityThreshold = isDifficult ? FUZZY_MATCH_SIMILARITY_THRESHOLD_DIFFICULT : FUZZY_MATCH_SIMILARITY_THRESHOLD_DEFAULT;

    const isLengthSufficientByRatio = bufferPortionToCompare.length >= normalizedTargetVerseText.length * MINIMUM_READ_LENGTH_RATIO;
    const isLengthSufficientByAbsoluteDiff = (normalizedTargetVerseText.length - bufferPortionToCompare.length) <= ABSOLUTE_READ_DIFFERENCE_THRESHOLD && bufferPortionToCompare.length > 0;

    console.log(`[App.tsx] Matching Details - Similarity: ${similarity} (Threshold: ${similarityThreshold}), LengthRatioSufficient: ${isLengthSufficientByRatio}, LengthAbsoluteSufficient: ${isLengthSufficientByAbsoluteDiff}, Difficult: ${isDifficult}`);
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
                
                // 해당 장의 마지막 절을 찾습니다
                const bookInfo = AVAILABLE_BOOKS.find(b => b.name === book);
                if (!bookInfo) return false;
                
                // 해당 장의 마지막 절 번호를 가져옵니다
                const lastVerseNumber = bookInfo.versesPerChapter[chapter - 1] || 0;
                
                // 이 세션에서 읽은 절들 중에 해당 장의 마지막 절이 있는지 확인합니다
                return actuallyReadVersesInSession.some(readVerse => 
                    readVerse.book === book && 
                    readVerse.chapter === chapter &&
                    readVerse.verse === lastVerseNumber
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
          if (isIOS) {
            console.log('[App.tsx] iOS - Restarting speech recognition for next verse using retry mechanism');
            // 다시읽기 버튼과 동일한 로직 사용
            setTranscriptBuffer(''); // 버퍼 초기화
            resetTranscript(); // 트랜스크립트 초기화
            stopListening(); // 음성 인식 중지
            setIsRetryingVerse(true); // 이 플래그가 useEffect에서 마이크를 다시 켜도록 함
          } else {
            resetTranscript(); // 비iOS 기기에서는 단순히 초기화만
          }
      }
    }
    // 매칭 실패 시 인덱스 증가/세션 종료 없음
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcriptBuffer, readingState, currentTargetVerseForSession, currentUser, sessionTargetVerses, userOverallProgress]);

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
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-500 to-purple-500 drop-shadow-lg mb-2">
            말씀 여정에 함께해요
          </h1>
          <div className="text-base sm:text-lg text-gray-600 font-serif mb-2">Bible Journey Challenge</div>
        </header>
        {/* 안내 메시지: 비밀번호 변경 필요 사용자 또는 신규 사용자 대상 */}
        {(!currentUser || (currentUser && (currentUser as User).must_change_password)) && !showPasswordChangePrompt && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-md text-sm text-yellow-700 text-center">
            <p>
              <span className="font-semibold">기존 사용자 또는 신규 사용자 안내:</span><br />
              아이디 입력 후, 임시 비밀번호 <strong className="font-bold">1234</strong>로 로그인하세요.<br />
              로그인 후 즉시 <strong className="font-bold">새로운 비밀번호로 변경</strong>하셔야 정상적인 이용이 가능합니다.
            </p>
          </div>
        )}
        <AuthForm onAuth={handleAuth} onRegister={handleRegister} title="로그인 또는 사용자 등록" />
        {appError && <p className="mt-4 text-red-500">{appError}</p>}

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
      </div>
    );
  } // End of if (!currentUser)

  // Main application view when currentUser is defined
  return (
    <div className="container mx-auto p-4 max-w-4xl bg-amber-50 shadow-lg rounded-lg">
      {currentUser && (currentUser as User).must_change_password && showPasswordChangePrompt && (
        // This condition ensures the form only shows if needed and explicitly triggered
        // We might want a separate state like `isPasswordChangeModalOpen` for better control
        // For now, piggybacking on showPasswordChangePrompt for simplicity
        // The password change form JSX starts directly below:
        <div className="p-4 mb-4 text-sm text-orange-700 bg-orange-100 rounded-lg border border-orange-300 shadow-md" role="alert">
          <h3 className="font-bold text-lg mb-2">비밀번호 변경 필요</h3>
          <p className="mb-1">
            현재 임시 비밀번호(1234)를 사용하고 있습니다. 보안을 위해 즉시 새 비밀번호를 설정해주세요.
          </p>
          <form onSubmit={handlePasswordChangeSubmit} className="mt-3 space-y-3">
            <div>
              <label htmlFor="newPassword" className="block text-xs font-medium text-orange-800">새 비밀번호:</label>
              <input 
                type="password" 
                id="newPassword" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                className="mt-0.5 block w-full px-2 py-1 text-xs text-orange-900 bg-orange-50 border border-orange-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 placeholder-orange-400"
                placeholder="새 비밀번호 입력"
              />
            </div>
            <div>
              <label htmlFor="confirmNewPassword" className="block text-xs font-medium text-orange-800">새 비밀번호 확인:</label>
              <input 
                type="password" 
                id="confirmNewPassword" 
                value={confirmNewPassword} 
                onChange={(e) => setConfirmNewPassword(e.target.value)} 
                className="mt-0.5 block w-full px-2 py-1 text-xs text-orange-900 bg-orange-50 border border-orange-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 placeholder-orange-400"
                placeholder="새 비밀번호 다시 입력"
              />
            </div>
            {passwordChangeError && <p className="text-xs text-red-600">{passwordChangeError}</p>}
            {passwordChangeSuccess && <p className="text-xs text-green-600">{passwordChangeSuccess}</p>}
            <div className="flex items-center justify-between">
              <button 
                type="submit" 
                className="px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 rounded hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-1"
              >
                비밀번호 변경하기
              </button>
              <button 
                type="button"
                onClick={() => {
                  setShowPasswordChangePrompt(false);
                  setPasswordChangeError(null);
                  setPasswordChangeSuccess(null);
                  setNewPassword('');
                  setConfirmNewPassword('');
                }} 
                className="px-3 py-1.5 text-xs font-medium text-orange-700 bg-transparent border border-orange-700 rounded hover:bg-orange-200 focus:ring-2 focus:ring-orange-300"
              >
                나중에 변경
              </button>
            </div>
          </form>
        </div>
      )}
      {/* TODO: Consider adding a header here for authenticated users, e.g., user display and logout button */}
      {/* TODO: Consider adding a header here for authenticated users, e.g., user display and logout button */}
      {/* The following JSX was previously misplaced and is now part of the main authenticated view */}
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

            {/* Toggle Button for Book Completion Status - MOVED HERE */}
            {currentUser && userOverallProgress && (
  <div className="my-8 flex flex-col gap-3 items-center w-full max-w-md mx-auto">
    {/* 권별 완독 현황 보기 버튼 */}
    <button
      onClick={() => setShowBookCompletionStatus(!showBookCompletionStatus)}
      className="w-full h-14 px-6 text-lg font-bold tracking-tight bg-gradient-to-r from-blue-400 via-blue-300 to-sky-300 text-white rounded-2xl shadow-lg border border-blue-200 flex items-center justify-center gap-2 transition-transform duration-150 hover:scale-[1.04] hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-blue-300"
    >
      <span className="text-2xl mr-1">📚</span>
      {showBookCompletionStatus ? '권별 완독 현황 숨기기' : '권별 완독 현황 보기'}
    </button>
    {/* 함께 걷는 여정 버튼 */}
    <button
      onClick={() => setCurrentView(currentView === 'LEADERBOARD' ? 'IDLE_SETUP' : 'LEADERBOARD')}
      className={`w-full h-14 px-6 text-lg font-bold tracking-tight bg-gradient-to-r from-purple-500 via-fuchsia-400 to-pink-300 text-white rounded-2xl shadow-lg border border-purple-200 flex items-center justify-center gap-2 transition-transform duration-150 hover:scale-[1.04] hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-fuchsia-300 ${currentView === 'LEADERBOARD' ? 'ring-2 ring-fuchsia-400' : ''}`}
    >
      <span className="text-2xl mr-1">👣</span>
      {currentView === 'LEADERBOARD' ? '함께 걷는 여정 숨기기' : '함께 걷는 여정 보기'}
    </button>
    {/* 명예의 전당 전체 보기 버튼 (아래로 이동) */}
    <button
      onClick={() => setShowHallOfFame(true)}
      className="w-full h-14 px-6 text-lg font-bold tracking-tight bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 text-amber-900 rounded-2xl shadow-xl border-2 border-yellow-300 flex items-center justify-center gap-2 transition-transform duration-150 hover:scale-[1.04] hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-amber-300 drop-shadow-glow"
      style={{ boxShadow: '0 0 16px 2px #ffe06655' }}
    >
      <span className="text-2xl mr-1">👑</span>
      명예의 전당 전체 보기
    </button>
    {/* 다시 시작 버튼: 완독자+100%만 노출 */}
    {(currentUser && (currentUser as any).completed_count > 0) && overallCompletedChaptersCount === totalBibleChapters && (
      <button
        disabled={bibleResetLoading}
        onClick={async () => {
          if (!window.confirm('정말로 다시 말씀 여정을 시작하시겠습니까?\n완독 횟수가 증가하고, 모든 진행률이 초기화됩니다.')) return;
          setBibleResetLoading(true);
          try {
            const res = await fetch('/api/bible-reset', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: currentUser.id }),
            });
            const data = await res.json();
            if (data.success) {
              alert(`다시 시작되었습니다! (완독 횟수: ${data.round})`);
              window.location.reload();
            } else {
              alert('오류: ' + (data.error || '진행에 실패했습니다.'));
            }
          } catch (e) {
            alert('서버 오류: 다시 시도해 주세요.');
          } finally {
            setBibleResetLoading(false);
          }
        }}
        className="w-full h-14 px-6 text-lg font-bold tracking-tight bg-gradient-to-r from-white via-yellow-100 to-yellow-200 text-amber-700 rounded-2xl border-2 border-amber-300 shadow-xl mt-1 flex items-center justify-center gap-2 transition-transform duration-150 hover:scale-[1.04] hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-amber-300 drop-shadow-glow disabled:opacity-60"
        style={{ boxShadow: '0 0 14px 2px #ffe06644' }}
      >
        <span className="text-2xl mr-1">⟳</span>
        {bibleResetLoading ? '⏳ 진행 중...' : '다시 말씀 여정 시작하기'}
      </button>
    )}
  </div>
)}

            {/* Conditional Rendering for BookCompletionStatus component - MOVED HERE */}
            {currentUser && userOverallProgress && showBookCompletionStatus && (
              <BookCompletionStatus 
                userProgress={userOverallProgress} 
                availableBooks={AVAILABLE_BOOKS} 
              />
            )}


          </>
        )}

        {/* Hall of Fame Modal */}
        {showHallOfFame && (
          <HallOfFame onClose={() => setShowHallOfFame(false)} />
        )}

        {readingState === ReadingState.IDLE && currentView === 'LEADERBOARD' && (
          <div className="my-4 p-4 bg-gray-50 rounded-lg shadow">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">👣 함께 걷는 말씀의 발자취</h3>
            <Leaderboard key={userOverallProgress ? `lb-${userOverallProgress.lastReadBook}-${userOverallProgress.lastReadChapter}-${userOverallProgress.lastReadVerse}` : 'lb-no-progress'} />
          </div>
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
                className="px-6 py-2 bg-gray-400 text-white rounded-lg font-bold hover:bg-gray-500 transition"
                onClick={() => {
                  // Reset session-specific state and go back to setup
                  setReadingState(ReadingState.IDLE);
                  setSessionTargetVerses([]);
                  setCurrentVerseIndexInSession(0);
                  setMatchedVersesContentForSession('');
                  setSessionProgress(initialSessionProgress);
                  setSessionCertificationMessage('');
                  setTranscriptBuffer('');
                }}
              >
                ← 뒤로가기
              </button>
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
              <div className="fixed top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 text-center p-6 bg-green-100 border-2 border-green-600 rounded-lg shadow-xl max-w-md w-11/12">
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
        
        <footer className="mt-12 pt-6 border-t border-gray-300 text-center text-xs sm:text-sm text-gray-500">
        <div className="mt-10 text-center text-xs text-gray-400 font-sans select-none">
      <div className="mb-1">포도나무교회 &nbsp;|&nbsp; Dev: 이종림 &nbsp;|&nbsp; <a href="mailto:luxual8@gmail.com" className="underline hover:text-amber-700">문의 및 개선사항</a></div>
      <div className="mb-1">© 2025 이종림. All rights reserved.</div>
      <div className="mb-1">Copyright © 2025 Lee Jongrim. All rights reserved.</div>
      <div className="italic text-[11px] text-gray-300">음성 인식 정확도를 위해 조용한 환경을 권장합니다.</div>
      </div>
        </footer>
      </div>
  );
}; 

export default App;
