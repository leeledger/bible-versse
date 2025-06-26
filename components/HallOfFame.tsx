import React, { useEffect, useState } from 'react';

interface HallOfFameEntry {
  user_id: number;
  username: string;
  round: number;
  completed_at: string;
}

const HallOfFame: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [entries, setEntries] = useState<HallOfFameEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/hall-of-fame')
      .then(res => res.json())
      .then(data => {
        setEntries(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('명예의 전당 정보를 불러올 수 없습니다:', err);
        // 에러 발생 시에도 빈 배열로 설정하여 "아직 완독자가 없습니다" 메시지가 표시되도록 함
        setEntries([]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto border-4 border-amber-100">
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl font-bold"
          onClick={onClose}
          aria-label="닫기"
        >
          ×
        </button>
        <div className="flex flex-col items-center mb-6">
          <svg className="w-16 h-16 mb-2 text-amber-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.753 6.753 0 006.138 5.6 6.73 6.73 0 002.743 1.346A6.707 6.707 0 019.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a2.25 2.25 0 00-2.25 2.25c0 .414.336.75.75.75h15a.75.75 0 00.75-.75 2.25 2.25 0 00-2.25-2.25h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.706 6.706 0 01-1.112-3.173 6.73 6.73 0 002.743-1.347 6.753 6.753 0 006.139-5.6.75.75 0 00-.585-.858 47.077 47.077 0 00-3.07-.543V2.62a.75.75 0 00-.658-.744 49.22 49.22 0 00-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 00-.657.744zm0 2.629c0 1.196.312 2.32.857 3.294A5.266 5.266 0 013.16 5.337a45.6 45.6 0 012.006-.343v.256zm13.5 0v-.256c.674.1 1.343.214 2.006.343a5.265 5.265 0 01-2.863 3.207 6.72 6.72 0 00.857-3.294z" clipRule="evenodd" />
          </svg>
          <h1 className="text-3xl font-extrabold text-amber-600 drop-shadow mb-2">명예의 전당</h1>
          <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-400 rounded-lg shadow-inner">
            <div className="text-base text-gray-800 font-serif tracking-wide leading-relaxed text-center italic">
              <span className="text-xl text-amber-700 font-semibold">"</span>
              내가 달려갈 길과 주 예수께 받은 사명<br /> 
              곧 하나님의 은혜의 복음을 증언하는 일을 마치려 함에는<br />
              나의 생명조차 조금도 귀한 것으로 여기지 아니하노라
              <span className="text-xl text-amber-700 font-semibold">"</span>
            </div>
            <div className="mt-2 text-center">
              <span className="text-sm font-medium text-amber-600 tracking-wider">(사도행전 20:24)</span>
            </div>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-8 text-lg text-gray-600">불러오는 중...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">{error}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {entries.length === 0 ? (
              <div className="col-span-2 text-center text-gray-400">아직 완독자가 없습니다.</div>
            ) : entries.map(entry => (
              <div key={entry.user_id + '-' + entry.round} className="flex flex-col items-center bg-yellow-50 rounded-2xl shadow p-4 border-2 border-amber-200">
                <svg className="w-10 h-10 mb-2 text-amber-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.753 6.753 0 006.138 5.6 6.73 6.73 0 002.743 1.346A6.707 6.707 0 019.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a2.25 2.25 0 00-2.25 2.25c0 .414.336.75.75.75h15a.75.75 0 00.75-.75 2.25 2.25 0 00-2.25-2.25h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.706 6.706 0 01-1.112-3.173 6.73 6.73 0 002.743-1.347 6.753 6.753 0 006.139-5.6.75.75 0 00-.585-.858 47.077 47.077 0 00-3.07-.543V2.62a.75.75 0 00-.658-.744 49.22 49.22 0 00-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 00-.657.744zm0 2.629c0 1.196.312 2.32.857 3.294A5.266 5.266 0 013.16 5.337a45.6 45.6 0 012.006-.343v.256zm13.5 0v-.256c.674.1 1.343.214 2.006.343a5.265 5.265 0 01-2.863 3.207 6.72 6.72 0 00.857-3.294z" clipRule="evenodd" />
                </svg>
                <div className="text-lg font-bold text-indigo-800 mb-1">{entry.username}</div>
                <div className="text-base text-amber-600 mb-1">{entry.round}회 완독</div>
                <div className="text-xs text-gray-500">{new Date(entry.completed_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HallOfFame;
