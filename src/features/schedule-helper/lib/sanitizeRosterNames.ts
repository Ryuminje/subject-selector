// 각 항목 trim → 빈 값 제거 → 중복 제거, 첫 등장 순서는 그대로 보존 (재정렬 금지 — 순서 자체가 의미를 가짐)
export function sanitizeRosterNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    const name = typeof item === "string" ? item.trim() : "";
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}
