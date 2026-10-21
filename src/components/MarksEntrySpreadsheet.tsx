import React, { useState, useMemo, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Search, 
  Sparkles, 
  Trash2, 
  HelpCircle,
  BookOpen,
  ChevronDown,
  Percent,
  CheckCircle,
  Sliders,
  Settings,
  Save,
  Undo
} from 'lucide-react';
import { InstructorCourse } from '../types';
import { apiService } from '../services/apiService';

interface MarksEntrySpreadsheetProps {
  courses: InstructorCourse[];
  selectedCourse: InstructorCourse;
  setCourses: React.Dispatch<React.SetStateAction<InstructorCourse[]>>;
  selectedCategoryName: string;
  setSelectedCategoryName: React.Dispatch<React.SetStateAction<string>>;
  handleSaveQuestionMark: (regNo: string, categoryName: string, unitNo: number, qId: string, value: number) => void;
  handleSaveUnitDirectMark: (regNo: string, categoryName: string, unitNo: number, value: number) => void;
  handleAddInlineQuestion: (categoryName: string, unitNo: number, qName: string, maxMarks: number, mappedCLOs: string[]) => void;
  handleWizardPartition: (categoryName: string, unitNo: number, numQuestions: number) => void;
  handleClearInlineQuestions: (categoryName: string, unitNo: number) => void;
  handleOpenUnitEditor?: (categoryName: string, unitIndex?: number) => void; 
  onShowNotification?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface ColumnGroup {
  id: string;
  label: string;
  colSpan: number;
  type: 'unit' | 'overview';
  unitNo?: number;
}

interface LeafColumn {
  id: string; // e.g. q-id or direct or overview-obtained
  name: string; // e.g. Question 1
  subLabel?: string; // used for Overview subheaders
  maxMarks: number;
  mappedCLOs: string[];
  type: 'question' | 'direct' | 'obtained' | 'weighted';
  unitNo?: number;
  qId?: string;
}

export default function MarksEntrySpreadsheet({
  courses,
  selectedCourse,
  setCourses,
  selectedCategoryName,
  setSelectedCategoryName,
  handleSaveQuestionMark,
  handleSaveUnitDirectMark,
  handleAddInlineQuestion,
  handleWizardPartition,
  handleClearInlineQuestions,
  handleOpenUnitEditor,
  onShowNotification
}: MarksEntrySpreadsheetProps) {

  // Local state for tracking unsaved edited marks
  // draftMarks maps student.regNo -> { markKey -> value }
  const [draftMarks, setDraftMarks] = useState<Record<string, Record<string, number>>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize draftMarks whenever the course or student list changes
  useEffect(() => {
    const initialDraft: Record<string, Record<string, number>> = {};
    selectedCourse.students.forEach(std => {
      initialDraft[std.regNo] = { ...(std.marks || {}) };
    });
    setDraftMarks(initialDraft);
    setIsDirty(false);
  }, [selectedCourse.id, selectedCourse.students]);

  // Handler to permanently save the draft marks back to the parent state and Django backend
  const handleSaveChanges = async () => {
    setIsSaving(true);
    if (onShowNotification) {
      onShowNotification('Saving marks...', 'info');
    }

    try {
      // 1. Compute the new list of courses based on draftMarks and c.id === selectedCourse.id
      const updatedCourses = courses.map(c => {
        if (c.id === selectedCourse.id) {
          // Also keep obe_marks and obeMarks in perfect sync so backend always gets question-wise marks inside obe_marks
          const copyObeMarks = { ...(c.obe_marks || c.obeMarks || {}) };

          const updatedStudents = c.students.map(std => {
            const nextMarks = { ...(draftMarks[std.regNo] || std.student_marks || std.marks || {}) };
            
            if (!copyObeMarks[std.regNo]) {
              copyObeMarks[std.regNo] = {};
            }
            
            // Recompute aggregated unit total aggregates for all categories for this student
            c.categories.forEach(cat => {
              for (let u = 1; u <= cat.units; u++) {
                const matchingUnit = (c.unitsData[cat.name] || []).find(unit => unit.unitNo === u);
                const questions = matchingUnit?.questions || [];
                if (questions.length > 0) {
                  const uTotal = questions.reduce((sum, q) => {
                    const qKey = `q-${cat.name}-${u}-${q.id}`;
                    const score = nextMarks[qKey] ?? 0;
                    
                    // Keep obeMarks updated
                    copyObeMarks[std.regNo][q.id] = score;

                    return sum + score;
                  }, 0);
                  nextMarks[`${cat.name}-${u}`] = uTotal;
                }
              }
            });

            return {
              ...std,
              marks: nextMarks,
              student_marks: nextMarks
            };
          });
          return {
            ...c,
            students: updatedStudents,
            obeMarks: copyObeMarks,
            obe_marks: copyObeMarks
          };
        }
        return c;
      });

      // 2. Update parent state immediately (keeps local UI and localStorage in sync)
      setCourses(updatedCourses);
      if (!apiService.isBackendUser()) {
        localStorage.setItem('IQRA_OBE_INSTRUCTOR_COURSES', JSON.stringify(updatedCourses));
      }

      // 3. Sync to remote Django backend
      try {
        await apiService.saveInstructorCourses(updatedCourses);
        setIsDirty(false);
        if (onShowNotification) {
          onShowNotification('All marks saved successfully to the database!', 'success');
        }
      } catch (syncErr: any) {
        console.error('[ERROR MarksEntrySpreadsheet] Remote DB save failed:', syncErr);
        if (onShowNotification) {
          onShowNotification(`Failed to save marks to database: ${syncErr.message || syncErr}. Please try again.`, 'error');
        }
      }
    } catch (err: any) {
      console.error('Failed to process marks:', err);
      if (onShowNotification) {
        onShowNotification(`Failed to save marks: ${err.message || err}. Please try again.`, 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Handler to revert draft edits back to original course marks
  const handleCancelChanges = () => {
    if (isSaving) return;
    if (confirm('Are you sure you want to discard all unsaved changes?')) {
      const initialDraft: Record<string, Record<string, number>> = {};
      selectedCourse.students.forEach(std => {
        initialDraft[std.regNo] = { ...(std.marks || {}) };
      });
      setDraftMarks(initialDraft);
      setIsDirty(false);
      if (onShowNotification) {
        onShowNotification('Changes discarded.', 'info');
      }
    }
  };
  
  // 1. Get list of all active categories (percentage > 0 && units > 0)
  const activeCategories = useMemo(() => {
    return selectedCourse.categories.filter(cat => cat.percentage > 0 && cat.units > 0);
  }, [selectedCourse]);

  // 2. Resolve the currently selected category object and make sure selection is state-synchronized
  const tempCurrentCategory = useMemo(() => {
    if (activeCategories.length === 0) return null;
    return activeCategories.find(c => c.name === selectedCategoryName) || activeCategories[0];
  }, [activeCategories, selectedCategoryName]);

  const currentCategory = tempCurrentCategory;

  useEffect(() => {
    if (activeCategories.length > 0 && currentCategory) {
      if (selectedCategoryName !== currentCategory.name) {
        setSelectedCategoryName(currentCategory.name);
      }
    }
  }, [activeCategories, currentCategory, selectedCategoryName, setSelectedCategoryName]);

  // 3. Build dynamic leaf columns for all assessment units of the current category
  const unitLeafColumns = useMemo<LeafColumn[]>(() => {
    if (!currentCategory) {
      console.log('[DEBUG MarksEntrySpreadsheet] No current category selected.');
      return [];
    }
    const cols: LeafColumn[] = [];
    
    console.log('[DEBUG MarksEntrySpreadsheet] Building unitLeafColumns:', {
      courseId: selectedCourse.id,
      courseCode: selectedCourse.code,
      currentCategoryName: currentCategory.name,
      unitsCount: currentCategory.units,
      unitsData: selectedCourse.unitsData[currentCategory.name]
    });
    
    // Loop through each unit configured
    for (let u = 1; u <= currentCategory.units; u++) {
      const matchingUnit = (selectedCourse.unitsData[currentCategory.name] || []).find(unit => unit.unitNo === u);
      const questions = matchingUnit?.questions || [];
      
      console.log(`[DEBUG MarksEntrySpreadsheet] Unit ${u}: matchingUnit found? ${!!matchingUnit}, questions length: ${questions.length}`);
      
      if (questions.length > 0) {
        questions.forEach((q, idx) => {
          cols.push({
            id: `q-${currentCategory.name}-${u}-${q.id}`,
            name: q.name || `Question ${idx + 1}`,
            maxMarks: q.maxMarks || 0,
            mappedCLOs: (q.mappedCLOs && q.mappedCLOs.length > 0) ? [q.mappedCLOs[0]] : [],
            type: 'question',
            unitNo: u,
            qId: q.id
          });
        });
      } else {
        cols.push({
          id: `direct-${currentCategory.name}-${u}`,
          name: 'Direct Marks Score',
          maxMarks: matchingUnit ? matchingUnit.totalMarks : 10,
          mappedCLOs: (matchingUnit?.mappedCLOs && matchingUnit.mappedCLOs.length > 0) ? [matchingUnit.mappedCLOs[0]] : ['CLO-1'],
          type: 'direct',
          unitNo: u
        });
      }
    }
    return cols;
  }, [selectedCourse.unitsData, currentCategory]);

  // Total Max Marks across all units in this category combined
  const totalMaxMarksAllUnits = useMemo(() => {
    return unitLeafColumns.reduce((sum, col) => sum + col.maxMarks, 0);
  }, [unitLeafColumns]);

  // 4. Complete list of all headers (Unit Columns + Overview columns on the right)
  const allLeafColumns = useMemo<LeafColumn[]>(() => {
    if (!currentCategory) return [];
    const overviewCols: LeafColumn[] = [
      {
        id: 'overview-obtained',
        name: 'Obtained Total',
        subLabel: 'Sum (Units)',
        maxMarks: totalMaxMarksAllUnits,
        mappedCLOs: ['Sum (Units)'],
        type: 'obtained'
      },
      {
        id: 'overview-weighted',
        name: 'Weighted Marks',
        subLabel: 'Scale Ratio',
        maxMarks: currentCategory.percentage,
        mappedCLOs: ['Scale Ratio'],
        type: 'weighted'
      }
    ];
    return [...unitLeafColumns, ...overviewCols];
  }, [unitLeafColumns, totalMaxMarksAllUnits, currentCategory]);

  // 5. Column groups (for rowspanning group row headers)
  const columnGroups = useMemo<ColumnGroup[]>(() => {
    if (!currentCategory) return [];
    const groups: ColumnGroup[] = [];
    
    for (let u = 1; u <= currentCategory.units; u++) {
      const matchingUnit = (selectedCourse.unitsData[currentCategory.name] || []).find(unit => unit.unitNo === u);
      const questions = matchingUnit?.questions || [];
      const colSpan = questions.length || 1;
      
      groups.push({
        id: `unit-${u}`,
        label: `${currentCategory.name.toUpperCase()} ${u}`,
        colSpan,
        type: 'unit',
        unitNo: u
      });
    }
    
    // Overview Total group
    groups.push({
      id: 'overview',
      label: `OVERVIEW TOTAL (${currentCategory.percentage}%)`,
      colSpan: 2,
      type: 'overview'
    });
    
    return groups;
  }, [currentCategory, selectedCourse.unitsData]);

  // 6. Search filtering of students list
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredStudents = useMemo(() => {
    return selectedCourse.students.filter(std => {
      if (!searchQuery) return true;
      const term = searchQuery.toLowerCase();
      return (
        std.name.toLowerCase().includes(term) ||
        std.regNo.toLowerCase().includes(term)
      );
    });
  }, [selectedCourse.students, searchQuery]);

  // 7. General statistics calculations for active sheets
  const enrolledCount = selectedCourse.students.length;
  
  const evaluatedCount = useMemo(() => {
    if (!currentCategory || unitLeafColumns.length === 0) return 0;
    let count = 0;
    selectedCourse.students.forEach(std => {
      const studentDraft = draftMarks[std.regNo] || {};
      const hasAny = unitLeafColumns.some(col => {
        if (col.type === 'question') {
          const mark = studentDraft[col.id];
          return mark !== undefined && mark !== null && mark > 0;
        } else {
          const dKey = `${currentCategory.name}-${col.unitNo}`;
          const mark = studentDraft[dKey];
          return mark !== undefined && mark !== null && mark > 0;
        }
      });
      if (hasAny) count++;
    });
    return count;
  }, [selectedCourse.students, currentCategory, unitLeafColumns, draftMarks]);

  // Class obtained average across all questions/units
  const classAverage = useMemo(() => {
    if (enrolledCount === 0 || unitLeafColumns.length === 0) return 0;
    let totalSum = 0;
    selectedCourse.students.forEach(std => {
      let stdTotal = 0;
      const studentDraft = draftMarks[std.regNo] || {};
      unitLeafColumns.forEach(col => {
        if (col.type === 'question') {
          stdTotal += studentDraft[col.id] ?? 0;
        } else if (col.type === 'direct') {
          const dKey = `${currentCategory?.name}-${col.unitNo}`;
          stdTotal += studentDraft[dKey] ?? 0;
        }
      });
      totalSum += stdTotal;
    });
    return totalSum / enrolledCount;
  }, [selectedCourse.students, unitLeafColumns, enrolledCount, currentCategory, draftMarks]);

  const classPercentageAvg = totalMaxMarksAllUnits > 0
    ? (classAverage / totalMaxMarksAllUnits) * 100
    : 0;

  // 8. Bulk Operations handlers
  const handleFillMaxAllUnits = () => {
    if (!currentCategory) return;
    if (confirm(`Auto-Fill MAX MARKS (locally in draft) for all ${enrolledCount} students across all ${currentCategory.units} units of ${currentCategory.name}? This will overwrite empty/existing marks with the maximum possible score in draft. You will need to click 'Save Changes' to apply permanently.`)) {
      setDraftMarks(prev => {
        const next = { ...prev };
        selectedCourse.students.forEach(std => {
          const studentDraft = { ...(next[std.regNo] || {}) };
          unitLeafColumns.forEach(col => {
            if (col.type === 'question') {
              studentDraft[col.id] = col.maxMarks;
            } else if (col.type === 'direct') {
              const dKey = `${currentCategory.name}-${col.unitNo}`;
              studentDraft[dKey] = col.maxMarks;
            }
          });
          next[std.regNo] = studentDraft;
        });
        return next;
      });
      setIsDirty(true);
      if (onShowNotification) {
        onShowNotification('Filled max marks in draft. Click "Save Changes" to persist.', 'info');
      }
    }
  };

  const handleClearAllMarksCategory = () => {
    if (!currentCategory) return;
    if (confirm(`Clear entered marks (locally in draft) for all units under ${currentCategory.name}? This action is irreversible once saved. You will need to click 'Save Changes' to apply permanently.`)) {
      setDraftMarks(prev => {
        const next = { ...prev };
        selectedCourse.students.forEach(std => {
          const studentDraft = { ...(next[std.regNo] || {}) };
          unitLeafColumns.forEach(col => {
            if (col.type === 'question') {
              delete studentDraft[col.id];
            } else if (col.type === 'direct') {
              const dKey = `${currentCategory.name}-${col.unitNo}`;
              delete studentDraft[dKey];
            }
          });
          next[std.regNo] = studentDraft;
        });
        return next;
      });
      setIsDirty(true);
      if (onShowNotification) {
        onShowNotification('Cleared marks in draft. Click "Save Changes" to persist.', 'info');
      }
    }
  };

  // Rendering empty states
  if (activeCategories.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center text-slate-500 max-w-xl mx-auto shadow-xs mt-8 animate-fadeIn">
        <ClipboardCheck className="w-12 h-12 text-indigo-500 mx-auto mb-3 opacity-60" />
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-1">No Active Assessments</h3>
        <p className="text-xs text-slate-500 leading-relaxed font-sans">
          You haven't allocated weightages to any category yet. Please navigate to the 
          <strong> Set Weightage</strong> tab to set percentages and add units first.
        </p>
      </div>
    );
  }

  if (!currentCategory) {
    return (
      <div className="p-8 text-center text-slate-400 italic text-xs font-sans">
        Loading active assessment configurations...
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans animate-fadeIn">
      
      {/* SECTION A & D CONTROLS ROW */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 select-none">
        {/* Category selector pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl max-w-fit">
          {activeCategories.map(cat => {
            const isSelected = cat.name === currentCategory.name;
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCategoryName(cat.name)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer flex items-center gap-1.5 focus:outline-none ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5 shrink-0" />
                <span>{cat.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected ? 'bg-indigo-700/60 text-indigo-100' : 'bg-slate-200 text-slate-500'
                }`}>
                  {cat.percentage}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick search input */}
        <div className="relative w-full sm:w-80 group">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-3.5 w-3.5 text-slate-450 group-focus-within:text-indigo-600 transition-colors" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student by name or registration number..."
            className="pl-9 pr-8 py-2 w-full bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-white focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all rounded-xl text-xs font-bold text-slate-800 shadow-xs"
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

      {/* ACTION BAR: Save Changes / Cancel / Unsaved Changes Indicator */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs select-none">
        <div className="flex items-center gap-2">
          {isDirty ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Unsaved Changes: Click "Save Changes" to save modified marks.</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>All marks are up-to-date and saved.</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancelChanges}
            disabled={!isDirty || isSaving}
            className={`px-4 py-2 text-xs font-extrabold uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-all focus:outline-none cursor-pointer ${
              (isDirty && !isSaving) 
                ? 'bg-white border border-slate-350 text-slate-700 hover:bg-slate-100 hover:text-red-650 active:bg-slate-200 shadow-3xs'
                : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Undo className="w-3.5 h-3.5 shrink-0" />
            <span>Cancel</span>
          </button>
          
          <button
            onClick={handleSaveChanges}
            disabled={!isDirty || isSaving}
            className={`px-5 py-2 text-xs font-extrabold uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-all focus:outline-none shadow-xs cursor-pointer ${
              (isDirty && !isSaving)
                ? 'bg-blue-600 border border-blue-700 text-white hover:bg-blue-700 active:bg-blue-800 font-black'
                : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
            ) : (
              <Save className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* SECTION E: CORE EXCEL-LIKE SIDE-BY-SIDE SPREADSHEET */}
      <div className="bg-white border-2 border-slate-300 rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left border-collapse text-xs table-fixed min-w-[800px] border border-slate-300">
            <thead className="bg-[#f8fafc] border-b-2 border-slate-300 text-center text-xs select-none sticky top-0 z-20">
              
              {/* Row 1: Header groupings (e.g. ASSIGNMENTS 1, ASSIGNMENTS 2, etc.) */}
              <tr className="divide-x divide-slate-300 border-b border-slate-300 text-slate-800 font-bold">
                <th rowSpan={4} className="py-3 px-2 w-12 sticky left-0 bg-[#f8fafc] z-30 border-b-2 border-slate-300 text-center border-r-2 border-r-slate-300">S.#</th>
                <th rowSpan={4} className="py-3 px-3 w-36 sticky left-12 bg-[#f8fafc] z-30 border-b-2 border-slate-300 text-left pl-3 text-slate-800 border-r-2 border-r-slate-300 border-l border-l-slate-200">Reg No</th>
                <th rowSpan={4} className="py-3 px-4 w-44 sticky left-48 bg-[#f8fafc] z-30 border-b-2 border-slate-300 text-left pl-3 text-slate-800 border-r-2 border-r-slate-300">Student Name</th>
                
                {columnGroups.map(group => (
                  <th
                    key={group.id}
                    colSpan={group.colSpan}
                    className={`py-2 text-center text-[10.5px] font-black tracking-widest uppercase border-r border-b border-slate-300 ${
                      group.type === 'overview'
                        ? 'bg-indigo-600 text-white border-r-indigo-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {group.label}
                  </th>
                ))}
              </tr>

              {/* Row 2: Leaf column names (e.g. Question 1, Obtained Total) */}
              <tr className="divide-x divide-slate-300 border-b border-slate-300 text-slate-705 font-bold bg-white">
                {allLeafColumns.map(col => (
                  <th 
                    key={col.id} 
                    className={`py-1.5 text-center text-[11px] font-extrabold font-sans border-r border-b border-slate-300 ${
                      col.type === 'obtained' || col.type === 'weighted'
                        ? 'text-indigo-950 bg-indigo-50/40 border-r-indigo-200'
                        : 'text-slate-800'
                    }`}
                  >
                    {col.name}
                  </th>
                ))}
              </tr>

              {/* Row 3: Mapped CLOs (e.g. CLO-1, CLO-2) - AMBER/BEIGE HIGHLIGHTED */}
              <tr className="divide-x divide-slate-300 border-b border-slate-350 text-center">
                {allLeafColumns.map(col => {
                  const isOverview = col.type === 'obtained' || col.type === 'weighted';
                  const clValue = col.mappedCLOs.length > 0 ? col.mappedCLOs.join(', ') : 'CLO-1';
                  return (
                    <th 
                      key={col.id} 
                      className={`py-1 text-center font-mono font-black text-[9.5px] tracking-tight border-r border-b border-slate-300 ${
                        isOverview 
                          ? 'bg-indigo-50 text-indigo-700 border-r-indigo-200' 
                          : 'bg-[#fef3c7] text-[#b45309]'
                      }`}
                    >
                      {clValue}
                    </th>
                  );
                })}
              </tr>

              {/* Row 4: Maximum possible score */}
              <tr className="divide-x divide-slate-300 border-b-2 border-slate-300 bg-slate-50 font-mono text-slate-600 text-[10.5px]">
                {allLeafColumns.map(col => {
                  const isWeighted = col.type === 'weighted';
                  return (
                    <th key={col.id} className="py-1 text-center font-extrabold border-r border-b border-slate-300 text-slate-900 bg-slate-50">
                      {isWeighted ? `${col.maxMarks}%` : col.maxMarks}
                    </th>
                  );
                })}
              </tr>

            </thead>

            {/* TBODY ROW LISTINGS */}
            <tbody className="divide-y divide-slate-300 font-mono text-slate-700 bg-white">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={allLeafColumns.length + 3} className="py-12 text-center text-slate-400 font-sans italic text-xs">
                    No registered students match your search filter query.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, stdIdx) => {
                  
                  // Calculate obtained total on the fly from the local draft state
                  let studentObtainedSum = 0;
                  const studentDraft = draftMarks[student.regNo] || {};
                  unitLeafColumns.forEach(col => {
                    if (col.type === 'question') {
                      studentObtainedSum += studentDraft[col.id] ?? 0;
                    } else if (col.type === 'direct') {
                      const dKey = `${currentCategory.name}-${col.unitNo}`;
                      studentObtainedSum += studentDraft[dKey] ?? 0;
                    }
                  });

                  // Calculate weighted scaled marks
                  const studentWeighted = totalMaxMarksAllUnits > 0
                    ? (studentObtainedSum / totalMaxMarksAllUnits) * currentCategory.percentage
                    : 0;

                  return (
                    <tr key={`${student.regNo || 'std'}-${stdIdx}`} className="hover:bg-slate-50/40 divide-x divide-slate-300 border-b border-slate-300">
                      
                      {/* S.# */}
                      <td className="p-2 text-center text-slate-500 bg-slate-50 sticky left-0 z-10 font-bold select-none border-r-2 border-r-slate-300 border-b border-b-slate-300">
                        {stdIdx + 1}
                      </td>

                      {/* Reg No */}
                      <td className="p-2 pl-3 font-extrabold text-slate-900 bg-white sticky left-12 z-10 text-[10.5px] tracking-wide whitespace-nowrap border-r-2 border-r-slate-300 border-b border-b-slate-300 border-l border-l-slate-200">
                        {student.regNo}
                      </td>

                      {/* Student Name */}
                      <td className="p-2 pl-3 font-semibold text-slate-700 bg-white sticky left-48 z-10 text-left font-sans truncate border-r-2 border-r-slate-300 border-b border-b-slate-300">
                        {student.name}
                      </td>

                      {/* Side-by-side assessment cells */}
                      {allLeafColumns.map((col, colIdx) => {
                        const isOverviewCol = col.type === 'obtained' || col.type === 'weighted';
                        
                        if (isOverviewCol) {
                          // Render computed results
                          if (col.type === 'obtained') {
                            return (
                              <td key={col.id} className="p-2 text-center text-xs font-black text-slate-800 bg-slate-50/50 font-mono border-r border-b border-slate-300 text-slate-900">
                                {studentObtainedSum.toFixed(1)}
                              </td>
                            );
                          } else {
                            const isPassing = (studentObtainedSum / (totalMaxMarksAllUnits || 1)) >= 0.5;
                            return (
                              <td 
                                key={col.id} 
                                className={`p-2 text-center text-xs font-black bg-indigo-50/15 font-mono border-r border-b border-slate-300 ${
                                  isPassing ? 'text-blue-700' : 'text-rose-600'
                                }`}
                              >
                                {studentWeighted.toFixed(1)}
                              </td>
                            );
                          }
                        }

                        // Editable input cell
                        const inputCellId = `cell-${stdIdx}-${colIdx}`;
                        const markKey = col.type === 'question' ? col.id : `${currentCategory.name}-${col.unitNo}`;
                        const cellValue = studentDraft[markKey];

                        const isEmpty = cellValue === 0 || cellValue === undefined;

                        return (
                          <td key={col.id} className="p-1.5 text-center min-w-[90px] border-r border-b border-slate-300">
                            <div className="flex flex-col items-center justify-center leading-none">
                              
                              {/* Rectangular Rounded Input Box styled exactly like the screenshot */}
                              <div className={`flex items-center justify-center py-1 px-1.5 rounded-lg border w-[64px] h-8 transition-all ${
                                isEmpty 
                                  ? 'border-rose-300 bg-rose-50/30 text-rose-600' 
                                  : 'border-slate-300 bg-white text-slate-900 focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500'
                              }`}>
                                <input
                                  id={inputCellId}
                                  type="text"
                                  inputMode="decimal"
                                  value={cellValue !== undefined ? cellValue : ''}
                                  placeholder="0"
                                  className={`w-full text-center font-mono font-bold text-xs bg-transparent border-none outline-none p-0 focus:ring-0 ${
                                    isEmpty ? 'text-rose-600' : 'text-slate-900'
                                  }`}
                                  disabled={selectedCourse?.status === 'closed'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                      const numVal = (val === '' || val === '.') ? 0 : parseFloat(val);
                                      if (numVal > col.maxMarks) {
                                        if (onShowNotification) {
                                          onShowNotification(`Warning: Entered marks (${numVal}) cannot be greater than the maximum marks (${col.maxMarks}) allowed for this assessment.`, 'error');
                                        }
                                        return;
                                      }
                                      setDraftMarks(prev => {
                                        const nextStdDraft = { ...(prev[student.regNo] || {}) };
                                        nextStdDraft[markKey] = numVal;
                                        return {
                                          ...prev,
                                          [student.regNo]: nextStdDraft
                                        };
                                      });
                                      setIsDirty(true);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (isNaN(val) || val < 0) {
                                      setDraftMarks(prev => {
                                        const nextStdDraft = { ...(prev[student.regNo] || {}) };
                                        nextStdDraft[markKey] = 0;
                                        return {
                                          ...prev,
                                          [student.regNo]: nextStdDraft
                                        };
                                      });
                                      setIsDirty(true);
                                    } else if (val > col.maxMarks) {
                                      if (onShowNotification) {
                                        onShowNotification(`Warning: Went over the maximum marks limit. Reverting to maximum (${col.maxMarks}m).`, 'error');
                                      }
                                      setDraftMarks(prev => {
                                        const nextStdDraft = { ...(prev[student.regNo] || {}) };
                                        nextStdDraft[markKey] = col.maxMarks;
                                        return {
                                          ...prev,
                                          [student.regNo]: nextStdDraft
                                        };
                                      });
                                      setIsDirty(true);
                                    }
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  onKeyDown={(e) => {
                                    // Matrix Laptop Keyboard Navigation
                                    if (e.key === 'Enter' || e.key === 'ArrowDown') {
                                      e.preventDefault();
                                      const target = document.getElementById(`cell-${stdIdx + 1}-${colIdx}`);
                                      if (target) (target as HTMLInputElement).focus();
                                    } else if (e.key === 'ArrowUp') {
                                      e.preventDefault();
                                      const target = document.getElementById(`cell-${stdIdx - 1}-${colIdx}`);
                                      if (target) (target as HTMLInputElement).focus();
                                    } else if (e.key === 'ArrowRight') {
                                      const el = e.target as HTMLInputElement;
                                      if (el.selectionEnd === el.value.length || el.value.length === 0) {
                                        const nextCol = colIdx + 1;
                                        if (nextCol < unitLeafColumns.length) {
                                          const target = document.getElementById(`cell-${stdIdx}-${nextCol}`);
                                          if (target) (target as HTMLInputElement).focus();
                                        }
                                      }
                                    } else if (e.key === 'ArrowLeft') {
                                      const el = e.target as HTMLInputElement;
                                      if (el.selectionStart === 0 || el.value.length === 0) {
                                        const prevCol = colIdx - 1;
                                        if (prevCol >= 0) {
                                          const target = document.getElementById(`cell-${stdIdx}-${prevCol}`);
                                          if (target) (target as HTMLInputElement).focus();
                                        }
                                      }
                                    }
                                  }}
                                />
                              </div>

                            </div>
                          </td>
                        );
                      })}

                    </tr>
                  );
                })
              )}
            </tbody>

            {/* CLASS AVERAGES FOOTER ROW */}
            <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-700">
              <tr className="divide-x divide-slate-300 text-center text-[11px] select-none text-slate-800 border-b border-b-slate-300">
                <td colSpan={3} className="py-3 font-sans font-black text-[10px] uppercase text-slate-500 bg-slate-50 sticky left-0 z-10 border-r-2 border-r-slate-300 border-b border-b-slate-300 text-center">
                  Class Averages:
                </td>

                {allLeafColumns.map((col) => {
                  const isOverview = col.type === 'obtained' || col.type === 'weighted';
                  
                  if (col.type === 'obtained') {
                    return (
                      <td key={col.id} className="py-2.5 bg-indigo-50/15 text-center border-r border-b border-slate-300">
                        <span className="text-slate-900 block font-black text-xs font-mono">
                          {classAverage.toFixed(1)}
                        </span>
                      </td>
                    );
                  }

                  if (col.type === 'weighted') {
                    const avgWeighted = totalMaxMarksAllUnits > 0
                      ? (classAverage / totalMaxMarksAllUnits) * currentCategory.percentage
                      : 0;
                    return (
                      <td key={col.id} className="py-2.5 bg-[#ecfdf5] text-center border-r border-b border-slate-300">
                        <span className="text-blue-800 block font-black text-xs font-mono">
                          {avgWeighted.toFixed(1)}%
                        </span>
                      </td>
                    );
                  }

                  // Class average for specific questions
                  let sumOfMarks = 0;
                  selectedCourse.students.forEach(std => {
                    let sc = 0;
                    const studentDraft = draftMarks[std.regNo] || {};
                    if (col.type === 'question') {
                      sc = studentDraft[col.id] ?? 0;
                    } else if (col.type === 'direct') {
                      const dKey = `${currentCategory.name}-${col.unitNo}`;
                      sc = studentDraft[dKey] ?? 0;
                    }
                    sumOfMarks += sc;
                  });

                  const questionAvg = enrolledCount > 0 ? (sumOfMarks / enrolledCount) : 0;

                  return (
                    <td key={col.id} className="py-2.5 bg-white text-center border-r border-b border-slate-300">
                      <span className="text-slate-900 block font-black text-xs font-mono">
                        {questionAvg.toFixed(1)}
                      </span>
                    </td>
                  );
                })}

              </tr>
            </tfoot>

          </table>
        </div>
      </div>

    </div>
  );
}
