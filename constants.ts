import { BibleVerse, BookChapterInfo } from './types';
import bibleDataRaw from '/public/bible_hierarchical.json';

// bibleDataRaw의 타입을 정의 (실제 구조에 맞게 조정 필요)
interface BibleHierarchicalData {
  [bookName: string]: {
    [chapterNum: string]: {
      [verseNum: string]: string;
    };
  };
}

const BIBLE_DATA: BibleHierarchicalData = bibleDataRaw as BibleHierarchicalData;

// AVAILABLE_BOOKS를 bibleDataRaw를 사용하여 동적으로 생성
export const AVAILABLE_BOOKS: BookChapterInfo[] = Object.keys(BIBLE_DATA).map(bookName => {
  const chapters = BIBLE_DATA[bookName];
  const chapterCount = Object.keys(chapters).length;
  const versesPerChapter = Object.keys(chapters)
    .sort((a, b) => parseInt(a) - parseInt(b)) // 장 번호 순으로 정렬
    .map(chapterNum => Object.keys(chapters[chapterNum]).length);
  return { name: bookName, chapterCount, versesPerChapter };
});

export const TOTAL_CHAPTERS_IN_BIBLE = AVAILABLE_BOOKS.reduce((sum, book) => sum + book.chapterCount, 0);

// 특정 책, 장, 절 범위에 해당하는 성경 구절들을 가져오는 함수 (기존 로직 활용)
export const getVersesForSelection = (book: string, startCh: number, endCh: number): BibleVerse[] => {
  const verses: BibleVerse[] = [];
  const bookData = BIBLE_DATA[book];
  if (!bookData) return verses;

  for (let ch = startCh; ch <= endCh; ch++) {
    const chapterStr = ch.toString();
    const chapterData = bookData[chapterStr];
    if (chapterData) {
      Object.keys(chapterData).forEach(verseStr => {
        const verseNum = parseInt(verseStr);
        verses.push({
          book,
          chapter: ch,
          verse: verseNum,
          text: chapterData[verseStr]
        });
      });
    }
  }
  return verses.sort((a, b) => a.chapter === b.chapter ? a.verse - b.verse : a.chapter - b.chapter);
};


// 이어 읽기 시작 위치를 계산하는 함수
export const getNextReadingStart = (
  lastRead: { book: string; chapter: number; verse: number } | null
): { book: string; chapter: number; verse: number } | null => {
  if (!lastRead || !lastRead.book) { // 마지막 읽은 기록이 없으면 첫 번째 책, 1장, 1절부터
    const firstBook = AVAILABLE_BOOKS[0];
    if (!firstBook) return null;
    return { book: firstBook.name, chapter: 1, verse: 1 };
  }

  const currentBookInfo = AVAILABLE_BOOKS.find(b => b.name === lastRead.book);
  if (!currentBookInfo) return null; // 책 정보를 찾을 수 없음

  const currentChapterIndex = lastRead.chapter - 1; // 0-indexed
  if (currentChapterIndex < 0 || currentChapterIndex >= currentBookInfo.versesPerChapter.length) {
    // 유효하지 않은 장 번호 (이런 경우는 없어야 하지만 방어 코드)
    // 이 경우, 해당 책의 첫 장, 첫 절로 안내하거나, 혹은 전체 성경의 처음으로 안내할 수 있습니다.
    // 여기서는 해당 책의 1장 1절로 안내합니다.
    console.warn(`Invalid chapter index ${currentChapterIndex} for book ${lastRead.book}. Defaulting to chapter 1, verse 1.`);
    return { book: currentBookInfo.name, chapter: 1, verse: 1 };
  }

  const versesInCurrentChapter = currentBookInfo.versesPerChapter[currentChapterIndex];

  if (lastRead.verse < versesInCurrentChapter) {
    // 현재 장의 다음 절
    return { book: lastRead.book, chapter: lastRead.chapter, verse: lastRead.verse + 1 };
  } else {
    // 현재 장의 마지막 절을 읽었으므로 다음 장으로 이동
    if (lastRead.chapter < currentBookInfo.chapterCount) {
      // 현재 책의 다음 장
      return { book: lastRead.book, chapter: lastRead.chapter + 1, verse: 1 };
    } else {
      // 현재 책의 마지막 장을 읽었으므로 다음 책으로 이동
      const currentBookIndex = AVAILABLE_BOOKS.findIndex(b => b.name === lastRead.book);
      if (currentBookIndex < AVAILABLE_BOOKS.length - 1) {
        const nextBook = AVAILABLE_BOOKS[currentBookIndex + 1];
        return { book: nextBook.name, chapter: 1, verse: 1 };
      } else {
        // 성경 전체의 마지막 절을 읽음 (예: 요한계시록 마지막 절)
        return null; // 또는 첫 번째 책으로 돌아가거나, 완료 메시지 표시
      }
    }
  }
};

// 성경 약어와 전체 이름 매핑 객체 (기존 코드 유지)
export const BOOK_ABBREVIATIONS_MAP: Record<string, string> = {
  "창": "창세기", "출": "출애굽기", "레": "레위기", "민": "민수기", "신": "신명기", "수": "여호수아", "삿": "사사기", "룻": "룻기",
  "삼상": "사무엘상", "삼하": "사무엘하", "왕상": "열왕기상", "왕하": "열왕기하", "대상": "역대상", "대하": "역대하", "스": "에스라", "느": "느헤미야", "에": "에스더",
  "욥": "욥기", "시": "시편", "잠": "잠언", "전": "전도서", "아": "아가",
  "사": "이사야", "렘": "예레미야", "애": "예레미야애가", "겔": "에스겔", "단": "다니엘",
  "호": "호세아", "욜": "요엘", "암": "아모스", "옵": "오바댜", "욘": "요나", "미": "미가", "나": "나훔", "합": "하박국", "습": "스바냐", "학": "학개", "슥": "스가랴", "말": "말라기",
  "마": "마태복음", "막": "마가복음", "눅": "누가복음", "요": "요한복음", "행": "사도행전",
  "롬": "로마서", "고전": "고린도전서", "고후": "고린도후서", "갈": "갈라디아서", "엡": "에베소서", "빌": "빌립보서", "골": "골로새서",
  "살전": "데살로니가전서", "살후": "데살로니가후서", "딤전": "디모데전서", "딤후": "디모데후서", "딛": "디도서", "몬": "빌레몬서", "히": "히브리서",
  "약": "야고보서", "벧전": "베드로전서", "벧후": "베드로후서", "요일": "요한1서", "요이": "요한2서", "요삼": "요한3서", "유": "유다서", "계": "요한계시록"
};

// "창4:17" 같은 문자열을 "창세기 4장 17절"로 변환하는 함수 (기존 코드 유지)
export const convertAbbrVerseToFullText = (abbrVerse: string): string => {
  const match = abbrVerse.match(/([가-힣]+)(\d+):(\d+)/);
  if (match) {
    const bookAbbr = match[1];
    const chapter = match[2];
    const verse = match[3];
    const fullBookName = BOOK_ABBREVIATIONS_MAP[bookAbbr] || bookAbbr;
    return `${fullBookName} ${chapter}장 ${verse}절`;
  }
  return abbrVerse; // 매칭 실패 시 원본 반환
};
