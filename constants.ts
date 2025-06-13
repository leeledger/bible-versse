import { BibleVerse, BookChapterInfo } from './types';
import bibleDataRaw from '/public/bible_hierarchical.json';

// AVAILABLE_BOOKS는 그대로 유지
export const AVAILABLE_BOOKS: BookChapterInfo[] = [
  // 구약 (Old Testament)
  { name: "창세기", chapterCount: 50, versesPerChapter: [31, 25, 24, 26, 32 /*, TODO: Add counts for ch 6-50 when data is available */] },
  { name: "출애굽기", chapterCount: 40, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "레위기", chapterCount: 27, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "민수기", chapterCount: 36, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "신명기", chapterCount: 34, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "여호수아", chapterCount: 24, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "사사기", chapterCount: 21, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "룻기", chapterCount: 4, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "사무엘상", chapterCount: 31, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "사무엘하", chapterCount: 24, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "열왕기상", chapterCount: 22, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "열왕기하", chapterCount: 25, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "역대상", chapterCount: 29, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "역대하", chapterCount: 36, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "에스라", chapterCount: 10, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "느헤미야", chapterCount: 13, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "에스더", chapterCount: 10, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "욥기", chapterCount: 42, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "시편", chapterCount: 150, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "잠언", chapterCount: 31, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "전도서", chapterCount: 12, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "아가", chapterCount: 8, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "이사야", chapterCount: 66, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "예레미야", chapterCount: 52, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "예레미야애가", chapterCount: 5, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "에스겔", chapterCount: 48, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "다니엘", chapterCount: 12, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "호세아", chapterCount: 14, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "요엘", chapterCount: 3, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "아모스", chapterCount: 9, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "오바댜", chapterCount: 1, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "요나", chapterCount: 4, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "미가", chapterCount: 7, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "나훔", chapterCount: 3, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "하박국", chapterCount: 3, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "스바냐", chapterCount: 3, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "학개", chapterCount: 2, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "스가랴", chapterCount: 14, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "말라기", chapterCount: 4, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  // 신약 (New Testament)
  { name: "마태복음", chapterCount: 28, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "마가복음", chapterCount: 16, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "누가복음", chapterCount: 24, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "요한복음", chapterCount: 21, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "사도행전", chapterCount: 28, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "로마서", chapterCount: 16, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "고린도전서", chapterCount: 16, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "고린도후서", chapterCount: 13, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "갈라디아서", chapterCount: 6, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "에베소서", chapterCount: 6, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "빌립보서", chapterCount: 4, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "골로새서", chapterCount: 4, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "데살로니가전서", chapterCount: 5, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "데살로니가후서", chapterCount: 3, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "디모데전서", chapterCount: 6, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "디모데후서", chapterCount: 4, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "디도서", chapterCount: 3, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "빌레몬서", chapterCount: 1, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "히브리서", chapterCount: 13, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "야고보서", chapterCount: 5, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "베드로전서", chapterCount: 5, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "베드로후서", chapterCount: 3, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "요한1서", chapterCount: 5, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "요한2서", chapterCount: 1, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "요한3서", chapterCount: 1, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "유다서", chapterCount: 1, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ },
  { name: "요한계시록", chapterCount: 22, versesPerChapter: [] /* TODO: Populate with actual verse counts per chapter for this book */ }
];

// 성경 약어와 전체 이름 매핑 객체 (고정)
export const BOOK_ABBREVIATIONS_MAP: Record<string, string> = {
  "창": "창세기", "출": "출애굽기", "레": "레위기", "민": "민수기", "신": "신명기", "수": "여호수아", "삿": "사사기", "룻": "룻기",
  "삼상": "사무엘상", "삼하": "사무엘하", "왕상": "열왕기상", "왕하": "열왕기하", "대상": "역대상", "대하": "역대하", "스": "에스라", "느": "느헤미야", "에": "에스더",
  "욥": "욥기", "시": "시편", "잠": "잠언", "전": "전도서", "아": "아가", "사": "이사야", "렘": "예레미야", "애": "예레미야애가", "겔": "에스겔", "단": "다니엘",
  "호": "호세아", "욜": "요엘", "암": "아모스", "옵": "오바댜", "욘": "요나", "미": "미가", "나": "나훔", "합": "하박국", "습": "스바냐", "학": "학개", "슥": "스가랴", "말": "말라기",
  "마": "마태복음", "막": "마가복음", "눅": "누가복음", "요": "요한복음", "행": "사도행전", "롬": "로마서", "고전": "고린도전서", "고후": "고린도후서", "갈": "갈라디아서", "엡": "에베소서", "빌": "빌립보서", "골": "골로새서", "살전": "데살로니가전서", "살후": "데살로니가후서", "딤전": "디모데전서", "딤후": "디모데후서", "딛": "디도서", "몬": "빌레몬서", "히": "히브리서", "약": "야고보서", "벧전": "베드로전서", "벧후": "베드로후서", "요일": "요한1서", "요이": "요한2서", "요삼": "요한3서", "유": "유다서", "계": "요한계시록"
};

// 계층 구조 bible_hierarchical.json에서 원하는 범위 구절 추출
export function getVersesForSelection(bookName: string, startChapter: number, endChapter: number): BibleVerse[] {
  const bibleData = bibleDataRaw;
  if (!bibleData) {
    console.error('Bible data is not loaded!');
    return [];
  }

  const book = bibleData[bookName as keyof typeof bibleData];
  if (!book) return [];
  const result: BibleVerse[] = [];
  for (let c = startChapter; c <= endChapter; c++) {
    const chapter = book[c];
    if (!chapter) continue;
    for (const v in chapter) {
      result.push({
        book: bookName,
        chapter: Number(c),
        verse: Number(v),
        text: chapter[v]
      });
    }
  }
  return result;
}

// "창4:17" 같은 문자열을 "창세기 4장 17절"로 변환하는 함수
export function convertAbbrVerseToFullText(abbrVerse: string): string {
  const match = abbrVerse.match(/^([가-힣]+)(\d+):(\d+)$/);
  if (!match) return abbrVerse;
  const [_, abbr, chapter, verse] = match;
  const fullBookName = BOOK_ABBREVIATIONS_MAP[abbr] || abbr;
  return `${fullBookName} ${chapter}장 ${verse}절`;
}
