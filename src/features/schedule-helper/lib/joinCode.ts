const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리기 쉬운 0/O, 1/I 제외

export function generateJoinCode(length = 8): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
