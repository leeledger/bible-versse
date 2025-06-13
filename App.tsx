import React, { useState, useEffect, useMemo } from 'react';
import { progressService } from './services/progressService';
import { BibleVerse, SessionReadingProgress, ReadingState, User, UserProgress, UserSessionRecord } from './types';
import { AVAILABLE_BOOKS, getVersesForSelection } from './constants';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import * as authService from './services/authService'; 
import RecognitionDisplay from './components/RecognitionDisplay';
import ProgressBar from './components/ProgressBar';
import AuthForm from './components/AuthForm'; 
import ChapterSelector from './components/ChapterSelector'; 
import Leaderboard from './components/Leaderboard'; 
import { calculateSimilarity } from './utils';

// Helper to normalize text for matching (simple version)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    // eslint-disable-next-line no-irregular-whitespace
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?　]/g, "") // remove punctuation, including full-width space
    .replace(/\s+/g, ""); // remove all whitespace
};

const FUZZY_MATCH_LOOKBACK_FACTOR = 1.8; 
const FUZZY_MATCH_SIMILARITY_THRESHOLD = 60; // 70에서 하향 조정. 발음이 어려운 단어 인식률 개선
const MINIMUM_READ_LENGTH_RATIO = 0.9; // Must read at least 90% of the verse's length
const ABSOLUTE_READ_DIFFERENCE_THRESHOLD = 5; // Or be within 5 characters of the end

