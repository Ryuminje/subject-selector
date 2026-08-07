// Gemini가 돌려주는 영어 오류를 선생님이 읽고 무엇을 하면 되는지 알 수 있는 문장으로 바꿉니다.
//
// 원문을 그대로 노출하면(예: "You exceeded your current quota, please check your plan and
// billing details...") 무엇이 잘못됐는지도, 다음에 뭘 해야 하는지도 알 수 없습니다.
// 알 수 없는 오류만 원문을 덧붙여 실마리를 남깁니다.

interface GeminiErrorBody {
  error?: { status?: string; message?: string };
}

export function describeGeminiError(httpStatus: number, json: unknown): string {
  const body = json as GeminiErrorBody;
  const status = body?.error?.status;
  const raw = body?.error?.message?.trim();

  if (httpStatus === 429 || status === "RESOURCE_EXHAUSTED") {
    return "지금 Gemini 요청이 한도를 넘었습니다. 잠시 뒤에 '다시 분석'을 눌러주세요. 자주 그러면 파일을 한 번에 여러 개 올리지 말고 하나씩 올려보세요.";
  }
  if (httpStatus === 400 && status === "INVALID_ARGUMENT") {
    return "Gemini가 요청을 거부했습니다. 등록된 API 키가 올바른지 확인해 주세요.";
  }
  if (httpStatus === 401 || httpStatus === 403 || status === "PERMISSION_DENIED") {
    return "Gemini API 키가 거부됐습니다. 연수 이수증 수거 화면의 공통 설정에서 관리자가 키를 다시 등록해 주세요.";
  }
  if (httpStatus >= 500 || status === "UNAVAILABLE") {
    return "Gemini 서버가 일시적으로 응답하지 않습니다. 잠시 뒤에 '다시 분석'을 눌러주세요.";
  }

  return raw ? `Gemini 오류 (HTTP ${httpStatus}): ${raw}` : `Gemini 요청이 실패했습니다 (HTTP ${httpStatus}).`;
}
