import sys

with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Define the function as a standalone
standalone_func = '''function normalizeSubjectName(name: string): string {
  if (!name) return "";
  let normalized = name.trim().replace(/\s+/g, "");

  // 1. 유니코드 로마자 (Ⅰ, Ⅱ, Ⅲ, Ⅳ, Ⅴ) -> 영어 알파벳 (I, II, III, IV, V)으로 통일
  normalized = normalized
    .replace(/Ⅰ/g, "I")
    .replace(/Ⅱ/g, "II")
    .replace(/Ⅲ/g, "III")
    .replace(/Ⅳ/g, "IV")
    .replace(/Ⅴ/g, "V");

  // 2. 아라비아 숫자 (1, 2, 3, 4, 5) -> 영어 알파벳 (I, II, III, IV, V)으로 통일 (과목명 끝의 숫자)
  normalized = normalized
    .replace(/1$/, "I")
    .replace(/2$/, "II")
    .replace(/3$/, "III")
    .replace(/4$/, "IV")
    .replace(/5$/, "V");

  return normalized;
}'''

# 1. Insert standalone function
if 'function normalizeSubjectName' not in content:
    target_insert = 'type GradeKey = "pre1" | "grade1" | "grade2";'
    if target_insert in content:
        content = content.replace(target_insert, target_insert + '\n\n' + standalone_func)

# 2. Remove old function definition inside Home
old_func_start = '  const normalizeSubjectName = (name: string): string => {'
old_func_end = '  };'
start_idx = content.find(old_func_start)
if start_idx != -1:
    end_idx = content.find(old_func_end, start_idx) + len(old_func_end)
    # Remove the old function
    content = content[:start_idx] + content[end_idx:]

# 3. Update handleCurriculumUpload
target_curriculum = 'const individualSubjects = subjectNameRaw.split("↔").map(s => s.trim());'
replace_curriculum = 'const individualSubjects = subjectNameRaw.split("↔").map(s => normalizeSubjectName(s.trim()));'
content = content.replace(target_curriculum, replace_curriculum)

with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
