/**
 * 클립보드 텍스트를 격자 데이터로 바꿉니다.
 *
 * 엑셀에서 여러 칸을 선택해 복사하면 열은 탭(`\t`), 행은 개행으로 구분된 텍스트가
 * 클립보드에 담깁니다. 시험 시간표 격자에 그대로 붙여넣을 수 있도록 이 형태를
 * 2차원 배열로 되돌립니다.
 */

/**
 * 클립보드 텍스트를 `string[][]`로 파싱합니다.
 *
 * 엑셀은 복사 범위 끝에 개행을 하나 더 붙이는 경우가 많아, 그 결과로 생기는
 * 빈 마지막 행은 버립니다. 각 셀의 앞뒤 공백과 `\r`은 제거합니다.
 */
export function parseClipboardGrid(text: string): string[][] {
  const rows = text
    .replace(/\r/g, '')
    .split('\n')
    .map((row) => row.split('\t').map((cell) => cell.trim()));

  while (
    rows.length > 1 &&
    rows[rows.length - 1].length === 1 &&
    rows[rows.length - 1][0] === ''
  ) {
    rows.pop();
  }

  return rows;
}
