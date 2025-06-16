import React from 'react';
import { SessionReadingProgress } from '../types';

interface ProgressBarProps {
  progress: SessionReadingProgress;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  const {
    totalVersesInSession,
    sessionCompletedVersesCount,
    sessionInitialSkipCount,
  } = progress;

  // The number of verses the user is actually expected to read in this session
  const totalVersesToRead = totalVersesInSession - sessionInitialSkipCount;
  
  // The number of verses the user has read *after* the initial skip point
  const versesEffectivelyRead = sessionCompletedVersesCount - sessionInitialSkipCount;

  const progressPercent = totalVersesToRead > 0 ? (versesEffectivelyRead / totalVersesToRead) * 100 : 0;

  return (
    <div className="my-4 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-2">
        <span className="text-lg font-semibold text-gray-800">이번 세션 진행률</span>
        <span className="text-sm font-medium text-indigo-600">
          ({versesEffectivelyRead} / {totalVersesToRead} 구절 읽음)
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-4">
        <div
          className="bg-indigo-600 h-4 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;
