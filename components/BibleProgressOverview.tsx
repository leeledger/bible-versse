import React, { useEffect } from 'react'; // Combined imports
import { UserProgress, BookChapterInfo } from '../types';

interface BibleProgressOverviewProps {
  userOverallProgress: UserProgress | null;
  allBooksData: BookChapterInfo[];
}

const BibleProgressOverview: React.FC<BibleProgressOverviewProps> = ({ userOverallProgress, allBooksData }) => {
  useEffect(() => {
    if (userOverallProgress && userOverallProgress.completedChapters) {
      console.log('[BibleProgressOverview.tsx useEffect] Props updated. userOverallProgress.completedChapters:', JSON.stringify(userOverallProgress.completedChapters));
    } else {
      console.log('[BibleProgressOverview.tsx useEffect] Props updated. userOverallProgress or completedChapters is null/undefined.', userOverallProgress);
    }
  }, [userOverallProgress]);
  if (!allBooksData || allBooksData.length === 0) {
    return <p>성경 데이터를 불러오는 중입니다...</p>;
  }

  const getCompletedChaptersForBook = (bookName: string): number => {
    if (!userOverallProgress || !userOverallProgress.completedChapters) {
      return 0;
    }
    let count = 0;
    for (const completedChapter of userOverallProgress.completedChapters) {
      if (completedChapter.startsWith(bookName + ':')) {
        count++;
      }
    }
    return count;
  };

  return (
    <div className="my-6 p-4 bg-white border border-gray-200 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">📖 성경 각 권별 완독 현황</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
        {allBooksData.map((book) => {
          const completedChaptersCount = getCompletedChaptersForBook(book.name);
          const progressPercentage = book.chapterCount > 0 ? (completedChaptersCount / book.chapterCount) * 100 : 0;
          const isCompleted = completedChaptersCount === book.chapterCount;

          return (
            <div 
              key={book.name} 
              title={`${book.name}: ${completedChaptersCount} / ${book.chapterCount} 장`}
              className={`p-2 border rounded-md text-center text-xs transition-all duration-300 ease-in-out transform hover:scale-105 
                ${isCompleted ? 'bg-green-100 border-green-400 shadow-lg' : 'bg-gray-50 border-gray-300 hover:shadow-md'}
                ${completedChaptersCount > 0 && !isCompleted ? 'bg-yellow-50 border-yellow-400' : ''}
              `}
            >
              <p className={`font-semibold truncate ${isCompleted ? 'text-green-700' : 'text-gray-700'}`}>{book.name}</p>
              <div className="w-full bg-gray-200 rounded-full h-2.5 my-1 overflow-hidden">
                <div 
                  className={`h-2.5 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <p className={`text-xxs ${isCompleted ? 'text-green-600' : 'text-gray-500'}`}>
                {completedChaptersCount} / {book.chapterCount} 장
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BibleProgressOverview;
