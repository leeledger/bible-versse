const fs = require('fs');
const path = require('path');

// 약어 → 전체 이름 매핑 (constants.ts에서 복사)
const BOOK_ABBREVIATIONS_MAP = {
  "창": "창세기",
  "출": "출애굽기",
  "레": "레위기",
  "민": "민수기",
  "신": "신명기",
  "수": "여호수아",
  "삿": "사사기",
  "룻": "룻기",
  "삼상": "사무엘상",
  "삼하": "사무엘하",
  "왕상": "열왕기상",
  "왕하": "열왕기하",
  "대상": "역대상",
  "대하": "역대하",
  "스": "에스라",
  "느": "느헤미야",
  "에": "에스더",
  "욥": "욥기",
  "시": "시편",
  "잠": "잠언",
  "전": "전도서",
  "아": "아가",
  "사": "이사야",
  "렘": "예레미야",
  "애": "예레미야애가",
  "겔": "에스겔",
  "단": "다니엘",
  "호": "호세아",
  "욜": "요엘",
  "암": "아모스",
  "옵": "오바댜",
  "욘": "요나",
  "미": "미가",
  "나": "나훔",
  "합": "하박국",
  "습": "스바냐",
  "학": "학개",
  "슥": "스가랴",
  "말": "말라기",
  "마": "마태복음",
  "막": "마가복음",
  "눅": "누가복음",
  "요": "요한복음",
  "행": "사도행전",
  "롬": "로마서",
  "고전": "고린도전서",
  "고후": "고린도후서",
  "갈": "갈라디아서",
  "엡": "에베소서",
  "빌": "빌립보서",
  "골": "골로새서",
  "살전": "데살로니가전서",
  "살후": "데살로니가후서",
  "딤전": "디모데전서",
  "딤후": "디모데후서",
  "딛": "디도서",
  "몬": "빌레몬서",
  "히": "히브리서",
  "약": "야고보서",
  "벧전": "베드로전서",
  "벧후": "베드로후서",
  "요일": "요한일서",
  "요이": "요한이서",
  "요삼": "요한삼서",
  "유": "유다서",
  "계": "요한계시록"
};

const inputFile = path.join(__dirname, 'bible_hierarchical.json');
const outputFile = path.join(__dirname, 'bible_hierarchical_fullname.json');

const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
const result = {};

for (const abbr in data) {
  const full = BOOK_ABBREVIATIONS_MAP[abbr] || abbr;
  result[full] = data[abbr];
}

fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf-8');
console.log('변환 완료:', outputFile);
