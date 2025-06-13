import React from 'react';
import { SessionReadingProgress } from '../types';

interface ProgressBarProps {
  progress: SessionReadingProgress;
  // targetTotalChapters is now derived from progress.sessionTargetChapters
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  const targetTotalChaptersInSession = progress.sessionTargetChapters.length;
  const overallVerseProgress = progress.sessionTotalVersesCount > 0 
    ? (progress.sessionCompletedVersesCount / progress.sessionTotalVersesCount) * 100 
    : 0;
  
  const currentChapterInfoForSession = progress.sessionTargetChapters.find(
    ch => ch.book === progress.currentBook && ch.chapter === progress.currentChapter
  );
  
  let currentChapterVerseCountInSession = 0;
  let currentChapterTotalVersesInSession = 0;

  if (currentChapterInfoForSession) {
    let versesBeforeCurrentChapterInSession = 0;
    let foundCurrentChapter = false;
    for (const chap of progress.sessionTargetChapters) {
      if (chap.book === currentChapterInfoForSession.book && chap.chapter === currentChapterInfoForSession.chapter) {
        foundCurrentChapter = true;
        break;
      }
      if (!foundCurrentChapter) {
        versesBeforeCurrentChapterInSession += chap.totalVerses;
      }
    }
    
    currentChapterVerseCountInSession = progress.sessionCompletedVersesCount - versesBeforeCurrentChapterInSession;
    currentChapterTotalVersesInSession = currentChapterInfoForSession.totalVerses;
  }
  
  currentChapterVerseCountInSession = Math.max(0, Math.min(currentChapterVerseCountInSession, currentChapterTotalVersesInSession));

  // Determine current chapter's index within the session's target chapters for chapter progress bar
  let currentChapterIndexInSession = 0;
  if (currentChapterInfoForSession) {
    currentChapterIndexInSession = progress.sessionTargetChapters.findIndex(
      ch => ch.book === currentChapterInfoForSession.book && ch.chapter === currentChapterInfoForSession.chapter
    );
  }
  // If reading is complete, show all chapters as completed for the session
  const sessionChapterProgressPercentage = targetTotalChaptersInSession > 0
    ? ( (progress.sessionCompletedChaptersCount / targetTotalChaptersInSession) * 100)
    : (overallVerseProgress === 100 ? 100 : 0);


  return (
    <div className="space-y-3 p-4 bg-white shadow rounded-lg">
      <h3 className="text-xl font-semibold text-gray-800">이번 세션 읽기 진행 상황</h3>
      
      <div>
        <p className="text-sm font-medium text-gray-600">
          이번 세션 목표: 총 {targetTotalChaptersInSession}장 읽기 (현재 {progress.sessionCompletedChaptersCount + 1 > targetTotalChaptersInSession ? targetTotalChaptersInSession : progress.sessionCompletedChaptersCount + 1}번째 장 진행 중)
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
            style={{ width: `${sessionChapterProgressPercentage}%` }}
            aria-valuenow={sessionChapterProgressPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
            aria-label="세션 장 진행률"
          ></div>
        </div>
        <p className="text-xs text-gray-500 text-right">{progress.sessionCompletedChaptersCount} / {targetTotalChaptersInSession} 장 완료 (이번 세션)</p>
      </div>

      {currentChapterInfoForSession && progress.sessionCompletedVersesCount < progress.sessionTotalVersesCount && (
        <div>
          <p className="text-sm font-medium text-gray-600">
            현재 장 진행 ({progress.currentBook} {progress.currentChapter}장): {currentChapterVerseCountInSession} / {currentChapterTotalVersesInSession} 절
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
            <div 
              className="bg-green-500 h-2.5 rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${currentChapterTotalVersesInSession > 0 ? (currentChapterVerseCountInSession / currentChapterTotalVersesInSession) * 100 : 0}%` }}
              aria-valuenow={currentChapterTotalVersesInSession > 0 ? (currentChapterVerseCountInSession / currentChapterTotalVersesInSession) * 100 : 0}
              aria-valuemin={0}
              aria-valuemax={100}
              role="progressbar"
              aria-label="현재 장 절 진행률"
            ></div>
          </div>
        </div>
      )}
      
      <div>
        <p className="text-sm font-medium text-gray-600">
            이번 세션 전체 절 진행률: {progress.sessionCompletedVersesCount} / {progress.sessionTotalVersesCount} 절
        </p>
        <div className="w-full bg-gray-200 rounded-full h-4 mt-1">
          <div 
            className="bg-purple-600 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all duration-300 ease-out" 
            style={{ width: `${overallVerseProgress}%` }}
            aria-valuenow={overallVerseProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
            aria-label="세션 전체 절 진행률"
          >
            {Math.round(overallVerseProgress)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
