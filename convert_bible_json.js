const fs = require('fs');
const path = require('path');

// 원본 flat 구조 파일명
const inputFile = path.join(__dirname, 'bible.json');
// 변환될 파일명
const outputFile = path.join(__dirname, 'bible_hierarchical.json');

const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
const hierarchical = {};

for (const key in data) {
  // key 예시: "창10:29"
  const match = key.match(/^([가-힣]+)(\d+):(\d+)$/);
  if (!match) continue;
  const [_, book, chapter, verse] = match;

  if (!hierarchical[book]) hierarchical[book] = {};
  if (!hierarchical[book][chapter]) hierarchical[book][chapter] = {};
  hierarchical[book][chapter][verse] = data[key];
}

fs.writeFileSync(outputFile, JSON.stringify(hierarchical, null, 2), 'utf-8');
console.log('변환 완료:', outputFile);
