// 연수 이수증 이미지에서 이수번호/이수기관/이수날짜를 Gemini 2.5 Flash로 추출.
// 원본 Google Apps Script(Code.gs)의 extractCertificateInfo를 fetch 기반으로 그대로 이식.

export interface CertificateExtraction {
  number: string | null;
  institution: string | null;
  date: string | null;
}

const PROMPT = `이 이수증 이미지에서 아래 3가지 정보를 추출해줘.
1) 이수번호: '제 OO교육연수원-원격-XXXX-XXXXXX호' 형식이면 전체 출력, 숫자만 있으면 그대로, 못 찾으면 빈 문자열
2) 이수기관: 연수를 주관한 기관명, 못 찾으면 빈 문자열
3) 이수날짜: YYYY-MM-DD 형식, 못 찾으면 빈 문자열
반드시 아래 JSON 형식으로만 응답:
{"number": "이수번호", "institution": "이수기관", "date": "이수날짜"}`;

export async function analyzeCertificateImage(
  apiKey: string,
  bytes: Buffer,
  mimeType: string
): Promise<CertificateExtraction> {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const base64Data = bytes.toString("base64");

  const payload = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: base64Data } },
        ],
      },
    ],
  };

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!res.ok) {
      return { number: null, institution: null, date: null };
    }

    const rawText: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return { number: null, institution: null, date: null };

    const cleaned = rawText.trim().replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      return {
        number: (parsed.number || "").trim() || null,
        institution: (parsed.institution || "").trim() || null,
        date: (parsed.date || "").trim() || null,
      };
    } catch {
      return { number: null, institution: null, date: null };
    }
  } catch {
    return { number: null, institution: null, date: null };
  }
}
