const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const { JSDOM } = require('jsdom');
const { SVGPathData } = require('svg-pathdata');

async function convertSvgToPng(svgPath, pngPath, width, height) {
  try {
    // SVG 파일 읽기
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    
    // Canvas 생성
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // 배경색 설정 (필요한 경우)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // SVG를 Data URL로 변환
    const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
    
    // 이미지 로드 및 그리기
    const img = await loadImage(svgDataUrl);
    ctx.drawImage(img, 0, 0, width, height);
    
    // PNG로 저장
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(pngPath, buffer);
    
    console.log(`Converted ${svgPath} to ${pngPath}`);
  } catch (error) {
    console.error(`Error converting ${svgPath}:`, error);
  }
}

// 파비콘 변환 (32x32)
convertSvgToPng(
  path.join(__dirname, 'public', 'images', 'favicon.svg'),
  path.join(__dirname, 'public', 'images', 'favicon.png'),
  32, 32
);

// 애플 터치 아이콘 변환 (180x180)
convertSvgToPng(
  path.join(__dirname, 'public', 'images', 'favicon.svg'),
  path.join(__dirname, 'public', 'images', 'apple-touch-icon.png'),
  180, 180
);

// OG 이미지 변환 (1200x630)
convertSvgToPng(
  path.join(__dirname, 'public', 'images', 'og-image.svg'),
  path.join(__dirname, 'public', 'images', 'og-image.png'),
  1200, 630
);
