import { UserProgress } from '../types';

const API_URL = '/api/progress';

export const progressService = {
  async loadUserProgress(username: string): Promise<UserProgress> {
    try {
      const response = await fetch(`${API_URL}/${username}`);
      // 서버에서 사용자를 찾지 못하거나 데이터가 없는 경우, 기본 진행 상태를 반환합니다.
      if (!response.ok || response.headers.get('content-length') === '0') {
        console.log(`'${username}'에 대한 진행 상황을 찾을 수 없어 기본값을 반환합니다.`);
        return { lastReadBook: '', lastReadChapter: 0, lastReadVerse: 0, history: [] };
      }
      const progress = await response.json();
      return progress;
    } catch (error) {
      console.error('사용자 진행 상황 로딩 중 오류 발생:', error);
      // 오류 발생 시 앱 충돌을 방지하기 위해 기본 상태를 반환합니다.
      return { lastReadBook: '', lastReadChapter: 0, lastReadVerse: 0, history: [] };
    }
  },

  async saveUserProgress(username: string, progress: UserProgress): Promise<void> {
    try {
      await fetch(`${API_URL}/${username}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(progress),
      });
    } catch (error) {
      console.error('사용자 진행 상황 저장 중 오류 발생:', error);
    }
  },
};