const initialSessionProgress: SessionReadingProgress = {
  currentBook: '',
  currentChapter: 0,
  currentVerseNum: 0,
  sessionTargetVerses: [],
  sessionTotalVersesCount: 0,
  sessionCompletedVersesCount: 0,
  sessionTargetChapters: [],
  sessionCompletedChaptersCount: 0,
  sessionInitialSkipCount: 0,
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userOverallProgress, setUserOverallProgress] = useState<UserProgress | null>(null);
  
  const [sessionTargetVerses, setSessionTargetVerses] = useState<BibleVerse[]>([]); // Verses for the current reading session
  const [currentVerseIndexInSession, setCurrentVerseIndexInSession] = useState(0); // Index within sessionTargetVerses
  
  const [transcriptBuffer, setTranscriptBuffer] = useState('');
  const [matchedVersesContentForSession, setMatchedVersesContentForSession] = useState<string>(''); // Accumulated for current session display
  const [readingState, setReadingState] = useState<ReadingState>(ReadingState.IDLE);
  
  const [sessionProgress, setSessionProgress] = useState<SessionReadingProgress>(initialSessionProgress);

  const [sessionCertificationMessage, setSessionCertificationMessage] = useState<string>('');
  const [appError, setAppError] = useState<string | null>(null);

  const { 
    isListening, 
    transcript: sttTranscript, 
    error: sttError, 
    startListening, 
    stopListening, 
    browserSupportsSpeechRecognition,
    resetTranscript 
  } = useSpeechRecognition({ lang: 'ko-KR' });

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
    if (sttTranscript) {
      setTranscriptBuffer(sttTranscript); 
    }
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

    // 매칭 성공 시에만 다음 절로 진행
    const isLengthSufficientByRatio = bufferPortionToCompare.length >= normalizedTargetVerseText.length * MINIMUM_READ_LENGTH_RATIO;
    const isLengthSufficientByAbsoluteDiff = (normalizedTargetVerseText.length - bufferPortionToCompare.length) <= ABSOLUTE_READ_DIFFERENCE_THRESHOLD && bufferPortionToCompare.length > 0;

    if (similarity >= FUZZY_MATCH_SIMILARITY_THRESHOLD && (isLengthSufficientByRatio || isLengthSufficientByAbsoluteDiff)) {
      setMatchedVersesContentForSession(prev => prev + `${currentTargetVerseForSession.book} ${currentTargetVerseForSession.chapter}:${currentTargetVerseForSession.verse} - ${currentTargetVerseForSession.text}\n`);
      
      const newTotalCompletedInSelection = currentVerseIndexInSession + 1; // Count from start of selection array
      
      let fullyCompletedChaptersInSession = 0;
      const chaptersEncountered = new Set<string>();
      for(let i = 0; i < newTotalCompletedInSelection; i++) {
        const verse = sessionTargetVerses[i];
        const chapterKey = `${verse.book}-${verse.chapter}`;
        chaptersEncountered.add(chapterKey);
      }
      fullyCompletedChaptersInSession = Array.from(chaptersEncountered).filter(chKey => {
        const [book, chapterStr] = chKey.split('-');
        const chapter = parseInt(chapterStr);
        const chapterInfo = sessionProgress.sessionTargetChapters.find(tc => tc.book === book && tc.chapter === chapter);
        if (!chapterInfo) return false;
        const versesInThisChapterInSelection = sessionTargetVerses.filter(v => v.book === book && v.chapter === chapter);
        const versesInThisChapterFromSelection = sessionTargetVerses.slice(0, newTotalCompletedInSelection).filter(v => v.book === book && v.chapter === chapter);
        return versesInThisChapterFromSelection.length === versesInThisChapterInSelection.length;
      }).length;

      setSessionProgress(prev => ({ 
        ...prev,
        sessionCompletedVersesCount: newTotalCompletedInSelection, // Total "done" from start of selection
        sessionCompletedChaptersCount: fullyCompletedChaptersInSession,
      }));

      // 마지막 절까지 실제로 읽었을 때만 세션 종료
      if (newTotalCompletedInSelection >= sessionTargetVerses.length) { 
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
            progressService.saveUserProgress(currentUser.username, newOverallProgress);
            setUserOverallProgress(newOverallProgress);
        }
        setSessionProgress(prev => ({
            ...prev,
            sessionCompletedChaptersCount: prev.sessionTargetChapters.length, 
            currentBook: lastVerseOfSession.book,
            currentChapter: lastVerseOfSession.chapter,
            currentVerseNum: lastVerseOfSession.verse,
        }));

      } else { 
         setCurrentVerseIndexInSession(prevIdx => prevIdx + 1); // 다음 절로 이동
         const nextVerseDetails = sessionTargetVerses[newTotalCompletedInSelection];
         setSessionProgress(prev => ({
            ...prev,
            currentBook: nextVerseDetails.book,
            currentChapter: nextVerseDetails.chapter,
            currentVerseNum: nextVerseDetails.verse,
          }));
         setTranscriptBuffer(''); // Clear buffer for next verse
         resetTranscript(); // Reset STT for next verse
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
    let verses = getVersesForSelection(book, startCh, endCh);
    // 마지막 읽은 곳이 현재 책/범위에 포함되면 다음 절부터만 남기기
    if (userOverallProgress) {
      const { lastReadBook, lastReadChapter, lastReadVerse } = userOverallProgress;
      // 같은 책이면, 마지막 읽은 절 이후부터 시작
      if (lastReadBook === book) {
        verses = verses.filter((v: BibleVerse) =>
          v.chapter > lastReadChapter ||
          (v.chapter === lastReadChapter && v.verse > lastReadVerse)
        );
      } else {
        // 다른 책이면 전체 범위 읽기 (즉, 필터링하지 않음)
      }
    }
    if (verses.length === 0) {
      const selectedBookInfo = AVAILABLE_BOOKS.find(b => b.name === book);
      if (selectedBookInfo && selectedBookInfo.chapterCount > 0) {
        setAppError(`"${book}" 책의 성경 데이터(본문)가 아직 로드되지 않았습니다. 현재는 '창세기' 1-5장의 본문만 제공됩니다. 다른 책은 장/절 구조만 표시됩니다.`);
      } else if (selectedBookInfo && selectedBookInfo.chapterCount === 0) {
        setAppError(`"${book}" 책은 장/절 정보가 없습니다.`);
      } else {
        setAppError(`"${book}" 책을 찾을 수 없습니다.`);
      }
      return;
    }
    setSessionTargetVerses(verses);
    setCurrentVerseIndexInSession(0); // 세션 시작 시 항상 0으로 초기화
    setReadingState(ReadingState.READING); // 읽기 모드로 전환
    setAppError(null);
    setSessionCertificationMessage("");
    setMatchedVersesContentForSession("");
    // 세션 구절/장 정보 세팅
    const chapters = Array.from(new Set(verses.map((v: BibleVerse) => v.chapter)));
    setSessionProgress({
      currentBook: book,
      currentChapter: chapters[0] || 1,
      currentVerseNum: verses[0]?.verse || 1,
      sessionTargetVerses: verses,
      sessionTotalVersesCount: verses.length,
      sessionCompletedVersesCount: 0,
      sessionTargetChapters: chapters.map((ch: number) => ({ book, chapter: ch, totalVerses: verses.filter((v: BibleVerse) => v.chapter === ch).length })),
      sessionCompletedChaptersCount: 0,
      sessionInitialSkipCount: 0
    });
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
      const newOverallProgress: UserProgress = {
          lastReadBook: lastEffectivelyReadVerse.book,
          lastReadChapter: lastEffectivelyReadVerse.chapter,
          lastReadVerse: lastEffectivelyReadVerse.verse,
          history: userOverallProgress?.history ? [...userOverallProgress.history, historyEntry] : [historyEntry]
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
    if (readingState !== ReadingState.LISTENING) return;

    stopListening();
    setTranscriptBuffer('');
    resetTranscript();
    setAppError(null);

    // Restart listening for the same verse after a short delay
    setTimeout(() => {
      if (browserSupportsSpeechRecognition) {
        startListening();
      } else {
        setAppError('이 브라우저는 음성 인식을 지원하지 않습니다.');
        setReadingState(ReadingState.ERROR);
      }
    }, 100);
  };

  const initialSelectionForSelector = useMemo(() => {
    if (userOverallProgress && userOverallProgress.lastReadBook && userOverallProgress.lastReadChapter > 0 && userOverallProgress.lastReadVerse > 0) {
      let { lastReadBook, lastReadChapter, lastReadVerse } = userOverallProgress;

      let suggestedBookName = lastReadBook;
      let suggestedChapterNum = lastReadChapter;

      const currentBookInfo = AVAILABLE_BOOKS.find(b => b.name === lastReadBook);

      if (currentBookInfo && currentBookInfo.chapterCount > 0 && currentBookInfo.versesPerChapter.length >= lastReadChapter) { // Check versesPerChapter length for populated data
        // Only proceed if versesPerChapter for the lastReadChapter is available
        // This check is a bit tricky since versesPerChapter is often a TODO for non-Genesis books
        // A more robust check might be needed if versesPerChapter is sparse.
        // For now, let's assume if chapterCount > 0, we can attempt to get verse count.
        // A better approach would be to have BIBLE_DATA_RAW populate versesPerChapter accurately.
        
        // This part relies on having correct verse counts in currentBookInfo.versesPerChapter
        // If it's a TODO (empty array), this logic might not be accurate.
        // For Genesis, it will be accurate. For others, it might default to suggesting chapter+1
        // even if not strictly the end of chapter. This is an acceptable limitation given current data.
        
        const versesInLastReadChapter = currentBookInfo.versesPerChapter[lastReadChapter - 1] || 999; // Fallback if not populated

        if (lastReadVerse >= versesInLastReadChapter) { // If last read verse was the last in the chapter
          suggestedChapterNum = lastReadChapter + 1;
          
          if (suggestedChapterNum > currentBookInfo.chapterCount) { // If last read chapter was the last in the book
            const currentBookIndex = AVAILABLE_BOOKS.findIndex(b => b.name === lastReadBook);
            let nextBookFoundAndValid = false;
            if (currentBookIndex !== -1 && currentBookIndex < AVAILABLE_BOOKS.length - 1) {
              for (let i = currentBookIndex + 1; i < AVAILABLE_BOOKS.length; i++) {
                const nextBookCandidate = AVAILABLE_BOOKS[i];
                if (nextBookCandidate && nextBookCandidate.chapterCount > 0) {
                  suggestedBookName = nextBookCandidate.name;
                  suggestedChapterNum = 1;
                  nextBookFoundAndValid = true;
                  break;
                }
              }
            }
            if (!nextBookFoundAndValid) {
              // Cannot find a subsequent book with data, suggest the last chapter of the current book.
              suggestedBookName = lastReadBook; 
              suggestedChapterNum = currentBookInfo.chapterCount > 0 ? currentBookInfo.chapterCount : 1; 
            }
          }
        }
        // If not last verse of chapter, suggestedBookName and suggestedChapterNum remain as lastReadBook/Chapter
      } else if (currentBookInfo && currentBookInfo.chapterCount > 0) {
        // Fallback if versesPerChapter is not populated: assume not end of chapter, or try to advance chapter/book if it's the last possible chapter.
         if (lastReadChapter >= currentBookInfo.chapterCount) { // If at the last chapter of the book
            suggestedChapterNum = lastReadChapter + 1; // This will trigger book advancement logic above
             if (suggestedChapterNum > currentBookInfo.chapterCount) {
                const currentBookIndex = AVAILABLE_BOOKS.findIndex(b => b.name === lastReadBook);
                let nextBookFoundAndValid = false;
                if (currentBookIndex !== -1 && currentBookIndex < AVAILABLE_BOOKS.length - 1) {
                  for (let i = currentBookIndex + 1; i < AVAILABLE_BOOKS.length; i++) {
                    const nextBookCandidate = AVAILABLE_BOOKS[i];
                    if (nextBookCandidate && nextBookCandidate.chapterCount > 0) {
                      suggestedBookName = nextBookCandidate.name;
                      suggestedChapterNum = 1;
                      nextBookFoundAndValid = true;
                      break;
                    }
                  }
                }
                 if (!nextBookFoundAndValid) {
                    suggestedBookName = lastReadBook; 
                    suggestedChapterNum = currentBookInfo.chapterCount > 0 ? currentBookInfo.chapterCount : 1; 
                }
            }
        }
      }
      
      const finalBookInfo = AVAILABLE_BOOKS.find(b => b.name === suggestedBookName);
      if (finalBookInfo && finalBookInfo.chapterCount > 0 && suggestedChapterNum > 0 && suggestedChapterNum <= finalBookInfo.chapterCount) {
        return { book: suggestedBookName, chapter: suggestedChapterNum };
      } else if (finalBookInfo && finalBookInfo.chapterCount > 0) { 
         return { book: suggestedBookName, chapter: 1 }; 
      } else { 
         const firstAvailableBookWithData = AVAILABLE_BOOKS.find(b => b.chapterCount > 0);
         return firstAvailableBookWithData ? { book: firstAvailableBookWithData.name, chapter: 1} : { book: "창세기", chapter: 1};
      }
    }
    const firstAvailableBookWithData = AVAILABLE_BOOKS.find(b => b.chapterCount > 0);
    return firstAvailableBookWithData ? { book: firstAvailableBookWithData.name, chapter: 1} : { book: "창세기", chapter: 1};
  }, [userOverallProgress]);


  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 py-8 px-4 flex flex-col items-center justify-center">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-indigo-700">포도나무교회 | 성경 읽기 도우미</h1>
        </header>
        <AuthForm onAuth={handleAuth} title="로그인 또는 사용자 등록" />
        {appError && <p className="mt-4 text-red-500">{appError}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-50 to-purple-100 py-8 px-4 flex flex-col items-center">
      <div className="w-full max-w-3xl bg-white shadow-xl rounded-lg p-6 md:p-8">
        <header className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl md:text-4xl font-bold text-indigo-700">성경 읽기 도우미</h1>
          <div className="text-right">
            <p className="text-sm text-gray-600">환영합니다, {currentUser.username}님!</p>
            <button onClick={handleLogout} className="text-sm text-indigo-600 hover:text-indigo-800 underline">로그아웃</button>
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
            <ChapterSelector 
              onStartReading={handleSelectChaptersAndStartReading} 
              defaultBook={AVAILABLE_BOOKS.find(b => b.chapterCount > 0)?.name || "창세기"} 
              initialSelection={initialSelectionForSelector}
            />
            <Leaderboard key={userOverallProgress ? `${userOverallProgress.lastReadBook}-${userOverallProgress.lastReadChapter}-${userOverallProgress.lastReadVerse}` : 'no-progress'} /> 
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
            <span>음성 인식 정확도는 환경에 따라 다를 수 있습니다.</span>
        </footer>
      </div>
    </div>
  );
};

export default App;
