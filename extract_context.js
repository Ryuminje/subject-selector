const fs = require('fs');
const lines = fs.readFileSync('src/app/page.tsx', 'utf8').split('\n');

let allStates = [];
let insideHome = false;

for (const line of lines) {
  if (line.includes('export default function Home()')) insideHome = true;
  if (!insideHome) continue;
  if (line.includes('const [') && line.includes('useState')) {
    allStates.push(line);
  }
  if (line.includes('const handleDeleteSampleUpload')) break;
}

let contextHook = `import React, { createContext, useContext, useState, ReactNode } from "react";
import { GradeKey, ParsedCurriculumSubject, SubjectMap, HierarchyRule, StudentTimeData } from "../types";

interface SurveyContextType {
${allStates.map(line => {
  const match = line.match(/const \[([a-zA-Z0-9_]+), ([a-zA-Z0-9_]+)\]/);
  if (match) return `  ${match[1]}: any;\n  ${match[2]}: any;`;
  return '';
}).join('\n')}
}

const SurveyContext = createContext<SurveyContextType | undefined>(undefined);

export const SurveyProvider = ({ children }: { children: ReactNode }) => {
${allStates.join('\n')}

  const value = {
${allStates.map(line => {
  const match = line.match(/const \[([a-zA-Z0-9_]+), ([a-zA-Z0-9_]+)\]/);
  if (match) return `    ${match[1]},\n    ${match[2]},`;
  return '';
}).join('\n')}
  };

  return <SurveyContext.Provider value={value}>{children}</SurveyContext.Provider>;
};

export const useSurveyContext = () => {
  const context = useContext(SurveyContext);
  if (context === undefined) {
    throw new Error('useSurveyContext must be used within a SurveyProvider');
  }
  return context;
};
`;
fs.mkdirSync('src/context', { recursive: true });
fs.writeFileSync('src/context/SurveyContext.tsx', contextHook);

console.log('Context generated successfully!');
