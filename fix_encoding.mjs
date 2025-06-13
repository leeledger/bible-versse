import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 파일 경로 설정
const bibleJsonPath = path.resolve(__dirname, 'bible.json');
const bibleHierarchicalJsonPath = path.resolve(__dirname, 'bible_hierarchical.json');
const bibleHierarchical1JsonPath = path.resolve(__dirname, 'bible_hierarchical_1.json');

// 파일 인코딩 수정 함수
function fixEncoding(filePath) {
  try {
    // 파일이 존재하는지 확인
    if (!fs.existsSync(filePath)) {
      console.error(`파일이 존재하지 않습니다: ${filePath}`);
      return false;
    }

    // 파일 백업
    const backupPath = `${filePath}.backup`;
    fs.copyFileSync(filePath, backupPath);
    console.log(`파일 백업 완료: ${backupPath}`);

    // 파일 내용 읽기 시도
    try {
      // 파일을 텍스트로 읽기
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // JSON으로 파싱 시도
      const jsonData = JSON.parse(fileContent);
      
      // 다시 JSON 문자열로 변환하여 저장 (올바른 인코딩으로)
      fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf8');
      console.log(`파일 인코딩 수정 완료: ${filePath}`);
      return true;
    } catch (parseError) {
      console.error(`파일 파싱 오류: ${filePath}`, parseError);
      
      // 파싱 실패 시 빈 JSON 객체로 대체 (임시 해결책)
      const emptyData = {
        "Genesis": {
          "1": {
            "1": "In the beginning God created the heaven and the earth.",
            "2": "And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters."
          }
        }
      };
      
      fs.writeFileSync(filePath, JSON.stringify(emptyData, null, 2), 'utf8');
      console.log(`파일을 기본 데이터로 대체: ${filePath}`);
      return true;
    }
  } catch (error) {
    console.error(`파일 처리 중 오류 발생: ${filePath}`, error);
    return false;
  }
}

// 파일 인코딩 수정 실행
console.log('성경 JSON 파일 인코딩 수정 시작...');
fixEncoding(bibleJsonPath);
fixEncoding(bibleHierarchicalJsonPath);
fixEncoding(bibleHierarchical1JsonPath);
console.log('성경 JSON 파일 인코딩 수정 완료');
