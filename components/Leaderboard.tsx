import React, { useState, useEffect } from 'react';
import { UserProgress } from '../types';
import * as authService from '../services/authService';
import { AVAILABLE_BOOKS } from '../constants'; // To get book order if needed

// authService.getAllUsersWithProgress()가 반환하는 데이터 구조에 대한 인터페이스
interface UserDataForLeaderboard {
  username: string;
  progress: UserProgress; // UserProgress에는 lastProgressUpdateDate가 포함됨
  completionRate: number;
  completed_count?: number; // 완독 횟수
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  progressDisplay: string;
  completionRate: number;
  lastProgressUpdateDate?: string; // ISO string, UserProgress에서 가져옴
  completed_count: number; // 완독 횟수
  // Raw progress for sorting
  book: string;
  chapter: number;
  verse: number;
}

// Define the canonical order of Bible books (for now, only Genesis)
const BOOK_ORDER = AVAILABLE_BOOKS.map(b => b.name);

const Leaderboard: React.FC = () => {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboardData = async () => {
      setIsLoading(true);
      try {
        const usersData: UserDataForLeaderboard[] = await authService.getAllUsersWithProgress(); // Await the promise

        const sortedUsers = [...usersData].sort((a, b) => {
          // Primary sort: by completionRate, descending
          if (a.completionRate !== b.completionRate) {
            return b.completionRate - a.completionRate;
          }

          // Secondary sort: by last read progress
          const bookIndexA = BOOK_ORDER.indexOf(a.progress.lastReadBook);
          const bookIndexB = BOOK_ORDER.indexOf(b.progress.lastReadBook);

          // Handle books not in order or empty lastReadBook (treat as "later" in sort)
          const effectiveIndexA = bookIndexA === -1 ? Infinity : bookIndexA;
          const effectiveIndexB = bookIndexB === -1 ? Infinity : bookIndexB;

          if (effectiveIndexA !== effectiveIndexB) {
            return effectiveIndexA - effectiveIndexB; // Sort by predefined book order
          }
          // If books are the same or both unknown, sort by chapter/verse
          if (a.progress.lastReadChapter !== b.progress.lastReadChapter) {
            return b.progress.lastReadChapter - a.progress.lastReadChapter; // Higher chapter first
          }
          return b.progress.lastReadVerse - a.progress.lastReadVerse; // Higher verse first
        });

        const formattedData: LeaderboardEntry[] = sortedUsers.map((user, index) => {
          let progressDisplay = "아직 읽기 시작 안 함";
          if (user.progress && (user.progress.lastReadBook || user.progress.lastReadChapter > 0 || user.progress.lastReadVerse > 0)) {
            progressDisplay = `${user.progress.lastReadBook || '??'} ${user.progress.lastReadChapter}장 ${user.progress.lastReadVerse}절`;
          }
          return {
            completionRate: user.completionRate,
            rank: index + 1,
            username: user.username,
            progressDisplay: progressDisplay,
            book: user.progress?.lastReadBook || '',
            chapter: user.progress?.lastReadChapter || 0,
            verse: user.progress?.lastReadVerse || 0,
            lastProgressUpdateDate: user.progress?.lastProgressUpdateDate, // UserProgress에서 직접 가져옴
            completed_count: user.completed_count || 0, // 완독 횟수
          };
        });

        setLeaderboardData(formattedData);
      } catch (error) {
        console.error("Failed to fetch or process leaderboard data:", error);
        setLeaderboardData([]); // Set to empty on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="mt-8 p-4 bg-white shadow rounded-lg text-center">
        <p className="text-gray-600">랭킹 보드 로딩 중...</p>
      </div>
    );
  }

  if (leaderboardData.length === 0) {
    return (
      <div className="mt-8 p-4 bg-white shadow rounded-lg text-center">
        <p className="text-gray-600">아직 등록된 사용자 기록이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="mt-8 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-xl rounded-2xl overflow-hidden border border-indigo-100">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 py-4 px-6">
        <h2 className="text-xl sm:text-2xl font-bold text-center text-white mb-1 break-keep drop-shadow-sm">✨ 완독률 순위 ✨</h2>
        <p className="text-center text-indigo-100 text-sm">함께 걷는 말씀의 여정</p>
      </div>
      
      {/* 모바일에서는 카드 형태로, 데스크톱에서는 테이블 형태로 표시 */}
      <div className="md:hidden">
        {/* 모바일 카드 뷰 */}
        <div className="p-4 space-y-4">
          {leaderboardData.map((entry) => (
            <div 
              key={entry.username} 
              className={`rounded-xl p-4 shadow-md transition-all duration-300 hover:shadow-lg ${entry.rank <= 3 ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200' : 'bg-white'}`}
            >
              <div className="flex items-center mb-3">
                <div className={`
                  ${entry.rank === 1 ? 'bg-amber-500 text-white' : 
                    entry.rank === 2 ? 'bg-gray-400 text-white' : 
                    entry.rank === 3 ? 'bg-amber-700 text-white' : 
                    'bg-indigo-100 text-indigo-800'} 
                  rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm mr-3
                `}>
                  {entry.rank}
                </div>
                <div className="font-bold text-lg text-indigo-900 flex-grow truncate flex items-center gap-1">
                  {entry.username}
                  {entry.completed_count > 0 && (
                    <span className="bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-900 px-2 py-0.5 rounded-full text-xs font-bold shadow-sm border border-amber-300 ml-1 flex items-center">
                      <span className="mr-0.5">🏆</span>
                      <span>{entry.completed_count}</span>
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold bg-indigo-100 text-indigo-800 px-2 py-1 rounded-lg">
                  {entry.completionRate.toFixed(1)}%
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex">
                  <span className="text-gray-500 w-20">최근 읽기:</span>
                  <span className="text-gray-800 font-medium">{entry.progressDisplay}</span>
                </div>
                <div className="flex">
                  <span className="text-gray-500 w-20">업데이트:</span>
                  <span className="text-gray-600">
                    {entry.lastProgressUpdateDate 
                      ? new Date(entry.lastProgressUpdateDate).toLocaleString('ko-KR', { 
                          month: '2-digit', 
                          day: '2-digit', 
                          hour: '2-digit', 
                          minute: '2-digit', 
                          hour12: false 
                        }).replace(/\.$/, '').replace(/\./g, '-').replace(' - ', ' ')
                      : '기록 없음'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 데스크톱 테이블 뷰 */}
      <div className="hidden md:block">
        <div className="p-6">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b-2 border-indigo-200">
                <th className="pb-3 px-4 text-indigo-800 font-bold">순위</th>
                <th className="pb-3 px-4 text-indigo-800 font-bold">사용자명</th>
                <th className="pb-3 px-4 text-indigo-800 font-bold">최근 읽기</th>
                <th className="pb-3 px-4 text-indigo-800 font-bold">완독률</th>
                <th className="pb-3 px-4 text-indigo-800 font-bold">업데이트 일시</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardData.map((entry) => (
                <tr 
                  key={entry.username} 
                  className={`border-b border-indigo-50 hover:bg-indigo-50/50 transition-colors ${entry.rank <= 3 ? 'bg-amber-50/50' : ''}`}
                >
                  <td className="py-4 px-4">
                    <div className={`
                      ${entry.rank === 1 ? 'bg-amber-500 text-white' : 
                        entry.rank === 2 ? 'bg-gray-400 text-white' : 
                        entry.rank === 3 ? 'bg-amber-700 text-white' : 
                        'bg-indigo-100 text-indigo-800'} 
                      rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm
                    `}>
                      {entry.rank}
                    </div>
                  </td>
                  <td className="py-4 px-4 font-medium text-gray-800">
                    <div className="flex items-center gap-1">
                      {entry.username}
                      {entry.completed_count > 0 && (
                        <span className="bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-900 px-2 py-0.5 rounded-full text-xs font-bold shadow-sm border border-amber-300 ml-1 flex items-center">
                          <span className="mr-0.5">🏆</span>
                          <span>{entry.completed_count}</span>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-gray-700">{entry.progressDisplay}</td>
                  <td className="py-4 px-4">
                    <div className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-lg inline-block font-medium">
                      {entry.completionRate.toFixed(1)}%
                    </div>
                  </td>
                  <td className="py-4 px-4 text-gray-600">
                    {entry.lastProgressUpdateDate 
                      ? new Date(entry.lastProgressUpdateDate).toLocaleString('ko-KR', { 
                          year: 'numeric', 
                          month: '2-digit', 
                          day: '2-digit', 
                          hour: '2-digit', 
                          minute: '2-digit', 
                          hour12: false 
                        }).replace(/\.$/, '').replace(/\./g, '-').replace(' - ', ' ')
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
