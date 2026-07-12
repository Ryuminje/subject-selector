const fs = require('fs');
const lines = fs.readFileSync('src/app/page.tsx', 'utf8').split('\n');

let demandStates = [];
let changeStates = [];
let insideHome = false;

for (const line of lines) {
  if (line.includes('export default function Home()')) insideHome = true;
  if (!insideHome) continue;
  if (line.includes('const [') && line.includes('useState')) {
    if (line.includes('change') || line.includes('Change') || line.includes('extraUploads') || line.includes('grade2HistoryData') || line.includes('grade3Sem1HistoryData')) {
      changeStates.push(line);
    } else {
      demandStates.push(line);
    }
  }
  if (line.includes('const handleDeleteSampleUpload')) break;
}

// Generate useDemandSurveyState
let demandHook = `import { useState } from "react";
import { GradeKey, ParsedCurriculumSubject, SubjectMap, HierarchyRule, StudentTimeData } from "../types";

export const useDemandSurveyState = () => {
${demandStates.join('\n')}
  
  return {
${demandStates.map(line => {
  const match = line.match(/const \[([a-zA-Z0-9_]+), ([a-zA-Z0-9_]+)\]/);
  if (match) return `    ${match[1]},\n    ${match[2]},`;
  return '';
}).join('\n')}
  };
};
`;
fs.writeFileSync('src/hooks/useDemandSurveyState.ts', demandHook);

// Generate useChangeState
let changeHook = `import { useState } from "react";
import { GradeKey, ParsedCurriculumSubject, SubjectMap, HierarchyRule, StudentTimeData } from "../types";

export const useChangeState = () => {
${changeStates.join('\n')}
  
  return {
${changeStates.map(line => {
  const match = line.match(/const \[([a-zA-Z0-9_]+), ([a-zA-Z0-9_]+)\]/);
  if (match) return `    ${match[1]},\n    ${match[2]},`;
  return '';
}).join('\n')}
  };
};
`;
fs.writeFileSync('src/hooks/useChangeState.ts', changeHook);

console.log('Hooks generated successfully!');
