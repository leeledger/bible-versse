import { UserProgress } from '../types';
import { TOTAL_CHAPTERS_IN_BIBLE, AVAILABLE_BOOKS } from '../constants';

const API_URL = '/api/progress';
const getCompletedChaptersKey = (username: string) => `completedBibleChapters_${username}`;

export const progressService = {
  getTotalChaptersInScope: (): number => {
    return AVAILABLE_BOOKS.reduce((sum, book) => sum + book.chapterCount, 0);
  },
  async loadUserProgress(username: string): Promise<UserProgress> {
    try {
      const response = await fetch(`${API_URL}/${username}`);
      if (!response.ok || response.headers.get('content-length') === '0') {
        console.log(`'${username}'에 대한 진행 상황을 찾을 수 없어 기본값을 반환합니다.`);
        return { lastReadBook: '', lastReadChapter: 0, lastReadVerse: 0, history: [], completedChapters: [] };
      }
      const progress = await response.json();
      // Ensure completedChapters is always an array, even if not present in older data
      return { ...progress, completedChapters: progress.completedChapters || [] };
    } catch (error) {
      console.error('사용자 진행 상황 로딩 중 오류 발생:', error);
      return { lastReadBook: '', lastReadChapter: 0, lastReadVerse: 0, history: [], completedChapters: [] };
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
      console.error('Failed to save user progress:', error);
      // Optionally, implement offline storage or retry logic here
    }
  },

  getCompletedChapters: async (username: string): Promise<string[]> => {
    if (!username) return [];
    try {
      // Use loadUserProgress which fetches the full progress object
      const userProgress = await progressService.loadUserProgress(username);
      // completedChapters is guaranteed to be an array by the modified loadUserProgress
      return userProgress.completedChapters || []; 
    } catch (error) {
      console.error('Error fetching completed chapters via loadUserProgress:', error);
      return [];
    }
  },

  calculateCompletionRate: async (username: string): Promise<number> => {
    try {
      const userProgress = await progressService.loadUserProgress(username);
      console.log(`[progressService.ts] calculateCompletionRate - UserProgress for ${username}:`, JSON.stringify(userProgress, null, 2));
      const completedChapters = userProgress.completedChapters || [];
      console.log(`[progressService.ts] calculateCompletionRate - Completed Chapters for ${username}:`, JSON.stringify(completedChapters, null, 2));
      console.log(`[progressService.ts] calculateCompletionRate - TOTAL_CHAPTERS_IN_BIBLE: ${TOTAL_CHAPTERS_IN_BIBLE}`);
      const completedChaptersCount = completedChapters.length;
      if (TOTAL_CHAPTERS_IN_BIBLE === 0) {
        console.warn('[progressService.ts] calculateCompletionRate - TOTAL_CHAPTERS_IN_BIBLE is 0. Returning 0.');
        return 0; // Avoid division by zero
      }
      const rate = completedChaptersCount / TOTAL_CHAPTERS_IN_BIBLE;
      console.log(`[progressService.ts] calculateCompletionRate - Calculated rate for ${username}: ${rate} (Completed: ${completedChaptersCount}, Total: ${TOTAL_CHAPTERS_IN_BIBLE})`);
      return rate;
    } catch (error) {
      console.error(`Error calculating completion rate for ${username}:`, error);
      return 0;
    }
    const completedChapters = await progressService.getCompletedChapters(username);
    const completedCount = completedChapters.length;
    const totalChapters = progressService.getTotalChaptersInScope();
    if (totalChapters === 0) return 0;
    return (completedCount / totalChapters) * 100;
  },
};
