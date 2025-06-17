import React from 'react';
import { UserProgress, BookChapterInfo } from '../types'; // Import BookChapterInfo
import { AVAILABLE_BOOKS } from '../constants';

interface BookCompletionStatusProps {
  userProgress: UserProgress | null;
  availableBooks: BookChapterInfo[];
}

const BookCompletionStatus: React.FC<BookCompletionStatusProps> = ({ userProgress, availableBooks }) => {
  if (!userProgress || !userProgress.completedChapters) {
    return <p className="text-sm text-gray-600">완독 현황을 불러올 수 없습니다.</p>;
  }

  const { completedChapters } = userProgress;
  const completedChaptersSet = new Set(completedChapters);

  return (
    <div className="my-4 p-4 bg-green-50 border border-green-200 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-green-700 mb-3">권별 완독 현황</h3>
      <div className="grid grid-cols-3 gap-3">
        {availableBooks.map((book: BookChapterInfo) => {
          let completedInBook = 0;
          for (let i = 1; i <= book.chapterCount; i++) {
            if (completedChaptersSet.has(`${book.name}:${i}`)) {
              completedInBook++;
            }
          }
          const progressPercentage = book.chapterCount > 0 ? (completedInBook / book.chapterCount) * 100 : 0;

          return (
            <div key={book.name} className="p-3 bg-white border border-green-100 rounded-md shadow-sm">
              <h4 className="text-md font-semibold text-green-800">{book.name}</h4>
              <div className="w-full bg-gray-200 rounded-full h-3 my-1">
                <div 
                  className="bg-green-500 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                >
                </div>
              </div>
              <p className="text-xs text-gray-500 text-right">
                {completedInBook} / {book.chapterCount} 장 완독 ({progressPercentage.toFixed(1)}%)
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BookCompletionStatus;
