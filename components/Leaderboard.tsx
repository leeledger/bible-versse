import React, { useState, useEffect } from 'react';
import { UserProgress } from '../types';
import * as authService from '../services/authService';
import { AVAILABLE_BOOKS } from '../constants'; // To get book order if needed

// authService.getAllUsersWithProgress()가 반환하는 데이터 구조에 대한 인터페이스
interface UserDataForLeaderboard {
  username: string;
  progress: UserProgress; // UserProgress에는 lastProgressUpdateDate가 포함됨
  completionRate: number;
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  progressDisplay: string;
  completionRate: number;
  lastProgressUpdateDate?: string; // ISO string, UserProgress에서 가져옴
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
    <div className="mt-8 p-4 sm:p-6 bg-white shadow-xl rounded-lg">
      <h2 className="text-xl sm:text-2xl font-bold text-center text-indigo-700 mb-6 break-keep">완독률 순위</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 whitespace-nowrap">순위</th>
              <th scope="col" className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 whitespace-nowrap">사용자명</th>
              <th scope="col" className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 whitespace-nowrap">최근 읽기</th>
              <th scope="col" className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 whitespace-nowrap">완독률</th>
              <th scope="col" className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 whitespace-nowrap">업데이트 일시</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {leaderboardData.map((entry) => (
              <tr key={entry.username} className="hover:bg-gray-50 transition-colors duration-150">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{entry.rank}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{entry.username}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{entry.progressDisplay}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{entry.completionRate.toFixed(1)}%</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {entry.lastProgressUpdateDate 
                      ? new Date(entry.lastProgressUpdateDate).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\.$/, '').replace(/\./g, '-').replace(' - ', ' ') // YYYY-MM-DD HH:mm, .replace(/\.$/, '') for potential trailing dot from seconds
                      : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Leaderboard;
