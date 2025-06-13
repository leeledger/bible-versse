
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY for Gemini is not set. Please ensure the process.env.API_KEY environment variable is configured.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY || "MISSING_API_KEY" }); // Fallback to prevent crash if key is missing, though it won't work.

export const getReflectionFromGemini = async (biblePassage: string): Promise<string> => {
  if (!API_KEY) {
    return "Gemini API 키가 설정되지 않아 묵상을 생성할 수 없습니다. 관리자에게 문의하세요.";
  }

  const model = "gemini-2.5-flash-preview-04-17";
  const prompt = `다음은 사용자가 방금 읽은 성경 구절들입니다:

---
${biblePassage}
---

이 구절들에 대한 짧고(1~2 문단) 격려가 되며 이해하기 쉬운 묵상을 작성해주세요. 응답은 한국어로 해주세요.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: prompt,
      // For general tasks like reflection, default thinkingConfig is fine (thinking enabled).
    });
    return response.text;
  } catch (error) {
    console.error("Error fetching reflection from Gemini:", error);
    if (error instanceof Error) {
        if (error.message.includes("API key not valid")) {
             return "Gemini API 키가 유효하지 않습니다. 확인 후 다시 시도해주세요.";
        }
         return `Gemini API 요청 중 오류가 발생했습니다: ${error.message}`;
    }
    return "Gemini API 요청 중 알 수 없는 오류가 발생했습니다.";
  }
};
    