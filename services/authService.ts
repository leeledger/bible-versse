import { User, UserProgress } from '../types';

const USER_SESSION_KEY = 'bible_user';

export const loginUser = (username: string): User => {
  const user: User = { username };
  sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
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

interface UserWithProgress {
  username: string;
  progress: UserProgress;
}

export const getAllUsersWithProgress = async (): Promise<UserWithProgress[]> => {
  try {
    const response = await fetch('/api/users/all'); // Vite proxy를 통해 백엔드 호출
    if (!response.ok) {
      console.error('Failed to fetch all users progress, status:', response.status);
      return [];
    }
    const allUserData: Record<string, UserProgress> = await response.json();
    
    // 데이터베이스 객체를 배열 형태로 변환
    // 각 사용자에 대해 기본 UserProgress 구조를 보장 (혹시 모를 불완전한 데이터 대비)
    const formattedUsers: UserWithProgress[] = Object.entries(allUserData).map(([username, progressData]) => ({
      username,
      progress: {
        lastReadBook: progressData?.lastReadBook || '',
        lastReadChapter: progressData?.lastReadChapter || 0,
        lastReadVerse: progressData?.lastReadVerse || 0,
        history: progressData?.history || [],
      },
    }));
    return formattedUsers;
  } catch (error) {
    console.error('Error fetching or processing all users progress:', error);
    return []; // 오류 발생 시 빈 배열 반환
  }
};
