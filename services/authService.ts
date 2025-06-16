import { User, UserProgress } from '../types';
import { progressService } from './progressService';
import { TOTAL_CHAPTERS_IN_BIBLE } from '../constants';

const USER_SESSION_KEY = 'bible_user';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const ensureUserExists = async (username: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/users/ensure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to ensure user existence:', errorData.message);
      // Optionally, throw an error or handle it as per app's error handling strategy
    } else {
      const data = await response.json();
      console.log('User ensured successfully:', data.message);
    }
  } catch (error) {
    console.error('Error calling ensureUserExists API:', error);
    // Optionally, throw an error or handle it
  }
};

export const loginUser = (username: string): User => {
  const user: User = { username };
  sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
  ensureUserExists(username); // Call ensureUserExists after successful login
  return user;
};

export const logoutUser = (): void => {
  sessionStorage.removeItem(USER_SESSION_KEY);
};

export const getCurrentUser = (): User | null => {
  const userJson = sessionStorage.getItem(USER_SESSION_KEY);
  if (userJson) {
    try {
      return JSON.parse(userJson) as User;
    } catch (e) {
      console.error("Failed to parse user from session storage", e);
      return null;
    }
  }
  return null;
};

export interface UserWithProgress {
  username: string;
  progress: UserProgress;
  completionRate: number; // Added for leaderboard
}

export const getAllUsersWithProgress = async (): Promise<UserWithProgress[]> => {
  try {
    const response = await fetch('/api/users/all');
    if (!response.ok) {
      console.error('Failed to fetch all users progress, status:', response.status);
      return [];
    }
    // API returns an array of user summaries, not a Record<string, UserProgress>
    // Each summary includes: username, lastReadBook, lastReadChapter, lastReadVerse, lastProgressUpdateDate, completedChaptersCount
    const usersSummaryFromApi: Array<{
      username: string;
      lastReadBook: string;
      lastReadChapter: number;
      lastReadVerse: number;
      lastProgressUpdateDate: string | null;
      completedChaptersCount: number;
    }> = await response.json();

    const formattedUsers: UserWithProgress[] = usersSummaryFromApi.map((summary) => {
      // Calculate completionRate based on the entire Bible using completedChaptersCount from API
      const completionRate = TOTAL_CHAPTERS_IN_BIBLE > 0 
        ? (summary.completedChaptersCount / TOTAL_CHAPTERS_IN_BIBLE) * 100 
        : 0;

      return {
        username: summary.username, // Use username directly from API summary
        progress: {
          lastReadBook: summary.lastReadBook || '',
          lastReadChapter: summary.lastReadChapter || 0,
          lastReadVerse: summary.lastReadVerse || 0,
          history: [], // Full history is not provided by this summary API endpoint
          completedChapters: [], // API provides count, not the full array for this summary
          lastProgressUpdateDate: summary.lastProgressUpdateDate === null ? undefined : summary.lastProgressUpdateDate,
        },
        completionRate, // This is now a percentage (0-100)
      };
    });
    return formattedUsers;
  } catch (error) {
    console.error('Error fetching or processing all users progress:', error);
    return []; // 오류 발생 시 빈 배열 반환
  }
};
