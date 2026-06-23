# Subject Selector Project Agent Guidelines

This project is a Next.js application for High School Subject Selection ("수강신청").
It uses:
- React (Next.js)
- Tailwind CSS
- xlsx-js-style for Excel Parsing and Exporting
- Lucide React for Icons

## Features
- **1단계 (Curriculum)**: Parses curriculum tables. Expects headers like "학교지정과목" or "지정과목여부" with hours.
- **2단계 (Hierarchy)**: Sets prerequisite hierarchies.
- **3단계 (Upload)**: Uploads 리로스쿨 Excel data.
- **4단계 (Preview)**: Previews data, calculating basic hours (기초 10과목 초과 시 경고), hierarchy violations, duplicates.
- **5단계 (Class Opening)**: Analyzes selected subjects, recommends class counts based on standard class size. Highlights cells during export (`#F18448`, `#6AAADE`).
- **6단계 (Average Hours)**: Combines designated and selected subjects to compute total/average hours by category based on number of teachers.

## Running Locally
Run `npm run dev` to start. Or run `cmd /c npm run build` to verify correctness on Windows.
