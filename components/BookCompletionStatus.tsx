import React, { useState } from 'react';
import { UserProgress, BookChapterInfo } from '../types'; // Import BookChapterInfo
import { AVAILABLE_BOOKS } from '../constants';

interface BookCompletionStatusProps {
  userProgress: UserProgress | null;
  availableBooks: BookChapterInfo[];
}

const BookCompletionStatus: React.FC<BookCompletionStatusProps> = ({ userProgress, availableBooks }) => {
  const [selectedBook, setSelectedBook] = useState<BookChapterInfo | null>(null);
  
  if (!userProgress || !userProgress.completedChapters) {
    return <p className="text-sm text-gray-600">완독 현황을 불러올 수 없습니다.</p>;
  }

  const { completedChapters } = userProgress;
  const completedChaptersSet = new Set(completedChapters);
  
  // 선택된 책의 장별 읽기 현황을 보여주는 함수
  const renderChapterList = (book: BookChapterInfo) => {
    return (
      <div className="mt-4 p-4 bg-white border border-green-200 rounded-lg shadow">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-lg font-semibold text-green-700">{book.name} 장별 읽기 현황</h4>
          <button 
            onClick={() => setSelectedBook(null)}
            className="text-sm px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
          >
            닫기
          </button>
        </div>
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {Array.from({ length: book.chapterCount }, (_, i) => i + 1).map(chapter => {
            const isCompleted = completedChaptersSet.has(`${book.name}:${chapter}`);
            return (
              <div 
                key={chapter}
                className={`p-2 text-center rounded-md ${isCompleted ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}
              >
                <span className="text-sm">{chapter}장</span>
                {isCompleted && (
                  <div className="mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mx-auto text-green-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="my-4">
      {selectedBook ? (
        // 선택된 책의 장별 읽기 현황 표시
        renderChapterList(selectedBook)
      ) : (
        // 권별 완독 현황 표시
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-green-700 mb-3">권별 완독 현황</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {availableBooks.map((book: BookChapterInfo) => {
              let completedInBook = 0;
              for (let i = 1; i <= book.chapterCount; i++) {
                if (completedChaptersSet.has(`${book.name}:${i}`)) {
                  completedInBook++;
                }
              }
              const progressPercentage = book.chapterCount > 0 ? (completedInBook / book.chapterCount) * 100 : 0;

              return (
                <div 
                  key={book.name} 
                  className="p-3 bg-white border border-green-100 rounded-md shadow-sm cursor-pointer hover:shadow-md hover:border-green-300 transition-all duration-200"
                  onClick={() => setSelectedBook(book)}
                >
                  <h4 className="text-md font-semibold text-green-800">{book.name}</h4>
                  <div className="w-full bg-gray-200 rounded-full h-3 my-1">
                    <div 
                      className="bg-green-500 h-3 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progressPercentage}%` }}
                    >
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-gray-500">
                      {completedInBook} / {book.chapterCount} 장
                    </p>
                    <p className="text-xs font-medium text-green-600">
                      {progressPercentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default BookCompletionStatus;
