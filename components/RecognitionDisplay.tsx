
import React from 'react';
import VerseFadeIn from './VerseFadeIn';
import { BibleVerse } from '../types';

interface RecognitionDisplayProps {
  currentVerseToRead: BibleVerse | null;
  liveTranscript: string; // The full accumulated transcript from STT hook
  matchedVersesText: string; // Text of verses confirmed as read
  readingTarget: string; // e.g. "창세기 1장 1절"
}

const RecognitionDisplay: React.FC<RecognitionDisplayProps> = ({
  currentVerseToRead,
  liveTranscript,
  matchedVersesText,
  readingTarget
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-1">다음 구절 읽기:</h3>
        {currentVerseToRead ? (
          <p className="p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-700 text-lg">
            <span className="font-bold">{readingTarget}:</span> <VerseFadeIn
  key={currentVerseToRead.book + '-' + currentVerseToRead.chapter + '-' + currentVerseToRead.verse}
  verseText={currentVerseToRead.text}
/>
          </p>
        ) : (
          <p className="p-3 bg-gray-50 border border-gray-200 rounded-md text-gray-500">
            읽기 목표가 설정되지 않았거나 완료되었습니다.
          </p>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-1">인식된 음성 (실시간):</h3>
        <div className="p-3 bg-white border border-gray-300 rounded-md min-h-[60px] text-gray-800 italic">
          {liveTranscript || "음성 입력을 기다리는 중..."}
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-1">인식 완료된 구절:</h3>
        <div className="p-3 bg-green-50 border border-green-200 rounded-md min-h-[100px] max-h-60 overflow-y-auto text-green-700">
          {matchedVersesText || "아직 인식 완료된 구절이 없습니다."}
        </div>
      </div>
    </div>
  );
};

export default RecognitionDisplay;
    