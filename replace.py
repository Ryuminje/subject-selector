import sys

with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target1 = '''                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 25;
                              setStandardClassSize(prev => ({ ...prev, [activeGrade]: val }));
                            }}'''

replacement1 = '''                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 25;
                              setStandardClassSize(prev => ({ ...prev, [activeGrade]: val }));
                              setManualStep5Classes(prev => {
                                const next = { ...prev };
                                Object.keys(next).forEach(k => {
                                  if (k.startsWith(${activeGrade}_)) delete next[k];
                                });
                                return next;
                              });
                            }}'''

content = content.replace(target1, replacement1)

target2 = '''<span className="text-sm text-slate-400">명</span>
                        </div>'''

replacement2 = '''<span className="text-sm text-slate-400">명</span>
                          <button
                            onClick={() => {
                              if (confirm("수동으로 변경한 모든 개설 반 수 데이터를 원래 상태(자동 계산)로 되돌리시겠습니까?")) {
                                setManualStep5Classes(prev => {
                                  const next = { ...prev };
                                  Object.keys(next).forEach(k => {
                                    if (k.startsWith(${activeGrade}_)) delete next[k];
                                  });
                                  return next;
                                });
                              }
                            }}
                            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                            원래 상태로 돌아가기
                          </button>
                        </div>'''

content = content.replace(target2, replacement2)

target3 = '''import { Upload, FileText, Settings, Download, CheckCircle2, ChevronRight, Trash2, File as FileIcon, Save, FolderOpen, GitBranch, Plus, Users } from "lucide-react";'''
replacement3 = '''import { Upload, FileText, Settings, Download, CheckCircle2, ChevronRight, Trash2, File as FileIcon, Save, FolderOpen, GitBranch, Plus, Users, RotateCcw } from "lucide-react";'''

content = content.replace(target3, replacement3)

with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
