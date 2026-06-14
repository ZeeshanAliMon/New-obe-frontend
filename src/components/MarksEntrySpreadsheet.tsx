import React, { useState, useMemo, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Search, 
  Sparkles, 
  Sliders, 
  Plus, 
  Trash, 
  FileSpreadsheet 
} from 'lucide-react';
import { InstructorCourse, MarksCategory } from '../types';
import { getStudentMark } from './InstructorDashboard';

interface MarksEntrySpreadsheetProps {
  selectedCourse: InstructorCourse;
  setCourses: React.Dispatch<React.SetStateAction<InstructorCourse[]>>;
  selectedCategoryName: string;
  setSelectedCategoryName: React.Dispatch<React.SetStateAction<string>>;
  handleSaveQuestionMark: (regNo: string, categoryName: string, unitNo: number, qId: string, value: number) => void;
  handleSaveUnitDirectMark: (regNo: string, categoryName: string, unitNo: number, value: number) => void;
  handleAddInlineQuestion: (categoryName: string, unitNo: number, qName: string, maxMarks: number, mappedCLOs: string[]) => void;
  handleWizardPartition: (categoryName: string, unitNo: number, numQuestions: number) => void;
  handleClearInlineQuestions: (categoryName: string, unitNo: number) => void;
}

export default function MarksEntrySpreadsheet({
  selectedCourse,
  setCourses,
  selectedCategoryName,
  setSelectedCategoryName,
  handleSaveQuestionMark,
  handleSaveUnitDirectMark,
  handleAddInlineQuestion,
  handleWizardPartition,
  handleClearInlineQuestions
}: MarksEntrySpreadsheetProps) {
  // Find active categories (percentage > 0)
  const activeCategories = useMemo(() => {
    return selectedCourse.categories.filter(cat => cat.percentage > 0);
  }, [selectedCourse.categories]);

  // Find current category object
  const currentCategory = useMemo(() => {
    return activeCategories.find(c => c.name === selectedCategoryName) || null;
  }, [activeCategories, selectedCategoryName]);

  // Dynamic search query for students
  const [searchQuery, setSearchQuery] = useState('');

  // Active unit settings drawer being configured (1-indexed)
  const [activeUnitConfigNo, setActiveUnitConfigNo] = useState<number | null>(null);

  // Form states for creating custom questions inline
  const [inlineQName, setInlineQName] = useState('');
  const [inlineQMaxMarks, setInlineQMaxMarks] = useState('5');
  const [inlineQMappedCLOs, setInlineQMappedCLOs] = useState<string[]>([]);
  const [wizardNumQuestions, setWizardNumQuestions] = useState<number>(3);

  // If active category has no units active, reset activeUnitConfigNo
  useEffect(() => {
    setActiveUnitConfigNo(null);
  }, [selectedCategoryName]);

  // If no active categories configured
  if (activeCategories.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center text-slate-500 max-w-xl mx-auto shadow-sm mt-8 animate-fadeIn">
        <ClipboardCheck className="w-12 h-12 text-indigo-505 mx-auto mb-3 opacity-60" />
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-1">No Active Assessments</h3>
        <p className="text-xs text-slate-500 leading-relaxed font-sans">
          You haven't allocated weightages to any category yet. Please navigate to the 
          <strong> Set Weightage</strong> tab to set percentages and add units first.
        </p>
      </div>
    );
  }

  if (!currentCategory) return null;

  // Generate 1-indexed list of units for active category
  const activeUnits = Array.from({ length: currentCategory.units }, (_, idx) => idx + 1);

  // Flattened grid columns for student entries
  // Each item corresponds to an enterable column (subquestion or direct unit mark)
  interface GridColumn {
    id: string; // unique internal key
    uNo: number;
    type: 'question' | 'direct';
    qId?: string;
    name: string;
    maxMarks: number;
    mappedCLOs: string[];
  }

  const columns: GridColumn[] = [];
  activeUnits.forEach(u => {
    const matchingUnit = (selectedCourse.unitsData[selectedCategoryName] || []).find(unit => unit.unitNo === u);
    const questions = matchingUnit?.questions || [];
    if (questions.length > 0) {
      questions.forEach(q => {
        columns.push({
          id: `question-${u}-${q.id}`,
          uNo: u,
          type: 'question',
          qId: q.id,
          name: q.name,
          maxMarks: q.maxMarks || 0,
          mappedCLOs: q.mappedCLOs || []
        });
      });
    } else {
      columns.push({
        id: `direct-${u}`,
        uNo: u,
        type: 'direct',
        name: `Unit ${u} Direct`,
        maxMarks: matchingUnit ? matchingUnit.totalMarks : 10,
        mappedCLOs: matchingUnit?.mappedCLOs || ['CLO-1']
      });
    }
  });

  // Filter student list by search text
  const filteredStudents = selectedCourse.students.filter(student => {
    if (!searchQuery) return true;
    const qLower = searchQuery.toLowerCase();
    return (
      student.name.toLowerCase().includes(qLower) ||
      student.regNo.toLowerCase().includes(qLower)
    );
  });

  // Calculate overall assessment statistics
  const enrolledCount = selectedCourse.students.length;
  let totalAchievedMarks = 0;
  let totalPossibleMax = 0;
  let gradedRowsCount = 0;

  selectedCourse.students.forEach(student => {
    let studentSum = 0;
    let studentMax = 0;
    let hasGraded = false;

    activeUnits.forEach(u => {
      const matchingUnit = (selectedCourse.unitsData[selectedCategoryName] || []).find(un => un.unitNo === u);
      const unitMax = matchingUnit ? matchingUnit.totalMarks : 10;
      const score = getStudentMark(student, selectedCategoryName, u, unitMax, selectedCourse.unitsData);
      
      if (score > 0) hasGraded = true;
      studentSum += score;
      studentMax += unitMax;
    });

    if (hasGraded) gradedRowsCount++;
    totalAchievedMarks += studentSum;
    totalPossibleMax += studentMax;
  });

  const generalAverage = totalPossibleMax > 0 ? (totalAchievedMarks / enrolledCount) : 0;
  const averagePercentage = totalPossibleMax > 0 ? (totalAchievedMarks / (enrolledCount * (totalPossibleMax / enrolledCount)) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* 1. Header Ribbon Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-indigo-600 shrink-0" />
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider select-none">
            Ledger spreadsheet: <span className="text-indigo-650 normal-case font-bold">{selectedCategoryName}</span>
          </h3>
        </div>

        {/* Right tools and inputs */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Quick Helper Actions */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto select-none">
            <button
              onClick={() => {
                if (confirm(`Auto-Fill MAX MARKS for ALL students in this Evaluation Category (${selectedCategoryName})? Empty cells will be overwritten with maximum score values.`)) {
                  setCourses(prev => prev.map(c => {
                    if (c.id === selectedCourse.id) {
                      const updatedStudents = c.students.map(std => {
                        const nextMarks = { ...(std.marks || {}) };
                        activeUnits.forEach(u => {
                          const matchingUnit = (c.unitsData[selectedCategoryName] || []).find(unit => unit.unitNo === u);
                          const questions = matchingUnit?.questions || [];
                          if (questions.length > 0) {
                            questions.forEach(q => {
                              nextMarks[`q-${selectedCategoryName}-${u}-${q.id}`] = q.maxMarks;
                            });
                            nextMarks[`${selectedCategoryName}-${u}`] = matchingUnit ? matchingUnit.totalMarks : 10;
                          } else {
                            nextMarks[`${selectedCategoryName}-${u}`] = matchingUnit ? matchingUnit.totalMarks : 10;
                          }
                        });
                        return { ...std, marks: nextMarks };
                      });
                      return { ...c, students: updatedStudents };
                    }
                    return c;
                  }));
                }
              }}
              className="px-2.5 py-1.5 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-[#4f46e5] rounded-md border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer"
              title="Fill all empty score cells with maximum possible marks"
            >
              <Sparkles className="w-3 h-3 text-indigo-550 shrink-0 animate-pulse" />
              Fill Max Marks
            </button>
            
            <button
              onClick={() => {
                if (confirm(`Clear and reset ALL student marks in this Category (${selectedCategoryName})?`)) {
                  setCourses(prev => prev.map(c => {
                    if (c.id === selectedCourse.id) {
                      const updatedStudents = c.students.map(std => {
                        const nextMarks = { ...(std.marks || {}) };
                        activeUnits.forEach(u => {
                          const matchingUnit = (c.unitsData[selectedCategoryName] || []).find(unit => unit.unitNo === u);
                          const questions = matchingUnit?.questions || [];
                          if (questions.length > 0) {
                            questions.forEach(q => {
                              nextMarks[`q-${selectedCategoryName}-${u}-${q.id}`] = 0;
                            });
                          }
                          nextMarks[`${selectedCategoryName}-${u}`] = 0;
                        });
                        return { ...std, marks: nextMarks };
                      });
                      return { ...c, students: updatedStudents };
                    }
                    return c;
                  }));
                }
              }}
              className="px-2.5 py-1.5 text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-[#dc2626] rounded-md border border-rose-200 transition-colors cursor-pointer"
              title="Reset all grades in this category"
            >
              Reset Scores
            </button>
          </div>

          <div className="w-px h-6 bg-slate-200 hidden sm:block" />

          {/* Search input to quickly filter list */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-slate-400" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student Name / Reg..."
              className="pl-9 pr-8 py-1.5 w-56 bg-white border border-slate-300 hover:border-slate-400 focus:border-indigo-550 focus:outline-none transition-all rounded-lg text-xs font-semibold text-slate-800"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-650 text-sm font-bold"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. EXCEL-LIKE MAIN WORKSPACE GRID */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-3xs overflow-hidden">
        
        {/* Statistics info banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b border-slate-150 bg-slate-50/55 select-none text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Students Registered</span>
            <span className="text-[14px] font-black text-slate-800 font-mono">
              {enrolledCount} <span className="text-[11px] font-normal text-slate-400">rows</span>
            </span>
          </div>
          <div className="border-l border-slate-150 pl-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Graded rows</span>
            <span className="text-[14px] font-black text-slate-800 font-mono">
              {gradedRowsCount} <span className="text-[11px] font-normal text-slate-400">graded</span>
            </span>
          </div>
          <div className="border-l border-slate-150 pl-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Class average</span>
            <span className="text-[14px] font-black text-indigo-650 font-mono">
              {generalAverage.toFixed(1)} <span className="text-[11px] font-normal text-slate-400">avg</span>
            </span>
          </div>
          <div className="border-l border-slate-150 pl-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Average Percentage</span>
            <span className="text-[14px] font-black text-emerald-600 font-mono">
              {averagePercentage.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Master Ledger Grid Table frame */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse text-xs table-fixed">
            
            {/* Hierarchical Header Matrix */}
            <thead className="sticky top-0 bg-[#f8fafc] border-b border-slate-300 z-10 select-none shadow-3xs text-center text-[11px]">
              
              {/* Row 1: Merged Categories & Units */}
              <tr className="divide-x divide-slate-200 border-b border-slate-300 text-[#0f172a] font-bold">
                <th rowSpan={4} className="py-2.5 w-12 sticky left-0 bg-[#f8fafc] z-20 text-center font-bold border-b border-slate-300">S.#</th>
                <th rowSpan={4} className="py-2.5 w-28 sticky left-12 bg-[#f8fafc] z-20 text-left pl-3 text-slate-800 font-bold border-b border-slate-300">Reg No</th>
                <th rowSpan={4} className="py-2.5 w-36 sticky left-40 bg-[#f8fafc] z-20 text-left pl-3 text-slate-800 font-bold border-b border-slate-300">Student Name</th>
                
                {activeUnits.length > 0 ? (
                  activeUnits.map(u => {
                    const matchingUnit = (selectedCourse.unitsData[selectedCategoryName] || []).find(unit => unit.unitNo === u);
                    const questions = matchingUnit?.questions || [];
                    const colSpan = questions.length > 0 ? questions.length : 1;
                    return (
                      <th 
                        key={u} 
                        colSpan={colSpan} 
                        className="py-2.5 font-sans font-black bg-indigo-650 text-white uppercase border-r border-slate-200 text-center text-xs tracking-wider select-none"
                      >
                        {selectedCategoryName} {u}
                      </th>
                    );
                  })
                ) : (
                  <th className="py-2 font-sans font-black bg-indigo-50 text-indigo-950 uppercase border-r border-slate-200 text-center text-xs">
                    No Components Configured
                  </th>
                )}
                
                <th colSpan={2} className="py-2 font-sans font-black bg-slate-200 text-slate-850 uppercase text-center text-[10.5px] tracking-wide border-b border-slate-200">
                  Overview Total ({currentCategory.percentage}%)
                </th>
              </tr>

              {/* Row 2: Sub-item Question/Direct marks labels */}
              <tr className="divide-x divide-slate-200 border-b border-slate-200 text-slate-705">
                {columns.map(col => (
                  <th key={col.id} className="py-1 bg-white font-black text-slate-800 font-sans text-center text-xs">
                    {col.type === 'question' ? col.name : `Unit ${col.uNo} Direct Marks`}
                  </th>
                ))}
                <th className="py-1 bg-[#f1f5f9] font-sans font-black text-center text-slate-700 text-xs">Obtained Total</th>
                <th className="py-1 bg-[#f1f5f9] font-sans font-black text-center text-indigo-650 text-xs">Weighted Marks</th>
              </tr>

              {/* Row 3: CLO target mappings */}
              <tr className="divide-x divide-slate-200 border-b border-slate-200 text-indigo-900 leading-tight">
                {columns.map(col => (
                  <th key={col.id} className="py-1 bg-amber-50/75 font-mono font-bold text-[10px] text-center select-none text-amber-800">
                    {col.mappedCLOs.length > 0 ? col.mappedCLOs.join(', ') : 'CLO-1'}
                  </th>
                ))}
                <th className="py-1 bg-[#f8fafc] text-center text-[9px] text-slate-450 italic select-none">Sum (Units)</th>
                <th className="py-1 bg-[#f8fafc] text-center text-[9px] text-indigo-500 italic select-none font-sans">Scale Ratio</th>
              </tr>

              {/* Row 4: Maximum possible score */}
              <tr className="divide-x divide-slate-200 border-b border-slate-300 text-slate-700 select-none font-mono text-xs font-bold bg-slate-50">
                {columns.map(col => (
                  <th key={col.id} className="py-1 text-center font-black text-slate-800">
                    {col.maxMarks}
                  </th>
                ))}
                {(() => {
                  const maxTotal = columns.reduce((acc, c) => acc + c.maxMarks, 0);
                  return (
                    <>
                      <th className="py-1 text-slate-600 text-center font-black">{maxTotal}</th>
                      <th className="py-1 text-indigo-700 text-center font-black">{currentCategory.percentage}%</th>
                    </>
                  );
                })()}
              </tr>

            </thead>

            {/* Table Dynamic Content Rows */}
            <tbody className="divide-y divide-slate-150 font-mono text-slate-705">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 5} className="py-10 text-center text-slate-400 font-sans italic text-xs">
                    No registered student matches your query.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, stdIdx) => {
                  // Recompute obtained aggregates on the fly
                  let totalObtained = 0;
                  let totalMaxPossible = 0;

                  activeUnits.forEach(u => {
                    const matchingUnit = (selectedCourse.unitsData[selectedCategoryName] || []).find(unit => unit.unitNo === u);
                    const unitMax = matchingUnit ? matchingUnit.totalMarks : 10;
                    const obtainedMark = getStudentMark(student, selectedCategoryName, u, unitMax, selectedCourse.unitsData);
                    totalObtained += obtainedMark;
                    totalMaxPossible += unitMax;
                  });

                  const weightedMarksStr = totalMaxPossible > 0 
                    ? ((totalObtained / totalMaxPossible) * currentCategory.percentage).toFixed(1) 
                    : '0.0';

                  return (
                    <tr key={student.regNo} className="hover:bg-slate-50/40 divide-x divide-slate-150">
                      
                      {/* S.# */}
                      <td className="p-2 text-center text-slate-400 bg-slate-50 sticky left-0 z-10 font-bold select-none">
                        {stdIdx + 1}
                      </td>

                      {/* Reg No sticky */}
                      <td className="p-2 pl-3 font-extrabold text-indigo-950 bg-white sticky left-12 z-10 text-[10.5px] tracking-wide truncate">
                        {student.regNo}
                      </td>

                      {/* Student Name sticky */}
                      <td className="p-2 pl-3 font-semibold text-slate-700 bg-white sticky left-40 z-10 text-left font-sans truncate">
                        {student.name}
                      </td>

                      {/* Marks entry cells corresponding to each column */}
                      {columns.map((col, colIdx) => {
                        const cellId = `excel-unified-cell-${stdIdx}-${colIdx}`;
                        let cellValueStr = '';

                        if (col.type === 'question') {
                          const qKey = `q-${selectedCategoryName}-${col.uNo}-${col.qId}`;
                          cellValueStr = student.marks?.[qKey] !== undefined ? String(student.marks[qKey]) : '';
                        } else {
                          const dKey = `${selectedCategoryName}-${col.uNo}`;
                          cellValueStr = student.marks?.[dKey] !== undefined ? String(student.marks[dKey]) : '';
                        }

                        return (
                          <td key={colIdx} className="p-1 text-center min-w-[90px]">
                            <div className="flex flex-col items-center justify-center leading-none">
                              <input
                                id={cellId}
                                type="text"
                                inputMode="decimal"
                                pattern="[0-9]*\.?[0-9]*"
                                value={cellValueStr}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                    const numVal = val === '' ? 0 : parseFloat(val);
                                    if (col.type === 'question') {
                                      handleSaveQuestionMark(student.regNo, selectedCategoryName, col.uNo, col.qId!, numVal);
                                    } else {
                                      handleSaveUnitDirectMark(student.regNo, selectedCategoryName, col.uNo, numVal);
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (isNaN(val) || val < 0) {
                                    if (col.type === 'question') {
                                      handleSaveQuestionMark(student.regNo, selectedCategoryName, col.uNo, col.qId!, 0);
                                    } else {
                                      handleSaveUnitDirectMark(student.regNo, selectedCategoryName, col.uNo, 0);
                                    }
                                  } else if (val > col.maxMarks) {
                                    if (col.type === 'question') {
                                      handleSaveQuestionMark(student.regNo, selectedCategoryName, col.uNo, col.qId!, col.maxMarks);
                                    } else {
                                      handleSaveUnitDirectMark(student.regNo, selectedCategoryName, col.uNo, col.maxMarks);
                                    }
                                  }
                                }}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => {
                                  // Excel navigation
                                  if (e.key === 'Enter' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    const tgt = document.getElementById(`excel-unified-cell-${stdIdx + 1}-${colIdx}`);
                                    if (tgt) (tgt as HTMLInputElement).focus();
                                  } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    const tgt = document.getElementById(`excel-unified-cell-${stdIdx - 1}-${colIdx}`);
                                    if (tgt) (tgt as HTMLInputElement).focus();
                                  } else if (e.key === 'ArrowRight') {
                                    const el = e.target as HTMLInputElement;
                                    if (el.selectionEnd === el.value.length || el.value.length === 0) {
                                      const tgt = document.getElementById(`excel-unified-cell-${stdIdx}-${colIdx + 1}`);
                                      if (tgt) (tgt as HTMLInputElement).focus();
                                    }
                                  } else if (e.key === 'ArrowLeft') {
                                    const el = e.target as HTMLInputElement;
                                    if (el.selectionStart === 0 || el.value.length === 0) {
                                      const tgt = document.getElementById(`excel-unified-cell-${stdIdx}-${colIdx - 1}`);
                                      if (tgt) (tgt as HTMLInputElement).focus();
                                    }
                                  }
                                }}
                                className={`w-14 text-center font-mono font-extrabold text-xs bg-slate-50/50 border border-slate-205 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all ${
                                  cellValueStr === '0' || cellValueStr === '' ? 'text-rose-500 font-medium' : 'text-slate-900 font-extrabold'
                                }`}
                              />
                              <span className="text-[10px] text-slate-400 font-semibold select-none mt-0.5">/ {col.maxMarks}m</span>
                            </div>
                          </td>
                        );
                      })}

                      {/* Raw and Weighted Obtained Totals columns */}
                      <td className="p-2 text-center text-xs font-black text-slate-800 bg-slate-100/30">
                        {totalObtained.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">/ {totalMaxPossible}</span>
                      </td>
                      <td className="p-2 text-center text-xs font-black text-[#4f46e5] bg-indigo-50/20">
                        {weightedMarksStr} <span className="text-[10px] text-slate-400 font-normal">/ {currentCategory.percentage}%</span>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Class Outcome Averages calculation foot */}
            <tfoot className="border-t-2 border-slate-200 bg-slate-100 font-semibold text-slate-700">
              <tr className="divide-x divide-slate-150 text-center text-[11px] select-none text-slate-800">
                <td colSpan={3} className="py-2.5 font-sans font-black text-[10px] uppercase text-slate-500 sticky left-0 bg-slate-100 z-10 border-r text-center">
                  Class averages:
                </td>

                {columns.map((col, colIdx) => {
                  let sumOfMarks = 0;
                  selectedCourse.students.forEach(std => {
                    let sc = 0;
                    if (col.type === 'question') {
                      sc = std.marks?.[`q-${selectedCategoryName}-${col.uNo}-${col.qId}`] ?? 0;
                    } else {
                      sc = std.marks?.[`${selectedCategoryName}-${col.uNo}`] ?? 0;
                    }
                    sumOfMarks += sc;
                  });
                  const avg = selectedCourse.students.length > 0 ? (sumOfMarks / selectedCourse.students.length) : 0;
                  const pct = col.maxMarks > 0 ? (avg / col.maxMarks) * 105 : 0;

                  return (
                    <td key={colIdx} className="py-2 bg-white text-center">
                      <span className="text-slate-900 block font-black text-xs font-mono">{avg.toFixed(1)}</span>
                      <span className="text-[9.5px] text-slate-400 font-normal">{Math.min(100, pct).toFixed(0)}% avg</span>
                    </td>
                  );
                })}

                {/* Obtained Raw average and Weighted average */}
                {(() => {
                  let sumOfRawObtained = 0;
                  let sumOfWeightedScore = 0;
                  let totalMaxPossible = 0;

                  activeUnits.forEach(u => {
                    const matchingUnit = (selectedCourse.unitsData[selectedCategoryName] || []).find(unit => unit.unitNo === u);
                    totalMaxPossible += matchingUnit ? matchingUnit.totalMarks : 10;
                  });

                  selectedCourse.students.forEach(std => {
                    let rawObtained = 0;
                    activeUnits.forEach(u => {
                      const matchingUnit = (selectedCourse.unitsData[selectedCategoryName] || []).find(unit => unit.unitNo === u);
                      const unitMax = matchingUnit ? matchingUnit.totalMarks : 10;
                      rawObtained += getStudentMark(std, selectedCategoryName, u, unitMax, selectedCourse.unitsData);
                    });

                    sumOfRawObtained += rawObtained;
                    if (totalMaxPossible > 0) {
                      sumOfWeightedScore += (rawObtained / totalMaxPossible) * currentCategory.percentage;
                    }
                  });

                  const avgRawObtained = selectedCourse.students.length > 0 ? (sumOfRawObtained / selectedCourse.students.length) : 0;
                  const avgWeighted = selectedCourse.students.length > 0 ? (sumOfWeightedScore / selectedCourse.students.length) : 0;

                  return (
                    <>
                      <td className="py-2 bg-indigo-50/20 text-[#0f172a] font-black text-xs text-center font-mono">
                        {avgRawObtained.toFixed(1)} / {totalMaxPossible}
                      </td>
                      <td className="py-2 bg-indigo-100/20 text-indigo-700 font-black text-xs text-center font-mono">
                        {avgWeighted.toFixed(1)} / {currentCategory.percentage}%
                      </td>
                    </>
                  );
                })()}

              </tr>
            </tfoot>

          </table>
        </div>

      </div>

    </div>
  );
}
