import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import WeightageAndStudents from './instructor/WeightageAndStudents';
import Toast from './Toast';
import * as XLSX from 'xlsx';
import { 
  BookOpen, 
  Settings, 
  Trash2, 
  Plus, 
  Check, 
  AlertTriangle, 
  Users, 
  FileSpreadsheet, 
  ChevronRight, 
  ChevronLeft, 
  ArrowLeft,
  ChevronDown,
  LogOut, 
  BookOpenCheck,
  Building,
  GraduationCap,
  Save,
  Sliders,
  Sparkles,
  ClipboardList,
  Flame,
  Info,
  Upload,
  Pencil,
  X,
  Award,
  FileText,
  Percent,
  Edit3,
  Trash,
  ClipboardCheck,
  Search,
  Printer,
  Download,
  RefreshCw,
  Lock
} from 'lucide-react';
import { apiService, BASE_URL } from '../services/apiService';
import { Course, Department, Program, MarksCategory, UnitItem, UnitQuestion, CourseStudent, InstructorCourse, OBEData } from '../types';
import MarksEntrySpreadsheet from './MarksEntrySpreadsheet';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

const areRegNosEqual = (reg1: string | null | undefined, reg2: string | null | undefined): boolean => {
  if (!reg1 || !reg2) return false;
  const r1 = String(reg1).trim().toLowerCase();
  const r2 = String(reg2).trim().toLowerCase();
  if (r1 === r2) return true;

  const norm1 = r1.replace(/[^a-z0-9]/g, '');
  const norm2 = r2.replace(/[^a-z0-9]/g, '');
  if (norm1 === norm2) return true;

  // Handle cases where one registration number might miss a prefix or department code (e.g., 052-SP23-22144 vs SP23-22144)
  // We only match if one normalized registration number is a suffix of the other.
  if (norm1.endsWith(norm2) || norm2.endsWith(norm1)) {
    const minLen = Math.min(norm1.length, norm2.length);
    if (minLen >= 4) return true;
  }

  return false;
};

interface InstructorDashboardProps {
  onLogout: () => void;
  instructorName?: string;
}

// Prefix generator for dynamic column naming based on category
export const getCategoryPrefix = (name: string): string => {
  if (name.toLowerCase().includes('assign')) return 'A';
  if (name.toLowerCase().includes('quiz')) return 'Q';
  if (name.toLowerCase().includes('session')) return 'Sess';
  if (name.toLowerCase().includes('mid')) return 'Mid';
  if (name.toLowerCase().includes('final')) return 'Final';
  if (name.toLowerCase().includes('project')) return 'Proj';
  if (name.toLowerCase().includes('present')) return 'Pres';
  if (name.toLowerCase().includes('participat')) return 'CP';
  return name.split(' ').map(w => w[0]).join('').toUpperCase();
};

export const formatGACodeToStandard = (id: string): string => {
  if (!id || id === 'No GA' || id === 'None') return id || 'No GA';
  const matches = id.match(/\d+/);
  if (matches) {
    return `GA${matches[0]}`;
  }
  return id;
};

const DEFAULT_CUSTOM_GRADES = [
  { grade: 'A', percentage: '88% - 100%', points: '4' },
  { grade: 'B+', percentage: '81% - 87%', points: '3.5' },
  { grade: 'B', percentage: '74% - 80%', points: '3' },
  { grade: 'C+', percentage: '67% - 73%', points: '2.5' },
  { grade: 'C', percentage: '60% - 66%', points: '2' },
  { grade: 'F', percentage: 'Below 60%', points: '0' },
];

// Precise score extractor returning 0 by default, dynamically aggregating question marks if defined
export const getStudentMark = (
  student: CourseStudent,
  categoryName: string,
  unitNo: number,
  totalMarks: number,
  unitsData?: Record<string, UnitItem[]>
): number => {
  if (unitsData && unitsData[categoryName]) {
    const matchingUnit = unitsData[categoryName].find(u => u.unitNo === unitNo);
    if (matchingUnit && matchingUnit.questions && matchingUnit.questions.length > 0) {
      // Sum question-level marks stored in student.marks as q-${categoryName}-${unitNo}-${questionId}
      return matchingUnit.questions.reduce((sum, q) => {
        const qKey = `q-${categoryName}-${unitNo}-${q.id}`;
        return sum + (student.marks?.[qKey] ?? 0);
      }, 0);
    }
  }

  if (student.marks && student.marks[`${categoryName}-${unitNo}`] !== undefined) {
    return student.marks[`${categoryName}-${unitNo}`];
  }
  return 0; // No dummy data, instructor must enter student marks
};

// Safe and accurate Iqra letter grade lookup
export const getLetterGrade = (marks: number): string => {
  if (marks >= 88) return 'A';
  if (marks >= 81) return 'B+';
  if (marks >= 74) return 'B';
  if (marks >= 67) return 'C+';
  if (marks >= 60) return 'C';
  return 'F';
};

// Safe parser for student ranges formatted like "X% - Y%" or "Below X%"
export const parsePercentRange = (pctStr: string): { min: number; max: number } => {
  if (!pctStr) return { min: 0, max: 0 };
  const clean = pctStr.replace(/%/g, '').trim();
  if (clean.toLowerCase().includes('below')) {
    const val = parseInt(clean.replace(/below/i, '').trim(), 10);
    return { min: 0, max: isNaN(val) ? 0 : val };
  }
  const parts = clean.split(/[-–to]/);
  if (parts.length === 2) {
    const minVal = parseInt(parts[0].trim(), 10);
    const maxVal = parseInt(parts[1].trim(), 10);
    return {
      min: isNaN(minVal) ? 0 : minVal,
      max: isNaN(maxVal) ? 0 : maxVal
    };
  }
  const single = parseInt(clean, 10);
  return { min: isNaN(single) ? 0 : single, max: isNaN(single) ? 0 : single };
};

// Dynamic grade computer that respects course active evaluation system
export const getCourseLetterGrade = (marks: number, course?: any): string => {
  if (!course) return getLetterGrade(marks);

  const system = course.selectedGradingSystem || 'ready1';
  
  if (system === 'ready1') {
    return getLetterGrade(marks);
  }

  if (system === 'ready2') {
    if (marks >= 90) return 'A+';
    if (marks >= 85) return 'A';
    if (marks >= 80) return 'A-';
    if (marks >= 75) return 'B+';
    if (marks >= 70) return 'B';
    if (marks >= 65) return 'B-';
    if (marks >= 60) return 'C+';
    if (marks >= 55) return 'C';
    if (marks >= 50) return 'D';
    return 'F';
  }
  
  if (system === 'custom') {
    const list = course.customGradingSystem || DEFAULT_CUSTOM_GRADES;
    // Look through defined ranges
    for (const tier of list) {
      const range = parsePercentRange(tier.percentage);
      if (marks >= range.min && marks <= range.max) {
        return tier.grade;
      }
    }
    // Simple fallback using sorted list
    const sorted = [...list].sort((a, b) => {
      const rA = parsePercentRange(a.percentage);
      const rB = parsePercentRange(b.percentage);
      return rA.min - rB.min;
    });
    if (sorted.length > 0) {
      const lowestRange = parsePercentRange(sorted[0].percentage);
      if (marks < lowestRange.min) return 'F';
      
      const highestRange = parsePercentRange(sorted[sorted.length - 1].percentage);
      if (marks > highestRange.max) return sorted[sorted.length - 1].grade;
    }
  }
  
  return getLetterGrade(marks);
};

// High-fidelity cell input with focus controls, constraint capping, and zero/fail red text styling
export function CellInput({
  initialValue,
  totalMarks,
  rowIndex,
  colIndex,
  onSave
}: {
  initialValue: number;
  totalMarks: number;
  rowIndex: number;
  colIndex: number;
  onSave: (val: number) => void;
}) {
  const [val, setVal] = useState<string>(initialValue.toString());

  useEffect(() => {
    setVal(initialValue.toString());
  }, [initialValue]);

  const handleBlur = () => {
    let num = parseFloat(val);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > totalMarks) num = totalMarks; // cap score to max unit marks defined
    setVal(parseFloat(num.toFixed(1)).toString());
    onSave(parseFloat(num.toFixed(1)));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tgt = e.currentTarget;
      tgt.blur();
      setTimeout(() => {
        const nextInput = document.querySelector<HTMLInputElement>(
          `input[data-row="${rowIndex + 1}"][data-col="${colIndex}"]`
        );
        if (nextInput) {
          nextInput.focus();
        }
      }, 50);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const tgt = e.currentTarget;
      tgt.blur();
      setTimeout(() => {
        const nextInput = document.querySelector<HTMLInputElement>(
          `input[data-row="${rowIndex + 1}"][data-col="${colIndex}"]`
        );
        if (nextInput) {
          nextInput.focus();
        }
      }, 50);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const tgt = e.currentTarget;
      tgt.blur();
      setTimeout(() => {
        const prevInput = document.querySelector<HTMLInputElement>(
          `input[data-row="${rowIndex - 1}"][data-col="${colIndex}"]`
        );
        if (prevInput) {
          prevInput.focus();
        }
      }, 50);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const tgt = e.currentTarget;
      tgt.blur();
      setTimeout(() => {
        const prevColInput = document.querySelector<HTMLInputElement>(
          `input[data-row="${rowIndex}"][data-col="${colIndex - 1}"]`
        );
        if (prevColInput) {
          prevColInput.focus();
        }
      }, 50);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const tgt = e.currentTarget;
      tgt.blur();
      setTimeout(() => {
        const nextColInput = document.querySelector<HTMLInputElement>(
          `input[data-row="${rowIndex}"][data-col="${colIndex + 1}"]`
        );
        if (nextColInput) {
          nextColInput.focus();
        }
      }, 50);
    }
  };

  const currentScore = parseFloat(val) || 0;
  const isFailed = currentScore === 0;

  return (
    <input
      type="text"
      value={val}
      data-row={rowIndex}
      data-col={colIndex}
      onChange={(e) => setVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onFocus={(e) => e.target.select()}
      className={`w-12 px-1 py-0.5 text-center bg-transparent border-0 font-mono text-[11px] font-bold outline-none rounded transition-all focus:ring-2 focus:ring-indigo-400 focus:bg-indigo-50/70 ${
        isFailed ? 'text-rose-600 focus:text-rose-700' : 'text-blue-700'
      }`}
    />
  );
}



// Initial defaults to start entirely from scratch without pre-distributed dummy values.
const INITIAL_CATEGORIES: MarksCategory[] = [
  { name: 'Assignments', percentage: 0, units: 0 },
  { name: 'Quizzes', percentage: 0, units: 0 },
  { name: 'Class Participation', percentage: 0, units: 0 },
  { name: 'Class Project', percentage: 0, units: 0 },
  { name: 'Project', percentage: 0, units: 0 },
  { name: 'Presentation', percentage: 0, units: 0 },
  { name: 'Lab Project', percentage: 0, units: 0 },
  { name: 'Problem Based Learning', percentage: 0, units: 0 },
  { name: 'Complex Problem', percentage: 0, units: 0 },
  { name: 'Open Ended Lab', percentage: 0, units: 0 },
  { name: 'Other Activities', percentage: 0, units: 0 },
  { name: 'Viva', percentage: 0, units: 0 },
  { name: 'Lab Performance', percentage: 0, units: 0 },
  { name: 'Lab Reports', percentage: 0, units: 0 },
  { name: 'Mid Term', percentage: 0, units: 0 },
  { name: 'Final', percentage: 0, units: 0 },
];

const INITIAL_UNITS_DATA: Record<string, UnitItem[]> = {
  'Assignments': [],
  'Quizzes': [],
  'Class Participation': [],
  'Class Project': [],
  'Project': [],
  'Presentation': [],
  'Lab Project': [],
  'Problem Based Learning': [],
  'Complex Problem': [],
  'Open Ended Lab': [],
  'Other Activities': [],
  'Viva': [],
  'Lab Performance': [],
  'Lab Reports': [],
  'Mid Term': [],
  'Final': [],
};

const THEORY_CATEGORY_NAMES = [
  'Assignments',
  'Quizzes',
  'Class Participation',
  'Class Project',
  'Presentation',
  'Problem Based Learning',
  'Other Activities',
  'Mid Term',
  'Final',
];

const LAB_CATEGORY_NAMES = [
  'Mid Term',
  'Final',
  'Lab Reports',
  'Lab Performance',
  'Viva',
  'Assignments',
  'Quizzes',
  'Open Ended Lab',
  'Other Activities',
  'Project',
];

const getShortLabel = (catName: string, unitNo: number, totalUnits: number): string => {
  const lower = catName.toLowerCase();
  let prefix = catName;
  if (lower.startsWith('assignment')) {
    prefix = 'A';
  } else if (lower.startsWith('quiz')) {
    prefix = 'Q';
  } else if (lower.startsWith('presentation')) {
    prefix = 'PR';
  } else if (lower.includes('mid term') || lower.includes('mid-term') || lower.includes('midterm')) {
    prefix = 'MT';
  } else if (lower.startsWith('final')) {
    prefix = 'FT';
  } else if (lower.startsWith('lab report')) {
    prefix = 'LR';
  } else if (lower.startsWith('lab performance')) {
    prefix = 'LP';
  } else if (lower.startsWith('viva')) {
    prefix = 'V';
  } else if (lower.includes('open ended') || lower.includes('open-ended')) {
    prefix = 'OEL';
  } else if (lower.includes('project')) {
    prefix = 'P';
  } else if (lower.includes('attendance')) {
    prefix = 'Att';
  } else if (lower.includes('other')) {
    prefix = 'Other';
  } else {
    prefix = catName.length > 5 ? catName.substring(0, 3).toUpperCase() : catName.toUpperCase();
  }

  if (prefix === 'A' || prefix === 'Q' || totalUnits > 1) {
    return `${prefix}${unitNo}`;
  }
  return prefix;
};

const normalizeCourse = (course: InstructorCourse): InstructorCourse => {
  console.log('[DEBUG normalizeCourse] Entering with course:', {
    id: course.id,
    code: course.code,
    title: course.title,
    obeQuestionsLength: (course.obeQuestions || (course as any).obe_questions || []).length,
    unitsDataKeys: course.unitsData ? Object.keys(course.unitsData) : null
  });
  let courseType: 'Theory' | 'Lab' = 'Theory';
  const code = String(course.code || '').trim().toUpperCase();
  const title = String(course.title || '').trim().toLowerCase();

  if (code.endsWith('L') || title.includes('lab')) {
    courseType = 'Lab';
  } else {
    const raw = (course as any).courseType || (course as any).course_subtype || (course as any).courseSubtype || (course as any).subtype;
    if (raw) {
      courseType = String(raw).toLowerCase().includes('lab') ? 'Lab' : 'Theory';
    } else if ((course as any).course_type) {
      const ct = String((course as any).course_type).toLowerCase();
      if (ct === 'lab' || ct === 'theory') {
        courseType = ct === 'lab' ? 'Lab' : 'Theory';
      }
    }
  }

  const allowedNames = courseType === 'Lab' ? LAB_CATEGORY_NAMES : THEORY_CATEGORY_NAMES;

  const rawCategories = course.categories || (course as any).categories || [];
  let updatedCategories = rawCategories.filter((c: any) => 
    c.name !== 'Sessionals' && 
    c.name !== 'Sessional' &&
    allowedNames.includes(c.name)
  );

  const typeCats = INITIAL_CATEGORIES.filter(cat => allowedNames.includes(cat.name));

  typeCats.forEach(initCat => {
    const exists = updatedCategories.some(c => c.name === initCat.name);
    if (!exists) {
      updatedCategories.push({ ...initCat });
    }
  });

  const catOrder = typeCats.map(c => c.name);
  updatedCategories.sort((a, b) => catOrder.indexOf(a.name) - catOrder.indexOf(b.name));

  // Extract and normalize obeQuestions first so we can use it to populate unitsData if needed
  const rawObeQuestions = course.obeQuestions || (course as any).obe_questions || [];
  const parsedObeQuestions = rawObeQuestions.map((q: any) => {
    return {
      id: q.id || '',
      categoryName: q.categoryName || q.category_name || '',
      unitNo: q.unitNo !== undefined ? q.unitNo : (q.unit_no !== undefined ? q.unit_no : 1),
      questionName: q.questionName || q.question_name || q.name || '',
      maxMarks: q.maxMarks !== undefined ? q.maxMarks : (q.max_marks !== undefined ? q.max_marks : 10),
      mappedCLOs: q.mappedCLOs || q.mapped_clos || q.mappedClos || []
    };
  });

  // Extract unitsData supporting both camelCase and snake_case from python backend
  const rawUnitsData = course.unitsData || (course as any).units_data || {};
  const updatedUnitsData: Record<string, UnitItem[]> = {};

  updatedCategories.forEach(cat => {
    const key = cat.name;
    const numUnits = cat.units || 0;
    const rawList = rawUnitsData[key] || [];
    const unitsList: UnitItem[] = [];

    for (let uNo = 1; uNo <= numUnits; uNo++) {
      // Find matching raw unit if any
      const rawUnit = Array.isArray(rawList) ? rawList.find((ru: any) => {
        const rNo = ru.unitNo !== undefined ? ru.unitNo : (ru.unit_no !== undefined ? ru.unit_no : 1);
        return rNo === uNo;
      }) : null;

      const unitNo = uNo;
      const passing = rawUnit?.passing !== undefined ? rawUnit.passing : (rawUnit?.passing_marks !== undefined ? rawUnit.passing_marks : 5);
      const totalMarks = rawUnit?.totalMarks !== undefined ? rawUnit.totalMarks : (rawUnit?.total_marks !== undefined ? rawUnit.total_marks : 10);
      const weightage = rawUnit?.weightage !== undefined ? rawUnit.weightage : (numUnits > 0 ? parseFloat((100 / numUnits).toFixed(1)) : 0);
      const mappedCLOs = rawUnit?.mappedCLOs || rawUnit?.mapped_clos || rawUnit?.mappedClos || [];

      let rawQs = rawUnit?.questions || rawUnit?.unit_questions || [];

      // Robust Fallback: if rawQs is empty, but parsedObeQuestions contains questions for this category and unit, populate them!
      if ((!rawQs || rawQs.length === 0) && parsedObeQuestions.length > 0) {
        const matchingObeQs = parsedObeQuestions.filter(
          (oq: any) => oq.categoryName === key && oq.unitNo === unitNo
        );
        if (matchingObeQs.length > 0) {
          rawQs = matchingObeQs.map((oq: any) => ({
            id: oq.id,
            name: oq.questionName,
            maxMarks: oq.maxMarks,
            mappedCLOs: oq.mappedCLOs
          }));
        }
      }

      const questions = (rawQs || []).map((q: any) => {
        const qCLOs = q.mappedCLOs || q.mapped_clos || q.mappedClos || [];
        return {
          id: q.id || '',
          name: q.name || q.questionName || q.question_name || '',
          maxMarks: q.maxMarks !== undefined ? q.maxMarks : (q.max_marks !== undefined ? q.max_marks : 10),
          mappedCLOs: qCLOs.length > 0 ? [qCLOs[0]] : []
        };
      });

      const isPresentation = key.toLowerCase().includes('presentation');
      let formattedQuestions = questions.map((q: any) => {
        if (isPresentation && (q.name.toLowerCase().startsWith('question') || q.name.toLowerCase().startsWith('q'))) {
          const match = q.name.match(/\d+$/);
          const numStr = match ? match[0] : '';
          return {
            ...q,
            name: numStr ? `Module ${numStr}` : 'Module'
          };
        }
        return q;
      });

      if (formattedQuestions.length === 0) {
        const labelPrefix = isPresentation ? 'Module' : 'Question';
        formattedQuestions = [
          {
            id: `q-default-${unitNo}-${Date.now()}`,
            name: `${labelPrefix} 1`,
            maxMarks: totalMarks || 10,
            mappedCLOs: mappedCLOs.length > 0 ? [mappedCLOs[0]] : ['CLO-1']
          }
        ];
      }

      const finalUnitMappedCLOs = Array.from(new Set<string>(formattedQuestions.flatMap(q => (q.mappedCLOs || []) as string[]))).sort();

      unitsList.push({
        unitNo,
        passing,
        totalMarks,
        weightage,
        mappedCLOs: finalUnitMappedCLOs,
        questions: formattedQuestions
      });
    }

    updatedUnitsData[key] = unitsList;
    console.log(`[DEBUG normalizeCourse] Normalized category ${key} with ${unitsList.length} units:`, unitsList.map(u => ({ unitNo: u.unitNo, questionsCount: u.questions.length })));
  });

  typeCats.forEach(initCat => {
    if (!updatedUnitsData[initCat.name]) {
      updatedUnitsData[initCat.name] = [];
    }
  });

  // Re-sync and collect all questions from updatedUnitsData to build a master synced list of normalizedObeQuestions
  const collectedQuestionsFromUnits: any[] = [];
  Object.keys(updatedUnitsData).forEach(catName => {
    const units = updatedUnitsData[catName] || [];
    units.forEach(u => {
      const qList = u.questions || [];
      qList.forEach(q => {
        collectedQuestionsFromUnits.push({
          id: q.id,
          categoryName: catName,
          unitNo: u.unitNo,
          questionName: q.name,
          maxMarks: q.maxMarks,
          mappedCLOs: q.mappedCLOs || []
        });
      });
    });
  });

  const normalizedObeQuestions = [...collectedQuestionsFromUnits];
  parsedObeQuestions.forEach(pq => {
    const alreadyCollected = normalizedObeQuestions.some(
      fq => fq.id === pq.id || (fq.categoryName === pq.categoryName && fq.unitNo === pq.unitNo && fq.questionName === pq.questionName)
    );
    if (!alreadyCollected) {
      normalizedObeQuestions.push(pq);
    }
  });

  // Extract other database fields from both camelCase and snake_case format
  const departmentId = course.departmentId || (course as any).department_id || (course as any).department || '';
  const departmentName = course.departmentName || (course as any).department_name || '';
  const programId = course.programId || (course as any).program_id || (course as any).program || '';
  const programName = course.programName || (course as any).program_name || '';
  const creditHours = course.creditHours !== undefined ? course.creditHours : ((course as any).credit_hours !== undefined ? (course as any).credit_hours : 3);
  const cloCount = course.cloCount !== undefined ? course.cloCount : ((course as any).clo_count !== undefined ? (course as any).clo_count : 4);
  const academicYear = course.academicYear || (course as any).academic_year || '';
  const selectedGradingSystem = course.selectedGradingSystem || (course as any).selected_grading_system || '';
  const customGradingSystem = course.customGradingSystem || (course as any).custom_grading_system || [];

  const rawObeMarks = course.obeMarks || (course as any).obe_marks || {};
  const rawStudents = [
    ...(course.students || 
        (course as any).students || 
        (course as any).enrolled_students || 
        (course as any).enrolledStudents || 
        (course as any).enrolled_student_list || 
        (course as any).enrolledStudentList || 
        (course as any).student_list || 
        (course as any).studentList || 
        [])
  ];

  const normalizedStudents = rawStudents.map((s: any) => {
    const regNo = s.regNo || s.reg_no || s.registration_no || s.registrationNo || '';
    const name = s.name || s.student_name || s.studentName || '';
    const marks = { ...(s.marks || s.obtained_marks || s.obtainedMarks || {}) };

    // Inject individual OBE question marks from rawObeMarks (from OBEStudentMark DB model)
    const matchedKey = Object.keys(rawObeMarks || {}).find(k => areRegNosEqual(k, regNo));
    const studentObeMarks = matchedKey ? rawObeMarks[matchedKey] : {};
    Object.entries(studentObeMarks).forEach(([qId, score]) => {
      // Find the corresponding question metadata to reconstruct the exact frontend key:
      // q-${categoryName}-${unitNo}-${questionId}
      const matchingQ = normalizedObeQuestions.find(q => q.id === qId);
      if (matchingQ) {
        const key = `q-${matchingQ.categoryName}-${matchingQ.unitNo}-${qId}`;
        marks[key] = Number(score);
      } else {
        // Fallback: search parsedObeQuestions
        const fallbackQ = parsedObeQuestions.find(q => q.id === qId);
        if (fallbackQ) {
          const key = `q-${fallbackQ.categoryName}-${fallbackQ.unitNo}-${qId}`;
          marks[key] = Number(score);
        }
      }
    });

    return {
      regNo,
      name,
      marks
    };
  });

  return {
    ...course,
    courseType,
    departmentId,
    departmentName,
    programId,
    programName,
    creditHours,
    cloCount,
    academicYear,
    selectedGradingSystem,
    customGradingSystem,
    categories: updatedCategories,
    unitsData: updatedUnitsData,
    obeQuestions: normalizedObeQuestions,
    obeMarks: rawObeMarks,
    students: normalizedStudents
  };
};

export const DEPARTMENT_PROGRAMS: Record<string, { id: string; name: string }[]> = {};

const distributeUnitWeightages = (n: number): number[] => {
  if (n <= 0) return [];
  if (n === 1) return [100];
  const weights: number[] = [];
  const share = parseFloat((100 / n).toFixed(1));
  let sum = 0;
  for (let i = 0; i < n - 1; i++) {
    weights.push(share);
    sum += share;
  }
  // The last one gets the exact remainder to sum to exactly 100
  weights.push(parseFloat((100 - sum).toFixed(1)));
  return weights;
};

const redistributeCategoryUnits = (catUnits: number, currentList: UnitItem[]): UnitItem[] => {
  const result: UnitItem[] = [];
  const weights = distributeUnitWeightages(catUnits);
  for (let i = 0; i < catUnits; i++) {
    const existing = currentList[i];
    result.push({
      unitNo: i + 1,
      passing: existing ? existing.passing : 5,
      totalMarks: existing ? existing.totalMarks : 10,
      weightage: weights[i],
      mappedCLOs: existing ? existing.mappedCLOs : []
    });
  }
  return result;
};

const getShortCategoryLabel = (catName: string): string => {
  const lower = catName.toLowerCase();
  if (lower.startsWith('assignment')) return 'Assg';
  if (lower.startsWith('quiz')) return 'Quiz';
  if (lower.includes('presentation') && lower.includes('project')) return 'Presentation & Project';
  if (lower.startsWith('presentation')) return 'Presentation';
  if (lower.includes('mid term') || lower.includes('mid-term') || lower.includes('midterm')) return 'Mid Term Exam';
  if (lower.startsWith('final') || lower.includes('end term') || lower.includes('end-term')) return 'End Term Exam';
  if (lower.startsWith('lab report')) return 'Lab Report';
  if (lower.startsWith('lab performance')) return 'Lab Performance';
  if (lower.includes('project')) return 'Project';
  if (lower.includes('attendance')) return 'Attendance';
  return catName;
};

const getDegreeDisplay = (course: InstructorCourse): string => {
  if (course.programId) {
    return course.programId.toUpperCase();
  }
  if (course.programName) {
    const match = course.programName.match(/\(([^)]+)\)/);
    if (match && match[1]) return match[1].toUpperCase();
    return course.programName.split(' ')[0].toUpperCase();
  }
  return 'BSCS';
};

const getDynamicStyles = (colsCount: number) => {
  if (colsCount <= 12) {
    return {
      tableClass: "text-[10px]",
      headerRow1Class: "text-[10px]",
      headerRow2Class: "text-[9.5px]",
      cellClass: "p-1.5 text-[10px]",
      monoCellClass: "p-1.5 text-[10px]",
      rollNoStyle: { minWidth: "100px", width: "11%", maxWidth: "115px" },
      nameStyle: { minWidth: "140px", width: "18%", maxWidth: "175px" },
      assStyle: { minWidth: "32px" },
      totStyle: { minWidth: "40px" },
      gaStyle: { minWidth: "45px" },
    };
  } else if (colsCount <= 18) {
    return {
      tableClass: "text-[9px]",
      headerRow1Class: "text-[9px]",
      headerRow2Class: "text-[8.5px]",
      cellClass: "p-1 text-[9px]",
      monoCellClass: "p-1 text-[9px]",
      rollNoStyle: { minWidth: "85px", width: "11%", maxWidth: "100px" },
      nameStyle: { minWidth: "115px", width: "18%", maxWidth: "145px" },
      assStyle: { minWidth: "26px" },
      totStyle: { minWidth: "32px" },
      gaStyle: { minWidth: "36px" },
    };
  } else if (colsCount <= 25) {
    return {
      tableClass: "text-[8px]",
      headerRow1Class: "text-[8px]",
      headerRow2Class: "text-[7.5px]",
      cellClass: "px-1 py-0.5 text-[8px]",
      monoCellClass: "px-0.5 py-0.5 text-[8px]",
      rollNoStyle: { minWidth: "75px", width: "10%", maxWidth: "90px" },
      nameStyle: { minWidth: "95px", width: "16%", maxWidth: "120px" },
      assStyle: { minWidth: "22px" },
      totStyle: { minWidth: "28px" },
      gaStyle: { minWidth: "30px" },
    };
  } else {
    return {
      tableClass: "text-[7.2px]",
      headerRow1Class: "text-[7.2px]",
      headerRow2Class: "text-[7px]",
      cellClass: "px-0.5 py-[1px] text-[7.2px]",
      monoCellClass: "px-[1px] py-[1px] text-[7.2px] tracking-tighter",
      rollNoStyle: { minWidth: "62px", width: "9%", maxWidth: "75px" },
      nameStyle: { minWidth: "85px", width: "14%", maxWidth: "105px" },
      assStyle: { minWidth: "18px" },
      totStyle: { minWidth: "24px" },
      gaStyle: { minWidth: "26px" },
    };
  }
};

/**
 * Single source of truth for a mark sheet's page orientation.
 *
 * Three places used to decide this independently and disagreed:
 *   - the document itself:  units in categories weighted > 0, column counts
 *   - the print wrapper:    units across ALL categories (0% ones included) > 5
 *   - the PDF export:       rendered pixel width > 850
 * A course with unused 0% categories, for example, was laid out portrait but
 * printed onto a landscape-width wrapper, squeezing or clipping columns.
 *
 * This reproduces the document's original rule exactly (that's what the
 * layout, font sizing and @page size were built around), and all three now
 * call it.
 */
const isMarksheetLandscape = (course: InstructorCourse, reportType: string): boolean => {
  if (reportType === 'clo' || reportType === 'ga') return true;
  const activeCats = course.categories.filter(c => c.percentage > 0);
  if (reportType === 'standard') {
    const unitCols = activeCats.reduce((s, c) => s + c.units, 0);
    // S.#, Reg No, Name + one column per unit + Total, Grade
    return unitCols > 5 || (3 + unitCols + 2) > 8;
  }
  if (reportType === 'combined') {
    return activeCats.length > 6 || (3 + activeCats.length + 2) > 8;
  }
  return false;
};

const MarksheetDocument = ({
  course,
  campus,
  semester,
  section,
  offeredIn,
  session,
  instructor,
  dated,
  printDate,
  isPrintView,
  reportType = 'standard',
  courseCLOs = []
}: {
  course: InstructorCourse;
  campus: string;
  semester: string;
  section: string;
  offeredIn: string;
  session: string;
  instructor: string;
  dated: string;
  printDate: string;
  isPrintView: boolean;
  reportType?: 'standard' | 'combined' | 'award' | 'clo' | 'ga';
  courseCLOs?: any[];
}) => {
  const activeSystem = course.selectedGradingSystem || 'ready1';
  let gradingList: { grade: string; min: number; label: string }[] = [];
  
  if (activeSystem === 'ready1') {
    gradingList = [
      { grade: 'A', min: 88, label: '88.0' },
      { grade: 'B+', min: 81, label: '81.0' },
      { grade: 'B', min: 74, label: '74.0' },
      { grade: 'C+', min: 67, label: '67.0' },
      { grade: 'C', min: 60, label: '60.0' },
      { grade: 'F', min: 0, label: '0.0' }
    ];
  } else if (activeSystem === 'ready2') {
    gradingList = [
      { grade: 'A+', min: 90, label: '90.0' },
      { grade: 'A', min: 85, label: '85.0' },
      { grade: 'A-', min: 80, label: '80.0' },
      { grade: 'B+', min: 75, label: '75.0' },
      { grade: 'B', min: 70, label: '70.0' },
      { grade: 'B-', min: 65, label: '65.0' },
      { grade: 'C+', min: 60, label: '60.0' },
      { grade: 'C', min: 55, label: '55.0' },
      { grade: 'D', min: 50, label: '50.0' },
      { grade: 'F', min: 0, label: '0.0' }
    ];
  } else {
    const customList = course.customGradingSystem || DEFAULT_CUSTOM_GRADES;
    gradingList = customList.map(tier => {
      const range = parsePercentRange(tier.percentage);
      return {
        grade: tier.grade,
        min: range.min,
        label: `${range.min}.0`
      };
    }).sort((a, b) => b.min - a.min);

    if (!gradingList.some(item => item.grade === 'F')) {
      gradingList.push({ grade: 'F', min: 0, label: '0.0' });
    }
  }

  const activeCats = course.categories.filter(c => c.percentage > 0);
  const totalMaxWeight = activeCats.reduce((sum, cat) => sum + cat.percentage, 0);

  const studentTotalGrades = course.students.map(std => {
    let aggregate = 0;
    const categoryContributions: Record<string, number> = {};

    activeCats.forEach(cat => {
      let totalMaxMarks = 0;
      let studentObtainedSum = 0;
      const existingUnits = course.unitsData[cat.name] || [];

      if (cat.units > 0) {
        for (let u = 1; u <= cat.units; u++) {
          const matchingUnit = existingUnits.find(unit => unit.unitNo === u);
          const questions = matchingUnit?.questions || [];

          if (questions.length > 0) {
            questions.forEach(q => {
              totalMaxMarks += q.maxMarks || 0;
              const qKey = `q-${cat.name}-${u}-${q.id}`;
              const dKey = `${cat.name}-${u}`;
              const val = std.marks?.[qKey];
              if (val !== undefined && Number(val) > 0) {
                studentObtainedSum += Number(val);
              } else if (questions.length === 1) {
                studentObtainedSum += Number(std.marks?.[dKey] || 0);
              } else {
                studentObtainedSum += Number(val || 0);
              }
            });
          } else {
            const maxMarks = matchingUnit ? matchingUnit.totalMarks : 10;
            totalMaxMarks += maxMarks;
            const dKey = `${cat.name}-${u}`;
            studentObtainedSum += Number(std.marks?.[dKey] || 0);
          }
        }
      }

      const catContribution = totalMaxMarks > 0
        ? (studentObtainedSum / totalMaxMarks) * cat.percentage
        : 0;

      categoryContributions[cat.name] = catContribution;
      aggregate += catContribution;
    });
    
    const letterGrade = getCourseLetterGrade(aggregate, course);
    return {
      student: std,
      aggregate,
      grade: letterGrade,
      categoryContributions
    };
  });

  const gradeCounts: Record<string, number> = {};
  gradingList.forEach(item => {
    gradeCounts[item.grade] = 0;
  });
  
  let passCount = 0;
  studentTotalGrades.forEach(item => {
    if (gradeCounts[item.grade] !== undefined) {
      gradeCounts[item.grade]++;
    } else {
      gradeCounts[item.grade] = 1;
    }
    if (item.grade !== 'F') {
      passCount++;
    }
  });

  const totalColumns: { catName: string; unitNo: number; label: string; maxMarks: number }[] = [];
  
  activeCats.forEach(cat => {
    const existingUnits = course.unitsData[cat.name] || [];
    for (let u = 1; u <= cat.units; u++) {
      const matchingUnit = existingUnits.find(unit => unit.unitNo === u);
      const totalMarks = matchingUnit ? matchingUnit.totalMarks : 10;
      totalColumns.push({
        catName: cat.name,
        unitNo: u,
        label: getShortLabel(cat.name, u, cat.units),
        maxMarks: totalMarks
      });
    }
  });

  // CLO-Based Result Calculations
  const cloCount = course.cloCount || 4;
  const cloListToUse = courseCLOs && courseCLOs.length > 0
    ? courseCLOs.map(c => ({
        code: c.code,
        description: c.description || 'Course Learning Outcome',
        mappedGA: c.mappedGA || c.mapped_ga || null
      }))
    : Array.from({ length: cloCount }, (_, i) => ({
        code: `CLO-${i + 1}`,
        description: `Course Learning Outcome ${i + 1}`,
        mappedGA: null
      }));

  const cloCodes = cloListToUse.map(c => c.code);

  const gaToCLOsMap: Record<string, typeof cloListToUse> = {};
  cloListToUse.forEach(cloObj => {
    const gaCode = cloObj.mappedGA || 'No GA';
    if (!gaToCLOsMap[gaCode]) {
      gaToCLOsMap[gaCode] = [];
    }
    gaToCLOsMap[gaCode].push(cloObj);
  });

  const sortedGAKeys = Object.keys(gaToCLOsMap).sort((a, b) => {
    if (a === 'No GA') return 1;
    if (b === 'No GA') return -1;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });

  interface CLOAssessment {
    id: string;
    label: string;
    categoryName: string;
    unitNo: number;
    questionId?: string;
    maxMarks: number;
    contrib: number;
    passing: number;
    relativeWeight: number;
  }

  const cloAssessments: Record<string, CLOAssessment[]> = {};
  cloCodes.forEach(code => {
    cloAssessments[code] = [];
  });

  activeCats.forEach(cat => {
    const units = course.unitsData[cat.name] || [];
    units.forEach(unit => {
      const unitWeightage = unit.weightage ?? (cat.units > 0 ? (100 / cat.units) : 0);
      const unitPassing = unit.passing ?? (unit.totalMarks * 0.5);

      if (unit.questions && unit.questions.length > 0) {
        unit.questions.forEach(q => {
          const qCLOs = q.mappedCLOs || [];
          qCLOs.forEach(cloCode => {
            const normalizedCLO = String(cloCode).trim().toUpperCase();
            if (cloAssessments[normalizedCLO]) {
              const catShort = getShortLabel(cat.name, unit.unitNo, cat.units);
              let cleanQName = q.name || '';
              if (cleanQName.toLowerCase().startsWith('question')) {
                cleanQName = 'Q' + cleanQName.substring(8).trim();
              }
              const label = cleanQName ? `${catShort}-${cleanQName}` : catShort;
              const contrib = (q.maxMarks / unit.totalMarks) * (unitWeightage / 100) * cat.percentage;
              cloAssessments[normalizedCLO].push({
                id: `q-${cat.name}-${unit.unitNo}-${q.id}`,
                label: label,
                categoryName: cat.name,
                unitNo: unit.unitNo,
                questionId: q.id,
                maxMarks: q.maxMarks,
                contrib: contrib,
                passing: q.maxMarks * (unitPassing / unit.totalMarks),
                relativeWeight: 0
              });
            }
          });
        });
      } else {
        const unitCLOs = unit.mappedCLOs || [];
        unitCLOs.forEach(cloCode => {
          const normalizedCLO = String(cloCode).trim().toUpperCase();
          if (cloAssessments[normalizedCLO]) {
            const label = getShortLabel(cat.name, unit.unitNo, cat.units);
            const contrib = (unitWeightage / 100) * cat.percentage;
            cloAssessments[normalizedCLO].push({
              id: `${cat.name}-${unit.unitNo}`,
              label: label,
              categoryName: cat.name,
              unitNo: unit.unitNo,
              maxMarks: unit.totalMarks,
              contrib: contrib,
              passing: unitPassing,
              relativeWeight: 0
            });
          }
        });
      }
    });
  });

  // Calculate relative weights for each CLO
  cloCodes.forEach(code => {
    const list = cloAssessments[code];
    const totalCLOContrib = list.reduce((sum, ass) => sum + ass.contrib, 0);

    if (totalCLOContrib > 0) {
      list.forEach(ass => {
        ass.relativeWeight = (ass.contrib / totalCLOContrib) * 100;
      });
    } else if (list.length > 0) {
      list.forEach(ass => {
        ass.relativeWeight = 100 / list.length;
      });
    }

    // Round nicely so they sum to exactly 100%
    if (list.length > 0) {
      const roundedWeights = list.map(ass => Math.round(ass.relativeWeight));
      const roundedSum = roundedWeights.reduce((s, w) => s + w, 0);
      if (roundedSum !== 100) {
        const maxVal = Math.max(...roundedWeights);
        const maxIdx = roundedWeights.indexOf(maxVal);
        if (maxIdx !== -1) {
          roundedWeights[maxIdx] += (100 - roundedSum);
        }
      }
      list.forEach((ass, idx) => {
        ass.relativeWeight = roundedWeights[idx];
      });
    }
  });

  // Determine dynamic styles based on number of columns
  let totalTableCols = 3;
  if (reportType === 'ga') {
    sortedGAKeys.forEach(gaCode => {
      const clos = gaToCLOsMap[gaCode] || [];
      clos.forEach(cloObj => {
        const list = cloAssessments[cloObj.code] || [];
        totalTableCols += list.length + 1; // assessments + CLO Tot
      });
      totalTableCols += 1; // GA Total
    });
  } else if (reportType === 'clo') {
    cloCodes.forEach(code => {
      const list = cloAssessments[code] || [];
      totalTableCols += list.length + 1; // assessments + CLO Tot
    });
  } else if (reportType === 'standard') {
    totalTableCols = 3 + totalColumns.length + 2;
  } else if (reportType === 'combined') {
    totalTableCols = 3 + activeCats.length + 2;
  }

  const isLandscapeReport = isMarksheetLandscape(course, reportType);

  const ds = getDynamicStyles(totalTableCols);
  const gaFontSize = totalTableCols <= 12 ? '13px' : totalTableCols <= 18 ? '11.5px' : totalTableCols <= 25 ? '10.5px' : '9.5px';
  const gaHeaderFontSize = totalTableCols <= 12 ? '13px' : totalTableCols <= 18 ? '11.5px' : totalTableCols <= 25 ? '10.5px' : '9.5px';

  return (
    <div id="marksheet-real-view" className={`p-6 bg-white shrink-0 antialiased text-black font-sans leading-relaxed ${isPrintView ? 'w-full' : (isLandscapeReport ? 'min-w-[297mm] w-fit max-w-full min-h-[210mm]' : 'w-[210mm] min-h-[297mm]') + ' shadow-2xl border border-slate-350 rounded-xl m-auto print:shadow-none print:border-none'}`}>
      
      {/* Dynamic Style tags representing the official vector print directives */}
      <style>{`
        @media print {
          @page {
            size: ${isLandscapeReport ? 'landscape' : 'portrait'};
            /* margin: 0 leaves the browser nowhere to draw its own header and
               footer, which is what was stamping the page URL
               ("localhost:3000/?print=true&courseId=...") and the "1/3" page
               counter onto every sheet. The page's own breathing room is
               restored via padding on the document below. */
            margin: 0;
          }
          #marksheet-real-view {
            padding: 10mm !important;
          }
          .no-print-break {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          /* The student ledger is taller than one page on any real class, so it
             must be allowed to flow across pages. It previously sat inside a
             .no-print-break wrapper, and "break-inside: avoid" pushed the whole
             table to page 2 — which is why page 1 came out almost blank. Let the
             table break, repeat its header row on each page, and only keep
             individual rows from being split down the middle. */
          .print-allow-break {
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          thead {
            display: table-header-group;
          }
          tbody tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid black !important;
            padding: 3px 4px !important;
          }
          th {
            background-color: #f8fafc !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          td {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .ga-highlight-cell {
            background-color: #e0e7ff !important;
            color: #1e1b4b !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .ga-highlight-cell-fail {
            background-color: #e0e7ff !important;
            color: #b91c1c !important;
            font-weight: 900 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .ga-highlight-header {
            background-color: #c7d2fe !important;
            color: #1e1b4b !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        .ga-highlight-cell {
          background-color: #e0e7ff !important;
          color: #1e1b4b !important;
        }
        .ga-highlight-cell-fail {
          background-color: #e0e7ff !important;
          color: #b91c1c !important;
          font-weight: 900 !important;
        }
        .ga-highlight-header {
          background-color: #c7d2fe !important;
          color: #1e1b4b !important;
        }
      `}</style>

      {/* Header Block with Custom University Name in Blue */}
      <div className="flex flex-col items-center justify-center text-center pb-5 border-b-2 border-black">
        <h1 className="text-[26px] sm:text-[28px] md:text-[32px] font-black font-serif text-[#005f9e] uppercase tracking-wide leading-tight select-none px-4">
          {campus}
        </h1>
        <p className="text-[13px] sm:text-[14px] font-bold text-slate-800 uppercase tracking-wider mt-2">
          {session}
        </p>
        
        {/* Course detail bar */}
        <div className="mt-4 w-full flex items-center justify-between border-y-2 border-black py-2.5 px-4 font-mono text-[11.5px] uppercase font-extrabold text-slate-900">
          <div>Semester: <span className="font-sans font-black text-indigo-950 ml-1 text-[12.5px]">{semester}</span></div>
          <div>Dated: <span className="font-sans font-black text-indigo-950 ml-1 text-[12.5px]">{dated}</span></div>
        </div>
      </div>

      {/* Main Course Details Card */}
      <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[12.5px] font-black text-slate-900 tracking-tight py-1.5 font-sans border-b border-slate-300 pb-2">
        <div className="flex items-center gap-1">
          <span className="text-slate-700">Subject Name:</span>
          <span className="text-indigo-950 uppercase border-b-2 border-black pb-0.5 font-black text-[14px] sm:text-[15px]">{course.code} {course.title}</span>
        </div>
        <div className="flex items-center">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-700">Section:</span>
            <span className="text-indigo-950 uppercase border-b-2 border-black pb-0.5 px-3 font-black text-[14px]">{section}</span>
          </div>
        </div>
      </div>

      {/* Students Graded Marks Ledger Table */}
      <div className="mt-4 print-allow-break font-sans">
        <div className="overflow-x-auto">
          {reportType === 'award' ? (
            <>
              <table className="w-full text-center border-collapse border border-black font-sans text-[11px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-black font-black text-[10.5px] text-slate-900 leading-tight">
                    <th className="border-r border-black p-1.5 w-[5%] min-w-[32px] max-w-[40px] text-center">S.#</th>
                    <th className="border-r border-black p-1.5 text-center w-[18%] min-w-[100px] max-w-[120px] whitespace-nowrap">Reg.No</th>
                    <th className="border-r border-black p-1.5 text-left w-[32%] min-w-[180px] max-w-[220px]">Name of Student</th>
                    <th className="border-r border-black p-1.5 text-center w-[15%] min-w-[80px]">Degree</th>
                    <th className="border-r border-black p-1.5 text-slate-900 font-bold w-[18%] min-w-[90px] text-center">Final Marks out of 100%</th>
                    <th className="p-1.5 text-slate-900 font-bold w-[12%] min-w-[60px] text-center select-none">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/40 font-mono text-[11px]">
                  {studentTotalGrades.map((item, idx) => (
                    <tr key={`${item.student.regNo || 'std'}-${idx}`} className="hover:bg-slate-50/20 text-slate-850">
                      <td className="border-r border-black p-1.5 text-slate-450 text-[10px] font-sans text-center w-[5%] min-w-[32px] max-w-[40px]">{idx + 1}</td>
                      <td className="border-r border-black p-1.5 text-center text-slate-905 font-bold text-[11px] uppercase font-mono tracking-tight whitespace-nowrap w-[18%] min-w-[100px] max-w-[120px]">{item.student.regNo}</td>
                      <td className="border-r border-black p-1.5 text-left font-sans text-slate-900 font-bold uppercase text-[11px] w-[32%] min-w-[180px] max-w-[220px] break-words">{item.student.name}</td>
                      <td className="border-r border-black p-1.5 text-center text-slate-800 font-semibold uppercase text-[11px] w-[15%] min-w-[80px] font-sans">{getDegreeDisplay(course)}</td>
                      <td className="border-r border-black p-1.5 font-extrabold text-[#4f46e5] text-[12px] text-center w-[18%] min-w-[90px] font-sans">
                        {item.aggregate % 1 === 0 ? item.aggregate.toFixed(0) : item.aggregate.toFixed(2).replace(/\.?0+$/, '')}
                      </td>
                      <td className="p-1.5 font-black text-blue-800 text-[12.5px] bg-blue-50/5 text-center w-[12%] min-w-[60px] font-sans">{item.grade}</td>
                    </tr>
                  ))}
                  {/* Pad table with empty template rows just like in the reference image */}
                  {Array.from({ length: Math.max(0, 8 - course.students.length) }).map((_, emptyIdx) => {
                    const displayIdx = course.students.length + emptyIdx + 1;
                    return (
                      <tr key={`empty-${emptyIdx}`} className="text-slate-850">
                        <td className="border-r border-black p-1.5 text-slate-450 text-[10px] font-sans text-center w-[5%] min-w-[32px] max-w-[40px]">{displayIdx}</td>
                        <td className="border-r border-black p-1.5 w-[18%] min-w-[100px] max-w-[120px]"></td>
                        <td className="border-r border-black p-1.5 w-[32%] min-w-[180px] max-w-[220px]"></td>
                        <td className="border-r border-black p-1.5 w-[15%] min-w-[80px]"></td>
                        <td className="border-r border-black p-1.5 w-[18%] min-w-[90px]"></td>
                        <td className="p-1.5 w-[12%] min-w-[60px]"></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Grade count section */}
              <div className="mt-6 max-w-[260px] no-print-break font-sans border border-black p-1 bg-white">
                <table className="w-full border-collapse text-center text-[10.5px] font-sans">
                  <thead>
                    <tr className="bg-slate-50 border-b border-black font-black text-[9.5px] text-slate-900 leading-tight">
                      <th className="border-r border-black p-1 text-center w-1/2">Grade</th>
                      <th className="p-1 text-center w-1/2">No. of Student(s)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/30 font-mono text-[10.5px]">
                    {gradingList.map(item => (
                      <tr key={item.grade} className="text-slate-850">
                        <td className="border-r border-black p-1 text-center font-sans font-bold">{item.grade}</td>
                        <td className="p-1 text-center">{gradeCounts[item.grade] || 0}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 border-t border-black font-sans font-black text-[10px] text-slate-900">
                      <td className="border-r border-black p-1 text-center uppercase">Total Students</td>
                      <td className="p-1 text-center font-mono">{course.students.length}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : reportType === 'combined' ? (
            <table className="w-full text-center border-collapse border border-black font-sans text-[11px]">
              <thead>
                <tr className="bg-slate-50 border-b border-black font-black text-[10.5px] text-slate-900 leading-tight">
                  <th className="border-r border-black p-1.5 w-[4%] min-w-[28px] max-w-[35px] text-center">Sr. No.</th>
                  <th className="border-r border-black p-1.5 text-center w-[14%] min-w-[100px] max-w-[115px] whitespace-nowrap">Regn. No.</th>
                  <th className="border-r border-black p-1.5 text-left w-[24%] min-w-[150px] max-w-[180px]">Name</th>
                  {activeCats.map((cat, cIdx) => (
                    <th key={cIdx} className="border-r border-black p-1.5 font-bold text-center">
                      <span className="block uppercase tracking-tight">{getShortCategoryLabel(cat.name)}</span>
                    </th>
                  ))}
                  <th className="border-r border-black p-1.5 text-slate-900 font-bold w-[10%] min-w-[70px] text-center">Total Marks</th>
                  <th className="p-1.5 text-slate-900 font-bold w-[6%] min-w-[40px] text-center select-none">Grade</th>
                </tr>
                <tr className="bg-slate-50 border-b border-black font-black text-[9.5px] text-slate-900 leading-tight">
                  <th className="border-r border-black p-0.5"></th>
                  <th className="border-r border-black p-0.5"></th>
                  <th className="border-r border-black p-0.5"></th>
                  {activeCats.map((cat, cIdx) => (
                    <th key={cIdx} className="border-r border-black p-0.5 font-bold text-center text-[9px]">
                      {cat.percentage}
                    </th>
                  ))}
                  <th className="border-r border-black p-0.5 text-slate-900 font-bold text-center text-[9px]">{totalMaxWeight}</th>
                  <th className="p-0.5 text-slate-900 font-bold text-center select-none"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/40 font-mono text-[11px]">
                {studentTotalGrades.map((item, idx) => (
                  <tr key={`grade-col-${item.student.regNo || 'std'}-${idx}`} className="hover:bg-slate-50/20 text-slate-850">
                    <td className="border-r border-black p-1.5 text-slate-450 text-[10px] font-sans text-center w-[4%] min-w-[28px] max-w-[35px]">{idx + 1}</td>
                    <td className="border-r border-black p-1.5 text-center text-slate-905 font-bold text-[11px] uppercase font-mono tracking-tight whitespace-nowrap w-[14%] min-w-[100px] max-w-[115px]">{item.student.regNo}</td>
                    <td className="border-r border-black p-1.5 text-left font-sans text-slate-900 font-bold uppercase text-[11px] w-[24%] min-w-[150px] max-w-[180px] break-words">{item.student.name}</td>
                    {activeCats.map((cat, cIdx) => {
                      const val = item.categoryContributions[cat.name] || 0;
                      return (
                        <td key={cIdx} className="border-r border-black p-1.5 text-[11px] text-center font-sans">
                          {val.toFixed(2)}
                        </td>
                      );
                    })}
                    <td className="border-r border-black p-1.5 font-extrabold text-[#4f46e5] text-[12px] text-center w-[10%] min-w-[70px] font-sans">
                      {item.aggregate.toFixed(2)}
                    </td>
                    <td className="p-1.5 font-black text-blue-800 text-[12.5px] bg-blue-50/5 text-center w-[6%] min-w-[40px] font-sans">{item.grade}</td>
                  </tr>
                ))}
                {/* Pad table with empty template rows just like in the reference image */}
                {Array.from({ length: Math.max(0, 8 - course.students.length) }).map((_, emptyIdx) => {
                  const displayIdx = course.students.length + emptyIdx + 1;
                  return (
                    <tr key={`empty-${emptyIdx}`} className="text-slate-850">
                      <td className="border-r border-black p-1.5 text-slate-450 text-[10px] font-sans text-center w-[4%] min-w-[28px] max-w-[35px]">{displayIdx}</td>
                      <td className="border-r border-black p-1.5 w-[14%] min-w-[100px] max-w-[115px]"></td>
                      <td className="border-r border-black p-1.5 w-[24%] min-w-[150px] max-w-[180px]"></td>
                      {activeCats.map((_, cIdx) => (
                        <td key={cIdx} className="border-r border-black p-1.5"></td>
                      ))}
                      <td className="border-r border-black p-1.5 w-[10%] min-w-[70px]"></td>
                      <td className="p-1.5 w-[6%] min-w-[40px]"></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : reportType === 'ga' ? (
            <table className={`w-full text-center border-collapse border border-black font-sans ${ds.tableClass}`}>
              <thead>
                {/* ROW 1: GA Codes Group Headers */}
                <tr className={`bg-slate-50 border-b border-black font-black text-slate-900 leading-tight ${ds.headerRow1Class}`}>
                  <th colSpan={3} className="border-r border-black p-1 text-center font-bold">
                    Graduate Attributes Mapping
                  </th>
                  {sortedGAKeys.map(gaCode => {
                    const clos = gaToCLOsMap[gaCode] || [];
                    let totalCols = 0;
                    clos.forEach(cloObj => {
                      const list = cloAssessments[cloObj.code] || [];
                      totalCols += list.length + 1; // questions + Total
                    });
                    totalCols += 1; // GA Total column
                    return (
                      <th
                        key={gaCode}
                        colSpan={totalCols}
                        className="border-r border-black p-1 text-center font-black uppercase tracking-wider bg-indigo-50/30"
                      >
                        {formatGACodeToStandard(gaCode)}
                      </th>
                    );
                  })}
                </tr>

                {/* ROW 2: CLO Codes Group Headers */}
                <tr className={`bg-slate-50 border-b border-black font-black text-slate-900 leading-tight ${ds.headerRow2Class}`}>
                  <th colSpan={3} className="border-r border-black p-1 text-center font-bold">
                    Course Outcomes (CLO)
                  </th>
                  {sortedGAKeys.map(gaCode => {
                    const clos = gaToCLOsMap[gaCode] || [];
                    return (
                      <React.Fragment key={`clo-row-${gaCode}`}>
                        {clos.map(cloObj => {
                          const list = cloAssessments[cloObj.code] || [];
                          return (
                            <th
                              key={cloObj.code}
                              colSpan={list.length + 1}
                              className="border-r border-black p-1 text-center font-bold uppercase tracking-tight bg-slate-100/50"
                            >
                              {cloObj.code}
                            </th>
                          );
                        })}
                        <th 
                          className="border-r border-black font-black text-center ga-highlight-header"
                          style={{
                            padding: ds.cellClass.includes('px-') ? '2px 4px' : '4px 6px',
                            fontSize: gaHeaderFontSize,
                            minWidth: ds.gaStyle.minWidth
                          }}
                        >
                          {formatGACodeToStandard(gaCode)} Total
                        </th>
                      </React.Fragment>
                    );
                  })}
                </tr>

                {/* ROW 3: Column Names (Questions & totals) */}
                <tr className={`bg-slate-50 border-b border-black font-black text-slate-900 leading-tight ${ds.headerRow2Class}`}>
                  <th className="border-r border-black text-center w-[3%] min-w-[22px] max-w-[30px]" style={{ padding: ds.cellClass.includes('px-') ? '2px' : '4px' }}>S/N</th>
                  <th className="border-r border-black text-center whitespace-nowrap" style={{ padding: ds.cellClass.includes('px-') ? '2px' : '4px', ...ds.rollNoStyle }}>Roll No.</th>
                  <th className="border-r border-black text-left" style={{ padding: ds.cellClass.includes('px-') ? '2px' : '4px', ...ds.nameStyle }}>Student Name</th>
                  {sortedGAKeys.map(gaCode => {
                    const clos = gaToCLOsMap[gaCode] || [];
                    return (
                      <React.Fragment key={`items-row-${gaCode}`}>
                        {clos.map(cloObj => {
                          const list = cloAssessments[cloObj.code] || [];
                          return (
                            <React.Fragment key={`cols-${cloObj.code}`}>
                              {list.map((ass, aIdx) => (
                                <th
                                  key={`${cloObj.code}-col-${aIdx}`}
                                  className="border-r border-black p-0.5 font-mono text-center font-bold"
                                  style={ds.assStyle}
                                >
                                  {ass.label}
                                </th>
                              ))}
                              <th 
                                className="border-r border-black p-0.5 font-sans text-center font-bold bg-slate-100"
                                style={ds.totStyle}
                              >
                                CLO Tot
                              </th>
                            </React.Fragment>
                          );
                        })}
                        <th 
                          className="border-r border-black p-0.5 font-sans text-center font-black ga-highlight-header"
                          style={{
                            ...ds.gaStyle,
                            fontSize: gaHeaderFontSize
                          }}
                        >
                          GA %
                        </th>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/40 font-mono">
                {studentTotalGrades.map((item, idx) => {
                  return (
                    <tr key={`ga-tbl-${item.student.regNo || 'std'}-${idx}`} className="hover:bg-slate-50/20 text-slate-850">
                      <td className={`border-r border-black text-slate-450 font-sans text-center w-[3%] min-w-[22px] max-w-[30px] ${ds.cellClass}`}>
                        {idx + 1}
                      </td>
                      <td 
                        className={`border-r border-black text-center text-slate-905 font-bold uppercase font-mono tracking-tight whitespace-nowrap ${ds.monoCellClass}`}
                        style={ds.rollNoStyle}
                      >
                        {item.student.regNo}
                      </td>
                      <td 
                        className={`border-r border-black text-left font-sans text-slate-900 font-bold uppercase break-words ${ds.cellClass}`}
                        style={ds.nameStyle}
                      >
                        {item.student.name}
                      </td>
                      {sortedGAKeys.map(gaCode => {
                        const clos = gaToCLOsMap[gaCode] || [];
                        const cloTotalScores: number[] = [];

                        return (
                          <React.Fragment key={`stud-ga-row-${gaCode}-${item.student.regNo}`}>
                            {clos.map(cloObj => {
                              const list = cloAssessments[cloObj.code] || [];
                              let cloTotalScore = 0;

                              return (
                                <React.Fragment key={`stud-clo-items-${cloObj.code}`}>
                                  {list.map((ass, aIdx) => {
                                    let obtainedMark = 0;
                                    if (ass.questionId) {
                                      obtainedMark = item.student.marks?.[`q-${ass.categoryName}-${ass.unitNo}-${ass.questionId}`] ?? 0;
                                      if (obtainedMark === 0) {
                                        obtainedMark = item.student.marks?.[`${ass.categoryName}-${ass.unitNo}`] ?? 0;
                                      }
                                    } else {
                                      obtainedMark = item.student.marks?.[`${ass.categoryName}-${ass.unitNo}`] ?? 0;
                                    }
                                    const pct = ass.maxMarks > 0 ? (obtainedMark / ass.maxMarks) : 0;
                                    const weightedScore = pct * ass.relativeWeight;
                                    cloTotalScore += weightedScore;

                                    const formatMark = (num: number) => {
                                      if (num === 0) return '0';
                                      return Number(num.toFixed(2)).toString();
                                    };

                                    return (
                                      <td
                                        key={`${cloObj.code}-stud-ass-val-${aIdx}`}
                                        className={`border-r border-black text-center font-mono ${ds.monoCellClass}`}
                                        style={ds.assStyle}
                                      >
                                        {formatMark(weightedScore)}
                                      </td>
                                    );
                                  })}
                                  {/* CLO Total column */}
                                  {(() => {
                                    cloTotalScores.push(cloTotalScore);
                                    return (
                                      <td 
                                        className={`border-r border-black text-center font-bold font-sans bg-slate-50 ${ds.cellClass}`}
                                        style={ds.totStyle}
                                      >
                                        {cloTotalScore.toFixed(2)}
                                      </td>
                                    );
                                  })()}
                                </React.Fragment>
                              );
                            })}
                            {/* GA Total % column */}
                            {(() => {
                              const gaTotalScore = cloTotalScores.length > 0 
                                ? cloTotalScores.reduce((sum, score) => sum + score, 0) / cloTotalScores.length
                                : 0;
                              return (
                                <td 
                                  className="border-r border-black text-center font-black font-sans ga-highlight-cell"
                                  style={{
                                    ...ds.gaStyle,
                                    fontSize: gaFontSize
                                  }}
                                >
                                  {gaTotalScore.toFixed(2)}%
                                </td>
                              );
                            })()}
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Pad table with empty template rows */}
                {Array.from({ length: Math.max(0, 8 - course.students.length) }).map((_, emptyIdx) => {
                  const displayIdx = course.students.length + emptyIdx + 1;
                  return (
                    <tr key={`empty-${emptyIdx}`} className="text-slate-850">
                      <td className={`border-r border-black text-slate-450 font-sans text-center w-[3%] min-w-[22px] max-w-[30px] ${ds.cellClass}`}>
                        {displayIdx}
                      </td>
                      <td className={`border-r border-black ${ds.cellClass}`} style={ds.rollNoStyle}></td>
                      <td className={`border-r border-black ${ds.cellClass}`} style={ds.nameStyle}></td>
                      {sortedGAKeys.map(gaCode => {
                        const clos = gaToCLOsMap[gaCode] || [];
                        return (
                          <React.Fragment key={`empty-ga-${gaCode}-${emptyIdx}`}>
                            {clos.map(cloObj => {
                              const list = cloAssessments[cloObj.code] || [];
                              return (
                                <React.Fragment key={`empty-clo-${cloObj.code}`}>
                                  {list.map((_, aIdx) => (
                                    <td key={`empty-ass-cell-${aIdx}`} className={`border-r border-black ${ds.cellClass}`} style={ds.assStyle}></td>
                                  ))}
                                  <td className={`border-r border-black ga-highlight-cell ${ds.cellClass}`} style={ds.totStyle}></td>
                                </React.Fragment>
                              );
                            })}
                            <td className="border-r border-black ga-highlight-cell" style={ds.gaStyle}></td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : reportType === 'clo' ? (
            <table className={`w-full text-center border-collapse border border-black font-sans ${ds.tableClass}`}>
              <thead>
                {/* ROW 1: Header / CLO Names with Passing Threshold */}
                <tr className={`bg-slate-50 border-b border-black font-black text-slate-900 leading-tight ${ds.headerRow1Class}`}>
                  <th colSpan={3} className="border-r border-black p-1.5 text-center font-bold">
                    Assessment (Passing Threshold)
                  </th>
                  {cloCodes.map((code) => {
                    const list = cloAssessments[code] || [];
                    // Calculate passing percentage
                    let passingPctSum = 0;
                    let countWithPassing = 0;
                    list.forEach(ass => {
                      passingPctSum += ((ass.passing ?? (ass.maxMarks * 0.5)) / ass.maxMarks) * 100;
                      countWithPassing++;
                    });
                    const cloPassingThreshold = countWithPassing > 0 ? Math.round(passingPctSum / countWithPassing) : 50;
                    return (
                      <th
                        key={code}
                        colSpan={list.length + 1}
                        className="border-r border-black p-1.5 text-center font-bold uppercase tracking-tight"
                      >
                        {code}({cloPassingThreshold}%)
                      </th>
                    );
                  })}
                </tr>

                {/* ROW 2: Column Names */}
                <tr className={`bg-slate-50 border-b border-black font-black text-slate-900 leading-tight ${ds.headerRow2Class}`}>
                  <th className="border-r border-black text-center w-[3%] min-w-[22px] max-w-[30px]" style={{ padding: ds.cellClass.includes('px-') ? '2px' : '4px' }}>S/N</th>
                  <th className="border-r border-black text-center whitespace-nowrap" style={{ padding: ds.cellClass.includes('px-') ? '2px' : '4px', ...ds.rollNoStyle }}>Roll No.</th>
                  <th className="border-r border-black text-left" style={{ padding: ds.cellClass.includes('px-') ? '2px' : '4px', ...ds.nameStyle }}>Student Name</th>
                  {cloCodes.map(code => {
                    const list = cloAssessments[code] || [];
                    return (
                      <React.Fragment key={`cols-${code}`}>
                        {list.map((ass, aIdx) => (
                          <th
                            key={`${code}-col-${aIdx}`}
                            className="border-r border-black font-mono text-center font-bold"
                            style={ds.assStyle}
                          >
                            {ass.label}
                          </th>
                        ))}
                        <th 
                          className="border-r border-black font-sans text-center font-black ga-highlight-header"
                          style={ds.totStyle}
                        >
                          Total
                        </th>
                      </React.Fragment>
                    );
                  })}
                </tr>

                {/* ROW 3: Weights */}
                <tr className={`bg-slate-50 border-b border-black font-black text-slate-900 leading-tight ${ds.headerRow2Class}`}>
                  <td colSpan={3} className="border-r border-black p-1 bg-slate-100/30 font-bold text-center uppercase">
                    Weight
                  </td>
                  {cloCodes.map(code => {
                    const list = cloAssessments[code] || [];
                    return (
                      <React.Fragment key={`weights-${code}`}>
                        {list.map((ass, aIdx) => (
                          <td
                            key={`${code}-wt-${aIdx}`}
                            className="border-r border-black font-mono text-center font-semibold bg-slate-100/30"
                            style={ds.assStyle}
                          >
                            {ass.relativeWeight}%
                          </td>
                        ))}
                        <td 
                          className="border-r border-black font-sans text-center font-black ga-highlight-header"
                          style={ds.totStyle}
                        >
                          100%
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/40 font-mono">
                {studentTotalGrades.map((item, idx) => {
                  return (
                    <tr key={`clo-tbl-${item.student.regNo || 'std'}-${idx}`} className="hover:bg-slate-50/20 text-slate-850">
                      <td className={`border-r border-black text-slate-450 font-sans text-center w-[3%] min-w-[22px] max-w-[30px] ${ds.cellClass}`}>
                        {idx + 1}
                      </td>
                      <td 
                        className={`border-r border-black text-center text-slate-905 font-bold uppercase font-mono tracking-tight whitespace-nowrap ${ds.monoCellClass}`}
                        style={ds.rollNoStyle}
                      >
                        {item.student.regNo}
                      </td>
                      <td 
                        className={`border-r border-black text-left font-sans text-slate-900 font-bold uppercase break-words ${ds.cellClass}`}
                        style={ds.nameStyle}
                      >
                        {item.student.name}
                      </td>
                      {cloCodes.map(code => {
                        const list = cloAssessments[code] || [];
                        let cloTotalScore = 0;

                        // Calculate passing percentage
                        let passingPctSum = 0;
                        let countWithPassing = 0;
                        list.forEach(ass => {
                          passingPctSum += ((ass.passing ?? (ass.maxMarks * 0.5)) / ass.maxMarks) * 100;
                          countWithPassing++;
                        });
                        const cloPassingThreshold = countWithPassing > 0 ? Math.round(passingPctSum / countWithPassing) : 50;

                        return (
                          <React.Fragment key={`stud-clo-${code}`}>
                            {list.map((ass, aIdx) => {
                              let obtainedMark = 0;
                              if (ass.questionId) {
                                obtainedMark = item.student.marks?.[`q-${ass.categoryName}-${ass.unitNo}-${ass.questionId}`] ?? 0;
                                if (obtainedMark === 0) {
                                  obtainedMark = item.student.marks?.[`${ass.categoryName}-${ass.unitNo}`] ?? 0;
                                }
                              } else {
                                obtainedMark = item.student.marks?.[`${ass.categoryName}-${ass.unitNo}`] ?? 0;
                              }
                              const pct = ass.maxMarks > 0 ? (obtainedMark / ass.maxMarks) : 0;
                              const weightedScore = pct * ass.relativeWeight;
                              cloTotalScore += weightedScore;

                              const formatMark = (num: number) => {
                                if (num === 0) return '0';
                                return Number(num.toFixed(2)).toString();
                              };

                              return (
                                <td
                                  key={`${code}-stud-ass-${aIdx}`}
                                  className={`border-r border-black text-center font-mono ${ds.monoCellClass}`}
                                  style={ds.assStyle}
                                >
                                  {formatMark(weightedScore)}
                                </td>
                              );
                            })}
                            {/* CLO Total column */}
                            {(() => {
                              const isFailed = item.aggregate > 0 && cloTotalScore < cloPassingThreshold;
                              return (
                                <td
                                  className={`border-r border-black text-center font-bold font-sans ${ds.cellClass} ${
                                    isFailed ? 'ga-highlight-cell-fail font-black' : 'ga-highlight-cell'
                                  }`}
                                  style={ds.totStyle}
                                >
                                  {cloTotalScore.toFixed(2)}
                                </td>
                              );
                            })()}
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
                {/* Pad table with empty template rows */}
                {Array.from({ length: Math.max(0, 8 - course.students.length) }).map((_, emptyIdx) => {
                  const displayIdx = course.students.length + emptyIdx + 1;
                  return (
                    <tr key={`empty-${emptyIdx}`} className="text-slate-850">
                      <td className={`border-r border-black text-slate-450 font-sans text-center w-[3%] min-w-[22px] max-w-[30px] ${ds.cellClass}`}>
                        {displayIdx}
                      </td>
                      <td className={`border-r border-black ${ds.cellClass}`} style={ds.rollNoStyle}></td>
                      <td className={`border-r border-black ${ds.cellClass}`} style={ds.nameStyle}></td>
                      {cloCodes.map(code => {
                        const list = cloAssessments[code] || [];
                        return (
                          <React.Fragment key={`empty-${code}`}>
                            {list.map((_, aIdx) => (
                              <td key={`empty-${code}-ass-${aIdx}`} className={`border-r border-black ${ds.cellClass}`} style={ds.assStyle}></td>
                            ))}
                            <td className={`border-r border-black ga-highlight-cell ${ds.cellClass}`} style={ds.totStyle}></td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-center border-collapse border border-black font-sans text-[11px]">
              <thead>
                <tr className="bg-slate-50 border-b border-black font-black text-[10.5px] text-slate-900 leading-tight">
                  <th className="border-r border-black p-1.5 w-[4%] min-w-[28px] max-w-[35px] text-center">S.#</th>
                  <th className="border-r border-black p-1.5 text-left w-[14%] min-w-[100px] max-w-[115px] whitespace-nowrap">Registration No</th>
                  <th className="border-r border-black p-1.5 text-left w-[24%] min-w-[150px] max-w-[180px]">Student Name</th>
                  {totalColumns.map((col, cIdx) => (
                    <th key={cIdx} className="border-r border-black p-1.5 font-mono text-[10px] font-bold min-w-[32px] text-center">
                      <span className="block font-bold uppercase tracking-tighter">{col.label}</span>
                      <span className="text-[8px] text-slate-500 font-normal block mt-0.5">({col.maxMarks})</span>
                    </th>
                  ))}
                  <th className="border-r border-black p-1.5 text-indigo-805 font-bold w-[8%] min-w-[60px] text-center">Total Weightage</th>
                  <th className="p-1.5 text-blue-850 font-bold w-[6%] min-w-[40px] text-center bg-blue-50/5 select-none">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/40 font-mono text-[11px]">
                {studentTotalGrades.map((item, idx) => (
                  <tr key={`tot-tbl-${item.student.regNo || 'std'}-${idx}`} className="hover:bg-slate-50/20 text-slate-850">
                    <td className="border-r border-black p-1.5 text-slate-450 text-[10px] font-sans text-center w-[4%] min-w-[28px] max-w-[35px]">{idx + 1}</td>
                    <td className="border-r border-black p-1.5 text-left text-slate-905 font-black text-[11px] uppercase font-mono tracking-tight whitespace-nowrap w-[14%] min-w-[100px] max-w-[115px]">{item.student.regNo}</td>
                    <td className="border-r border-black p-1.5 text-left font-sans text-slate-900 font-bold uppercase text-[11px] w-[24%] min-w-[150px] max-w-[180px] break-words">{item.student.name}</td>
                    {totalColumns.map((col, cIdx) => {
                      const mark = getStudentMark(item.student, col.catName, col.unitNo, col.maxMarks, course.unitsData);
                      return (
                        <td key={cIdx} className="border-r border-black p-1.5 text-[11px] text-center min-w-[32px]">
                          {mark.toFixed(1)}
                        </td>
                      );
                    })}
                    <td className="border-r border-black p-1.5 font-extrabold text-[#4f46e5] text-[12px] text-center w-[8%] min-w-[60px]">
                      {item.aggregate.toFixed(1)}
                    </td>
                    <td className="p-1.5 font-black text-blue-800 text-[12.5px] bg-blue-50/5 text-center w-[6%] min-w-[40px]">{item.grade}</td>
                  </tr>
                ))}
                {course.students.length === 0 && (
                  <tr>
                    <td colSpan={5 + totalColumns.length} className="py-8 text-center text-slate-500 font-sans italic text-xs">
                      No students currently enrolled in this course specification. Enter students to build reports.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Signature & Attestation Panel Block */}
      <div className="mt-12 flex flex-col sm:flex-row justify-between items-end gap-12 text-[10px] font-sans pt-12 border-t border-dashed border-slate-350 no-print-break">
        <div className="text-center w-52">
          <p className="font-extrabold font-mono text-[11px] text-slate-850 border-b border-black pb-1 uppercase select-all">
            {instructor}
          </p>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
            Prepared By (Instructor)
          </p>
        </div>
        
        <div className="text-center w-52">
          <div className="border-b border-black pb-4 mb-1"></div>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
            Checked By Coordinator
          </p>
        </div>

        <div className="text-center w-52">
          <div className="border-b border-black pb-4 mb-1"></div>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
            Controller of Examinations
          </p>
        </div>
      </div>

    </div>
  );
};

const DEFAULT_COURSES: InstructorCourse[] = [];

export default function InstructorDashboard({ onLogout, instructorName = 'Prof. Dr. Jameel Ahmed' }: InstructorDashboardProps) {
  const [courses, setRawCourses] = useState<InstructorCourse[]>([]);
  const setCourses = (update: InstructorCourse[] | ((prev: InstructorCourse[]) => InstructorCourse[])) => {
    setRawCourses(prev => {
      const next = typeof update === 'function' ? update(prev) : update;
      const originalActive = prev.find(c => c.id === activeCourseId);
      if (originalActive && originalActive.status === 'closed') {
        return next.map(c => {
          if (c.id === activeCourseId) {
            return originalActive;
          }
          return c;
        });
      }
      return next;
    });
  };
  const [loading, setLoading] = useState(true);
  const [obeData, setObeData] = useState<OBEData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'error') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const [activeCourseId, setActiveCourseId] = useState<string>(() => {
    const saved = localStorage.getItem('IQRA_OBE_INSTRUCTOR_ACTIVE_ID');
    if (saved === 'course-1' || saved === 'course-2') return '';
    if (saved) return saved;
    return '';
  });

  // Single Course context helper (declared early for top-level usage)
  const selectedCourse = useMemo(() => {
    return courses.find(c => c.id === activeCourseId) || null;
  }, [courses, activeCourseId]);

  const [selectedObeAssKey, setSelectedObeAssKey] = useState<string>('');
  const [selectedMarksCategoryName, setSelectedMarksCategoryName] = useState<string>('');
  const [activeUnitConfigNo, setActiveUnitConfigNo] = useState<number | null>(null);
  const lastActiveCourseIdRef = useRef<string>('');
  const isFirstLoadRef = useRef<boolean>(true);

  // Load from API on mount, fallback offline if server not reachable
  useEffect(() => {
    let active = true;

    // Load available departments and programs dynamically
    apiService.getAllData().then(async res => {
      if (active) {
        let depts = res.departments || [];
        if (depts.length === 0) {
          try {
            const direct = await apiService.getDepartments();
            if (direct && direct.length > 0) depts = direct;
          } catch (e) {}
        }
        if (depts.length === 0) {
          const storedDept = localStorage.getItem('IQRA_OBE_USER_DEPT_ID');
          const storedDeptName = localStorage.getItem('IQRA_OBE_USER_DEPT_NAME');
          if (storedDept || storedDeptName) {
            depts = [{
              id: storedDept || 'dept-1',
              name: storedDeptName || 'Department of Computing and Technology',
              vision: '',
              mission: ''
            }];
          }
        }
        res.departments = depts;
        setObeData(res);
        if (depts && depts.length > 0) {
          const storedDept = localStorage.getItem('IQRA_OBE_USER_DEPT_ID');
          const firstDeptId = (storedDept && depts.some(d => String(d.id).toLowerCase() === String(storedDept).toLowerCase())) ? storedDept : depts[0].id;
          setAddDeptId(firstDeptId);
          setEditDeptId(firstDeptId);
          const firstProg = res.programs?.find(p => String(p.departmentId).toLowerCase() === String(firstDeptId).toLowerCase())?.id || '';
          setAddProgramId(firstProg);
          setEditProgramId(firstProg);
        }
      }
    }).catch(async err => {
      console.warn("Could not load departments & programs dynamically from backend:", err);
      if (active) {
        let fallbackDepts: Department[] = [];
        try {
          const direct = await apiService.getDepartments();
          if (direct && direct.length > 0) fallbackDepts = direct;
        } catch (e) {}
        if (fallbackDepts.length === 0) {
          const storedDept = localStorage.getItem('IQRA_OBE_USER_DEPT_ID');
          const storedDeptName = localStorage.getItem('IQRA_OBE_USER_DEPT_NAME');
          if (storedDept || storedDeptName) {
            fallbackDepts = [{
              id: storedDept || 'dept-1',
              name: storedDeptName || 'Department of Computing and Technology',
              vision: '',
              mission: ''
            }];
          }
        }
        setObeData({ departments: fallbackDepts, programs: [], courses: [], gas: [] });
        if (fallbackDepts.length > 0) {
          setAddDeptId(fallbackDepts[0].id);
          setEditDeptId(fallbackDepts[0].id);
        }
      }
    });

    const fetchCourses = async () => {
      try {
        const data = await apiService.getInstructorCourses();
        if (active) {
          const filtered = data.filter(c => c.id !== 'course-1' && c.id !== 'course-2');
          const normalized = filtered.map(normalizeCourse);
          setCourses(normalized);
          setErrorMsg(null);
          
          // Make sure a valid active course is selected and exists in the freshly-loaded list
          {
            const savedActive = localStorage.getItem('IQRA_OBE_INSTRUCTOR_ACTIVE_ID');
            const exists = normalized.some(c => c.id === savedActive);
            if (!savedActive || savedActive === 'course-1' || savedActive === 'course-2' || !exists) {
              if (normalized.length > 0) {
                setActiveCourseId(normalized[0].id);
              } else {
                setActiveCourseId('');
              }
            } else {
              setActiveCourseId(savedActive);
            }
          }
        }
      } catch (err: any) {
        console.warn("Failed to load instructor courses from server:", err);
        if (active) {
          const isBackend = apiService.isBackendUser();
          if (!isBackend) {
            const localCourses = apiService.getLocalInstructorCourses();
            if (localCourses && localCourses.length > 0) {
              const filtered = localCourses.filter(c => c.id !== 'course-1' && c.id !== 'course-2');
              const normalized = filtered.map(normalizeCourse);
              setCourses(normalized);
              setErrorMsg(null);
              
              // Set active course from local data fallback
              {
                const savedActive = localStorage.getItem('IQRA_OBE_INSTRUCTOR_ACTIVE_ID');
                const exists = normalized.some(c => c.id === savedActive);
                if (!savedActive || savedActive === 'course-1' || savedActive === 'course-2' || !exists) {
                  if (normalized.length > 0) {
                    setActiveCourseId(normalized[0].id);
                  } else {
                    setActiveCourseId('');
                  }
                } else {
                  setActiveCourseId(savedActive);
                }
              }
              showNotification("⚠️ Offline fallback active: Loaded your courses from cache/local storage.", "info");
              return;
            }
          }
          setCourses([]);
          setErrorMsg(err.message || "Failed to load instructor courses from backend server.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    fetchCourses();
    return () => {
      active = false;
    };
  }, []);

  // Keep state synced to local storage & backend
  useEffect(() => {
    localStorage.setItem('IQRA_OBE_INSTRUCTOR_ACTIVE_ID', activeCourseId);
    if (!activeCourseId) return;

    if (lastActiveCourseIdRef.current !== activeCourseId || !selectedObeAssKey) {
      lastActiveCourseIdRef.current = activeCourseId;
      const activeC = courses.find(c => c.id === activeCourseId);
      if (activeC && activeC.categories.length > 0) {
        const firstCat = activeC.categories[0];
        if (firstCat && firstCat.units > 0) {
          setSelectedObeAssKey(`${firstCat.name}:::1`);
        }
      }
    }
  }, [activeCourseId, courses, selectedObeAssKey]);

  useEffect(() => {
    if (!loading) {
      console.log('[DEBUG auto-save useEffect] courses state changed, local storing and syncing to backend:', courses.map(c => ({
        id: c.id,
        code: c.code,
        obeQuestionsCount: (c.obeQuestions || []).length,
        unitsDataKeys: c.unitsData ? Object.keys(c.unitsData) : null
      })));
      if (!apiService.isBackendUser()) {
        localStorage.setItem('IQRA_OBE_INSTRUCTOR_COURSES', JSON.stringify(courses));
      }
      if (isFirstLoadRef.current) {
        console.log('[DEBUG auto-save useEffect] Skipping initial load save');
        isFirstLoadRef.current = false;
        return;
      }
      apiService.saveInstructorCourses(courses).then(res => {
        console.log('[DEBUG auto-save useEffect] Backend sync success. Returned course list:', res ? res.map((c: any) => ({
          id: c.id,
          code: c.code,
          obeQuestionsCount: (c.obeQuestions || []).length,
          unitsDataKeys: c.unitsData ? Object.keys(c.unitsData) : null
        })) : null);

        if (Array.isArray(res)) {
          setCourses(prev => {
            let changed = false;
            const next = prev.map(localC => {
              const backendC = res.find(bc => bc.id === localC.id || bc.code === localC.code);
              if (!backendC) return localC;

              const localStudents = localC.students || [];
              const backendStudents = backendC.students || [];

              const localMap = new Map();
              localStudents.forEach(s => {
                const reg = s.regNo || (s as any).reg_no;
                if (reg) localMap.set(String(reg).toLowerCase().trim(), s);
              });

              const mergedStudents: CourseStudent[] = [];
              let studentsChanged = false;

              backendStudents.forEach(bs => {
                const bsReg = bs.regNo || (bs as any).reg_no;
                const bsName = bs.name || (bs as any).student_name || (bs as any).studentName || '';
                const bsMarks = bs.student_marks || bs.marks || {};
                const ls = bsReg ? localMap.get(String(bsReg).toLowerCase().trim()) : null;

                if (ls) {
                  const existingMarks = ls.student_marks || ls.marks || bsMarks;
                  if (ls.name !== bsName) {
                    studentsChanged = true;
                  }
                  mergedStudents.push({
                    ...ls,
                    regNo: bsReg,
                    name: bsName || ls.name,
                    marks: existingMarks,
                    student_marks: existingMarks
                  });
                } else {
                  studentsChanged = true;
                  mergedStudents.push({
                    regNo: bsReg,
                    name: bsName,
                    marks: bsMarks,
                    student_marks: bsMarks
                  });
                }
              });

              const backendSet = new Set(backendStudents.map(bs => String(bs.regNo || (bs as any).reg_no || '').toLowerCase().trim()));
              localStudents.forEach(ls => {
                const lsReg = String(ls.regNo || (ls as any).reg_no || '').toLowerCase().trim();
                if (lsReg && !backendSet.has(lsReg)) {
                  mergedStudents.push({
                    ...ls,
                    student_marks: ls.student_marks || ls.marks || {},
                    marks: ls.marks || ls.student_marks || {}
                  });
                }
              });

              if (localStudents.length !== mergedStudents.length) {
                studentsChanged = true;
              }

              if (studentsChanged) {
                changed = true;
                return {
                  ...localC,
                  students: mergedStudents
                };
              }
              return localC;
            });

            return changed ? next : prev;
          });
        }
      }).catch(err => {
        // This auto-save carries entered marks. Failing silently here meant an
        // instructor could enter marks for an entire class, see no error, and
        // lose all of it on logout — surface it so the change can be retried.
        console.error("[auto-save] Failed to sync instructor courses to backend", err);
        showNotification(
          `Changes could NOT be saved to the server: ${err?.message || 'connection or server error'}. ` +
          `Do not log out — please retry.`,
          "error"
        );
      });
    }
  }, [courses, loading]);

  // UI state variables
  const [activeTab, setActiveTab] = useState<'weightage' | 'edit-items' | 'students' | 'grade' | 'obe' | 'clo' | 'grading-system' | 'enter-marks'>('weightage');
  const [spreadsheetSearchQuery, setSpreadsheetSearchQuery] = useState<string>('');
  const [tempCustomGrades, setTempCustomGrades] = useState<{ grade: string; percentage: string; points: string }[] | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error-over' | 'error-under'>('idle');
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [courseToDeleteId, setCourseToDeleteId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'about' | 'help' | 'marksheet-report' | null>(null);
  // Set by handlePrintDirect only. It used to be seeded from a ?print=true URL
  // that the old open-in-a-new-tab print flow generated; nothing creates that
  // URL any more, so an old bookmark would just have auto-printed and frozen
  // the report fields.
  const [isDirectPrinting, setIsDirectPrinting] = useState(false);

  // Dynamic API CLOs states
  const [courseCLOs, setCourseCLOs] = useState<any[]>([]);
  const [loadingCLOs, setLoadingCLOs] = useState<boolean>(false);
  const [cloError, setCloError] = useState<string | null>(null);

  // Form states for creating/editing CLO
  const [numCLOs, setNumCLOs] = useState<number>(4);
  const [editingCLOId, setEditingCLOId] = useState<string | number | null>(null);
  const [cloFormCode, setCloFormCode] = useState<string>('CLO-1');
  const [cloFormDesc, setCloFormDesc] = useState<string>('');
  const [cloFormMappedGA, setCloFormMappedGA] = useState<string>('GA-1');
  const [cloFormOrder, setCloFormOrder] = useState<number>(1);

  // Keep track of edited descriptions and GA mappings for CLOs
  const [cloEdits, setCloEdits] = useState<Record<string, { description: string; mappedGA: string | null }>>({});

  // Synchronize numCLOs whenever selectedCourse changes or courseCLOs loads
  useEffect(() => {
    if (selectedCourse) {
      setNumCLOs(selectedCourse.cloCount || courseCLOs.length || 4);
    }
  }, [selectedCourse, courseCLOs.length]);

  // Sync edits state with existing course CLOs and selected numCLOs
  useEffect(() => {
    const edits: Record<string, { description: string; mappedGA: string | null }> = {};
    for (let i = 1; i <= numCLOs; i++) {
      const code = `CLO-${i}`;
      const existing = courseCLOs.find(c => c.code === code);
      edits[code] = {
        description: existing?.description || '',
        mappedGA: existing?.mappedGA || existing?.mapped_ga || null
      };
    }
    setCloEdits(edits);
  }, [numCLOs, courseCLOs]);

  // Compute available GAs for the selected course's department and program
  const availableGAs = useMemo(() => {
    if (!obeData?.gas || !selectedCourse) return [];
    
    // First, filter by department
    let filtered = obeData.gas.filter(ga => 
      ga.departmentId?.toLowerCase() === selectedCourse.departmentId?.toLowerCase()
    );

    // If the course belongs to a specific program (e.g. BSCS, BSAI, BSSE, BBA, etc.)
    const courseProgramId = (selectedCourse.programId || '').toLowerCase();
    const courseProgramName = (selectedCourse.programName || '').toLowerCase();
    
    let targetProgram = courseProgramId;
    if (!targetProgram && obeData?.programs) {
      const matched = obeData.programs.find(p => 
        (p.name && courseProgramName.includes(p.name.toLowerCase())) ||
        (p.code && courseProgramName.includes(p.code.toLowerCase()))
      );
      if (matched) {
        targetProgram = matched.id.toLowerCase();
      }
    }

    if (targetProgram) {
      // Filter GAs that match this programId or whose ID contains the program name (like "BSCS", "BSAI", etc.)
      const programFiltered = filtered.filter(ga => {
        const gaIdLower = (ga.id || '').toLowerCase();
        const gaProgLower = (ga.programId || (ga as any).program_id || '').toLowerCase();
        
        // Match by ga.programId / ga.program_id
        if (gaProgLower && gaProgLower === targetProgram) {
          return true;
        }
        // Match by ID suffix or containment (e.g. gaId is "GA-1-BSCS" or contains "-bscs")
        if (gaIdLower.includes(`-${targetProgram}`) || gaIdLower.endsWith(targetProgram)) {
          return true;
        }
        
        // If the GA doesn't have any program suffix/id at all, keep it as a general GA
        const hasAnyProgramSuffix = gaIdLower.includes('-bscs') || 
                                    gaIdLower.includes('-bsai') || 
                                    gaIdLower.includes('-bsse') || 
                                    gaIdLower.includes('-bscy') ||
                                    gaIdLower.includes('-bba');
        if (!hasAnyProgramSuffix && !gaProgLower) {
          return true;
        }
        
        return false;
      });
      
      if (programFiltered.length > 0) {
        filtered = programFiltered;
      }
    }

    const programScoped = filtered.length > 0 ? filtered : obeData.gas;

    // Narrow to the GAs that QA actually mapped to THIS course in the
    // "Courses to GA mapping" screen. Without this the dropdown listed every
    // GA in the program, letting a CLO be mapped to a GA the course doesn't
    // even contribute to — which then feeds the attainment reports.
    const courseCode = (selectedCourse.code || '').toLowerCase().trim();
    const courseProg = (selectedCourse.programId || '').toLowerCase().trim();
    const catalogCourses = obeData.courses || [];

    // Same code can exist in several programs, so prefer an exact
    // code+program match and fall back to code alone.
    const catalogCourse =
      catalogCourses.find(cc =>
        (cc.code || '').toLowerCase().trim() === courseCode &&
        (cc.programId || '').toLowerCase().trim() === courseProg
      ) ||
      catalogCourses.find(cc => (cc.code || '').toLowerCase().trim() === courseCode);

    if (catalogCourse) {
      const mappedIds = new Set(
        (catalogCourse.mappedGAs || []).map(id => String(id).toLowerCase().trim())
      );
      // An empty mapping is meaningful: QA hasn't mapped this course to any GA
      // yet, so there is genuinely nothing to choose from.
      return obeData.gas
        .filter(ga => mappedIds.has(String(ga.id).toLowerCase().trim()))
        .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: 'base' }));
    }

    // Catalog entry couldn't be resolved (data still loading, or the course
    // isn't in the catalog) — fall back to the program-scoped list rather than
    // showing an empty dropdown.
    return programScoped;
  }, [obeData?.gas, obeData?.courses, selectedCourse]);

  const handleAssignCLOsCount = async (targetCount: number) => {
    if (!selectedCourse) return;
    setLoadingCLOs(true);
    try {
      // 1. Update course cloCount locally in state.
      // This automatically triggers the courses saving useEffect to persist it safely!
      setCourses(prev => prev.map(c => {
        if (c.id === selectedCourse.id) {
          return { ...c, cloCount: targetCount };
        }
        return c;
      }));

      // 2. Automatically create default placeholder database records for CLOs up to targetCount
      const savePromises = Array.from({ length: targetCount }, async (_, idx) => {
        const i = idx + 1;
        const code = `CLO-${i}`;
        const existing = courseCLOs.find(c => c.code === code);
        const payload = {
          code,
          description: existing?.description || `Course Learning Outcome ${i}`,
          mappedGA: existing?.mappedGA || existing?.mapped_ga || null,
          mapped_ga: existing?.mappedGA || existing?.mapped_ga || null,
          order: i
        };

        if (existing && existing.id) {
          return apiService.updateCourseCLO(selectedCourse.id, existing.id, payload);
        } else {
          return apiService.createCourseCLO(selectedCourse.id, payload);
        }
      });

      // Delete any extra CLOs
      const deletePromises = courseCLOs
        .filter(c => {
          const match = c.code.match(/CLO-(\d+)/);
          if (match) {
            const index = parseInt(match[1]);
            return index > targetCount;
          }
          return false;
        })
        .map(c => apiService.deleteCourseCLO(selectedCourse.id, c.id));

      await Promise.all([...savePromises, ...deletePromises]);
      await fetchCurrentCourseCLOs(selectedCourse.id);

      showNotification(`Successfully configured ${targetCount} Course Learning Outcomes (CLOs) for this course.`, 'success');
    } catch (err: any) {
      console.error(err);
      showNotification(`Failed to configure CLO count: ${err.message || err}`);
    } finally {
      setLoadingCLOs(false);
    }
  };

  const handleSaveAllCLOs = async () => {
    if (!selectedCourse) return;
    setLoadingCLOs(true);
    try {
      // 1. Update course cloCount locally in state.
      setCourses(prev => prev.map(c => {
        if (c.id === selectedCourse.id) {
          return { ...c, cloCount: numCLOs };
        }
        return c;
      }));

      // 2. Save/update all CLOs from 1 to numCLOs
      const savePromises = Array.from({ length: numCLOs }, async (_, idx) => {
        const i = idx + 1;
        const code = `CLO-${i}`;
        const editData = cloEdits[code] || { description: '', mappedGA: null };
        const existing = courseCLOs.find(c => c.code === code);

        const payload = {
          code,
          description: editData.description || `Course Learning Outcome ${i}`,
          mappedGA: editData.mappedGA,
          mapped_ga: editData.mappedGA,
          order: i
        };

        if (existing && existing.id) {
          return apiService.updateCourseCLO(selectedCourse.id, existing.id, payload);
        } else {
          return apiService.createCourseCLO(selectedCourse.id, payload);
        }
      });

      // 3. Delete any extra CLOs in DB that are higher than numCLOs
      const deletePromises = courseCLOs
        .filter(c => {
          const match = c.code.match(/CLO-(\d+)/);
          if (match) {
            const index = parseInt(match[1]);
            return index > numCLOs;
          }
          return false;
        })
        .map(c => apiService.deleteCourseCLO(selectedCourse.id, c.id));

      await Promise.all([...savePromises, ...deletePromises]);

      // 4. Re-fetch current course CLOs from the server
      await fetchCurrentCourseCLOs(selectedCourse.id);

      showNotification(`Successfully saved ${numCLOs} CLO descriptions and GA mappings.`, 'success');
    } catch (err: any) {
      console.error(err);
      showNotification(`Failed to save CLO mappings: ${err.message || err}`);
    } finally {
      setLoadingCLOs(false);
    }
  };

  // Fetch Course CLOs dynamically
  const fetchCurrentCourseCLOs = async (cId: string) => {
    if (!cId) return;
    setLoadingCLOs(true);
    setCloError(null);
    try {
      const data = await apiService.getCourseCLOs(cId);
      if (Array.isArray(data)) {
        setCourseCLOs(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
      } else {
        setCourseCLOs([]);
      }
    } catch (err) {
      console.warn("Failed to fetch course CLOs from server:", err);
      // fallback mock or generate based on course count
      setCourseCLOs([]);
    } finally {
      setLoadingCLOs(false);
    }
  };

   useEffect(() => {
    if (loading) return;
    if (activeCourseId) {
      const exists = courses.some(c => c.id === activeCourseId);
      if (courses.length > 0 && !exists) {
        // Stale course ID, clear it or fall back
        setActiveCourseId('');
        setCourseCLOs([]);
      } else {
        fetchCurrentCourseCLOs(activeCourseId);
      }
    } else {
      setCourseCLOs([]);
    }
  }, [activeCourseId, courses, loading]);

  // Marksheet Report metadata states
  const [reportCampus, setReportCampus] = useState('Iqra University Chak Shahzad Campus Islamabad');
  const [reportType, setReportType] = useState<'standard' | 'combined' | 'award' | 'clo' | 'ga'>('standard');
  const [reportSemester, setReportSemester] = useState('SPRING 2026');
  const [reportSection, setReportSection] = useState('A');
  const [reportOfferedIn, setReportOfferedIn] = useState('Morning');
  const [reportSession, setReportSession] = useState('B.Sc Computer Science (Fall-Morning)');
  const [reportInstructor, setReportInstructor] = useState('Prof. Dr. Jameel Ahmed');
  const [reportDated, setReportDated] = useState('');
  const [reportPrintDate, setReportPrintDate] = useState(() => {
    const today = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${today.getDate()}-${months[today.getMonth()]}-${today.getFullYear()}`;
  });

  // Automatically sync report details when the selected course changes
  useEffect(() => {
    if (selectedCourse) {
      // The heading used to be `B.Sc ${programName} (Fall-Morning)`. The program
      // name from the API already carries its degree ("BS Computer Science
      // (BSCS)"), so sheets read "B.Sc BS Computer Science"; "Fall" was
      // hardcoded even on Spring courses; and with no program it fell back to
      // "B.Sc Electrical Engineering" for every department.
      //
      // Now: the program (or department) name as-is, and the season taken from
      // the course's own term (e.g. "Spring-2023" -> "Spring"). The shift isn't
      // stored anywhere, so "Morning" stays as the editable default.
      const base = (selectedCourse.programName || selectedCourse.departmentName || '').trim();
      const seasonMatch = String(selectedCourse.academicYear || '').match(/spring|summer|fall|autumn|winter/i);
      const season = seasonMatch
        ? seasonMatch[0].charAt(0).toUpperCase() + seasonMatch[0].slice(1).toLowerCase()
        : '';
      const shift = season ? `${season}-Morning` : 'Morning';
      setReportSession(base ? `${base} (${shift})` : `(${shift})`);

      // Semester was a hardcoded 'SPRING 2026' default that was never synced, so
      // every sheet printed that regardless of the course (a Spring-2023 course
      // showed "SPRING 2026"). Take it from the course's own term when known.
      const termText = String(selectedCourse.academicYear || '').replace(/[-_]+/g, ' ').trim();
      if (termText) setReportSemester(termText.toUpperCase());
      setReportInstructor(instructorName);
      const today = new Date();
      setReportDated(today.toISOString().split('T')[0]);
    }
  }, [selectedCourse, instructorName]);


  const handlePrintDirect = () => {
    if (!selectedCourse) return;

    // Print in place. This used to window.open() a dedicated ?print=true page
    // in a new tab, which meant a stray tab on every print and a browser-drawn
    // header/footer carrying that long query string across the top of the
    // output. The in-app print view renders the same document, so switch to it
    // directly and let the browser print this page.
    setIsDirectPrinting(true);

    // Leave the print view mounted until the browser is actually finished with
    // it. window.print() returns immediately in Chrome — the preview dialog is
    // asynchronous — so tearing the view down right after the call unmounted
    // the document while the dialog was still open, and "Save as PDF" then
    // wrote nothing because there was no longer anything to rasterise.
    // 'afterprint' fires once the dialog is closed, whether the user saved or
    // cancelled, which is the correct moment to restore the report builder.
    const handleAfterPrint = () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      setIsDirectPrinting(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);

    // Let React commit the print view before handing off to the browser.
    setTimeout(() => {
      try {
        window.focus();
        window.print();
      } catch (e) {
        console.error("Print failed:", e);
        // Only unwind here — if print() never opened, no 'afterprint' is coming.
        window.removeEventListener('afterprint', handleAfterPrint);
        setIsDirectPrinting(false);
      }
    }, 350);
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('marksheet-real-view');
    if (!element) {
      showNotification("Error: Mark sheet preview element not found. Please select a course first.");
      return;
    }

    // Show a temporary loading indicator on the download button
    const downloadBtns = document.querySelectorAll('button');
    let downloadBtn: HTMLButtonElement | null = null;
    downloadBtns.forEach(btn => {
      if (btn.textContent?.toLowerCase().includes('download')) {
        downloadBtn = btn as HTMLButtonElement;
      }
    });

    const oldText = downloadBtn ? downloadBtn.innerHTML : null;
    if (downloadBtn) {
      downloadBtn.innerHTML = `<span class="animate-spin mr-1.5 inline-block">⏳</span> Compiling PDF...`;
      downloadBtn.disabled = true;
    }

    // Save current layout configurations to restore them perfectly afterward
    const originalWidth = element.style.width;
    const originalMaxWidth = element.style.maxWidth;
    const originalMinHeight = element.style.minHeight;
    const originalBoxShadow = element.style.boxShadow;
    const originalBorder = element.style.border;

    // Direct search for all wrappers that might clip columns
    const overflowWrappers = element.querySelectorAll('.overflow-x-auto, .overflow-y-auto, .overflow-auto, [class*="overflow-x"]');
    const originalWrappers = Array.from(overflowWrappers).map((w: any) => ({
      el: w,
      overflow: w.style.overflow,
      overflowX: w.style.overflowX,
      overflowY: w.style.overflowY,
      maxWidth: w.style.maxWidth,
      width: w.style.width
    }));

    const tables = element.querySelectorAll('table');
    const originalTables = Array.from(tables).map((t: any) => ({
      el: t,
      width: t.style.width,
      minWidth: t.style.minWidth,
      tableLayout: t.style.tableLayout
    }));

    try {
      // 1. Unconstrain element and inner scroll wrappers first to calculate true unclipped width
      originalWrappers.forEach(item => {
        item.el.style.overflow = 'visible';
        item.el.style.overflowX = 'visible';
        item.el.style.overflowY = 'visible';
        item.el.style.maxWidth = 'none';
        item.el.style.width = 'max-content';
      });

      originalTables.forEach(item => {
        item.el.style.width = 'max-content';
        item.el.style.minWidth = '100%';
      });

      element.style.width = 'max-content';
      element.style.maxWidth = 'none';
      element.style.minHeight = 'auto';
      element.style.boxShadow = 'none';
      element.style.border = 'none';

      // Yield macro-task for computed DOM layout coordinates
      await new Promise(resolve => setTimeout(resolve, 50));

      let maxTableScrollWidth = 0;
      tables.forEach((t: any) => {
        if (t.scrollWidth > maxTableScrollWidth) {
          maxTableScrollWidth = t.scrollWidth;
        }
      });

      const requiredWidth = Math.max(element.scrollWidth, element.offsetWidth, maxTableScrollWidth);
      // Same rule the document was laid out with — see isMarksheetLandscape.
      const isLandscape = selectedCourse ? isMarksheetLandscape(selectedCourse, reportType) : requiredWidth > 850;
      const targetBaseWidth = isLandscape ? 1130 : 800;
      const renderWidth = Math.max(requiredWidth + 32, targetBaseWidth);

      // Lock element width to exact renderWidth so html-to-image renders all columns completely without clipping
      element.style.width = `${renderWidth}px`;
      element.style.maxWidth = 'none';

      // Reset the scroll wrappers back to full width as well.
      //
      // Step 1 above sets both the wrappers and the tables to `max-content` so
      // the true unclipped width can be measured. The tables were being reset
      // here, but the wrappers were not — they stayed at `max-content` for the
      // capture. A table at `width: 100%` inside a shrink-to-fit wrapper
      // resolves to the table's own content width, so the ledger rendered at
      // roughly 60% of the sheet while the header blocks (plain `w-full` divs)
      // spanned the whole thing. That mismatch was the white gap down the
      // right-hand side of the exported PDF.
      originalWrappers.forEach(item => {
        item.el.style.width = '100%';
      });

      originalTables.forEach(item => {
        item.el.style.width = '100%';
        // Step 1 set this to '100%', which is circular once the wrapper is
        // also percentage-based; clear it so the table simply fills the wrapper.
        item.el.style.minWidth = '0';
      });

      // Force layout calculation refresh
      const _reflow = element.offsetHeight;

      // Yield a tiny execution macrotask to allow Chrome rendering thread to flush computed coordinates
      await new Promise(resolve => setTimeout(resolve, 100));

      // Capture the fully expanded layout.
      //
      // This was a lossless PNG at pixelRatio 2.5, which produced ~37MB files.
      // A mark sheet is black text on white — JPEG compresses that to a few
      // percent of the PNG size with no visible difference at print DPI, and
      // 2x is still ~190 DPI on A4, well above what the text needs.
      const dataUrl = await toJpeg(element, {
        quality: 0.92,
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });

      // compress: true runs the PDF's own Flate compression over the object
      // streams on top of the JPEG.
      const pdf = new jsPDF({
        orientation: isLandscape ? 'l' : 'p',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });
      const pageHeight = isLandscape ? 210 : 297; // A4 height in mm
      const imgWidth = isLandscape ? 297 : 210; // A4 width in mm

      const widthInPx = element.offsetWidth || renderWidth;
      const heightInPx = element.offsetHeight || (isLandscape ? 800 : 1130);
      const imgHeight = (heightInPx * imgWidth) / widthInPx; // scales naturally to preserve original aspect ratio

      let heightLeft = imgHeight;
      let position = 0;

      // Multi-page output works by placing the SAME tall image at a negative
      // offset on each page. Passing a stable alias makes jsPDF store the image
      // once and reference it from every page — without it the whole capture was
      // embedded again per page, so a 3-page sheet carried 3 copies.
      const IMG_ALIAS = 'marksheet-capture';

      // Add Page 1
      pdf.addImage(dataUrl, 'JPEG', 0, position, imgWidth, imgHeight, IMG_ALIAS, 'FAST');
      heightLeft -= pageHeight;

      // Slice overflow contents onto successive pages natively
      let pageNum = 1;
      while (heightLeft > 5) {
        position = - (pageNum * pageHeight);
        pdf.addPage();
        pdf.addImage(dataUrl, 'JPEG', 0, position, imgWidth, imgHeight, IMG_ALIAS, 'FAST');
        heightLeft -= pageHeight;
        pageNum++;
      }

      pdf.save(`Marksheet_${selectedCourse?.code || 'Course'}.pdf`);

      if (downloadBtn && oldText) {
        downloadBtn.innerHTML = oldText;
        downloadBtn.disabled = false;
      }
    } catch (error) {
      console.error("PDF download compilation error:", error);
      showNotification("Direct PDF compilation encountered a delay. Please Click 'Print' and select 'Save as PDF' instead.");
      if (downloadBtn && oldText) {
        downloadBtn.innerHTML = oldText;
        downloadBtn.disabled = false;
      }
    } finally {
      // Instantly restore pristine on-screen app view styles
      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxWidth;
      element.style.minHeight = originalMinHeight;
      element.style.boxShadow = originalBoxShadow;
      element.style.border = originalBorder;

      originalWrappers.forEach(item => {
        item.el.style.overflow = item.overflow;
        item.el.style.overflowX = item.overflowX;
        item.el.style.overflowY = item.overflowY;
        item.el.style.maxWidth = item.maxWidth;
        item.el.style.width = item.width;
      });

      originalTables.forEach(item => {
        item.el.style.width = item.width;
        // minWidth was captured in originalTables but never restored, so every
        // export left an inline min-width on the preview tables.
        item.el.style.minWidth = item.minWidth;
        item.el.style.tableLayout = item.tableLayout;
      });
    }
  };

  // Close the desktop menu when the user clicks anywhere else
  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Warning Modals and Alert triggers
  const [showZeroAlert, setShowZeroAlert] = useState<{ show: boolean; msg: string; category: string } | null>(null);
  const [unitEditingCategory, setUnitEditingCategory] = useState<string | null>(null);
  const [unitSaveSuccessMsg, setUnitSaveSuccessMsg] = useState<string | null>(null);
  const [unitCloValidationError, setUnitCloValidationError] = useState<boolean>(false);

  // Form states for creating course
  const [addDeptId, setAddDeptId] = useState('');
  const [addProgramId, setAddProgramId] = useState('');
  const [addCourseCode, setAddCourseCode] = useState('');
  const [addCourseTitle, setAddCourseTitle] = useState('');
  const [addCreditHours, setAddCreditHours] = useState(3);
  const [addCourseType, setAddCourseType] = useState<'Theory' | 'Lab'>('Theory');

  // Form states for editing course
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [editCourseCode, setEditCourseCode] = useState('');
  const [editCourseTitle, setEditCourseTitle] = useState('');
  const [editDeptId, setEditDeptId] = useState('');
  const [editProgramId, setEditProgramId] = useState('');
  const [editCreditHours, setEditCreditHours] = useState(3);
  const [editCourseType, setEditCourseType] = useState<'Theory' | 'Lab'>('Theory');

  // Edit Student states
  const [editingStudentReg, setEditingStudentReg] = useState<string | null>(null);
  const [editStudentRegVal, setEditStudentRegVal] = useState<string>('');
  const [editStudentNameVal, setEditStudentNameVal] = useState<string>('');

  // --- Sub-modules: set Weightage States ---
  // A temporary copy of the selected course's categories for non-destructive updates before pressing "Ok" or "Save"
  const [tempCategories, setTempCategories] = useState<MarksCategory[]>([]);
  const [selectedWeightIndex, setSelectedWeightIndex] = useState<number>(0);

  // Form fields for updating a weight category under the table
  const [editWeightPercent, setEditWeightPercent] = useState<string>('0');
  const [editWeightUnits, setEditWeightUnits] = useState<string>('0');

  const previousCourseIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedCourse) {
      setTempCategories(JSON.parse(JSON.stringify(selectedCourse.categories)));
      if (previousCourseIdRef.current !== selectedCourse.id) {
        setSelectedWeightIndex(0);
        previousCourseIdRef.current = selectedCourse.id;
      }
    } else {
      previousCourseIdRef.current = null;
    }
  }, [selectedCourse, activeTab]);

  // Load input fields when the selected index or category length updates
  useEffect(() => {
    if (tempCategories.length > 0 && tempCategories[selectedWeightIndex]) {
      setEditWeightPercent(tempCategories[selectedWeightIndex].percentage.toString());
      setEditWeightUnits(tempCategories[selectedWeightIndex].units.toString());
    }
  }, [selectedWeightIndex, tempCategories.length]);

  useEffect(() => {
    if (saveStatus !== 'success') {
      setSaveStatus('idle');
    }
  }, [tempCategories, selectedWeightIndex, saveStatus]);

  // Sync selectedMarksCategoryName to the first active category if needed
  useEffect(() => {
    if (selectedCourse) {
      const activeCats = selectedCourse.categories.filter(cat => cat.percentage > 0 && cat.units > 0);
      if (activeCats.length > 0) {
        if (!selectedMarksCategoryName || !activeCats.some(c => c.name === selectedMarksCategoryName)) {
          setSelectedMarksCategoryName(activeCats[0].name);
        }
      } else {
        setSelectedMarksCategoryName('');
      }
    } else {
      setSelectedMarksCategoryName('');
    }
  }, [selectedCourse, selectedMarksCategoryName]);

  const handleWeightPercentChange = (valStr: string) => {
    setEditWeightPercent(valStr);
    const parsed = parseFloat(valStr);
    const val = isNaN(parsed) ? 0 : parsed;
    setTempCategories(prev => {
      const copy = [...prev];
      if (copy[selectedWeightIndex]) {
        copy[selectedWeightIndex] = {
          ...copy[selectedWeightIndex],
          percentage: val
        };
      }
      return copy;
    });
  };

  const handleWeightUnitsChange = (valStr: string) => {
    setEditWeightUnits(valStr);
    const parsed = parseInt(valStr, 10);
    const val = isNaN(parsed) ? 0 : parsed;
    setTempCategories(prev => {
      const copy = [...prev];
      if (copy[selectedWeightIndex]) {
        copy[selectedWeightIndex] = {
          ...copy[selectedWeightIndex],
          units: val
        };
      }
      return copy;
    });
  };

  // Compute live totals
  const currentTotalWeight = useMemo(() => {
    return tempCategories.reduce((sum, item) => sum + item.percentage, 0);
  }, [tempCategories]);

  // --- Sub-modules: Set Units Modal States ---
  // Grid details for the currently active unit editing configuration
  const [tempUnits, setTempUnits] = useState<UnitItem[]>([]);
  const [selectedUnitIndex, setSelectedUnitIndex] = useState<number>(0);
  const [unitTotalMarks, setUnitTotalMarks] = useState<string>('10');
  const [unitPassMarks, setUnitPassMarks] = useState<string>('5');
  const [unitWeightage, setUnitWeightage] = useState<string>('16');

  useEffect(() => {
    setUnitCloValidationError(false);
  }, [unitEditingCategory, selectedUnitIndex]);

  const handleUnitTotalMarksChange = (valStr: string) => {
    setUnitTotalMarks(valStr);
    const parsed = parseFloat(valStr);
    const val = isNaN(parsed) ? 0 : parsed;
    setTempUnits(prev => {
      const copy = [...prev];
      if (copy[selectedUnitIndex]) {
        copy[selectedUnitIndex] = {
          ...copy[selectedUnitIndex],
          totalMarks: val
        };
      }
      return copy;
    });
  };

  const handleUnitPassMarksChange = (valStr: string) => {
    setUnitPassMarks(valStr);
    const parsed = parseFloat(valStr);
    const val = isNaN(parsed) ? 0 : parsed;
    setTempUnits(prev => {
      const copy = [...prev];
      if (copy[selectedUnitIndex]) {
        copy[selectedUnitIndex] = {
          ...copy[selectedUnitIndex],
          passing: val
        };
      }
      return copy;
    });
  };

  const handleUnitWeightageChange = (valStr: string) => {
    setUnitWeightage(valStr);
    const parsed = parseFloat(valStr);
    const val = isNaN(parsed) ? 0 : parsed;
    setTempUnits(prev => {
      const copy = [...prev];
      if (copy[selectedUnitIndex]) {
        copy[selectedUnitIndex] = {
          ...copy[selectedUnitIndex],
          weightage: val
        };
      }
      return copy;
    });
  };

  // Triggered when opening a category from "Edit Items" dropdown or list
  const handleOpenUnitEditor = (categoryName: string, unitIndex?: number) => {
    if (!selectedCourse) return;
    const cat = selectedCourse.categories.find(c => c.name === categoryName);
    if (!cat || cat.percentage === 0 || cat.units === 0) {
      // Pop up the screenshot-accurate Windows error dialog
      const realMsg = `Number of units is zero, cannot add unit item for Marks Distribution ${categoryName}.`;
      setShowZeroAlert({
        show: true,
        msg: realMsg,
        category: categoryName
      });
      return;
    }

    // Load unit details
    const existingUnits = selectedCourse.unitsData[categoryName] || [];
    // Ensure accurate sizing to cat.units
    let actualUnits = [...existingUnits];
    if (actualUnits.length < cat.units) {
      const diff = cat.units - actualUnits.length;
      for (let i = 0; i < diff; i++) {
        const uNo = actualUnits.length + 1;
        const defaultW = Math.round(100 / cat.units);
        actualUnits.push({
          unitNo: uNo,
          passing: 5,
          totalMarks: 10,
          weightage: defaultW
        });
      }
    } else if (actualUnits.length > cat.units) {
      actualUnits = actualUnits.slice(0, cat.units);
    }

    const normalizedUnits = actualUnits.map(u => {
      const isPresentation = categoryName.toLowerCase().includes('presentation');
      const labelPrefix = isPresentation ? 'Module' : 'Question';
      let qs = u.questions || [];
      if (qs.length === 0) {
        qs = [
          {
            id: `q-default-${u.unitNo}-${Date.now()}`,
            name: `${labelPrefix} 1`,
            maxMarks: u.totalMarks || 10,
            mappedCLOs: u.mappedCLOs && u.mappedCLOs.length > 0 ? [u.mappedCLOs[0]] : ['CLO-1']
          }
        ];
      }
      return {
        ...u,
        mappedCLOs: [...new Set(qs.flatMap(q => q.mappedCLOs))].sort(),
        questions: qs
      };
    });

    setTempUnits(normalizedUnits);
    const targetIdx = unitIndex !== undefined ? unitIndex : 0;
    setSelectedUnitIndex(targetIdx);
    if (normalizedUnits[targetIdx]) {
      setUnitTotalMarks(normalizedUnits[targetIdx].totalMarks.toString());
      setUnitPassMarks(normalizedUnits[targetIdx].passing.toString());
      setUnitWeightage(normalizedUnits[targetIdx].weightage.toString());
    }
    setUnitEditingCategory(categoryName);
  };

  useEffect(() => {
    if (tempUnits.length > 0 && tempUnits[selectedUnitIndex]) {
      setUnitTotalMarks(tempUnits[selectedUnitIndex].totalMarks.toString());
      setUnitPassMarks(tempUnits[selectedUnitIndex].passing.toString());
      setUnitWeightage(tempUnits[selectedUnitIndex].weightage.toString());
    }
  }, [selectedUnitIndex, tempUnits.length]);

  // Calculate sum of unit weightages (should ideally sum to 100% of the category total weight)
  const totalUnitWeightSum = useMemo(() => {
    return tempUnits.reduce((sum, u) => sum + u.weightage, 0);
  }, [tempUnits]);

  // --- Sub-modules: Students Setup States ---
  const [newStudentReg, setNewStudentReg] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [bulkRegText, setBulkRegText] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [parsedStudents, setParsedStudents] = useState<CourseStudent[]>([]);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // --- Sub-modules: OBE Setup States ---
  const [obeSubTab, setObeSubTab] = useState<'questions' | 'marks' | 'reports'>('questions');
  const [reportsViewMode, setReportsViewMode] = useState<'clo' | 'ga'>('clo');
  const [qName, setQName] = useState('');
  const [qMaxMarks, setQMaxMarks] = useState<string>('10');
  const [qClos, setQClos] = useState<string[]>([]);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const resetObeForm = () => {
    setQName('');
    setQMaxMarks('10');
    setQClos([]);
    setEditingQuestionId(null);
  };

  // --- Inline Questions Entry in Enter Marks ---
  const [inlineQName, setInlineQName] = useState('');
  const [inlineQMaxMarks, setInlineQMaxMarks] = useState('5');
  const [inlineQMappedCLOs, setInlineQMappedCLOs] = useState<string[]>([]);
  const [wizardNumQuestions, setWizardNumQuestions] = useState(4);

  const handleSaveObeQuestion = () => {
    if (!selectedCourse) return;
    if (!qName.trim()) {
      showNotification("Please enter a question name (e.g. Question 1).");
      return;
    }
    const maxM = parseFloat(qMaxMarks);
    if (isNaN(maxM) || maxM <= 0) {
      showNotification("Max marks must be greater than 0.");
      return;
    }
    if (qClos.length === 0) {
      showNotification("Please map this question to at least one CLO target.");
      return;
    }
    if (!selectedObeAssKey) {
      showNotification("Please select an assessment component first.");
      return;
    }

    const [catName, unitNoStr] = selectedObeAssKey.split(':::');
    const uNo = parseInt(unitNoStr, 10);

    const updatedQuestions = [...(selectedCourse.obeQuestions || [])];
    if (editingQuestionId) {
      const idx = updatedQuestions.findIndex(q => q.id === editingQuestionId);
      if (idx !== -1) {
        updatedQuestions[idx] = {
          ...updatedQuestions[idx],
          questionName: qName.trim(),
          maxMarks: maxM,
          mappedCLOs: qClos
        };
      }
    } else {
      const newQ = {
        id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        categoryName: catName,
        unitNo: uNo,
        questionName: qName.trim(),
        maxMarks: maxM,
        mappedCLOs: qClos
      };
      updatedQuestions.push(newQ);
    }

    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        // Also update unitsData's questions for this category and unit to keep them in perfect sync
        const updatedUnitsData = { ...c.unitsData };
        const existingUnits = updatedUnitsData[catName] || [];
        let unitItem = existingUnits.find(u => u.unitNo === uNo);
        if (!unitItem) {
          unitItem = {
            unitNo: uNo,
            passing: Math.ceil(maxM * 0.5),
            totalMarks: maxM,
            weightage: 100 / (c.categories.find(cat => cat.name === catName)?.units || 1),
            mappedCLOs: qClos,
            questions: []
          };
        }
        
        const unitQs = updatedQuestions
          .filter(q => q.categoryName === catName && q.unitNo === uNo)
          .map(q => ({
            id: q.id,
            name: q.questionName,
            maxMarks: q.maxMarks,
            mappedCLOs: q.mappedCLOs
          }));
          
        const newTotalMarks = unitQs.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
        const allMappedCLOs = [...new Set(unitQs.flatMap(q => q.mappedCLOs || []))].sort();

        const updatedUnitItem = {
          ...unitItem,
          questions: unitQs,
          totalMarks: newTotalMarks > 0 ? newTotalMarks : unitItem.totalMarks,
          mappedCLOs: allMappedCLOs
        };

        const updatedUnitsList = existingUnits.map(u => u.unitNo === uNo ? updatedUnitItem : u);
        if (!existingUnits.some(u => u.unitNo === uNo)) {
          updatedUnitsList.push(updatedUnitItem);
        }
        
        updatedUnitsData[catName] = updatedUnitsList;

        return {
          ...c,
          obeQuestions: updatedQuestions,
          unitsData: updatedUnitsData
        };
      }
      return c;
    }));

    resetObeForm();
  };

  const handleDeleteObeQuestion = (qId: string) => {
    if (!selectedCourse) return;
    if (!confirm("Are you sure you want to delete this OBE question? Student marks entered for this question will also be removed permanently.")) return;

    const questionToDelete = (selectedCourse.obeQuestions || []).find(q => q.id === qId);
    const updatedQuestions = (selectedCourse.obeQuestions || []).filter(q => q.id !== qId);
    
    const updatedMarks = { ...(selectedCourse.obeMarks || {}) };
    Object.keys(updatedMarks).forEach(reg => {
      const stdMarks = { ...updatedMarks[reg] };
      delete stdMarks[qId];
      updatedMarks[reg] = stdMarks;
    });

    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        const updatedUnitsData = { ...c.unitsData };
        if (questionToDelete) {
          const { categoryName, unitNo } = questionToDelete;
          const existingUnits = updatedUnitsData[categoryName] || [];
          const updatedUnitsList = existingUnits.map(u => {
            if (u.unitNo === unitNo) {
              const remainingQs = (u.questions || []).filter(q => q.id !== qId);
              const newTotalMarks = remainingQs.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
              const allMappedCLOs = [...new Set(remainingQs.flatMap(q => q.mappedCLOs || []))].sort();
              return {
                ...u,
                questions: remainingQs,
                totalMarks: newTotalMarks > 0 ? newTotalMarks : u.totalMarks,
                mappedCLOs: allMappedCLOs
              };
            }
            return u;
          });
          updatedUnitsData[categoryName] = updatedUnitsList;
        }

        return {
          ...c,
          obeQuestions: updatedQuestions,
          obeMarks: updatedMarks,
          unitsData: updatedUnitsData
        };
      }
      return c;
    }));
  };

  const handleSaveObeMark = (regNo: string, qId: string, value: number) => {
    if (!selectedCourse) return;
    
    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        const copyMarks = { ...(c.obe_marks || c.obeMarks || {}) };
        const matchedObeKey = Object.keys(copyMarks).find(k => areRegNosEqual(k, regNo)) || regNo;
        if (!copyMarks[matchedObeKey]) {
          copyMarks[matchedObeKey] = {};
        }
        copyMarks[matchedObeKey] = {
          ...copyMarks[matchedObeKey],
          [qId]: value
        };

        // Also keep student marks (standard & aggregate) in sync for direct Excel entry
        const question = (c.obeQuestions || []).find(q => q.id === qId);
        let updatedStudents = c.students;
        if (question) {
          const { categoryName, unitNo } = question;
          updatedStudents = c.students.map(std => {
            if (areRegNosEqual(std.regNo, regNo)) {
              const nextMarks = { ...(std.student_marks || std.marks || {}) };
              const qKey = `q-${categoryName}-${unitNo}-${qId}`;
              nextMarks[qKey] = value;

              // Recompute aggregated unit total
              const existingUnits = c.unitsData[categoryName] || [];
              const unit = existingUnits.find(u => u.unitNo === unitNo);
              if (unit && unit.questions && unit.questions.length > 0) {
                const uTotal = unit.questions.reduce((sum, q) => {
                  const k = `q-${categoryName}-${unitNo}-${q.id}`;
                  const score = q.id === qId ? value : (nextMarks[k] ?? 0);
                  return sum + score;
                }, 0);
                nextMarks[`${categoryName}-${unitNo}`] = uTotal;
              }
              return { ...std, marks: nextMarks, student_marks: nextMarks };
            }
            return std;
          });
        }

        return {
          ...c,
          obeMarks: copyMarks,
          obe_marks: copyMarks,
          students: updatedStudents
        };
      }
      return c;
    }));
  };

  const handleSaveQuestionMark = (regNo: string, categoryName: string, unitNo: number, qId: string, value: number) => {
    if (!selectedCourse) return;
    
    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        const updatedStudents = c.students.map(std => {
          if (areRegNosEqual(std.regNo, regNo)) {
            const nextMarks = { ...(std.student_marks || std.marks || {}) };
            const qKey = `q-${categoryName}-${unitNo}-${qId}`;
            nextMarks[qKey] = value;
            
            // Recompute aggregated unit total
            const existingUnits = c.unitsData[categoryName] || [];
            const unit = existingUnits.find(u => u.unitNo === unitNo);
            if (unit && unit.questions && unit.questions.length > 0) {
              const uTotal = unit.questions.reduce((sum, q) => {
                const k = `q-${categoryName}-${unitNo}-${q.id}`;
                const score = q.id === qId ? value : (nextMarks[k] ?? 0);
                return sum + score;
              }, 0);
              nextMarks[`${categoryName}-${unitNo}`] = uTotal;
            }

            return {
              ...std,
              marks: nextMarks,
              student_marks: nextMarks
            };
          }
          return std;
        });

        // Also keep obeMarks in perfect sync so backend always gets question-wise marks inside obeMarks
        const copyMarks = { ...(c.obe_marks || c.obeMarks || {}) };
        const matchedObeKey = Object.keys(copyMarks).find(k => areRegNosEqual(k, regNo)) || regNo;
        if (!copyMarks[matchedObeKey]) {
          copyMarks[matchedObeKey] = {};
        }
        copyMarks[matchedObeKey] = {
          ...copyMarks[matchedObeKey],
          [qId]: value
        };

        return {
          ...c,
          students: updatedStudents,
          obeMarks: copyMarks,
          obe_marks: copyMarks
        };
      }
      return c;
    }));
  };

  const handleSaveUnitDirectMark = (regNo: string, categoryName: string, unitNo: number, value: number) => {
    if (!selectedCourse) return;
    
    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        const updatedStudents = c.students.map(std => {
          if (areRegNosEqual(std.regNo, regNo)) {
            const nextMarks = { ...(std.student_marks || std.marks || {}) };
            nextMarks[`${categoryName}-${unitNo}`] = value;
            return {
              ...std,
              marks: nextMarks,
              student_marks: nextMarks
            };
          }
          return std;
        });
        return {
          ...c,
          students: updatedStudents
        };
      }
      return c;
    }));
  };

  // Course management action callbacks
  const handleAddNewCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addCourseCode || !addCourseTitle) return;

    const deptObj = obeData?.departments?.find(d => d.id === addDeptId);
    const deptName = deptObj ? deptObj.name : addDeptId;

    const programObj = obeData?.programs?.find(p => p.id === addProgramId);

    const rawCourse: InstructorCourse = {
      id: `course-${Date.now()}`,
      code: addCourseCode.toUpperCase().trim(),
      title: addCourseTitle.trim(),
      courseType: addCourseType,
      departmentId: addDeptId,
      departmentName: deptName,
      programId: addProgramId,
      programName: programObj ? programObj.name : undefined,
      creditHours: addCreditHours,
      categories: JSON.parse(JSON.stringify(INITIAL_CATEGORIES)),
      unitsData: JSON.parse(JSON.stringify(INITIAL_UNITS_DATA)),
      students: [],
    };

    const newCourse = normalizeCourse(rawCourse);

    setCourses(prev => [...prev, newCourse]);
    setActiveCourseId(newCourse.id);
    setIsAddingCourse(false);
    setAddCourseCode('');
    setAddCourseTitle('');
    setActiveTab('weightage');
  };

  const handleOpenEditCourse = (course: InstructorCourse) => {
    setEditCourseCode(course.code);
    setEditCourseTitle(course.title);
    setEditDeptId(course.departmentId);
    setEditProgramId(course.programId || '');
    setEditCreditHours(course.creditHours);
    setEditCourseType(course.courseType || 'Theory');
    setIsEditingCourse(true);
  };

  const handleUpdateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCourseCode || !editCourseTitle) return;

    const deptObj = obeData?.departments?.find(d => d.id === editDeptId);
    const deptName = deptObj ? deptObj.name : editDeptId;

    const programObj = obeData?.programs?.find(p => p.id === editProgramId);

    setCourses(prev => prev.map(c => {
      if (c.id === activeCourseId) {
        const rawCourse: InstructorCourse = {
          ...c,
          code: editCourseCode.toUpperCase().trim(),
          title: editCourseTitle.trim(),
          departmentId: editDeptId,
          departmentName: deptName,
          programId: editProgramId,
          programName: programObj ? programObj.name : undefined,
          creditHours: editCreditHours,
          courseType: editCourseType,
        };
        return normalizeCourse(rawCourse);
      }
      return c;
    }));

    setIsEditingCourse(false);
    setSuccessMsg('Course specification updated successfully!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleDeleteCourse = (courseId: string) => {
    setCourseToDeleteId(courseId);
  };

  const confirmDeleteCourse = () => {
    if (!courseToDeleteId) return;
    const remaining = courses.filter(c => c.id !== courseToDeleteId);
    setCourses(remaining);
    if (activeCourseId === courseToDeleteId) {
      setActiveCourseId(remaining[0]?.id || '');
    }
    setCourseToDeleteId(null);
    setSuccessMsg('Course specification deleted successfully!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Weightage updates
  const handleUpdateCategorySingle = () => {
    const valPct = parseFloat(editWeightPercent) || 0;
    const valUnits = parseInt(editWeightUnits, 10) || 0;

    setTempCategories(prev => {
      const copy = [...prev];
      if (copy[selectedWeightIndex]) {
        copy[selectedWeightIndex] = {
          ...copy[selectedWeightIndex],
          percentage: valPct,
          units: valUnits
        };
      }
      return copy;
    });
  };

  const handleSaveAllWeightage = () => {
    if (!selectedCourse) return;
    if (currentTotalWeight > 100) {
      setSaveStatus('error-over');
      showNotification("Please set the total weightage to 100%");
      return;
    }
    if (currentTotalWeight < 100) {
      setSaveStatus('error-under');
      showNotification("Please set the total weightage to 100%");
      return;
    }

    setSaveStatus('success');

    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        // Build updated unitsData to make sure any changed units counts are matched nicely
        const updatedUnitsData = { ...c.unitsData };
        tempCategories.forEach(cat => {
          const currentList = updatedUnitsData[cat.name] || [];
          updatedUnitsData[cat.name] = redistributeCategoryUnits(cat.units, currentList);
        });

        return {
          ...c,
          categories: tempCategories,
          unitsData: updatedUnitsData
        };
      }
      return c;
    }));

    setSuccessMsg('Weightage configuration updated successfully!');
    setTimeout(() => {
      setSuccessMsg('');
      setSaveStatus('idle');
    }, 2000);
  };

  const handleResetWeightage = () => {
    if (selectedCourse) {
      setTempCategories(JSON.parse(JSON.stringify(selectedCourse.categories)));
    }
  };

  // Inline dynamic OBE sub-question handlers for single-assessment Excel spreadsheet sheets
  const handleAddInlineQuestion = (
    categoryName: string,
    unitNo: number,
    questionName: string,
    marks: number,
    mappedCLOs: string[]
  ) => {
    if (!selectedCourse) return;
    console.log('[DEBUG handleAddInlineQuestion] Entering with args:', {
      categoryName,
      unitNo,
      questionName,
      marks,
      mappedCLOs,
      selectedCourseId: selectedCourse.id,
      selectedCourseCode: selectedCourse.code
    });
    setCourses(prev =>
      prev.map(c => {
        if (c.id === selectedCourse.id) {
          const updatedUnitsData = { ...c.unitsData };
          const existingUnits = updatedUnitsData[categoryName] || [];
          
          let unitItem = existingUnits.find(u => u.unitNo === unitNo);
          if (!unitItem) {
            unitItem = {
              unitNo: unitNo,
              passing: Math.ceil(marks * 0.5),
              totalMarks: marks,
              weightage: 100 / (c.categories.find(cat => cat.name === categoryName)?.units || 1),
              mappedCLOs: mappedCLOs,
              questions: []
            };
          }

          const currentQuestions = unitItem.questions || [];
          const nextNo = currentQuestions.length + 1;
          const isPresentation = categoryName.toLowerCase().includes('presentation');
          let qName = questionName.trim();
          if (!qName) {
            qName = isPresentation ? `Module ${nextNo}` : `Question ${nextNo}`;
          } else if (isPresentation && (qName.toLowerCase().startsWith('question') || qName.toLowerCase().startsWith('q'))) {
            const match = qName.match(/\d+$/);
            const numStr = match ? match[0] : '';
            qName = numStr ? `Module ${numStr}` : 'Module';
          }
          const newQ: UnitQuestion = {
            id: Date.now().toString() + '_' + nextNo,
            name: qName,
            maxMarks: marks,
            mappedCLOs: [...mappedCLOs]
          };

          const newQuestionsList = [...currentQuestions, newQ];
          const newTotalMarks = newQuestionsList.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
          const allMappedCLOs = [...new Set(newQuestionsList.flatMap(q => q.mappedCLOs || []))].sort();

          const updatedUnitItem: UnitItem = {
            ...unitItem,
            questions: newQuestionsList,
            totalMarks: newTotalMarks,
            mappedCLOs: allMappedCLOs
          };

          const updatedUnitsList = existingUnits.map(u => u.unitNo === unitNo ? updatedUnitItem : u);
          if (!existingUnits.some(u => u.unitNo === unitNo)) {
            updatedUnitsList.push(updatedUnitItem);
          }

          // Sync with top-level obeQuestions
          const otherObeQuestions = (c.obeQuestions || []).filter(
            q => !(q.categoryName === categoryName && q.unitNo === unitNo)
          );
          const syncObeQs = newQuestionsList.map(q => ({
            id: q.id,
            categoryName: categoryName,
            unitNo: unitNo,
            questionName: q.name,
            maxMarks: q.maxMarks,
            mappedCLOs: q.mappedCLOs
          }));
          const updatedObeQuestions = [...otherObeQuestions, ...syncObeQs];

          return {
            ...c,
            unitsData: {
              ...c.unitsData,
              [categoryName]: updatedUnitsList
            },
            obeQuestions: updatedObeQuestions
          };
        }
        return c;
      })
    );
  };

  const handleClearInlineQuestions = (categoryName: string, unitNo: number) => {
    if (!selectedCourse) return;
    console.log('[DEBUG handleClearInlineQuestions] Entering with args:', {
      categoryName,
      unitNo,
      selectedCourseId: selectedCourse.id
    });
    setCourses(prev =>
      prev.map(c => {
        if (c.id === selectedCourse.id) {
          const updatedUnitsData = { ...c.unitsData };
          const existingUnits = updatedUnitsData[categoryName] || [];
          const updatedUnitsList = existingUnits.map(u => {
            if (u.unitNo === unitNo) {
              return {
                ...u,
                questions: [],
                mappedCLOs: []
              };
            }
            return u;
          });

          // Sync with top-level obeQuestions
          const updatedObeQuestions = (c.obeQuestions || []).filter(
            q => !(q.categoryName === categoryName && q.unitNo === unitNo)
          );

          return {
            ...c,
            unitsData: {
              ...c.unitsData,
              [categoryName]: updatedUnitsList
            },
            obeQuestions: updatedObeQuestions
          };
        }
        return c;
      })
    );
  };

  const handleWizardPartition = (categoryName: string, unitNo: number, numQuestions: number) => {
    if (!selectedCourse || numQuestions <= 0) return;
    console.log('[DEBUG handleWizardPartition] Entering with args:', {
      categoryName,
      unitNo,
      numQuestions,
      selectedCourseId: selectedCourse.id
    });
    setCourses(prev =>
      prev.map(c => {
        if (c.id === selectedCourse.id) {
          const updatedUnitsData = { ...c.unitsData };
          const existingUnits = updatedUnitsData[categoryName] || [];
          let unitItem = existingUnits.find(u => u.unitNo === unitNo);
          
          const maxUnitValue = unitItem ? unitItem.totalMarks : 10;
          const share = parseFloat((maxUnitValue / numQuestions).toFixed(1));
          
          const newQuestionsList: UnitQuestion[] = [];
          const isPresentation = categoryName.toLowerCase().includes('presentation');
          const labelPrefix = isPresentation ? 'Module ' : 'Q';
          for (let i = 1; i <= numQuestions; i++) {
            let qMarks = share;
            if (i === numQuestions) {
              const currentSum = parseFloat((share * (numQuestions - 1)).toFixed(1));
              qMarks = parseFloat((maxUnitValue - currentSum).toFixed(1));
            }

            newQuestionsList.push({
              id: `${Date.now().toString()}_w_${i}`,
              name: `${labelPrefix}${i}`,
              maxMarks: qMarks,
              mappedCLOs: ['CLO-1']
            });
          }

          const allMappedCLOs = [...new Set(newQuestionsList.flatMap(q => q.mappedCLOs || []))].sort();
          const updatedUnitItem: UnitItem = {
            ...(unitItem || {
              unitNo: unitNo,
              passing: Math.ceil(maxUnitValue * 0.5),
              weightage: 100 / (c.categories.find(cat => cat.name === categoryName)?.units || 1),
            }),
            questions: newQuestionsList,
            totalMarks: maxUnitValue,
            mappedCLOs: allMappedCLOs
          };

          const updatedUnitsList = existingUnits.map(u => u.unitNo === unitNo ? updatedUnitItem : u);
          if (!existingUnits.some(u => u.unitNo === unitNo)) {
            updatedUnitsList.push(updatedUnitItem);
          }

          // Sync with top-level obeQuestions
          const otherObeQuestions = (c.obeQuestions || []).filter(
            q => !(q.categoryName === categoryName && q.unitNo === unitNo)
          );
          const syncObeQs = newQuestionsList.map(q => ({
            id: q.id,
            categoryName: categoryName,
            unitNo: unitNo,
            questionName: q.name,
            maxMarks: q.maxMarks,
            mappedCLOs: q.mappedCLOs
          }));
          const updatedObeQuestions = [...otherObeQuestions, ...syncObeQs];

          return {
            ...c,
            unitsData: {
              ...c.unitsData,
              [categoryName]: updatedUnitsList
            },
            obeQuestions: updatedObeQuestions
          };
        }
        return c;
      })
    );
  };

  // Sub-question management for Units
  const handleAddSubQuestion = () => {
    const isPresentation = unitEditingCategory?.toLowerCase().includes('presentation');
    const labelPrefix = isPresentation ? 'Module' : 'Question';
    
    setTempUnits(prev => {
      const copy = [...prev];
      const unit = copy[selectedUnitIndex];
      if (unit) {
        const qList = unit.questions || [];
        const nextNo = qList.length + 1;
        const newQuestion: UnitQuestion = {
          id: Date.now().toString() + '_' + nextNo,
          name: `${labelPrefix} ${nextNo}`,
          maxMarks: 5,
          mappedCLOs: []
        };
        
        const newQuestionList = [...qList, newQuestion];
        const newTotal = newQuestionList.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
        const newCLOs = [...new Set(newQuestionList.flatMap(q => q.mappedCLOs || []))].sort();

        copy[selectedUnitIndex] = {
          ...unit,
          questions: newQuestionList,
          totalMarks: newTotal,
          mappedCLOs: newCLOs
        };
        
        setUnitTotalMarks(newTotal.toString());
      }
      return copy;
    });
  };

  const handleUpdateSubQuestion = (qId: string, updatedFields: Partial<UnitQuestion>) => {
    setTempUnits(prev => {
      const copy = [...prev];
      const unit = copy[selectedUnitIndex];
      if (unit) {
        const qList = unit.questions || [];
        const newQuestionList = qList.map(q => {
          if (q.id === qId) {
            return { ...q, ...updatedFields };
          }
          return q;
        });

        const newTotal = newQuestionList.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
        const newCLOs = [...new Set(newQuestionList.flatMap(q => q.mappedCLOs || []))].sort();

        copy[selectedUnitIndex] = {
          ...unit,
          questions: newQuestionList,
          totalMarks: newTotal,
          mappedCLOs: newCLOs
        };

        setUnitTotalMarks(newTotal.toString());
      }
      return copy;
    });
  };

  const handleRemoveSubQuestion = (qId: string) => {
    setTempUnits(prev => {
      const copy = [...prev];
      const unit = copy[selectedUnitIndex];
      if (unit) {
        const qList = unit.questions || [];
        if (qList.length <= 1) {
          showNotification("At least 1 question/module is required for the assessment.");
          return prev;
        }
        const newQuestionList = qList.filter(q => q.id !== qId);

        const newTotal = newQuestionList.reduce((sum, q) => sum + (q.maxMarks || 0), 0);
        const newCLOs = [...new Set(newQuestionList.flatMap(q => q.mappedCLOs || []))].sort();

        copy[selectedUnitIndex] = {
          ...unit,
          questions: newQuestionList,
          totalMarks: newTotal,
          mappedCLOs: newCLOs
        };

        setUnitTotalMarks(newTotal.toString());
      }
      return copy;
    });
  };

  // Unit category save/updates
  const handleUpdateUnitSingle = () => {
    const tot = parseFloat(unitTotalMarks) || 10;
    const pass = parseFloat(unitPassMarks) || 5;
    const weight = parseFloat(unitWeightage) || 0;

    setTempUnits(prev => {
      const copy = [...prev];
      if (copy[selectedUnitIndex]) {
        copy[selectedUnitIndex] = {
          ...copy[selectedUnitIndex],
          totalMarks: tot,
          passing: pass,
          weightage: weight
        };
      }
      return copy;
    });
  };

  const handleAddUnitRow = () => {
    const nextNo = tempUnits.length + 1;
    const isPresentation = unitEditingCategory?.toLowerCase().includes('presentation');
    const labelPrefix = isPresentation ? 'Module' : 'Question';
    setTempUnits(prev => [
      ...prev,
      {
        unitNo: nextNo,
        passing: 5,
        totalMarks: 10,
        weightage: 10,
        mappedCLOs: ['CLO-1'],
        questions: [
          {
            id: `q-default-${nextNo}-${Date.now()}`,
            name: `${labelPrefix} 1`,
            maxMarks: 10,
            mappedCLOs: ['CLO-1']
          }
        ]
      }
    ]);
    setSelectedUnitIndex(tempUnits.length);
  };

  const handleRemoveUnitRow = () => {
    if (tempUnits.length <= 1) {
      showNotification("At least 1 unit is required.");
      return;
    }
    setTempUnits(prev => prev.slice(0, prev.length - 1));
    setSelectedUnitIndex(Math.max(0, tempUnits.length - 2));
  };

  const handleSaveUnitSettings = () => {
    if (!selectedCourse || !unitEditingCategory) return;

    // Validate that every sub-question in all units has a CLO selected
    let invalidUnitIdx = -1;
    for (let i = 0; i < tempUnits.length; i++) {
      const unit = tempUnits[i];
      if (unit.questions && unit.questions.length > 0) {
        const hasUnmapped = unit.questions.some(q => !q.mappedCLOs || q.mappedCLOs.length === 0 || !q.mappedCLOs[0]);
        if (hasUnmapped) {
          invalidUnitIdx = i;
          break;
        }
      }
    }

    if (invalidUnitIdx !== -1) {
      setSelectedUnitIndex(invalidUnitIdx);
      setUnitCloValidationError(true);
      return;
    }

    // Validate that the total weightage of units is exactly 100%
    const weightSum = tempUnits.reduce((sum, u) => sum + u.weightage, 0);
    // Allow a tiny floating-point margin of 0.05% for rounding combinations like 33.3% + 33.3% + 33.4%
    const isSumValid = Math.abs(weightSum - 100) <= 0.05;

    if (!isSumValid) {
      showNotification(`Validation Error: Total weightage sum must be exactly 100% to save! Your current weightage sum is ${weightSum.toFixed(1)}%. Please adjust unit weightages to sum up to exactly 100% before saving.`);
      return;
    }

    // Dynamically update tempCategories too, so the change appears instantly in the set weightage section
    setTempCategories(prev => prev.map(cat => {
      if (cat.name === unitEditingCategory) {
        return {
          ...cat,
          units: tempUnits.length
        };
      }
      return cat;
    }));

    // Update both the specific category count and the unit objects
    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        const copyCats = c.categories.map(cat => {
          if (cat.name === unitEditingCategory) {
            return {
              ...cat,
              units: tempUnits.length
            };
          }
          return cat;
        });

        const copyUnitsData = {
          ...c.unitsData,
          [unitEditingCategory]: tempUnits
        };

        // Sync with top-level obeQuestions
        const otherObeQuestions = (c.obeQuestions || []).filter(
          q => q.categoryName !== unitEditingCategory
        );

        const newObeQuestions: any[] = [];
        tempUnits.forEach(u => {
          if (u.questions && u.questions.length > 0) {
            u.questions.forEach(q => {
              newObeQuestions.push({
                id: q.id,
                categoryName: unitEditingCategory,
                unitNo: u.unitNo,
                questionName: q.name,
                maxMarks: q.maxMarks,
                mappedCLOs: q.mappedCLOs || []
              });
            });
          }
        });

        const updatedObeQuestions = [...otherObeQuestions, ...newObeQuestions];

        console.log('[DEBUG handleSaveUnitSettings] Syncing obeQuestions:', {
          category: unitEditingCategory,
          newQuestionsCount: newObeQuestions.length,
          totalQuestionsCount: updatedObeQuestions.length
        });

        return {
          ...c,
          categories: copyCats,
          unitsData: copyUnitsData,
          obeQuestions: updatedObeQuestions
        };
      }
      return c;
    }));

    setUnitSaveSuccessMsg(`Marks and Weightages for ${unitEditingCategory} saved successfully!`);
    
    setTimeout(() => {
      setUnitSaveSuccessMsg(null);
      setUnitEditingCategory(null);
      setSuccessMsg(`Units configuration defined for ${unitEditingCategory}`);
      setTimeout(() => setSuccessMsg(''), 3000);
    }, 1800);
  };

  // Students administration
  const handleAddNewStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !newStudentReg) return;

    const stdName = newStudentName.trim() || `Student ${selectedCourse.students.length + 1}`;
    const cleanReg = newStudentReg.trim();

    // Check duplicate
    if (selectedCourse.students.some(s => areRegNosEqual(s.regNo, cleanReg))) {
      showNotification(`Student with registration number "${cleanReg}" already enrolled!`);
      return;
    }

    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        return {
          ...c,
          students: [...c.students, { regNo: cleanReg, name: stdName }]
        };
      }
      return c;
    }));

    setNewStudentReg('');
    setNewStudentName('');
  };

  // Clear students
  const handleUnenrollStudent = (reg: string) => {
    if (!selectedCourse) return;
    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        return {
          ...c,
          students: c.students.filter(s => !areRegNosEqual(s.regNo, reg))
        };
      }
      return c;
    }));
  };

  const handleSyncAllStudents = async () => {
    if (!selectedCourse) return;
    try {
      let allDirectoryStudents: { regNo: string; name: string }[] = [];
      try {
        const fetched = await apiService.getStudents();
        if (Array.isArray(fetched) && fetched.length > 0) {
          allDirectoryStudents = fetched.map(s => ({ regNo: s.regNo, name: s.name }));
        }
      } catch (e) {
        console.warn("Failed to fetch directory students, using default pool", e);
      }

      const defaultPool = [
        { regNo: "052-FA23-20001", name: "ZEESHAN ALI" },
        { regNo: "052-FA23-20002", name: "SYED SAMI" },
        { regNo: "052-FA23-20003", name: "WAJAHAT SAIF" },
        { regNo: "052-FA23-20004", name: "SYED AKBAR" },
        { regNo: "052-FA23-20005", name: "KALEEM ULLAH" },
        { regNo: "012-FA22-22012", name: "ABDUR REHMAN KHALID" },
        { regNo: "045-FA22-22045", name: "WAJAHAT BINE SAIF" },
        { regNo: "089-FA22-22089", name: "ZAYAN AHMED KHAN" },
        { regNo: "104-FA22-22104", name: "MISHA FAROOQ" }
      ];

      const mergedPool = [...allDirectoryStudents];
      defaultPool.forEach(dp => {
        if (!mergedPool.some(mp => areRegNosEqual(mp.regNo, dp.regNo))) {
          mergedPool.push(dp);
        }
      });

      let addedCount = 0;
      setCourses(prev => prev.map(c => {
        if (c.id === selectedCourse.id) {
          const existingSet = new Set(c.students.map(s => String(s.regNo).toLowerCase().trim()));
          const newStudents = [...c.students];
          mergedPool.forEach(sp => {
            const key = String(sp.regNo).toLowerCase().trim();
            if (key && !existingSet.has(key)) {
              newStudents.push({ regNo: sp.regNo, name: sp.name, marks: {} });
              existingSet.add(key);
              addedCount++;
            }
          });
          return {
            ...c,
            students: newStudents
          };
        }
        return c;
      }));

      if (addedCount > 0) {
        showNotification(`Successfully synced and enrolled ${addedCount} department student(s) into ${selectedCourse.code}!`);
      } else {
        showNotification(`All department students are already enrolled in ${selectedCourse.code}.`);
      }
    } catch (err) {
      showNotification("Failed to sync students from department database.");
    }
  };

  const handleStartEditStudent = (student: CourseStudent) => {
    setEditingStudentReg(student.regNo);
    setEditStudentRegVal(student.regNo);
    setEditStudentNameVal(student.name);
  };

  const handleCancelEditStudent = () => {
    setEditingStudentReg(null);
    setEditStudentRegVal('');
    setEditStudentNameVal('');
  };

  const handleUpdateStudentDetail = (oldRegNo: string) => {
    if (!selectedCourse) return;

    const cleanNewRegNo = editStudentRegVal.trim();
    const cleanNewName = editStudentNameVal.trim();

    if (!cleanNewRegNo) {
      showNotification("Registration number cannot be empty!");
      return;
    }
    if (!cleanNewName) {
      showNotification("Student name cannot be empty!");
      return;
    }

    // Check duplication if they changed registration number
    if (!areRegNosEqual(cleanNewRegNo, oldRegNo)) {
      const exists = selectedCourse.students.some(s => areRegNosEqual(s.regNo, cleanNewRegNo));
      if (exists) {
        showNotification(`Student with registration number "${cleanNewRegNo}" already exists!`);
        return;
      }
    }

    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        return {
          ...c,
          students: c.students.map(s => {
            if (areRegNosEqual(s.regNo, oldRegNo)) {
              return {
                ...s,
                regNo: cleanNewRegNo,
                name: cleanNewName
              };
            }
            return s;
          })
        };
      }
      return c;
    }));

    setEditingStudentReg(null);
    setEditStudentRegVal('');
    setEditStudentNameVal('');
  };

  // Excel / CSV File Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseExcelFile(file);
    }
  };

  const parseExcelFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return;

        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to array of arrays representing rows
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        
        const list: CourseStudent[] = [];
        
        rows.forEach((row) => {
          if (!row || row.length < 1) return;
          
          let regRaw = row[0];
          let nameRaw = row[1];
          
          if (regRaw === undefined || regRaw === null) return;
          
          const r = String(regRaw).trim().toUpperCase();
          const n = nameRaw !== undefined && nameRaw !== null ? String(nameRaw).trim() : '';

          // Skip empty or header rows
          if (!r) return;
          const lowerR = r.toLowerCase();
          if (
            lowerR.includes("reg no") || 
            lowerR.includes("reg. no") || 
            lowerR.includes("roll no") || 
            lowerR.includes("roll_no") || 
            lowerR.includes("registration") ||
            lowerR.includes("reg_no") ||
            lowerR.includes("regid") ||
            lowerR.includes("id")
          ) {
            return;
          }

          list.push({
            regNo: r,
            name: n || `Enrolled Student ${r.split('-').pop() || ''}`
          });
        });

        if (list.length === 0) {
          showNotification("No valid student records could be parsed. Ensure Column 1 has the Registration Number and Column 2 has the Student Name.");
          setParsedStudents([]);
        } else {
          setParsedStudents(list);
        }
      } catch (err) {
        console.error(err);
        showNotification("Failed to parse sheet. Please ensure it is a valid Excel (.xlsx, .xls) or CSV template file.");
        setParsedStudents([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        parseExcelFile(file);
      } else {
        showNotification("Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.");
      }
    }
  };

  const handleExcelImportExecute = () => {
    if (!selectedCourse || parsedStudents.length === 0) return;

    const addedList: CourseStudent[] = [];
    parsedStudents.forEach(item => {
      // Avoid duplicate enrollment within the course
      if (!selectedCourse.students.some(s => areRegNosEqual(s.regNo, item.regNo)) && !addedList.some(s => areRegNosEqual(s.regNo, item.regNo))) {
        addedList.push(item);
      }
    });

    if (addedList.length === 0) {
      showNotification("All parsed student registration numbers from the Excel sheet are already enrolled in this course.");
      return;
    }

    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        return {
          ...c,
          students: [...c.students, ...addedList]
        };
      }
      return c;
    }));

    const count = addedList.length;
    setParsedStudents([]);
    setFileName('');
    setSuccessMsg(`Successfully imported ${count} students from sheet.`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleUpdateStudentMark = (studentRegNo: string, categoryName: string, unitNo: number, score: number) => {
    if (!selectedCourse) return;
    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        return {
          ...c,
          students: c.students.map(s => {
            if (areRegNosEqual(s.regNo, studentRegNo)) {
              return {
                ...s,
                marks: {
                  ...(s.marks || {}),
                  [`${categoryName}-${unitNo}`]: score
                }
              };
            }
            return s;
          })
        };
      }
      return c;
    }));
  };

  const tableColumns = useMemo(() => {
    if (!selectedCourse) return [];
    const cols: { categoryName: string; unitNo: number; totalMarks: number; passing: number; label: string }[] = [];
    
    selectedCourse.categories.forEach(cat => {
      if (cat.percentage > 0 && cat.units > 0) {
        const existingUnits = selectedCourse.unitsData[cat.name] || [];
        const prefix = getCategoryPrefix(cat.name);
        
        for (let u = 1; u <= cat.units; u++) {
          const matchingUnit = existingUnits.find(unit => unit.unitNo === u);
          const totalMarks = matchingUnit ? matchingUnit.totalMarks : 10;
          const passing = matchingUnit ? matchingUnit.passing : 5;
          
          cols.push({
            categoryName: cat.name,
            unitNo: u,
            totalMarks,
            passing,
            label: `${prefix}${u}`
          });
        }
      }
    });
    
    return cols;
  }, [selectedCourse]);

  const calculateStudentCourseTotal = (student: CourseStudent) => {
    if (!selectedCourse) return 0;
    let aggregate = 0;
    
    selectedCourse.categories.forEach(cat => {
      if (cat.percentage > 0) {
        let totalMaxMarks = 0;
        let studentObtainedSum = 0;
        const existingUnits = selectedCourse.unitsData[cat.name] || [];

        if (cat.units > 0) {
          for (let u = 1; u <= cat.units; u++) {
            const matchingUnit = existingUnits.find(unit => unit.unitNo === u);
            const questions = matchingUnit?.questions || [];

            if (questions.length > 0) {
              questions.forEach(q => {
                totalMaxMarks += q.maxMarks || 0;
                const qKey = `q-${cat.name}-${u}-${q.id}`;
                studentObtainedSum += student.marks?.[qKey] ?? 0;
              });
            } else {
              const maxMarks = matchingUnit ? matchingUnit.totalMarks : 10;
              totalMaxMarks += maxMarks;
              const dKey = `${cat.name}-${u}`;
              studentObtainedSum += student.marks?.[dKey] ?? 0;
            }
          }
        }

        const catContribution = totalMaxMarks > 0
          ? (studentObtainedSum / totalMaxMarks) * cat.percentage
          : 0;

        aggregate += catContribution;
      }
    });
    
    return parseFloat(aggregate.toFixed(1));
  };

  const handleExportCourseSheet = () => {
    if (!selectedCourse) return;

    const csvRows: string[][] = [];

    // Header info matching core course details
    csvRows.push([`Course Title:`, selectedCourse.title]);
    csvRows.push([`Course Code:`, selectedCourse.code]);
    csvRows.push([`Instructor:`, instructorName]);
    csvRows.push([`Credit Hours:`, `${selectedCourse.creditHours}-0-${selectedCourse.creditHours}`]);
    csvRows.push([`Semester:`, `Sp-2026`]);
    csvRows.push([`Section:`, `All`]);
    csvRows.push([]); // spacer line

    // Table Header
    const headers = ['S.#', 'Registration No.', 'Student Name'];
    tableColumns.forEach(col => {
      headers.push(`${col.label} (Max ${col.totalMarks})`);
    });
    headers.push('TMarks', 'Grade');
    csvRows.push(headers);

    // Table Data row by row
    selectedCourse.students.forEach((std, idx) => {
      const row: string[] = [String(idx + 1), std.regNo, std.name];
      tableColumns.forEach(col => {
        const markVal = getStudentMark(std, col.categoryName, col.unitNo, col.totalMarks, selectedCourse.unitsData);
        row.push(String(markVal));
      });
      const tMarks = calculateStudentCourseTotal(std);
      const grade = getCourseLetterGrade(tMarks, selectedCourse);
      row.push(String(tMarks), grade);
      csvRows.push(row);
    });

    // Add Average Row if students exist
    if (selectedCourse.students.length > 0) {
      const stdCount = selectedCourse.students.length;
      const colAverages = tableColumns.map(col => {
        const sum = selectedCourse.students.reduce((acc, s) => {
          return acc + getStudentMark(s, col.categoryName, col.unitNo, col.totalMarks, selectedCourse.unitsData);
        }, 0);
        return (sum / stdCount).toFixed(2);
      });

      const tMarksAverage = (selectedCourse.students.reduce((acc, s) => {
        return acc + calculateStudentCourseTotal(s);
      }, 0) / stdCount).toFixed(2);

      const averageRow: string[] = ['F1', 'Average', 'Class Outcome Average'];
      colAverages.forEach(avg => {
        averageRow.push(avg);
      });
      averageRow.push(tMarksAverage, '-');
      csvRows.push(averageRow);
    }

    const csvContent = csvRows
      .map(row => row.map(val => {
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Create clean file name matching the name of the course
    const fileName = `${selectedCourse.code} - ${selectedCourse.title}.csv`.replace(/[/\\?%*:|"<>]+/g, '_');
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-sans frosted-bg text-slate-800">
        <div className="text-center space-y-4">
          <img 
            src="/iqralogo.png" 
            alt="Iqra University Logo" 
            className="mx-auto w-56 h-20 object-contain mb-2 animate-pulse bg-white p-2.5 rounded-2xl shadow-sm border border-slate-100"
            referrerPolicy="no-referrer"
          />
          <p className="text-sm font-sans font-semibold text-indigo-950 animate-pulse">Loading course data from backend API...</p>
        </div>
      </div>
    );
  }

  const getNavbarItemClass = (isActive: boolean) => {
    return `px-3.5 py-1.5 text-xs font-sans font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 border ${
      isActive 
        ? 'bg-indigo-600 text-white font-black shadow-sm border-indigo-600 hover:bg-indigo-700 hover:text-white' 
        : 'bg-slate-100/80 hover:bg-indigo-50 hover:text-indigo-900 hover:border-indigo-200/50 text-slate-700 border-slate-200/60'
    }`;
  };

  const showSidebar = activeTab !== 'clo' && activeTab !== 'grading-system' && activeTab !== 'students' && activeTab !== 'grade' && activeTab !== 'enter-marks';

  // Render ONLY the marksheet document if pure print mode is triggered
  if (isDirectPrinting && selectedCourse) {
    return (
      <div className="relative w-full min-h-screen bg-slate-100 text-black flex flex-col m-0 p-0 antialiased font-sans print:bg-white print:overflow-visible">
        {/* Floating Return Button - completely out of the way, print:hidden */}
        <button
          onClick={() => setIsDirectPrinting(false)}
          className="print:hidden fixed top-4 left-4 z-50 flex items-center justify-center p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-lg border border-slate-700/50 transition-all cursor-pointer group"
          title="Go Back to Dashboard"
        >
          <X className="w-5 h-5 transition-transform group-hover:scale-110" />
        </button>

        {/* The Actual Printable Marksheet Document Container */}
        <div className="flex-1 bg-slate-100 overflow-auto p-4 md:p-8 print:p-0 print:bg-white print:overflow-visible">
          <div className={`mx-auto bg-white shadow-xl rounded-xl border border-slate-200 p-8 print:p-0 print:shadow-none print:border-none print:max-w-none print:bg-white print:rounded-none ${
            isMarksheetLandscape(selectedCourse, reportType) ? 'max-w-fit min-w-[297mm] w-fit' : 'max-w-[210mm] w-full'
          }`}>
            <MarksheetDocument
              course={selectedCourse}
              campus={reportCampus}
              semester={reportSemester}
              section={reportSection}
              offeredIn={reportOfferedIn}
              session={reportSession}
              instructor={reportInstructor}
              dated={reportDated}
              printDate={reportPrintDate}
              isPrintView={true}
              reportType={reportType}
              courseCLOs={courseCLOs}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans frosted-bg text-slate-800">
      
      {/* Premium Corporate Top Header */}
      <header id="instructor-header" className="bg-[#1e1b4b] text-white border-b border-indigo-950 px-6 py-2.5 shrink-0 flex items-center justify-between shadow-sm select-none">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold font-display tracking-tight flex items-center gap-2">
            <span>Iqra University OBE</span>
            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-indigo-500/30">
              INSTRUCTOR CONTROL
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-logout"
            onClick={onLogout}
            className="px-3.5 py-1.5 bg-transparent hover:bg-white/10 text-white hover:text-white rounded-lg transition-all border border-white/20 hover:border-white/40 flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
            title="Sign out of Instructor Module"
          >
            <LogOut className="w-3.5 h-3.5 text-white/95" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* CLASSIC DESKTOP WINDOWS-STYLE MENU BAR HEADER */}
      <header 
        id="instructor-portal-header" 
        className="bg-[#f1f5f9] border-[#cbd5e1] border-b shrink-0 sticky top-0 z-40 select-none relative"
      >
        <div className="mx-auto flex flex-wrap items-center justify-between px-3 py-1.5 max-w-[1700px]">
          
          {/* Menu items list */}
          <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            
            {/* SET WEIGHTAGE DIRECT ITEM */}
            <div className="relative font-bold">
              <button
                onClick={() => { setActiveTab('weightage'); setOpenMenu(null); }}
                className={getNavbarItemClass(activeTab === 'weightage')}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Set Weightage</span>
              </button>
            </div>

            {/* CLO */}
            <div className="relative">
              <button
                onClick={() => { setActiveTab('clo'); setOpenMenu(null); }}
                className={getNavbarItemClass(activeTab === 'clo')}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>CLO</span>
              </button>
            </div>

            {/* EDIT ITEMS DROP DOWN */}
            <div className="relative font-bold">
              <button
                onClick={() => {
                  setOpenMenu(openMenu === 'edit-items' ? null : 'edit-items');
                }}
                onMouseEnter={() => {
                  if (openMenu) {
                    setOpenMenu('edit-items');
                  }
                }}
                className={getNavbarItemClass(openMenu === 'edit-items')}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Assessments</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
              {openMenu === 'edit-items' && selectedCourse && (
                <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg shadow-xl py-1 z-50 max-h-96 overflow-y-auto font-sans">
                  <div className="px-3.5 py-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider font-sans border-b border-slate-100 mb-1">
                    Assessment Components
                  </div>
                  {selectedCourse.categories
                    .filter(cat => cat.percentage > 0 && cat.units > 0)
                    .map(cat => (
                      <button
                        key={cat.name}
                        onClick={() => {
                          handleOpenUnitEditor(cat.name, 0);
                          setOpenMenu(null);
                        }}
                        className="w-full text-left px-3.5 py-1.5 text-xs text-slate-705 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded focus:outline-none font-medium cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>{cat.name}</span>
                      </button>
                    ))}
                  {selectedCourse.categories.filter(cat => cat.percentage > 0 && cat.units > 0).length === 0 && (
                    <div className="px-3.5 py-2 text-xs text-slate-400 italic">
                      No active items (set weightage & units first)
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* REGISTERED ROSTER */}
            <div className="relative">
              <button
                onClick={() => { setActiveTab('students'); setOpenMenu(null); }}
                className={getNavbarItemClass(activeTab === 'students')}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Student Roster</span>
              </button>
            </div>

            {/* GRADE */}
            <div className="relative">
              <button
                onClick={() => { setActiveTab('grading-system'); setOpenMenu(null); }}
                className={getNavbarItemClass(activeTab === 'grading-system')}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Grade</span>
              </button>
            </div>

            {/* ENTER MARKS BUTTON */}
            <div className="relative">
              <button
                onClick={() => {
                  setActiveTab('enter-marks');
                  setOpenMenu(openMenu === 'enter-marks' ? null : 'enter-marks');
                }}
                onMouseEnter={() => {
                  if (openMenu) {
                    setOpenMenu('enter-marks');
                    setActiveTab('enter-marks');
                  }
                }}
                className={getNavbarItemClass(openMenu === 'enter-marks' || activeTab === 'enter-marks')}
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-indigo-500" />
                <span className="font-bold">Enter Marks</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
              {openMenu === 'enter-marks' && selectedCourse && (
                <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg shadow-xl py-1 z-50 max-h-96 overflow-y-auto font-sans">
                  <div className="px-3.5 py-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider font-sans border-b border-slate-100 mb-1">
                    Assessment Components
                  </div>
                  {selectedCourse.categories.filter(cat => cat.percentage > 0 && cat.units > 0).map(cat => (
                    <button
                      key={cat.name}
                      onClick={() => {
                        setSelectedMarksCategoryName(cat.name);
                        setActiveTab('enter-marks');
                        setOpenMenu(null);
                      }}
                      className="w-full text-left px-3.5 py-1.5 text-xs text-slate-705 hover:bg-slate-100 hover:text-indigo-950 flex items-center gap-2 rounded focus:outline-none font-medium cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>{cat.name}</span>
                    </button>
                  ))}
                  {selectedCourse.categories.filter(cat => cat.percentage > 0 && cat.units > 0).length === 0 && (
                    <div className="px-3.5 py-2 text-xs text-slate-400 italic">
                      No active components configured
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* REPORTS MENU */}
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === 'reports' ? null : 'reports')}
                onMouseEnter={() => openMenu && setOpenMenu('reports')}
                className={getNavbarItemClass(openMenu === 'reports')}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Reports</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
              {openMenu === 'reports' && (
                <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg shadow-xl py-1 z-50">
                  <button
                    onClick={() => { 
                      setReportType('standard');
                      setActiveModal('marksheet-report');
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-900 hover:bg-slate-50 hover:text-black flex items-center gap-2 rounded font-bold"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    <span className="text-slate-900 font-bold">Standard Mark Sheet (PDF)</span>
                  </button>
                  <button
                    onClick={() => { 
                      setReportType('combined');
                      setActiveModal('marksheet-report');
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-900 hover:bg-slate-50 hover:text-black flex items-center gap-2 rounded font-bold"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    <span className="text-slate-900 font-bold">Combined Mark Sheet (PDF)</span>
                  </button>
                  <button
                    onClick={() => { 
                      setReportType('award');
                      setActiveModal('marksheet-report');
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-900 hover:bg-slate-50 hover:text-black flex items-center gap-2 rounded font-bold"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    <span className="text-slate-900 font-bold">Award List (PDF)</span>
                  </button>
                  <button
                    onClick={() => { 
                      setReportType('clo');
                      setActiveModal('marksheet-report');
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-900 hover:bg-slate-50 hover:text-black flex items-center gap-2 rounded font-bold"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    <span className="text-slate-900 font-bold">CLO Based Result (PDF)</span>
                  </button>
                  <button
                    onClick={() => { 
                      setReportType('ga');
                      setActiveModal('marksheet-report');
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-900 hover:bg-slate-50 hover:text-black flex items-center gap-2 rounded font-bold"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    <span className="text-slate-900 font-bold">GA Based Result (PDF)</span>
                  </button>

                </div>
              )}
            </div>

            {/* ABOUT */}
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === 'about' ? null : 'about')}
                onMouseEnter={() => openMenu && setOpenMenu('about')}
                className={getNavbarItemClass(openMenu === 'about')}
              >
                <Info className="w-3.5 h-3.5" />
                <span>About</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
              {openMenu === 'about' && (
                <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg shadow-xl py-1.5 z-50">
                  <button
                    onClick={() => { setActiveModal('about'); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded text-left font-medium"
                  >
                    <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>About ResultMate Instructor Area</span>
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Quick status display */}
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] text-slate-500 font-mono tracking-tight font-semibold hidden sm:inline">
              User: <strong className="text-indigo-950 font-extrabold">{instructorName} ({selectedCourse ? selectedCourse.departmentName : 'Department of Computing and Technology'} Instructor)</strong>
            </span>
          </div>

        </div>

        {/* Quick Toolbar (Desktop Icon Bar styled) */}
        <div 
          id="quick-toolbar-box"
          className="bg-[#f8fafc] border-t border-slate-200 px-6 py-2 flex flex-wrap items-center justify-between gap-4 select-none relative z-30"
        >
          
          <div className="flex flex-wrap items-center gap-4">
            
            {/* Quick Dept Selector */}
            <div className="flex items-center gap-2 bg-slate-100/70 border border-slate-200 px-3 py-1 rounded-lg animate-fade-in">
              <span className="text-[9px] text-indigo-950 font-bold tracking-wide uppercase">DEPARTMENT:</span>
              <span className="text-slate-800 text-xs font-bold font-sans">
                {selectedCourse ? selectedCourse.departmentName : 'Department of Computing and Technology'}
              </span>
            </div>

            {/* Quick Course Selector */}
            <div className="flex items-center gap-2 bg-white px-2.5 py-1 border border-slate-300 rounded-lg shadow-xs">
              <span className="text-[9px] text-indigo-950 font-bold tracking-wide uppercase">COURSE:</span>
              <select
                value={activeCourseId}
                onChange={(e) => {
                  setActiveCourseId(e.target.value);
                  setUnitEditingCategory(null);
                }}
                className="bg-transparent border-none text-slate-800 text-xs font-bold font-sans focus:outline-none cursor-pointer"
              >
                <option value="">-- Choose Course teaches --</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.code} — {c.title} {c.programId ? `(${c.programId.toUpperCase()})` : ''}{c.academicYear ? ` [${c.academicYear}]` : ''}</option>
                ))}
              </select>
            </div>

            {/* Educational Program details */}
            {selectedCourse && selectedCourse.programName && (
              <div className="flex items-center gap-2 bg-sky-50 border border-sky-250 px-3 py-1 rounded-lg animate-fade-in">
                <span className="text-[9px] text-sky-900 font-bold tracking-wide uppercase">PROGRAM:</span>
                <span className="text-slate-800 text-xs font-bold font-sans">
                  {selectedCourse.programName}
                </span>
              </div>
            )}

            {/* Academic Year badge */}
            {selectedCourse && selectedCourse.academicYear && (
              <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 px-3 py-1 rounded-lg animate-fade-in">
                <span className="text-[9px] text-purple-900 font-bold tracking-wide uppercase">TERM:</span>
                <span className="text-slate-800 text-xs font-bold font-sans font-mono text-[11px]">
                  {selectedCourse.academicYear}
                </span>
              </div>
            )}

            {/* Closed Course Badge */}
            {selectedCourse?.status === 'closed' && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-250 px-3 py-1 rounded-lg animate-fade-in text-rose-700 shadow-xs">
                <Lock className="w-3.5 h-3.5" />
                <span className="text-xs font-black uppercase tracking-wider">LOCKED / CLOSED</span>
              </div>
            )}





          </div>

          {/* Right side course lock / configurations */}
          <div className="flex items-center">
            
          </div>

        </div>
      </header>

      {/* MAIN LAYOUT CANVAS */}
      <main className="grow max-w-7xl w-full mx-auto p-3 sm:p-4 lg:p-5 flex flex-col gap-4">

        {errorMsg && (
          <div className="bg-amber-55 border border-amber-200 text-amber-850 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in duration-200 text-xs shadow-xs font-sans">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {selectedCourse?.status === 'closed' && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-rose-800 shadow-xs animate-fade-in font-sans">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <h3 className="font-bold text-sm text-rose-950">This Course is Finalized & Locked</h3>
              <p className="text-xs text-rose-700 mt-1">This course has been officially closed and finalized by the department administration. All grades, assessments, CLO mappings, and learning outcome attainments are now in a <strong>read-only snapshot state</strong> and cannot be mutated.</p>
            </div>
          </div>
        )}
        
        {successMsg && successMsg !== 'Weightage configuration updated successfully!' && (
          <div className="bg-blue-900/30 border border-blue-500/40 text-blue-300 px-4 py-3 rounded-lg flex items-center gap-3 animate-in fade-in duration-200 text-sm">
            <Check className="w-5 h-5 text-blue-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Empty State Banner */}
        {courses.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 p-12 rounded-3xl text-center max-w-md mx-auto my-12 shadow-sm font-sans">
            <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-800 mb-2">No Courses Assigned</h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              You are currently not assigned any courses. Please contact your Department Administration or QA focal person to assign courses to your profile.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start font-sans">
            
            {/* LEFT COLUMN: ACTIVE COURSE BOARD WITH DEPARTMENT GROUPING & SWITCHING & EASY EDIT/DELETE */}
            {showSidebar && (
              <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-5">
              <div>
                <h3 className="text-xs font-bold text-slate-900 tracking-wider uppercase flex items-center gap-2">
                  <Building className="w-4 h-4 text-indigo-600 shrink-0" />
                  Courses Teaches
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Click a module to switch active context. One instructor can teach across different departments seamlessly.
                </p>
              </div>

              {/* GROUPED DEPARTMENTS */}
              {(() => {
                const departmentsList = obeData?.departments && obeData.departments.length > 0
                  ? obeData.departments
                  : Array.from(new Set(courses.map(c => c.departmentId).filter(Boolean))).map((depId: string) => ({
                      id: depId,
                      name: `Department ${depId}`
                    }));

                return departmentsList.map((dept) => {
                  const deptCourses = courses.filter(c => c.departmentId === dept.id);
                  const dotColor = 'bg-indigo-600';
                  const borderBorder = 'border-slate-200';
                  const textHeaderColor = 'text-slate-800';
                  
                  return (
                    <div className="space-y-2" key={dept.id}>
                      <div className={`flex items-center gap-1.5 border-b ${borderBorder} pb-1`}>
                        <span className={`w-1.5 h-3 rounded ${dotColor} shrink-0`}></span>
                        <span className={`text-[9px] font-extrabold ${textHeaderColor} uppercase tracking-widest font-mono`}>
                          {dept.name}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {deptCourses.map(c => {
                          const isSelected = c.id === activeCourseId;
                          const selectedStyle = 'bg-indigo-50/50 border-indigo-600 text-slate-900 shadow-sm ring-1 ring-indigo-600 pl-3.5 border-l-4 border-l-indigo-600';
                          return (
                            <div
                              key={c.id}
                              onClick={() => {
                                setActiveCourseId(c.id);
                                setUnitEditingCategory(null);
                              }}
                              className={`group p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start justify-between gap-3 ${
                                isSelected
                                  ? selectedStyle
                                  : 'bg-slate-50/55 border-slate-200 text-slate-700 hover:bg-slate-100/60 hover:border-slate-300'
                              }`}
                            >
                              <div className="space-y-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md tracking-wider ${
                                    isSelected 
                                      ? 'bg-indigo-100 text-indigo-700' 
                                      : 'bg-slate-200 text-slate-650'
                                  }`}>
                                    {c.code}
                                  </span>
                                  {c.programId && (
                                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md tracking-wide ${
                                      isSelected
                                        ? 'bg-indigo-100/70 text-indigo-850' 
                                        : 'bg-slate-200/75 text-slate-605'
                                    }`}>
                                      {c.programId.toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-slate-900 font-extrabold' : 'text-slate-800'}`}>
                                  {c.title}
                                </h4>
                                <p className="text-[10px] text-slate-500 font-mono">
                                  {c.creditHours} Cr. Hr • {c.courseType || 'Theory'} • {c.students.length} Students{c.academicYear ? ` • ${c.academicYear}` : ''}
                                </p>
                              </div>
                              
                              {/* Action buttons */}
                              <div className="flex items-center gap-1 shrink-0 self-center">
                              </div>
                            </div>
                          );
                        })}
                        {deptCourses.length === 0 && (
                          <p className="text-[10px] text-slate-400 italic py-2 pl-1 select-none font-sans font-medium">No courses defined.</p>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}





            </div>
            )}

            {/* RIGHT COLUMN: MAIN OUTCOME ASSESSMENT INTERFACES */}
            <div className={`${showSidebar ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-6`}>
              
              {selectedCourse ? (
                <>
                  {/* INSTRUCTOR CONTENT HEADER */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-350 pb-3 gap-3">
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans flex items-center gap-2 flex-wrap">
                        <BookOpenCheck className="w-5 h-5 text-indigo-600" />
                        <span>{selectedCourse.code} — {selectedCourse.title}</span>
                        <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-full tracking-wider bg-indigo-105 text-indigo-800">
                          {selectedCourse.courseType || 'Theory'}
                        </span>
                      </h2>
                    </div>
                  </div>

                  {/* TAB PANES */}
                  <div className="bg-white/85 border border-slate-200/80 backdrop-blur-md rounded-2xl p-4 sm:p-6 shadow-md text-slate-800">
                    {/* TAB 1: SET WEIGHTAGE, TAB 2: EDIT ITEMS, TAB 3: REGISTER STUDENTS (MODULARIZED) */}
                    {selectedCourse && (activeTab === 'weightage' || activeTab === 'edit-items' || activeTab === 'students') && (
                      <WeightageAndStudents
                        activeTab={activeTab}
                        selectedCourse={selectedCourse}
                        tempCategories={tempCategories}
                        selectedWeightIndex={selectedWeightIndex}
                        setSelectedWeightIndex={setSelectedWeightIndex}
                        currentTotalWeight={currentTotalWeight}
                        editWeightPercent={editWeightPercent}
                        editWeightUnits={editWeightUnits}
                        handleWeightPercentChange={handleWeightPercentChange}
                        handleWeightUnitsChange={handleWeightUnitsChange}
                        handleUpdateCategorySingle={handleUpdateCategorySingle}
                        saveStatus={saveStatus}
                        handleResetWeightage={handleResetWeightage}
                        handleSaveAllWeightage={handleSaveAllWeightage}
                        handleOpenUnitEditor={handleOpenUnitEditor}
                        onSyncAllStudents={handleSyncAllStudents}
                        onAddStudent={(regNo, name) => {
                          if (!selectedCourse) return;
                          const cleanReg = regNo.trim();
                          const stdName = name.trim() || `Student ${selectedCourse.students.length + 1}`;
                          if (selectedCourse.students.some(s => areRegNosEqual(s.regNo, cleanReg))) {
                            showNotification(`Student "${cleanReg}" already enrolled!`);
                            return;
                          }
                          const updatedStudents = [...selectedCourse.students, { regNo: cleanReg, name: stdName }];
                          setCourses(prev => prev.map(c => {
                            if (c.id === selectedCourse.id) {
                              return {
                                ...c,
                                students: updatedStudents
                              };
                            }
                            return c;
                          }));

                          // Persist to local instructor courses cache
                          try {
                            const localICs = apiService.getLocalInstructorCourses();
                            const updatedICs = (localICs || []).map(c => c.id === selectedCourse.id ? { ...c, students: updatedStudents } : c);
                            if (!updatedICs.some(c => c.id === selectedCourse.id)) {
                              updatedICs.push({ ...selectedCourse, students: updatedStudents });
                            }
                            localStorage.setItem('IQRA_OBE_INSTRUCTOR_COURSES', JSON.stringify(updatedICs));
                          } catch (e) {}

                          // Also record in student bindings so Student Dashboard picks it up immediately
                          try {
                            const bindingsStr = localStorage.getItem('IQRA_OBE_STUDENT_BINDINGS');
                            let currentBindings = bindingsStr ? JSON.parse(bindingsStr) : [];
                            if (!Array.isArray(currentBindings)) currentBindings = [];
                            if (!currentBindings.some((b: any) => areRegNosEqual(b.studentRegNo, cleanReg) && b.courseCode === selectedCourse.code)) {
                              currentBindings.push({ studentRegNo: cleanReg, courseCode: selectedCourse.code });
                              localStorage.setItem('IQRA_OBE_STUDENT_BINDINGS', JSON.stringify(currentBindings));
                            }
                          } catch (e) {}

                          // Persist to the server. This used to call the dept-admin
                          // full-sync endpoint, which always 403s for instructors;
                          // the error was swallowed, so the student only ever lived
                          // in this browser. Use the instructor's add-only endpoint,
                          // and only report success once the server confirms.
                          const courseIdForSave = selectedCourse.id;
                          apiService.addStudentsToInstructorCourse(courseIdForSave, [{ regNo: cleanReg, name: stdName }])
                            .then(() => {
                              showNotification(`Enrolled student ${stdName} (${cleanReg})!`, 'success');
                            })
                            .catch(err => {
                              console.error("Failed to enroll student on server:", err);
                              // Roll back the optimistic add so the roster doesn't
                              // show a student the server never received.
                              setCourses(prev => prev.map(c => c.id === courseIdForSave
                                ? { ...c, students: (c.students || []).filter(s => !areRegNosEqual(s.regNo, cleanReg)) }
                                : c));
                              // Also drop the local student binding written above, or the
                              // Student Dashboard would still show this enrollment.
                              try {
                                const raw = localStorage.getItem('IQRA_OBE_STUDENT_BINDINGS');
                                const list = raw ? JSON.parse(raw) : [];
                                if (Array.isArray(list)) {
                                  localStorage.setItem('IQRA_OBE_STUDENT_BINDINGS', JSON.stringify(
                                    list.filter((b: any) => !(areRegNosEqual(b.studentRegNo, cleanReg) && b.courseCode === selectedCourse.code))
                                  ));
                                }
                              } catch (e) {
                                console.error("Could not roll back local student binding:", e);
                              }
                              showNotification(
                                `Could not enroll ${cleanReg}: ${err?.message || 'server error'}. Student was NOT added.`,
                                'error'
                              );
                            });
                        }}
                        onUnenrollStudent={handleUnenrollStudent}
                      />
                    )}
            {/* TAB: CLO SPECIFICATION */}
            {activeTab === "clo" && selectedCourse && (
              <div id="clo-setup-view" className="space-y-6 animate-fadeIn font-sans max-w-4xl mx-auto">
                {/* 1. Enter CLO count card */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 font-sans shadow-2xs">
                  <div className="border-b border-slate-200 pb-2">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 font-sans">
                      <Sliders className="w-4 h-4 text-indigo-600" />
                      Set Number of Course Learning Outcomes (CLOs)
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Determine how many distinct learning outcomes this course evaluates. Changing the count will dynamically adjust the list below.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1">
                      <label className="block text-[10px] uppercase font-extrabold text-slate-500 mb-1.5">Number of CLOs</label>
                      <select
                        value={numCLOs}
                        onChange={(e) => setNumCLOs(parseInt(e.target.value) || 4)}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-950 w-full outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {Array.from({ length: 12 }, (_, idx) => idx + 1).map(num => (
                          <option key={num} value={num}>{num} CLO{num > 1 ? "s" : ""}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => handleAssignCLOsCount(numCLOs)}
                      disabled={loadingCLOs}
                      className="py-2.5 px-4 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50 text-xs font-bold rounded-lg transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                    >
                      {loadingCLOs ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sliders className="w-3.5 h-3.5" />
                      )}
                      Initialize Placeholders
                    </button>
                  </div>
                </div>

                {/* 2. Detailed CLO to GA Mapping Card */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 font-sans">
                        CLO Descriptions & Graduate Attribute (GA) Mappings
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Define human-readable descriptions and map each individual CLO to its corresponding Graduate Attribute (one-to-one mapping).
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-150 text-indigo-700 text-[10px] font-extrabold rounded-full self-start sm:self-center">
                      {numCLOs} CLO{numCLOs > 1 ? 's' : ''} Defined
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 p-5 space-y-5">
                    {Array.from({ length: numCLOs }, (_, idx) => {
                      const i = idx + 1;
                      const code = `CLO-${i}`;
                      const edit = cloEdits[code] || { description: '', mappedGA: null };

                      return (
                        <div key={code} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start pt-5 first:pt-0">
                          {/* CLO Code Badge */}
                          <div className="md:col-span-2 flex items-center gap-2 mt-2">
                            <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-black rounded-lg uppercase tracking-wider font-mono">
                              {code}
                            </span>
                          </div>

                          {/* CLO Description Text Area */}
                          <div className="md:col-span-6">
                            <label className="block text-[10px] uppercase font-extrabold text-slate-400 mb-1">
                              Learning Outcome Description
                            </label>
                            <textarea
                              rows={2}
                              value={edit.description}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCloEdits(prev => ({
                                  ...prev,
                                  [code]: { ...prev[code], description: val }
                                }));
                              }}
                              placeholder={`e.g. Design and evaluate solutions for complex computing problems...`}
                              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-950 w-full outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400"
                            />
                          </div>

                          {/* Mapped GA Dropdown Selection */}
                          <div className="md:col-span-4">
                            <label className="block text-[10px] uppercase font-extrabold text-slate-400 mb-1">
                              Associate Graduate Attribute (GA)
                            </label>
                            <select
                              value={edit.mappedGA || ''}
                              onChange={(e) => {
                                const val = e.target.value || null;
                                setCloEdits(prev => ({
                                  ...prev,
                                  [code]: { ...prev[code], mappedGA: val }
                                }));
                              }}
                              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-950 w-full outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="" className="text-slate-400 font-normal">-- Unmapped / No GA --</option>
                              {availableGAs.map(ga => (
                                <option key={ga.id} value={ga.id} className="text-slate-800 font-bold font-mono text-xs">
                                  {ga.id} - {ga.name}
                                </option>
                              ))}
                              {availableGAs.length === 0 && (
                                <option value="" disabled className="text-slate-400 font-normal">
                                  No GAs mapped to this course yet — ask QA to map it
                                </option>
                              )}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-slate-50 border-t border-slate-200 px-5 py-4 flex items-center justify-end">
                    <button
                      onClick={handleSaveAllCLOs}
                      disabled={loadingCLOs}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      {loadingCLOs ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Save CLO Mappings & GA Associations
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* TAB: GRADING SYSTEM SETUP */}
            {activeTab === 'grading-system' && selectedCourse && (
              <div id="grading-system-view" className="space-y-4 animate-fadeIn">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <span className="text-xs font-bold text-slate-550 font-sans">Evaluated Selection for {selectedCourse.code}:</span>
                  <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-black rounded-lg uppercase tracking-wider font-sans">
                    {selectedCourse.selectedGradingSystem === 'ready2' 
                      ? 'Plus/Minus System' 
                      : selectedCourse.selectedGradingSystem === 'custom' 
                      ? 'Custom Editable' 
                      : 'Iqra Standard'}
                  </span>
                </div>

                {/* Radio Cards to Select Active Grading System */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* CARD 1: IQRA STANDARD */}
                  <div 
                    onClick={() => {
                      setCourses(prev => prev.map(c => {
                        if (c.id === selectedCourse.id) {
                          return { ...c, selectedGradingSystem: 'ready1' };
                        }
                        return c;
                      }));
                    }}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      (selectedCourse.selectedGradingSystem || 'ready1') === 'ready1'
                        ? 'border-indigo-600 bg-white ring-2 ring-indigo-500/20 shadow-md'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-350 shadow-3xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-slate-900 font-sans flex items-center gap-2">
                          <span className={`w-3.5 h-3.5 rounded-full border-4 flex items-center justify-center shrink-0 ${
                            (selectedCourse.selectedGradingSystem || 'ready1') === 'ready1' ? 'border-indigo-550 bg-white' : 'border-slate-300'
                          }`} />
                          System 1: Iqra Standard
                        </h4>
                        <span className="text-[10px] uppercase font-black tracking-widest text-[#1e293b] font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-250 font-sans">Ready-Made</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-4 font-sans">
                        A 6-tier grading table with traditional brackets, including custom incomplete/withdrawal tags.
                      </p>

                      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                        <table className="w-full text-left text-[11px] font-sans">
                          <thead className="bg-[#f8fafc] border-b border-slate-200 font-bold text-slate-500 font-mono">
                            <tr>
                              <th className="py-1 px-3">Grade</th>
                              <th className="py-1 px-3 text-center">Percentage</th>
                              <th className="py-1 px-3 text-right">Points</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-700 font-mono">
                            {[
                              { grade: 'A', percentage: '88% - 100%', points: '4' },
                              { grade: 'B+', percentage: '81% - 87%', points: '3.5' },
                              { grade: 'B', percentage: '74% - 80%', points: '3' },
                              { grade: 'C+', percentage: '67% - 73%', points: '2.5' },
                              { grade: 'C', percentage: '60% - 66%', points: '2' },
                              { grade: 'F', percentage: 'Below 60%', points: '0' },
                              { grade: 'I', percentage: '-', points: '-' },
                              { grade: 'W', percentage: '-', points: '-' }
                            ].map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/40">
                                <td className="py-1.5 px-3 font-extrabold text-indigo-700 font-sans">{row.grade}</td>
                                <td className="py-1.5 px-3 text-center">{row.percentage}</td>
                                <td className="py-1.5 px-3 text-right font-bold text-slate-900">{row.points}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="mt-4">
                      <button className={`w-full py-2 px-3 text-xs font-bold rounded-xl transition-all font-sans cursor-pointer ${
                        (selectedCourse.selectedGradingSystem || 'ready1') === 'ready1'
                          ? 'bg-indigo-600 text-white cursor-default shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 border border-slate-200'
                      }`}>
                        {(selectedCourse.selectedGradingSystem || 'ready1') === 'ready1' ? 'Active System' : 'Activate This Template'}
                      </button>
                    </div>
                  </div>

                  {/* CARD 2: PLUS/MINUS STANDARD */}
                  <div 
                    onClick={() => {
                      setCourses(prev => prev.map(c => {
                        if (c.id === selectedCourse.id) {
                          return { ...c, selectedGradingSystem: 'ready2' };
                        }
                        return c;
                      }));
                    }}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      selectedCourse.selectedGradingSystem === 'ready2'
                        ? 'border-indigo-600 bg-white ring-2 ring-indigo-500/20 shadow-md'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-350 shadow-3xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-slate-900 font-sans flex items-center gap-2">
                          <span className={`w-3.5 h-3.5 rounded-full border-4 flex items-center justify-center shrink-0 ${
                            selectedCourse.selectedGradingSystem === 'ready2' ? 'border-indigo-550 bg-white' : 'border-slate-300'
                          }`} />
                          System 2: Plus/Minus
                        </h4>
                        <span className="text-[10px] uppercase font-black tracking-widest text-[#1e293b] font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-250 font-sans">Ready-Made</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-4 font-sans">
                        A 10-tier breakdown using fractional points (A+, A, A-, B+, B, B-, etc.) for finer grain performance scaling.
                      </p>

                      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                        <table className="w-full text-left text-[11px] font-sans">
                          <thead className="bg-[#f8fafc] border-b border-slate-200 font-bold text-slate-500 font-mono">
                            <tr>
                              <th className="py-1 px-3">Grade</th>
                              <th className="py-1 px-3 text-center">Percentage</th>
                              <th className="py-1 px-3 text-right">Points</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-700 font-mono">
                            {[
                              { grade: 'A+', percentage: '90% - 100%', points: '4.0' },
                              { grade: 'A', percentage: '85% - 89%', points: '4.0' },
                              { grade: 'A-', percentage: '80% - 84%', points: '3.7' },
                              { grade: 'B+', percentage: '75% - 79%', points: '3.3' },
                              { grade: 'B', percentage: '70% - 74%', points: '3.0' },
                              { grade: 'B-', percentage: '65% - 69%', points: '2.7' },
                              { grade: 'C+', percentage: '60% - 64%', points: '2.5' },
                              { grade: 'C', percentage: '55% - 59%', points: '2.0' },
                              { grade: 'D', percentage: '50% - 54%', points: '1.0' },
                              { grade: 'F', percentage: 'Below 50%', points: '0.0' }
                            ].map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/40">
                                <td className="py-1 px-3 font-extrabold text-indigo-700 font-sans">{row.grade}</td>
                                <td className="py-1 px-3 text-center">{row.percentage}</td>
                                <td className="py-1 px-3 text-right font-bold text-slate-900">{row.points}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="mt-4">
                      <button className={`w-full py-2 px-3 text-xs font-bold rounded-xl transition-all font-sans cursor-pointer ${
                        selectedCourse.selectedGradingSystem === 'ready2'
                          ? 'bg-indigo-600 text-white cursor-default shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 border border-slate-200'
                      }`}>
                        {selectedCourse.selectedGradingSystem === 'ready2' ? 'Active System' : 'Activate This Template'}
                      </button>
                    </div>
                  </div>

                  {/* CARD 3: EDITABLE CUSTOM GRADING SYSTEM */}
                  <div 
                    className={`p-5 rounded-2xl border transition-all relative flex flex-col justify-between ${
                      selectedCourse.selectedGradingSystem === 'custom'
                        ? 'border-indigo-600 bg-white ring-2 ring-indigo-500/20 shadow-md'
                        : 'border-slate-200 bg-slate-50/50 shadow-3xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 
                          onClick={() => {
                            setCourses(prev => prev.map(c => {
                              if (c.id === selectedCourse.id) {
                                return { ...c, selectedGradingSystem: 'custom' };
                              }
                              return c;
                            }));
                          }}
                          className="text-sm font-bold text-slate-900 font-sans flex items-center gap-2 cursor-pointer select-none"
                        >
                          <span className={`w-3.5 h-3.5 rounded-full border-4 flex items-center justify-center shrink-0 ${
                            selectedCourse.selectedGradingSystem === 'custom' ? 'border-indigo-550 bg-white' : 'border-slate-300'
                          }`} />
                          System 3: Custom Editable Desk
                        </h4>
                        <span className="text-[10px] uppercase font-black tracking-widest text-[#b45309] font-mono bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-sans">Dynamic</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-4 font-sans">
                        Build and manage your custom local grading tiers. Select this item, modify any record below, and save changes.
                      </p>

                      <div className="max-h-[350px] overflow-y-auto border border-slate-200 rounded-lg bg-white p-2 space-y-2">
                        {(tempCustomGrades || selectedCourse.customGradingSystem || DEFAULT_CUSTOM_GRADES).map((row, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                            <input 
                              type="text"
                              value={row.grade}
                              onChange={(e) => {
                                const list = JSON.parse(JSON.stringify(tempCustomGrades || selectedCourse.customGradingSystem || DEFAULT_CUSTOM_GRADES));
                                list[idx].grade = e.target.value;
                                setTempCustomGrades(list);
                              }}
                              className="w-10 text-xs font-bold text-indigo-700 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-center font-mono outline-none focus:border-indigo-500"
                              placeholder="G"
                            />
                            {(() => {
                              const range = parsePercentRange(row.percentage);
                              return (
                                <div className="flex-1 flex items-center justify-center gap-1 bg-white border border-slate-300 rounded px-1.5 py-0.5 hover:border-slate-400 focus-within:border-indigo-500 transition-colors">
                                  <div className="flex items-center">
                                    <input 
                                      type="number"
                                      min="0"
                                      max="150"
                                      value={range.min}
                                      onChange={(e) => {
                                        let val = parseInt(e.target.value, 10);
                                        if (isNaN(val)) val = 0;
                                        if (val < 0) val = 0;
                                        if (val > 150) val = 150;
                                        const list = JSON.parse(JSON.stringify(tempCustomGrades || selectedCourse.customGradingSystem || DEFAULT_CUSTOM_GRADES));
                                        list[idx].percentage = `${val}% - ${range.max}%`;
                                        setTempCustomGrades(list);
                                      }}
                                      className="w-10 text-right text-xs text-slate-800 font-bold bg-transparent outline-none font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      placeholder="0"
                                    />
                                    <span className="text-[9px] text-slate-400 font-semibold ml-0.5">%</span>
                                  </div>
                                  <span className="text-slate-400 text-[10px] font-bold">-</span>
                                  <div className="flex items-center">
                                    <input 
                                      type="number"
                                      min="0"
                                      max="150"
                                      value={range.max}
                                      onChange={(e) => {
                                        let val = parseInt(e.target.value, 10);
                                        if (isNaN(val)) val = 0;
                                        if (val < 0) val = 0;
                                        if (val > 150) val = 150;
                                        const list = JSON.parse(JSON.stringify(tempCustomGrades || selectedCourse.customGradingSystem || DEFAULT_CUSTOM_GRADES));
                                        list[idx].percentage = `${range.min}% - ${val}%`;
                                        setTempCustomGrades(list);
                                      }}
                                      className="w-10 text-left text-xs text-slate-800 font-bold bg-transparent outline-none font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      placeholder="100"
                                    />
                                    <span className="text-[9px] text-slate-400 font-semibold ml-0.5">%</span>
                                  </div>
                                </div>
                              );
                            })()}
                            <input 
                              type="text"
                              value={row.points}
                              onChange={(e) => {
                                const list = JSON.parse(JSON.stringify(tempCustomGrades || selectedCourse.customGradingSystem || DEFAULT_CUSTOM_GRADES));
                                list[idx].points = e.target.value;
                                setTempCustomGrades(list);
                              }}
                              className="w-12 text-xs text-center font-bold text-slate-900 bg-white border border-slate-300 rounded px-1.5 py-0.5 font-mono outline-none focus:border-indigo-500"
                              placeholder="4.0"
                            />
                            <button
                              onClick={() => {
                                const list = JSON.parse(JSON.stringify(tempCustomGrades || selectedCourse.customGradingSystem || DEFAULT_CUSTOM_GRADES));
                                list.splice(idx, 1);
                                setTempCustomGrades(list);
                              }}
                              className="p-1 hover:bg-rose-100 rounded text-rose-500 transition-colors cursor-pointer"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        <button
                          onClick={() => {
                            const list = JSON.parse(JSON.stringify(tempCustomGrades || selectedCourse.customGradingSystem || DEFAULT_CUSTOM_GRADES));
                            list.push({ grade: 'New', percentage: '0% - 0%', points: '0' });
                            setTempCustomGrades(list);
                          }}
                          className="w-full py-1.5 border border-dashed border-indigo-300 hover:border-indigo-500 text-indigo-600 hover:bg-indigo-50/50 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer font-sans"
                        >
                          <Plus className="w-3.5 h-3.5 animate-pulse" />
                          Add Grade Tier
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <button 
                        onClick={() => {
                          const list = tempCustomGrades || selectedCourse.customGradingSystem || DEFAULT_CUSTOM_GRADES;
                          setCourses(prev => prev.map(c => {
                            if (c.id === selectedCourse.id) {
                              return { ...c, selectedGradingSystem: 'custom', customGradingSystem: list };
                            }
                            return c;
                          }));
                          setTempCustomGrades(null);
                          setSaveStatus('success');
                          setTimeout(() => setSaveStatus('idle'), 3000);
                        }}
                        className="w-full py-2 px-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save Custom Changes
                      </button>

                      <button 
                        onClick={() => {
                          setCourses(prev => prev.map(c => {
                            if (c.id === selectedCourse.id) {
                              return { ...c, selectedGradingSystem: 'custom' };
                            }
                            return c;
                          }));
                        }}
                        className={`w-full py-1.5 px-3 text-xs font-bold rounded-xl transition-all font-sans cursor-pointer ${
                          selectedCourse.selectedGradingSystem === 'custom'
                            ? 'bg-blue-50 text-blue-700 border border-blue-100 cursor-default'
                            : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 border border-slate-200'
                        }`}
                      >
                        {selectedCourse.selectedGradingSystem === 'custom' ? 'Active System' : 'Activate Custom System'}
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* TAB 4: GRADE SHEETS */}
              {activeTab === 'grade' && selectedCourse && (
                <div className="space-y-6">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                        Outcome Marks Entry Ledger
                      </h3>
                      <p className="text-xs text-slate-600 mt-1">
                        View course total outputs from the assessment ledger. Scores dynamically update as unit specs alter.
                      </p>
                    </div>

                    <button
                      onClick={handleExportCourseSheet}
                      className="px-3 py-1.5 border border-slate-300 text-slate-755 hover:bg-slate-100 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
                    >
                      Export Excel
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-205 overflow-hidden shadow-xs">
                    <div className="overflow-auto max-h-[380px]">
                      <table className="w-full text-left text-xs border-collapse font-sans relative">
                        <thead className="sticky top-0 bg-slate-50 z-20 shadow-xs border-b border-slate-200">
                          <tr className="bg-slate-50 text-slate-700 font-bold">
                            <th className="py-2.5 px-4 w-12 text-center sticky top-0 bg-slate-50 z-20">S.#</th>
                            <th className="py-2.5 px-4 sticky top-0 bg-slate-50 z-20">Registration No.</th>
                            <th className="py-2.5 px-4 sticky top-0 bg-slate-50 z-20">Student Name</th>
                            {selectedCourse.categories.filter(c => c.percentage > 0).map(cat => (
                              <th key={cat.name} className="py-2.5 px-4 text-center font-mono sticky top-0 bg-slate-50 z-20">
                                {cat.name} <span className="text-[10px] text-slate-500 block font-normal">({cat.percentage}%)</span>
                              </th>
                            ))}
                            <th className="py-2.5 px-4 text-center font-bold text-indigo-650 font-sans sticky top-0 bg-slate-50 z-20">Total (100)</th>
                            <th className="py-2.5 px-4 text-center font-bold text-blue-700 font-sans sticky top-0 bg-slate-50 z-20">Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-mono text-slate-700">
                          {selectedCourse.students.map((std, idx) => {
                            const activeCats = selectedCourse.categories.filter(c => c.percentage > 0);
                            
                            let aggregate = 0;
                            const catGrades = activeCats.map(cat => {
                              let categoryObtainedSum = 0;
                              let categoryMaxMarksSum = 0;
                              const existingUnits = selectedCourse.unitsData[cat.name] || [];
                              if (cat.units > 0) {
                                  for (let u = 1; u <= cat.units; u++) {
                                    const matchingUnit = existingUnits.find(unit => unit.unitNo === u);
                                    const questions = matchingUnit?.questions || [];
                                    if (questions.length > 0) {
                                      questions.forEach(q => {
                                        categoryMaxMarksSum += q.maxMarks || 0;
                                        const qKey = `q-${cat.name}-${u}-${q.id}`;
                                        categoryObtainedSum += std.marks?.[qKey] ?? 0;
                                      });
                                    } else {
                                      const totalMarks = matchingUnit ? matchingUnit.totalMarks : 10;
                                      categoryMaxMarksSum += totalMarks;
                                      const dKey = `${cat.name}-${u}`;
                                      categoryObtainedSum += std.marks?.[dKey] ?? 0;
                                    }
                                  }
                              }
                              const categoryContribution = categoryMaxMarksSum > 0
                                ? (categoryObtainedSum / categoryMaxMarksSum) * cat.percentage
                                : 0;
                              aggregate += categoryContribution;
                              return parseFloat(categoryContribution.toFixed(1));
                            });

                            return (
                              <tr key={`${std.regNo || 'std'}-${idx}`} className="hover:bg-slate-55">
                                <td className="py-3 px-4 text-center text-slate-400">
                                  {idx + 1}
                                </td>
                                <td className="py-3 px-4 text-indigo-650 font-bold text-[11px]">
                                  {std.regNo}
                                </td>
                                <td className="py-3 px-4 font-sans text-slate-800">
                                  {std.name}
                                </td>
                                {catGrades.map((gradeScore, cIdx) => (
                                  <td key={cIdx} className="py-3 px-4 text-center text-slate-800 font-semibold font-mono">
                                    {gradeScore}
                                  </td>
                                ))}
                                <td className="py-3 px-4 text-center font-bold text-indigo-755 bg-indigo-50/50">
                                  {aggregate.toFixed(1)} / 100
                                </td>
                                <td className="py-3 px-4 text-center font-extrabold text-blue-700 bg-blue-50/20">
                                  {getCourseLetterGrade(aggregate, selectedCourse)}
                                </td>
                              </tr>
                            );
                          })}
                          {selectedCourse.students.length === 0 && (
                            <tr>
                              <td colSpan={5 + selectedCourse.categories.filter(c => c.percentage > 0).length} className="py-8 text-center text-slate-500 font-sans">
                                Enrolled student list is currently empty. Run student additions.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}


                      {/* TAB 5: Master Excel-like spreadsheet marks entry */}
              {activeTab === 'enter-marks' && selectedCourse && (
                <div className="space-y-6">
                  {/* SPLIT_PRE */}
                  <MarksEntrySpreadsheet
                    courses={courses}
                    selectedCourse={selectedCourse}
                    setCourses={setCourses}
                    selectedCategoryName={selectedMarksCategoryName}
                    setSelectedCategoryName={setSelectedMarksCategoryName}
                    handleSaveQuestionMark={handleSaveQuestionMark}
                    handleSaveUnitDirectMark={handleSaveUnitDirectMark}
                    handleAddInlineQuestion={handleAddInlineQuestion}
                    handleWizardPartition={handleWizardPartition}
                    handleClearInlineQuestions={handleClearInlineQuestions}
                    handleOpenUnitEditor={handleOpenUnitEditor}
                    onShowNotification={showNotification}
                  />

                  {false && (() => {
                    // Generate full list of assessments
                    const assessmentsList: { 
                      categoryName: string; 
                      unitNo: number; 
                      key: string; 
                      label: string; 
                      maxMarks: number; 
                      weightage: number; 
                      questionsCount: number; 
                      gradedCount: number;
                    }[] = [];

                    selectedCourse.categories.filter(c => c.percentage > 0 && c.units > 0).forEach(cat => {
                      for (let u = 1; u <= cat.units; u++) {
                        const matchingUnit = (selectedCourse.unitsData[cat.name] || []).find(unit => unit.unitNo === u);
                        const questions = matchingUnit?.questions || [];
                        const maxMarks = matchingUnit ? matchingUnit.totalMarks : 10;
                        
                        // Count how many students have marks recorded for this unit/assessment
                        let graded = 0;
                        selectedCourse.students.forEach(std => {
                          let hasMark = false;
                          if (questions.length > 0) {
                            hasMark = questions.some(q => {
                              const qKey = `q-${cat.name}-${u}-${q.id}`;
                              return std.marks?.[qKey] !== undefined && std.marks[qKey] > 0;
                            });
                          } else {
                            const dKey = `${cat.name}-${u}`;
                            hasMark = std.marks?.[dKey] !== undefined && std.marks[dKey] > 0;
                          }
                          if (hasMark) graded++;
                        });

                        assessmentsList.push({
                          categoryName: cat.name,
                          unitNo: u,
                          key: `${cat.name}:::${u}`,
                          label: `${cat.name} — Unit ${u}`,
                          maxMarks,
                          weightage: matchingUnit ? matchingUnit.weightage : Math.round(100 / cat.units),
                          questionsCount: questions.length,
                          gradedCount: graded
                        });
                      }
                    });

                    // Resolve selected active assessment key
                    let activeAssessmentKey = selectedObeAssKey;
                    if (!activeAssessmentKey || !assessmentsList.some(a => a.key === activeAssessmentKey)) {
                      if (assessmentsList.length > 0) {
                        activeAssessmentKey = assessmentsList[0].key;
                      }
                    }

                    const [curCat, curUnitStr] = (activeAssessmentKey || '').split(':::');
                    const curUnit = parseInt(curUnitStr || '1', 10);
                    const curAssessment = assessmentsList.find(a => a.key === activeAssessmentKey);
                    
                    const matchingUnit = curCat 
                      ? (selectedCourse.unitsData[curCat] || []).find(u => u.unitNo === curUnit)
                      : null;
                    const unitQuestions = matchingUnit?.questions || [];
                    const totalMarksMax = matchingUnit?.totalMarks ?? 10;

                    const enrolledCount = selectedCourse.students.length;

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* LEFT SIDEBAR: LIST OF COURSE EVALUATIONS */}
                        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-4 shadow-3xs space-y-3">
                          <div className="pb-2 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assessments</span>
                            <span className="text-[9px] font-bold text-[#4f46e5] bg-indigo-50 px-1.5 rounded-md font-mono">{assessmentsList.length} total</span>
                          </div>

                          {assessmentsList.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-xs italic">
                              No active assessments. Configure weights and units in "Set Weightage" first.
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                              {assessmentsList.map(ass => {
                                const isActive = ass.key === activeAssessmentKey;
                                const isComplete = ass.gradedCount === enrolledCount && ass.gradedCount > 0;

                                return (
                                  <button
                                    key={ass.key}
                                    onClick={() => setSelectedObeAssKey(ass.key)}
                                    className={`w-full text-left p-3 rounded-xl border transition-all duration-150 flex flex-col justify-between cursor-pointer focus:outline-none ${
                                      isActive 
                                        ? 'bg-indigo-650 text-white border-indigo-700 shadow-sm font-semibold' 
                                        : 'bg-slate-50/60 hover:bg-slate-100/85 text-slate-705 border-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span className={`text-xs font-bold font-sans ${isActive ? 'text-white' : 'text-slate-900'}`}>
                                        {ass.label}
                                      </span>
                                      
                                      {isActive ? (
                                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                                      ) : isComplete ? (
                                        <span className="text-[9px] font-black bg-blue-100 border border-blue-200 text-blue-800 rounded px-1.5 py-0.2 select-none font-mono">
                                          Done
                                        </span>
                                      ) : ass.gradedCount > 0 ? (
                                        <span className="text-[9px] font-black bg-amber-100 border border-amber-200 text-amber-800 rounded px-1.5 py-0.2 select-none font-mono">
                                          Grading
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-black bg-slate-100 border border-slate-200 text-slate-400 rounded px-1.5 py-0.2 select-none font-mono">
                                          New
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-baseline justify-between w-full mt-2.5">
                                      <span className={`text-[10px] ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}>
                                        Max: {ass.maxMarks}m • Weight: {ass.weightage}%
                                      </span>
                                      <span className={`text-[11px] font-mono font-bold ${isActive ? 'text-white' : 'text-slate-700'}`}>
                                        {ass.gradedCount} / {enrolledCount} graded
                                      </span>
                                    </div>

                                    <div className="w-full bg-slate-200/50 rounded-full h-1 mt-1.5 overflow-hidden">
                                      <div 
                                        className={`h-full transition-all duration-300 ${isActive ? 'bg-indigo-200' : 'bg-indigo-600'}`}
                                        style={{ width: `${(ass.gradedCount / (enrolledCount || 1)) * 100}%` }}
                                      />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* RIGHT CONTENT: SELECTED ASSESSMENT WORKSPACE */}
                        <div className="lg:col-span-9 space-y-5">
                          {!curAssessment ? (
                            <div className="bg-slate-50 border border-slate-205 rounded-xl p-8 text-center text-slate-450 text-xs font-sans italic shadow-3xs">
                              Select an assessment item on the left list to begin grading student evaluations.
                            </div>
                          ) : (
                            <>
                              {/* Evaluation Workspace Header */}
                              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black tracking-widest text-[#4f46e5] bg-[#eef2ff] border border-[#e0e7ff] px-2.5 py-0.5 rounded-full uppercase">
                                      EXPERT MARKS WORKFLOW
                                    </span>
                                    <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                                      unitQuestions.length > 0 
                                        ? 'text-blue-700 bg-blue-50 border border-blue-150' 
                                        : 'text-amber-700 bg-amber-50 border border-amber-150'
                                    }`}>
                                      {unitQuestions.length > 0 ? '✨ OBE Mode (CLO Question-Level)' : '⚠️ Direct Score Mode'}
                                    </span>
                                  </div>
                                  <h3 className="text-base font-black text-slate-900 mt-1 flex items-center gap-2 font-sans tracking-tight">
                                    <ClipboardCheck className="w-4 h-4 text-indigo-650" />
                                    {curAssessment.label} Workspace
                                  </h3>
                                  <p className="text-xs text-slate-500 mt-0.5 font-sans">
                                    Grade student questions mapped to Course Outcomes. Move between cells using <strong>Enter / ↑ / ↓ / ← / →</strong> keys on your keyboard.
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 self-start md:self-center">
                                  <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                      <Search className="h-3.5 w-3.5 text-slate-400" />
                                    </span>
                                    <input
                                      type="text"
                                      value={spreadsheetSearchQuery}
                                      onChange={(e) => setSpreadsheetSearchQuery(e.target.value)}
                                      placeholder="Filter students..."
                                      className="pl-9 pr-4 py-1.5 w-52 bg-white border border-slate-250 hover:border-slate-350 focus:border-[#4f46e5] focus:outline-none transition-all rounded-xl text-xs font-semibold text-slate-800 shadow-3xs"
                                    />
                                    {spreadsheetSearchQuery && (
                                      <button
                                        onClick={() => setSpreadsheetSearchQuery('')}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Performance statistics dashboard */}
                              {(() => {
                                let marksSum = 0;
                                let gradedCount = 0;
                                selectedCourse.students.forEach(std => {
                                  const m = getStudentMark(std, curCat, curUnit, totalMarksMax, selectedCourse.unitsData);
                                  if (m > 0) gradedCount++;
                                  marksSum += m;
                                });
                                const localAverage = enrolledCount > 0 ? (marksSum / enrolledCount) : 0;
                                const localPassLimit = matchingUnit ? matchingUnit.passing : (totalMarksMax * 0.5);
                                const passedStudentsCount = selectedCourse.students.filter(std => {
                                  const m = getStudentMark(std, curCat, curUnit, totalMarksMax, selectedCourse.unitsData);
                                  return m >= localPassLimit;
                                }).length;
                                const localPassRate = enrolledCount > 0 ? (passedStudentsCount / enrolledCount) * 100 : 0;

                                return (
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white border border-slate-200 p-4 rounded-xl shadow-3xs">
                                    <div>
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Grading Count</span>
                                      <span className="text-[14px] font-black text-slate-800 font-mono">
                                        {gradedCount} <span className="text-[11px] font-normal text-slate-400">/ {enrolledCount} rows</span>
                                      </span>
                                    </div>
                                    <div className="border-l border-slate-150 pl-4">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Assessment Average</span>
                                      <span className="text-[14px] font-black text-indigo-650 font-mono">
                                        {localAverage.toFixed(1)} <span className="text-[11px] font-normal text-slate-450">/ {totalMarksMax}m</span>
                                      </span>
                                    </div>
                                    <div className="border-l border-slate-150 pl-4">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Passing Limit</span>
                                      <span className="text-[14px] font-black text-rose-600 font-mono">
                                        &gt;= {localPassLimit}m
                                      </span>
                                    </div>
                                    <div className="border-l border-slate-150 pl-4">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Success Rate</span>
                                      <span className="text-[14px] font-black text-blue-600 font-mono">
                                        {localPassRate % 1 === 0 ? localPassRate.toFixed(0) : localPassRate.toFixed(2).replace(/\.?0+$/, '')}%
                                      </span>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* CORE SPREADSHEEET SHEETS */}
                              {unitQuestions.length > 0 ? (
                                /* CASE A: UNIT HAS DETAILED QUESTIONS MAPPED */
                                <div className="space-y-4">
                                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-3xs">
                                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
                                      <span className="text-xs font-bold text-slate-700 font-sans tracking-wide uppercase flex items-center gap-1.5">
                                        <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                                        OBE Ledger Matrix ({unitQuestions.length} questions)
                                      </span>
                                      
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <button
                                          onClick={() => {
                                            if (confirm(`Auto-Fill MAX MARKS for ALL students in this Assessment (${curAssessment.label})? This overwrites empty fields.`)) {
                                              setCourses(prev => prev.map(c => {
                                                if (c.id === selectedCourse.id) {
                                                  const updatedStudents = c.students.map(std => {
                                                    const nextMarks = { ...(std.marks || {}) };
                                                    unitQuestions.forEach(q => {
                                                      nextMarks[`q-${curCat}-${curUnit}-${q.id}`] = q.maxMarks;
                                                    });
                                                    nextMarks[`${curCat}-${curUnit}`] = totalMarksMax;
                                                    return { ...std, marks: nextMarks };
                                                  });
                                                  return { ...c, students: updatedStudents };
                                                }
                                                return c;
                                              }));
                                            }
                                          }}
                                          className="px-2.5 py-1 text-[11px] font-bold bg-[#eef2ff] hover:bg-[#e0e7ff] text-[#4f46e5] rounded-md border border-[#e0e7ff] transition-colors flex items-center gap-1 cursor-pointer"
                                        >
                                          <Sparkles className="w-3 h-3" />
                                          Fill Max Marks
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (confirm(`Clear and reset ALL student marks in this assessment (${curAssessment.label})?`)) {
                                              setCourses(prev => prev.map(c => {
                                                if (c.id === selectedCourse.id) {
                                                  const updatedStudents = c.students.map(std => {
                                                    const nextMarks = { ...(std.marks || {}) };
                                                    unitQuestions.forEach(q => {
                                                      nextMarks[`q-${curCat}-${curUnit}-${q.id}`] = 0;
                                                    });
                                                    nextMarks[`${curCat}-${curUnit}`] = 0;
                                                    return { ...std, marks: nextMarks };
                                                  });
                                                  return { ...c, students: updatedStudents };
                                                }
                                                return c;
                                              }));
                                            }
                                          }}
                                          className="px-2.5 py-1 text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md border border-rose-150 transition-colors cursor-pointer"
                                        >
                                          Reset Scores
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (confirm("Revert this evaluation to Direct Marks? This deletes subquestions definitions and their marks.")) {
                                              handleClearInlineQuestions(curCat, curUnit);
                                            }
                                          }}
                                          className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-705 border border-slate-200 rounded-md transition-colors cursor-pointer"
                                        >
                                          Reset to Direct
                                        </button>
                                      </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left border-collapse text-xs table-fixed border border-slate-300 rounded-lg overflow-hidden">
                                        <thead className="bg-[#f8fafc] border-b-2 border-slate-300 select-none">
                                          <tr className="divide-x divide-slate-300 font-semibold text-slate-800 text-center">
                                            <th className="py-2.5 w-12 sticky left-0 bg-[#f8fafc] z-10 border-r border-b border-slate-300">S.#</th>
                                            <th className="py-2.5 w-36 sticky left-12 bg-[#f8fafc] z-10 text-left pl-3 border-r border-b border-slate-300">Reg No</th>
                                            <th className="py-2.5 w-40 sticky left-48 bg-[#f8fafc] z-10 text-left pl-3 border-r border-b border-slate-300">Student Name</th>
                                            
                                            {unitQuestions.map(q => (
                                              <th key={q.id} className="py-2.5 w-24 bg-white font-sans text-center border-r border-b border-slate-300">
                                                <div className="flex flex-col items-center justify-center space-y-0.5 leading-tight">
                                                  <span className="font-extrabold text-slate-800 tracking-wide">{q.name}</span>
                                                  <span className="text-[9px] text-[#4f46e5] font-mono font-bold">Max {q.maxMarks}m</span>
                                                  {q.mappedCLOs && q.mappedCLOs.length > 0 && (
                                                    <span className="text-[8.5px] font-bold bg-amber-50 border border-amber-200 text-amber-805 rounded px-1 scale-95 origin-center font-mono">
                                                      {q.mappedCLOs.join(', ')}
                                                    </span>
                                                  )}
                                                </div>
                                              </th>
                                            ))}
                                            
                                            <th className="py-2.5 w-24 bg-indigo-50/50 text-[#4f46e5] font-black font-sans text-center border-r border-b border-slate-300">Obtained</th>
                                            <th className="py-2.5 w-20 bg-[#f8fafc] text-center border-r border-b border-slate-300 text-slate-700">Percent</th>
                                            <th className="py-2.5 w-20 bg-[#f8fafc] text-center border-b border-slate-300 text-slate-700">Status</th>
                                          </tr>
                                        </thead>
                                        
                                        <tbody className="divide-y divide-slate-300 font-mono text-slate-700">
                                          {(() => {
                                            const filteredStudents = selectedCourse.students.filter(student => {
                                              if (!spreadsheetSearchQuery) return true;
                                              const qLower = spreadsheetSearchQuery.toLowerCase();
                                              return (
                                                student.name.toLowerCase().includes(qLower) ||
                                                student.regNo.toLowerCase().includes(qLower)
                                              );
                                            });

                                            if (filteredStudents.length === 0) {
                                              return (
                                                <tr>
                                                  <td colSpan={unitQuestions.length + 6} className="py-8 text-center text-slate-400 italic font-sans text-xs">
                                                    No matching students registered.
                                                  </td>
                                                </tr>
                                              );
                                            }

                                            return filteredStudents.map((student, stdIdx) => {
                                              const obtainedScore = unitQuestions.reduce((sum, q) => {
                                                const qKey = `q-${curCat}-${curUnit}-${q.id}`;
                                                return sum + (student.marks?.[qKey] ?? 0);
                                              }, 0);
                                              
                                              const localPassLimit = matchingUnit ? matchingUnit.passing : (totalMarksMax * 0.5);
                                              const isPassed = obtainedScore >= localPassLimit;
                                              const rawScorePercent = totalMarksMax > 0 ? ((obtainedScore / totalMarksMax) * 100) : 0;
                                              const scorePercent = rawScorePercent % 1 === 0 ? rawScorePercent.toFixed(0) : rawScorePercent.toFixed(2).replace(/\.?0+$/, '');

                                              return (
                                                <tr key={student.regNo} className="group hover:bg-slate-50/30 divide-x divide-slate-300 border-b border-slate-300">
                                                  <td className="p-2 text-center text-slate-500 bg-slate-50 group-hover:bg-[#f8fafc] sticky left-0 z-10 transition-colors border-r-2 border-r-slate-300 border-b border-b-slate-300">
                                                    {stdIdx + 1}
                                                  </td>
                                                  <td className="p-2 pl-3 font-extrabold text-indigo-950 bg-white group-hover:bg-[#fafbff] sticky left-12 z-10 text-[10.5px] tracking-wide whitespace-nowrap transition-colors">
                                                    {student.regNo}
                                                  </td>
                                                  <td className="p-2 pl-3 font-bold text-slate-700 bg-white group-hover:bg-[#fafbff] sticky left-48 z-10 text-left truncate transition-colors">
                                                    {student.name}
                                                  </td>

                                                  {unitQuestions.map((q, qIdx) => {
                                                    const cellId = `excel-sub-cell-${stdIdx}-${qIdx}`;
                                                    const qKey = `q-${curCat}-${curUnit}-${q.id}`;
                                                    const cellValue = student.marks?.[qKey] !== undefined ? String(student.marks[qKey]) : '';

                                                    return (
                                                      <td key={q.id} className="p-1 text-center w-24">
                                                        <input
                                                          id={cellId}
                                                          type="text"
                                                          inputMode="decimal"
                                                          pattern="[0-9]*\.?[0-9]*"
                                                          value={cellValue}
                                                          placeholder="0"
                                                          onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                              const numVal = (val === '' || val === '.') ? 0 : parseFloat(val);
                                                              if (numVal > q.maxMarks) {
                                                                showNotification(`Warning: Entered marks (${numVal}) cannot be greater than the maximum marks (${q.maxMarks}) for this subquestion. Please enter a value less than or equal to ${q.maxMarks}.`);
                                                                return;
                                                              }
                                                              handleSaveQuestionMark(student.regNo, curCat, curUnit, q.id, numVal);
                                                            }
                                                          }}
                                                          onBlur={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            if (isNaN(val) || val < 0) {
                                                              handleSaveQuestionMark(student.regNo, curCat, curUnit, q.id, 0);
                                                            } else if (val > q.maxMarks) {
                                                              showNotification(`Warning: Entered marks (${val}) is greater than the maximum marks (${q.maxMarks}) for this subquestion. Reverting to ${q.maxMarks}.`);
                                                              handleSaveQuestionMark(student.regNo, curCat, curUnit, q.id, q.maxMarks);
                                                            }
                                                          }}
                                                          onFocus={(e) => e.target.select()}
                                                          onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === 'ArrowDown') {
                                                              e.preventDefault();
                                                              const tgt = document.getElementById(`excel-sub-cell-${stdIdx + 1}-${qIdx}`);
                                                              if (tgt) (tgt as HTMLInputElement).focus();
                                                            } else if (e.key === 'ArrowUp') {
                                                              e.preventDefault();
                                                              const tgt = document.getElementById(`excel-sub-cell-${stdIdx - 1}-${qIdx}`);
                                                              if (tgt) (tgt as HTMLInputElement).focus();
                                                            } else if (e.key === 'ArrowRight') {
                                                              const el = e.target as HTMLInputElement;
                                                              if (el.selectionEnd === el.value.length || el.value.length === 0) {
                                                                const tgt = document.getElementById(`excel-sub-cell-${stdIdx}-${qIdx + 1}`);
                                                                if (tgt) (tgt as HTMLInputElement).focus();
                                                              }
                                                            } else if (e.key === 'ArrowLeft') {
                                                              const el = e.target as HTMLInputElement;
                                                              if (el.selectionStart === 0 || el.value.length === 0) {
                                                                const tgt = document.getElementById(`excel-sub-cell-${stdIdx}-${qIdx - 1}`);
                                                                if (tgt) (tgt as HTMLInputElement).focus();
                                                              }
                                                            }
                                                          }}
                                                          className={`w-14 text-center font-mono font-bold text-xs bg-slate-50/50 border border-slate-205 rounded px-1.5 py-1 focus:ring-1 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all ${
                                                            cellValue === '0' || cellValue === '' ? 'text-rose-500 font-medium' : 'text-slate-900 font-extrabold'
                                                          }`}
                                                        />
                                                      </td>
                                                    );
                                                  })}

                                                  <td className="p-2 text-center text-xs font-black text-[#4f46e5] bg-indigo-50/20">
                                                    {obtainedScore.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">/ {totalMarksMax}</span>
                                                  </td>
                                                  
                                                  <td className="p-2 text-center text-slate-500 font-bold">
                                                    {scorePercent}%
                                                  </td>

                                                  <td className="p-2 text-center">
                                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black border ${
                                                      isPassed 
                                                        ? 'bg-blue-50 border-blue-250 text-blue-800' 
                                                        : 'bg-rose-50 border-rose-200 text-rose-700'
                                                    }`}>
                                                      {isPassed ? 'Pass' : 'Fail'}
                                                    </span>
                                                  </td>
                                                </tr>
                                              );
                                            });
                                          })()}
                                        </tbody>

                                        {/* TABLE FOOTER: COLUMN AVERAGES */}
                                        <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-700 shadow-sm border-b border-b-slate-300">
                                          <tr className="divide-x divide-slate-300 text-center">
                                            <td colSpan={3} className="py-2.5 font-sans font-bold text-[10px] uppercase text-slate-500 sticky left-0 bg-slate-50 z-10 border-r-2 border-r-slate-300 border-b border-b-slate-300 text-center">
                                              Question Averages
                                            </td>

                                            {unitQuestions.map(q => {
                                              let sumOfMarks = 0;
                                              selectedCourse.students.forEach(std => {
                                                const qKey = `q-${curCat}-${curUnit}-${q.id}`;
                                                sumOfMarks += std.marks?.[qKey] ?? 0;
                                              });
                                              const avg = enrolledCount > 0 ? (sumOfMarks / enrolledCount) : 0;
                                              const avgPercent = q.maxMarks > 0 ? (avg / q.maxMarks) * 100 : 0;

                                              return (
                                                <td key={q.id} className="py-2.5 bg-white border-r border-b border-slate-300">
                                                  <span className="text-slate-955 block font-black text-xs">{avg.toFixed(1)}</span>
                                                  <span className="text-[9px] text-slate-400 font-normal">{avgPercent % 1 === 0 ? avgPercent.toFixed(0) : avgPercent.toFixed(2).replace(/\.?0+$/, '')}% avg</span>
                                                </td>
                                              );
                                            })}

                                            {/* Overall Category Unit Total Obtained */}
                                            {(() => {
                                              let sumOfTotals = 0;
                                              selectedCourse.students.forEach(std => {
                                                sumOfTotals += getStudentMark(std, curCat, curUnit, totalMarksMax, selectedCourse.unitsData);
                                              });
                                              const overallAverage = enrolledCount > 0 ? (sumOfTotals / enrolledCount) : 0;
                                              const overallAveragePct = totalMarksMax > 0 ? (overallAverage / totalMarksMax) * 100 : 0;

                                              return (
                                                <>
                                                  <td className="py-2.5 text-indigo-650 bg-indigo-50/20 font-black text-xs text-center border-r border-b border-slate-300">
                                                    {overallAverage.toFixed(1)} / {totalMarksMax}
                                                  </td>
                                                  <td className="py-2.5 bg-slate-50 text-center font-bold text-slate-650 border-r border-b border-slate-300">
                                                    {overallAveragePct % 1 === 0 ? overallAveragePct.toFixed(0) : overallAveragePct.toFixed(2).replace(/\.?0+$/, '')}%
                                                  </td>
                                                  <td className="py-2.5 bg-slate-50 border-b border-slate-300"></td>
                                                </>
                                              );
                                            })()}
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  </div>

                                  {/* INLINE QUESTION MANAGEMENT DESK */}
                                  {(() => {
                                    const isPres = curCat.toLowerCase().includes('presentation');
                                    const singularLab = isPres ? 'Module' : 'Question';
                                    const pluralLab = isPres ? 'Modules' : 'Questions';
                                    const preLabel = isPres ? 'M' : 'Q';
                                    
                                    return (
                                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-3xs space-y-4">
                                        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                                          <div>
                                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Live {singularLab} Matrix Editor</h4>
                                            <p className="text-[10.5px] text-slate-500 mt-0.5 font-sans">Modify labels, assign scores, or alter Course Outcomes dynamically without switching screens.</p>
                                          </div>
                                          <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-[#4f46e5] text-[10px] font-black rounded font-mono uppercase tracking-wider">
                                            Active
                                          </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          {/* CURRENT LIST */}
                                          <div className="space-y-2 border border-slate-100 rounded-lg p-3 bg-slate-50/50 max-h-52 overflow-y-auto">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block font-sans">Active Sub{pluralLab.toLowerCase()}</span>
                                            {unitQuestions.map((q, qIndex) => (
                                              <div key={q.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200">
                                                <div className="flex items-center gap-2">
                                                  <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded text-indigo-700 bg-indigo-50">
                                                    {preLabel}{qIndex + 1}
                                                  </span>
                                                  <span className="text-xs font-bold text-slate-800 font-sans">{q.name}</span>
                                                  <span className="text-[10px] font-mono text-slate-400 font-semibold">({q.maxMarks}m)</span>
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                  {q.mappedCLOs && q.mappedCLOs.length > 0 ? (
                                                    <span className="text-[9.5px] font-bold bg-amber-50 border border-amber-250 text-amber-805 rounded px-1.5 font-mono">
                                                      {q.mappedCLOs.join(', ')}
                                                    </span>
                                                  ) : (
                                                    <span className="text-[9.5px] font-semibold text-rose-500 bg-rose-50 px-1.5 rounded animate-pulse">Unmapped</span>
                                                  )}
                                                  <button
                                                    onClick={() => {
                                                      setCourses(prev => prev.map(c => {
                                                        if (c.id === selectedCourse.id) {
                                                          const existU = c.unitsData[curCat] || [];
                                                          const nextU = existU.map(unitItem => {
                                                            if (unitItem.unitNo === curUnit) {
                                                              const nextQ = (unitItem.questions || []).filter(item => item.id !== q.id);
                                                              const sumMarks = nextQ.length > 0 ? nextQ.reduce((sum, item) => sum + item.maxMarks, 0) : unitItem.totalMarks;
                                                              return {
                                                                ...unitItem,
                                                                questions: nextQ,
                                                                totalMarks: sumMarks,
                                                                mappedCLOs: [...new Set(nextQ.flatMap(item => item.mappedCLOs || []))].sort()
                                                              };
                                                            }
                                                            return unitItem;
                                                          });
                                                          const nextObeQs = (c.obeQuestions || []).filter(item => item.id !== q.id);
                                                          return {
                                                            ...c,
                                                            unitsData: { ...c.unitsData, [curCat]: nextU },
                                                            obeQuestions: nextObeQs
                                                          };
                                                        }
                                                        return c;
                                                      }));
                                                    }}
                                                    className="text-rose-500 hover:text-rose-755 p-1 hover:bg-rose-50 rounded transition-all cursor-pointer"
                                                    title={`Delete ${singularLab.toLowerCase()}`}
                                                  >
                                                    <Trash className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>

                                          {/* ADD QUESTION INLINE */}
                                          <div className="bg-white border border-slate-205 p-3 rounded-lg space-y-3 z-10 shadow-2xs">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block font-sans">Quick Create {singularLab}</span>
                                            
                                            <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Label</label>
                                                <input
                                                  type="text"
                                                  value={inlineQName}
                                                  onChange={(e) => setInlineQName(e.target.value)}
                                                  placeholder={isPres ? "e.g. M1a" : "e.g. Q1a"}
                                                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 w-full outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-sans"
                                                />
                                              </div>
                                              <div>
                                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Marks</label>
                                                <input
                                                  type="text"
                                                  value={inlineQMaxMarks}
                                                  onChange={(e) => setInlineQMaxMarks(e.target.value)}
                                                  placeholder="5"
                                                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 w-full outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                                                />
                                              </div>
                                            </div>

                                            <div>
                                              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Target Outcome (CLO)</label>
                                              <div className="flex flex-wrap gap-1.5">
                                                {Array.from({ length: selectedCourse.cloCount || 4 }, (_, idx) => `CLO-${idx + 1}`).map(clo => {
                                                  const isSelected = inlineQMappedCLOs.includes(clo);
                                                  return (
                                                    <button
                                                      key={clo}
                                                      type="button"
                                                      onClick={() => {
                                                        setInlineQMappedCLOs([clo]);
                                                      }}
                                                      className={`px-2 py-0.5 text-[10px] font-black font-mono rounded-lg transition-all border ${
                                                        isSelected
                                                          ? 'bg-amber-500 border-amber-600 text-white'
                                                          : 'bg-slate-50 border-slate-205 text-slate-655 hover:bg-slate-100'
                                                      }`}
                                                    >
                                                      {clo}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>

                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (!inlineQName.trim()) {
                                                  showNotification(`Please enter a ${singularLab.toLowerCase()} label (e.g. ${preLabel}1).`);
                                                  return;
                                                }
                                                const marks = parseFloat(inlineQMaxMarks);
                                                if (isNaN(marks) || marks <= 0) {
                                                  showNotification("Please enter a valid positive number for marks.");
                                                  return;
                                                }
                                                if (inlineQMappedCLOs.length === 0) {
                                                  showNotification(`Please map this ${singularLab.toLowerCase()} to at least one CLO target.`);
                                                  return;
                                                }
                                                
                                                handleAddInlineQuestion(curCat, curUnit, inlineQName, marks, inlineQMappedCLOs);
                                                setInlineQName('');
                                                setInlineQMappedCLOs([]);
                                              }}
                                              className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5 font-sans cursor-pointer"
                                            >
                                              <Plus className="w-3.5 h-3.5" />
                                              Add {singularLab} to Matrix
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              ) : (
                                /* CASE B: COMPONENT LACKS SUBQUESTIONS (DIRECT MODE) */
                                <div className="space-y-5">
                                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                                    
                                    {/* DIRECT SCORES GRADING PANEL */}
                                    <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-3xs">
                                      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
                                        <span className="text-xs font-bold text-slate-700 font-sans tracking-wide uppercase flex items-center gap-1.5">
                                          <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                                          Direct Entry Ledger Grid (unpartitioned)
                                        </span>
                                        
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <button
                                            onClick={() => {
                                              if (confirm(`Auto-Fill MAX MARKS (${totalMarksMax}m) for ALL students in this Assessment (${curAssessment.label})?`)) {
                                                setCourses(prev => prev.map(c => {
                                                  if (c.id === selectedCourse.id) {
                                                    const updatedStudents = c.students.map(std => {
                                                      const nextMarks = { ...(std.marks || {}) };
                                                      nextMarks[`${curCat}-${curUnit}`] = totalMarksMax;
                                                      return { ...std, marks: nextMarks };
                                                    });
                                                    return { ...c, students: updatedStudents };
                                                  }
                                                  return c;
                                                }));
                                              }
                                            }}
                                            className="px-2.5 py-1 text-[11px] font-bold bg-[#eef2ff] hover:bg-[#e0e7ff] text-[#4f46e5] rounded-md border border-[#e0e7ff] transition-colors flex items-center gap-1 cursor-pointer"
                                          >
                                            <Sparkles className="w-3 h-3" />
                                            Fill Max Marks
                                          </button>
                                          <button
                                            onClick={() => {
                                              if (confirm(`Are you sure you want to delete and reset direct marks for this specific assessment (${curAssessment.label})?`)) {
                                                setCourses(prev => prev.map(c => {
                                                  if (c.id === selectedCourse.id) {
                                                    const updatedStudents = c.students.map(std => {
                                                      const nextMarks = { ...(std.marks || {}) };
                                                      nextMarks[`${curCat}-${curUnit}`] = 0;
                                                      return { ...std, marks: nextMarks };
                                                    });
                                                    return { ...c, students: updatedStudents };
                                                  }
                                                  return c;
                                                }));
                                              }
                                            }}
                                            className="px-2.5 py-1 text-[11px] font-bold bg-[#fef2f2] hover:bg-[#fecaca] text-[#dc2626] rounded-md border border-[#fca5a5] transition-colors cursor-pointer"
                                          >
                                            Reset Scores
                                          </button>
                                        </div>
                                      </div>

                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-xs table-fixed">
                                          <thead className="bg-[#f8fafc] border-b border-slate-200">
                                            <tr className="divide-x divide-slate-300 font-semibold text-slate-800 text-center">
                                              <th className="py-2.5 w-12 sticky left-0 bg-[#f8fafc] z-10 border-r border-b border-slate-300">S.#</th>
                                              <th className="py-2.5 w-36 sticky left-12 bg-[#f8fafc] z-10 text-left pl-3 border-r border-b border-slate-300">Reg No</th>
                                              <th className="py-2.5 w-40 sticky left-48 bg-[#f8fafc] z-10 text-left pl-3 border-r border-b border-slate-300">Student Name</th>
                                              <th className="py-2.5 bg-white text-center text-[#4f46e5] font-black border-r border-b border-slate-300">Obtained score</th>
                                              <th className="py-2.5 w-20 bg-[#f8fafc] border-r border-b border-slate-300 text-slate-700">Percent</th>
                                              <th className="py-2.5 w-20 bg-[#f8fafc] border-b border-slate-300 text-slate-700">Status</th>
                                            </tr>
                                          </thead>
                                          
                                          <tbody className="divide-y divide-slate-150 font-mono text-slate-705">
                                            {(() => {
                                              const filteredStudents = selectedCourse.students.filter(student => {
                                                if (!spreadsheetSearchQuery) return true;
                                                const qLower = spreadsheetSearchQuery.toLowerCase();
                                                return (
                                                  student.name.toLowerCase().includes(qLower) ||
                                                  student.regNo.toLowerCase().includes(qLower)
                                                );
                                              });

                                              if (filteredStudents.length === 0) {
                                                return (
                                                  <tr>
                                                    <td colSpan={6} className="py-8 text-center text-slate-404 italic font-sans text-xs">
                                                      No student records found matching search.
                                                    </td>
                                                  </tr>
                                                );
                                              }

                                              return filteredStudents.map((student, stdIdx) => {
                                                const cellId = `excel-direct-cell-${stdIdx}`;
                                                const dKey = `${curCat}-${curUnit}`;
                                                const cellValueStr = student.marks?.[dKey] !== undefined ? String(student.marks[dKey]) : '';
                                                const rawPoints = parseFloat(cellValueStr) || 0;

                                                const localPassLimit = matchingUnit ? matchingUnit.passing : (totalMarksMax * 0.5);
                                                const isPassed = rawPoints >= localPassLimit;
                                                const rawScorePercent = totalMarksMax > 0 ? ((rawPoints / totalMarksMax) * 100) : 0;
                                                const scorePercentStr = rawScorePercent % 1 === 0 ? rawScorePercent.toFixed(0) : rawScorePercent.toFixed(2).replace(/\.?0+$/, '');

                                                return (
                                                  <tr key={student.regNo} className="group hover:bg-slate-50/30 divide-x divide-slate-300 border-b border-slate-300">
                                                    <td className="p-2 text-center text-slate-500 bg-slate-50 group-hover:bg-[#f8fafc] sticky left-0 z-10 transition-colors border-r-2 border-r-slate-300 border-b border-b-slate-300">
                                                      {stdIdx + 1}
                                                    </td>
                                                    <td className="p-2 pl-3 font-extrabold text-indigo-950 bg-white group-hover:bg-[#fafbff] sticky left-12 z-10 text-[10.5px] tracking-wide whitespace-nowrap transition-colors border-r-2 border-r-slate-300 border-b border-b-slate-300 border-l border-l-slate-200">
                                                      {student.regNo}
                                                    </td>
                                                    <td className="p-2 pl-3 font-bold text-slate-700 bg-white group-hover:bg-[#fafbff] sticky left-48 z-10 text-left truncate transition-colors border-r-2 border-r-slate-300 border-b border-b-slate-300">
                                                      {student.name}
                                                    </td>
                                                    <td className="p-1.5 text-center flex items-center justify-center gap-1.5 bg-white border-r border-b border-slate-300">
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
                                                            const numVal = (val === '' || val === '.') ? 0 : parseFloat(val);
                                                            if (numVal > totalMarksMax) {
                                                              showNotification(`Warning: Entered marks (${numVal}) cannot be greater than the maximum marks (${totalMarksMax}) for this unit assessment. Please enter a value less than or equal to ${totalMarksMax}.`);
                                                              return;
                                                            }
                                                            handleSaveUnitDirectMark(student.regNo, curCat, curUnit, numVal);
                                                          }
                                                        }}
                                                        onBlur={(e) => {
                                                          const val = parseFloat(e.target.value);
                                                          if (isNaN(val) || val < 0) {
                                                            handleSaveUnitDirectMark(student.regNo, curCat, curUnit, 0);
                                                          } else if (val > totalMarksMax) {
                                                            showNotification(`Warning: Entered marks (${val}) is greater than the maximum marks (${totalMarksMax}) for this unit assessment. Reverting to ${totalMarksMax}.`);
                                                            handleSaveUnitDirectMark(student.regNo, curCat, curUnit, totalMarksMax);
                                                          }
                                                        }}
                                                        onFocus={(e) => e.target.select()}
                                                        onKeyDown={(e) => {
                                                          if (e.key === 'Enter' || e.key === 'ArrowDown') {
                                                            e.preventDefault();
                                                            const tgt = document.getElementById(`excel-direct-cell-${stdIdx + 1}`);
                                                            if (tgt) (tgt as HTMLInputElement).focus();
                                                          } else if (e.key === 'ArrowUp') {
                                                            e.preventDefault();
                                                            const tgt = document.getElementById(`excel-direct-cell-${stdIdx - 1}`);
                                                            if (tgt) (tgt as HTMLInputElement).focus();
                                                          }
                                                        }}
                                                        className={`w-20 text-center font-mono font-black text-xs bg-slate-50/50 border border-slate-205 rounded px-2.5 py-1 focus:ring-1 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all ${
                                                          cellValueStr === '0' || cellValueStr === '' ? 'text-rose-500 font-medium' : 'text-indigo-650 font-extrabold'
                                                        }`}
                                                      />
                                                      <span className="text-[10px] text-slate-400 font-medium select-none">/ {totalMarksMax}m</span>
                                                    </td>
                                                    
                                                    <td className="p-2 text-center text-slate-500 font-bold bg-white border-r border-b border-slate-300">
                                                      {scorePercentStr}%
                                                    </td>

                                                    <td className="p-2 text-center bg-white border-b border-slate-300">
                                                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black border ${
                                                        isPassed 
                                                          ? 'bg-blue-50 border-blue-250 text-blue-805' 
                                                          : 'bg-rose-50 border-rose-200 text-rose-700'
                                                      }`}>
                                                        {isPassed ? 'Pass' : 'Fail'}
                                                      </span>
                                                    </td>
                                                  </tr>
                                                );
                                              });
                                            })()}
                                          </tbody>

                                          <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-700">
                                            <tr className="divide-x divide-slate-150 text-center">
                                              <td colSpan={3} className="py-2.5 font-sans font-bold text-[10px] uppercase text-slate-500 sticky left-0 bg-slate-50 z-10 border-r-2 border-r-slate-300 border-b border-b-slate-300 text-center">
                                                Class Averages
                                              </td>
                                              
                                              {(() => {
                                                let sumOfMarks = 0;
                                                selectedCourse.students.forEach(std => {
                                                  const dKey = `${curCat}-${curUnit}`;
                                                  sumOfMarks += std.marks?.[dKey] ?? 0;
                                                });
                                                const average = enrolledCount > 0 ? (sumOfMarks / enrolledCount) : 0;
                                                const avgPercent = totalMarksMax > 0 ? (average / totalMarksMax) * 100 : 0;

                                                return (
                                                  <>
                                                    <td className="py-2.5 bg-white text-center text-indigo-650 font-black text-xs border-r border-b border-slate-300">
                                                      {average.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">/ {totalMarksMax}</span>
                                                    </td>
                                                    <td className="py-2.5 bg-white text-slate-600 text-center border-r border-b border-slate-300">
                                                      {avgPercent % 1 === 0 ? avgPercent.toFixed(0) : avgPercent.toFixed(2).replace(/\.?0+$/, '')}%
                                                    </td>
                                                    <td className="py-2.5 bg-white border-b border-slate-300"></td>
                                                  </>
                                                );
                                              })()}
                                            </tr>
                                          </tfoot>
                                        </table>
                                      </div>
                                    </div>

                                    {/* INTERACTIVE OBE PARTITION WIZARD CARD */}
                                    <div className="lg:col-span-5 bg-gradient-to-br from-indigo-50/40 to-[#f8fafc] border border-indigo-150 p-5 rounded-2xl shadow-3xs space-y-4">
                                      <div className="flex items-center gap-1.5 pb-2 border-b border-indigo-100 flex-wrap">
                                        <Sliders className="w-4 h-4 text-indigo-600 shrink-0" />
                                        <div>
                                          <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest leading-none">CLO Question Partition Wizard</h4>
                                          <p className="text-[9.5px] text-indigo-700/80 mt-1 font-sans">Set up question-level grades mapped individually to Course Learning Outcomes (CLOs).</p>
                                        </div>
                                      </div>

                                      <div className="space-y-4">
                                        {/* OPTION 1: INSTANT WIZARD */}
                                        <div className="bg-white border border-indigo-100 p-3.5 rounded-xl shadow-3xs space-y-2.5">
                                          <span className="text-[10.5px] font-extrabold text-[#4f46e5] flex items-center gap-1 font-sans leading-none">
                                            <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                                            Option A: 1-Click Auto-Splitter
                                          </span>
                                          <p className="text-[10.5px] text-slate-500 font-sans leading-normal">
                                            Divide this assessment ({totalMarksMax}m) equally into subquestions beautifully auto-mapped to target outcomes (e.g. Q1 &rarr; CLO-1, Q2 &rarr; CLO-2).
                                          </p>

                                          <div className="flex items-center justify-between gap-2.5 pt-2 flex-wrap sm:flex-nowrap">
                                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-lg shrink-0">
                                              <span className="text-[10px] text-slate-600 font-sans">Split:</span>
                                              <select
                                                value={wizardNumQuestions}
                                                onChange={(e) => setWizardNumQuestions(parseInt(e.target.value) || 2)}
                                                className="bg-transparent text-xs font-bold font-mono outline-none cursor-pointer border-0 p-0 text-slate-800"
                                              >
                                                <option value={2}>2 Questions (Q1-Q2)</option>
                                                <option value={3}>3 Questions (Q1-Q3)</option>
                                                <option value={4}>4 Questions (Q1-Q4)</option>
                                                <option value={5}>5 Questions (Q1-Q5)</option>
                                              </select>
                                            </div>

                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (confirm(`Auto-generate ${wizardNumQuestions} equal questions for ${curAssessment.label}? This unlocks detailed Outcomes inputs instantly.`)) {
                                                  handleWizardPartition(curCat, curUnit, wizardNumQuestions);
                                                }
                                              }}
                                              className="px-3.5 py-1.5 bg-[#4f46e5] hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all cursor-pointer font-sans"
                                            >
                                              🚀 Partition & Map
                                            </button>
                                          </div>
                                        </div>

                                        {/* OPTION 2: WRITE SINGLE QUESTION */}
                                        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-3xs space-y-3">
                                          <span className="text-[10.5px] font-bold text-slate-800 font-sans block leading-none">Option B: Define Custom Question Manually</span>
                                          
                                          <div className="grid grid-cols-2 gap-2">
                                            <div>
                                              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Label Name</label>
                                              <input
                                                type="text"
                                                value={inlineQName}
                                                onChange={(e) => setInlineQName(e.target.value)}
                                                placeholder="e.g. Q1"
                                                className="bg-slate-50 border border-slate-200 focus:bg-white rounded px-2 py-1 text-xs text-slate-900 w-full outline-none font-sans focus:border-indigo-400 transition-all font-medium"
                                              />
                                            </div>
                                            <div>
                                              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Max Marks</label>
                                              <input
                                                type="text"
                                                value={inlineQMaxMarks}
                                                onChange={(e) => setInlineQMaxMarks(e.target.value)}
                                                placeholder="5"
                                                className="bg-slate-50 border border-slate-200 focus:bg-white rounded px-2 py-1 text-xs text-slate-900 w-full outline-none font-mono focus:border-indigo-400 transition-all font-bold text-center"
                                              />
                                            </div>
                                          </div>

                                          <div>
                                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Target Outcome (CLO)</label>
                                            <div className="flex flex-wrap gap-1">
                                              {Array.from({ length: selectedCourse.cloCount || 4 }, (_, idx) => `CLO-${idx + 1}`).map(clo => {
                                                const isSel = inlineQMappedCLOs.includes(clo);
                                                return (
                                                  <button
                                                    key={clo}
                                                    type="button"
                                                    onClick={() => {
                                                      setInlineQMappedCLOs(prev => {
                                                        if (prev.includes(clo)) return prev.filter(c => c !== clo);
                                                        return [...prev, clo];
                                                      });
                                                    }}
                                                    className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded transition-all border ${
                                                      isSel 
                                                        ? 'bg-amber-500 border-amber-600 text-white shadow-3xs' 
                                                        : 'bg-slate-50 border-slate-200 text-slate-655 hover:bg-slate-100'
                                                    }`}
                                                  >
                                                    {clo}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (!inlineQName.trim()) {
                                                showNotification("Please enter a question label (e.g. Q1).");
                                                return;
                                              }
                                              const marks = parseFloat(inlineQMaxMarks);
                                              if (isNaN(marks) || marks <= 0) {
                                                showNotification("Please enter a valid positive number for marks.");
                                                return;
                                              }
                                              if (inlineQMappedCLOs.length === 0) {
                                                showNotification("Please associate this question with at least one Course Learning Outcome (CLO).");
                                                return;
                                              }

                                              handleAddInlineQuestion(curCat, curUnit, inlineQName, marks, inlineQMappedCLOs);
                                              setInlineQName('');
                                              setInlineQMappedCLOs([]);
                                            }}
                                            className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5 font-sans cursor-pointer"
                                          >
                                            <Plus className="w-3.5 h-3.5" />
                                            Define & Open Spreadsheet
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}



              {/* TAB 6: OBE COCKPIT */}
              {activeTab === 'obe' && selectedCourse && (
                <div className="space-y-6">
                  {/* OBE Navigation Header Card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-4">
                    <div>
                      <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded border border-indigo-150">OBE Cockpit Dashboard</span>
                      <h2 className="text-lg font-extrabold text-slate-900 mt-1 flex items-center gap-2">
                        {obeSubTab === 'questions' && (
                          <>
                            <ClipboardList className="w-5 h-5 text-indigo-600 animate-pulse" />
                            <span>CLO Questions Mapping</span>
                          </>
                        )}
                        {obeSubTab === 'marks' && (
                          <>
                            <Pencil className="w-5 h-5 text-indigo-600 animate-pulse" />
                            <span>OBE Marks Registration Ledger</span>
                          </>
                        )}
                        {obeSubTab === 'reports' && (
                          <>
                            <FileText className="w-5 h-5 text-indigo-600 animate-pulse" />
                            <span>CLO Attainment Reports & Analytics</span>
                          </>
                        )}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 font-sans italic flex items-center gap-1.5 bg-indigo-50/50 px-3 py-1.5 border border-indigo-100/50 rounded-lg">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse shrink-0" />
                        <span>Outcome Based Education Ledger Engine</span>
                      </span>
                    </div>
                  </div>

                  {/* SUB-TAB 1: QUESTIONS MAPPING */}
                  {obeSubTab === 'questions' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start font-sans">
                      {/* Left: Creator Panel */}
                      <div className="lg:col-span-5 bg-slate-50/50 border border-slate-200 rounded-xl p-5 space-y-4">
                        <div className="border-b border-slate-200 pb-2">
                          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                            <Plus className="w-4 h-4 text-indigo-600" />
                            {editingQuestionId ? 'Update OBE Question' : 'Define Assessment Question'}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Choose an assessment, create question labels, set max marks, and tick target CLOs.
                          </p>
                        </div>

                        {/* SELECT ASSESSMENT DROPDOWN */}
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-slate-700 tracking-wide uppercase font-sans">
                            Assessment Component
                          </label>
                          <select
                            value={selectedObeAssKey}
                            onChange={(e) => {
                              setSelectedObeAssKey(e.target.value);
                              resetObeForm();
                            }}
                            className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-sans font-medium focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                          >
                            {selectedCourse.categories.map(cat => {
                              const list = [];
                              for (let u = 1; u <= cat.units; u++) {
                                list.push(
                                  <option key={`${cat.name}:::${u}`} value={`${cat.name}:::${u}`}>
                                    {cat.name} — Unit {u} (Max {selectedCourse.unitsData[cat.name]?.[u-1]?.totalMarks || 10}m)
                                  </option>
                                );
                              }
                              return list;
                            })}
                          </select>
                        </div>

                        {/* QUESTION LABEL */}
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-slate-700 tracking-wide uppercase font-sans">
                            Question Label
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Question 1, Q1a, Part A"
                            value={qName}
                            onChange={(e) => setQName(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-sans font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>

                        {/* MAX MARKS */}
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-slate-700 tracking-wide uppercase font-sans">
                            Maximum Marks Set
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="0.5"
                            placeholder="10"
                            value={qMaxMarks}
                            onChange={(e) => setQMaxMarks(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-sans font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>

                        {/* CLO MAPPING CHECKBOXES */}
                        <div className="space-y-2">
                          <label className="block text-[11px] font-bold text-slate-700 tracking-wide uppercase font-sans">
                            Map to CLO (Select One)
                          </label>
                          <div className="grid grid-cols-2 gap-2 text-slate-800 font-sans">
                            {Array.from({ length: selectedCourse.cloCount || 4 }, (_, i) => `CLO-${i + 1}`).map(clo => {
                              const checked = qClos.includes(clo);
                              return (
                                <label
                                  key={clo}
                                  className={`flex items-center gap-2 p-2 px-2.5 border rounded-lg cursor-pointer text-xs font-semibold select-none transition-all ${checked ? 'border-indigo-300 bg-indigo-50/50 text-indigo-950 font-bold' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                                >
                                  <input
                                    type="radio"
                                    name="obe-question-clo-radio"
                                    checked={checked}
                                    onChange={() => {
                                      setQClos([clo]);
                                    }}
                                    className="accent-indigo-600 rounded-full text-indigo-600 shrink-0 cursor-pointer text-xs"
                                  />
                                  <span>{clo}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* SUBMIT BUTTON */}
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={handleSaveObeQuestion}
                            className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{editingQuestionId ? 'Update' : 'Add Question'}</span>
                          </button>
                          {editingQuestionId && (
                            <button
                              onClick={resetObeForm}
                              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Right: Questions list for selected Component */}
                      <div className="lg:col-span-7 space-y-4 font-sans">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">
                            Questions in <strong className="text-indigo-950">{selectedObeAssKey ? selectedObeAssKey.replace(':::', ' - Unit ') : ''}</strong>
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Configure sub-questions and map each to direct CLO competencies.
                          </p>
                        </div>

                        {/* Created questions list table */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-[#f8fafc] border-b border-slate-200 text-[10px] font-bold text-indigo-950 uppercase tracking-wider font-sans">
                              <tr>
                                <th className="py-2 px-3">Question</th>
                                <th className="py-2 px-3 text-center">Max Marks</th>
                                <th className="py-2 px-3">CLO Mapping</th>
                                <th className="py-2 px-3 text-center">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150">
                              {(selectedCourse.obeQuestions || []).filter(q => {
                                if (!selectedObeAssKey) return true;
                                const [catName, uNoStr] = selectedObeAssKey.split(':::');
                                return q.categoryName === catName && q.unitNo === parseInt(uNoStr, 10);
                              }).map(q => (
                                <tr key={q.id} className="hover:bg-slate-50/55 font-medium text-slate-700">
                                  <td className="py-2 px-3 font-bold text-slate-900 font-sans text-xs">
                                    {q.questionName}
                                  </td>
                                  <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">
                                    {q.maxMarks}
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="flex flex-wrap gap-1">
                                      {q.mappedCLOs.map(clo => (
                                        <span key={clo} className="px-1.5 py-0.5 text-[9px] bg-indigo-50 border border-indigo-200/50 text-indigo-700 rounded font-bold">
                                          {clo}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5 text-slate-500">
                                      <button
                                        onClick={() => {
                                          setEditingQuestionId(q.id);
                                          setQName(q.questionName);
                                          setQMaxMarks(q.maxMarks.toString());
                                          setQClos(q.mappedCLOs);
                                        }}
                                        className="p-1 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer transition-all"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteObeQuestion(q.id)}
                                        className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-all"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}

                              {(selectedCourse.obeQuestions || []).filter(q => {
                                if (!selectedObeAssKey) return true;
                                const [catName, uNoStr] = selectedObeAssKey.split(':::');
                                return q.categoryName === catName && q.unitNo === parseInt(uNoStr, 10);
                              }).length === 0 && (
                                <tr>
                                  <td colSpan={4} className="py-8 text-center text-slate-450 italic text-xs">
                                    No questions defined for this component yet.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 2: OBE MARKS GRID */}
                  {obeSubTab === 'marks' && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 font-sans">
                            OBE Registrations & Question Marks Ledger
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 font-sans">
                            Set student obtained marks for each OBE assessment question. Grid auto-caps to max marks for fail-safety.
                          </p>
                        </div>
                        {/* Selector for Assessment component */}
                        <div className="flex items-center gap-2 bg-slate-50/50 border border-slate-200 px-3 py-1.5 rounded-lg select-none">
                          <span className="text-[9px] text-indigo-950 font-bold tracking-wide uppercase font-sans">COMPONENT FILTER:</span>
                          <select
                            value={selectedObeAssKey}
                            onChange={(e) => setSelectedObeAssKey(e.target.value)}
                            className="bg-transparent border-none text-slate-800 text-xs font-bold font-sans focus:outline-none cursor-pointer"
                          >
                            {selectedCourse.categories.map(cat => {
                              const list = [];
                              for (let u = 1; u <= cat.units; u++) {
                                list.push(
                                  <option key={`${cat.name}:::${u}`} value={`${cat.name}:::${u}`}>
                                    {cat.name} — Unit {u} (Max {selectedCourse.unitsData[cat.name]?.[u-1]?.totalMarks || 10}m)
                                  </option>
                                );
                              }
                              return list;
                            })}
                          </select>
                        </div>
                      </div>

                      {/* Table structure */}
                      {(() => {
                        const currentQs = (selectedCourse.obeQuestions || []).filter(q => {
                          if (!selectedObeAssKey) return true;
                          const [catName, uNoStr] = selectedObeAssKey.split(':::');
                          return q.categoryName === catName && q.unitNo === parseInt(uNoStr, 10);
                        });

                        if (currentQs.length === 0) {
                          return (
                            <div className="border border-indigo-100 bg-indigo-50/45 p-8 text-center rounded-2xl max-w-xl mx-auto space-y-3 shadow-xs">
                              <ClipboardList className="w-10 h-10 text-indigo-500 mx-auto animate-pulse" />
                              <h5 className="font-extrabold text-indigo-950 font-sans text-sm">No OBE Questions defined for this component</h5>
                              <p className="text-xs text-slate-600 leading-relaxed font-sans max-w-md mx-auto">
                                To enter student marks, you first need to define questions (e.g. Q1, Q2) and set their maximum marks. Go to the <strong className="text-indigo-900 cursor-pointer underline" onClick={() => setObeSubTab('questions')}>Questions Mapping</strong> section to load them.
                              </p>
                            </div>
                          );
                        }

                        return (
                          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead className="bg-[#f8fafc] border-b border-slate-200 font-sans">
                                  <tr>
                                    <th className="py-2.5 px-4 font-bold text-slate-800">Registration</th>
                                    <th className="py-2.5 px-3 font-bold text-slate-800 border-r border-slate-200">Student Name</th>
                                    {currentQs.map(q => (
                                      <th key={q.id} className="py-2 px-2 text-center border-r border-slate-200 bg-indigo-50/10">
                                        <span className="block text-indigo-950 font-black">{q.questionName}</span>
                                        <span className="block text-[8px] text-slate-500 font-bold mt-0.5">Max {q.maxMarks}m</span>
                                        <span className="block text-[8px] text-indigo-600 font-extrabold mt-0.5 font-mono">{q.mappedCLOs.join(', ')}</span>
                                      </th>
                                    ))}
                                    <th className="py-2.5 px-3 text-center text-slate-900 font-bold bg-slate-100/50">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-150 font-mono text-slate-705">
                                  {selectedCourse.students.map((student, sIdx) => (
                                    <tr key={`${student.regNo || 'std'}-${sIdx}`} className="hover:bg-slate-50/50 font-medium text-slate-700 text-xs">
                                      <td className="py-2 px-4 font-bold text-indigo-950">{student.regNo}</td>
                                      <td className="py-2 px-3 border-r border-slate-200 text-slate-900 font-sans font-semibold">{student.name}</td>
                                      {currentQs.map(q => {
                                        const preVal = selectedCourse.obeMarks?.[student.regNo]?.[q.id] ?? 0;
                                        return (
                                          <td key={q.id} className="py-1 px-1 border-r border-slate-200 text-center">
                                            <input
                                              type="number"
                                              min="0"
                                              max={q.maxMarks}
                                              step="0.5"
                                              className="w-16 bg-white text-slate-900 border border-slate-250 text-center rounded-md font-sans text-xs py-1 outline-none ring-offset-2 focus:ring-2 focus:ring-indigo-500 font-bold"
                                              value={preVal}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                let num = parseFloat(val);
                                                if (isNaN(num)) {
                                                  handleSaveObeMark(student.regNo, q.id, 0);
                                                  return;
                                                }
                                                if (num < 0) {
                                                  handleSaveObeMark(student.regNo, q.id, 0);
                                                  return;
                                                }
                                                if (num > q.maxMarks) {
                                                  showNotification(`Warning: Entered marks (${num}) cannot be greater than the maximum marks (${q.maxMarks}) allowed for this question.\n\nPlease enter a value less than or equal to ${q.maxMarks}.`);
                                                  return;
                                                }
                                                handleSaveObeMark(student.regNo, q.id, num);
                                              }}
                                              onBlur={(e) => {
                                                const val = parseFloat(e.target.value);
                                                if (isNaN(val) || val < 0) {
                                                  handleSaveObeMark(student.regNo, q.id, 0);
                                                } else if (val > q.maxMarks) {
                                                  showNotification(`Warning: Entered marks (${val}) is greater than the maximum marks (${q.maxMarks}) allowed for this question. Reverting to ${q.maxMarks}.`);
                                                  handleSaveObeMark(student.regNo, q.id, q.maxMarks);
                                                }
                                              }}
                                            />
                                          </td>
                                        );
                                      })}
                                      <td className="py-1 px-3 text-center bg-slate-50/50">
                                        <button
                                          onClick={() => {
                                            if (confirm(`Reset OBE marks for ${student.name}?`)) {
                                              currentQs.forEach(q => {
                                                handleSaveObeMark(student.regNo, q.id, 0);
                                              });
                                            }
                                          }}
                                          className="text-[10px] text-rose-600 hover:text-rose-900 font-bold cursor-pointer font-sans"
                                        >
                                          Reset
                                        </button>
                                      </td>
                                    </tr>
                                  ))}

                                  {selectedCourse.students.length === 0 && (
                                    <tr>
                                      <td colSpan={3 + currentQs.length} className="py-12 bg-slate-50/50 text-center text-slate-505 font-sans">
                                        <Users className="w-8 h-8 text-slate-350 mx-auto mb-2" />
                                        <h5 className="font-bold text-slate-700 font-sans">Course Student Register is empty</h5>
                                        <p className="text-[10px] text-slate-500 mt-1 font-sans">Please enroll students via "Add Student" tab to record marks.</p>
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                       {/* SUB-TAB 3: CLO & GA REPORTS */}
                  {obeSubTab === 'reports' && (
                    <div className="space-y-6">
                      
                      {/* Premium Interactive Reports Tab Selector */}
                      <div className="flex border-b border-slate-200">
                        <button
                          onClick={() => setReportsViewMode('clo')}
                          className={`px-5 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                            reportsViewMode === 'clo'
                              ? 'border-indigo-600 text-indigo-600 font-extrabold'
                              : 'border-transparent text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          <FileText className="w-4 h-4" />
                          <span>CLO-wise Results & Attainment</span>
                        </button>
                        <button
                          onClick={() => setReportsViewMode('ga')}
                          className={`px-5 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                            reportsViewMode === 'ga'
                              ? 'border-indigo-600 text-indigo-600 font-extrabold'
                              : 'border-transparent text-slate-500 hover:text-indigo-900'
                          }`}
                        >
                          <Award className="w-4 h-4" />
                          <span>GA-wise Results & Attainment</span>
                        </button>
                      </div>

                      {reportsViewMode === 'clo' ? (
                        /* Overall CLO Attainments Visual Gauge cards */
                        (() => {
                          const students = selectedCourse.students;
                          const qs = selectedCourse.obeQuestions || [];
                          const marks = selectedCourse.obeMarks || {};

                          // Compute dynamic CLO list based on database synchronized records
                          const cloListToRender = courseCLOs.length > 0
                            ? courseCLOs.map(c => ({
                                code: c.code,
                                description: c.description || 'No description supplied.',
                                mappedGA: c.mappedGA
                              }))
                            : Array.from({ length: selectedCourse.cloCount || 4 }, (_, i) => ({
                                code: `CLO-${i + 1}`,
                                description: `Course Learning Outcome ${i + 1}`,
                                mappedGA: null
                              }));

                          const cloPerformance = cloListToRender.map(cloObj => {
                            const clo = cloObj.code;
                            const cloQs = qs.filter(q => q.mappedCLOs.includes(clo));
                            let totalClassMax = 0;
                            let totalClassObs = 0;
                            let attainedStudentsCount = 0;

                            students.forEach(std => {
                              let stdMax = 0;
                              let stdObs = 0;
                              cloQs.forEach(q => {
                                stdMax += q.maxMarks;
                                stdObs += marks[std.regNo]?.[q.id] ?? 0;
                              });

                              if (stdMax > 0) {
                                const stdPct = (stdObs / stdMax) * 100;
                                if (stdPct >= 50) {
                                  attainedStudentsCount++;
                                }
                              }
                              totalClassMax += stdMax;
                              totalClassObs += stdObs;
                            });

                            const classAvgPct = totalClassMax > 0 ? (totalClassObs / totalClassMax) * 100 : 0;
                            const attainmentRatePct = students.length > 0 ? (attainedStudentsCount / students.length) * 100 : 0;

                            return {
                              name: clo,
                              description: cloObj.description,
                              mappedGA: cloObj.mappedGA,
                              mappedQs: cloQs.length,
                              classAvg: classAvgPct,
                              attainmentRate: attainmentRatePct
                            };
                          });

                          return (
                            <div className="space-y-6 font-sans">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {cloPerformance.map(clo => (
                                  <div key={clo.name} className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3 transition-transform hover:translate-y-[-2px] hover:shadow-sm">
                                    <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                                      <div className="flex flex-col">
                                        <span className="text-xs font-black text-indigo-950 uppercase tracking-widest">{clo.name}</span>
                                        {clo.mappedGA && (
                                          <span className="text-[9px] font-bold text-indigo-500 font-mono mt-0.5">GA Mapping: {clo.mappedGA}</span>
                                        )}
                                      </div>
                                      <span className="text-[10px] bg-indigo-50 border border-indigo-200/50 text-indigo-800 font-bold px-2 py-0.5 rounded-full shrink-0">
                                        {clo.mappedQs} Qs
                                      </span>
                                    </div>

                                    <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed min-h-[30px]" title={clo.description}>
                                      {clo.description}
                                    </p>

                                    <div className="space-y-1">
                                      <div className="flex justify-between text-xs font-semibold text-slate-500">
                                        <span>Average Score:</span>
                                        <span className="text-indigo-955 font-bold font-mono">{clo.classAvg.toFixed(1)}%</span>
                                      </div>
                                      <div className="w-full bg-slate-200 rounded-full h-2">
                                        <div
                                          className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                                          style={{ width: `${Math.min(100, clo.classAvg)}%` }}
                                        ></div>
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <div className="flex justify-between text-xs font-semibold text-slate-500">
                                        <span>Class Attainment (≥50%):</span>
                                        <span className={`font-bold font-mono ${clo.attainmentRate >= 60 ? 'text-blue-700' : 'text-amber-700'}`}>
                                          {clo.attainmentRate.toFixed(1)}%
                                        </span>
                                      </div>
                                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                                        <div
                                          className={`h-1.5 rounded-full transition-all duration-500 ${clo.attainmentRate >= 60 ? 'bg-blue-500' : 'bg-amber-500'}`}
                                          style={{ width: `${Math.min(100, clo.attainmentRate)}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Detailed Student CLO Ledger Sheet */}
                              <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div>
                                    <h4 className="text-sm font-extrabold text-[#111827]">
                                      Student Individual CLO Attainment Grades Ledger
                                    </h4>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      List of students with computed outcome competency progress bars. Threshold for attainment is defined at 50%.
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setReportType('clo');
                                      setActiveModal('marksheet-report');
                                    }}
                                    className="px-3.5 py-1.5 bg-indigo-50 border border-indigo-250 text-indigo-700 rounded-lg hover:bg-indigo-100 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer font-sans"
                                  >
                                    <Award className="w-3.5 h-3.5" />
                                    <span>Print Reports Sheet (PDF)</span>
                                  </button>
                                </div>

                                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-[#f8fafc] border-b border-slate-200 font-sans text-slate-800">
                                      <tr>
                                        <th className="py-2.5 px-4 font-bold">Registration No</th>
                                        <th className="py-2.5 px-3 font-bold border-r border-slate-200">FullName</th>
                                        {cloListToRender.map(cloObj => (
                                          <th key={cloObj.code} className="py-2.5 px-3 text-center border-r border-slate-200 font-bold bg-slate-100/10" title={cloObj.description}>
                                            {cloObj.code} (%)
                                            {cloObj.mappedGA && <div className="text-[9px] text-slate-400 font-mono font-normal">({cloObj.mappedGA})</div>}
                                          </th>
                                        ))}
                                        <th className="py-2.5 px-3 text-center font-bold">Comprehensive Outcome Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150 font-mono text-slate-705 text-xs">
                                      {selectedCourse.students.map((student) => {
                                        const attList: { name: string; pct: number | null; attained: boolean }[] = [];
                                        let totalAttained = 0;
                                        let clCountWithData = 0;
    
                                        const cellRender = cloListToRender.map(cloObj => {
                                          const clo = cloObj.code;
                                          const cloQs = qs.filter(q => q.mappedCLOs.includes(clo));
                                          let stdMax = 0;
                                          let stdObs = 0;
                                          cloQs.forEach(q => {
                                            stdMax += q.maxMarks;
                                            stdObs += marks[student.regNo]?.[q.id] ?? 0;
                                          });

                                          const pctVal = stdMax > 0 ? (stdObs / stdMax) * 100 : null;
                                          const attained = pctVal !== null ? pctVal >= 50 : false;
                                          if (pctVal !== null) {
                                            clCountWithData++;
                                            if (attained) totalAttained++;
                                          }

                                          attList.push({ name: clo, pct: pctVal, attained });

                                          return (
                                            <td key={clo} className="py-2 px-3 text-center border-r border-slate-200">
                                              {pctVal !== null ? (
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${attained ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                                  {pctVal.toFixed(1)}%
                                                </span>
                                              ) : (
                                                <span className="text-slate-400 text-[10px] italic">-</span>
                                              )}
                                            </td>
                                          );
                                        });

                                        const isComprehensiveAttained = clCountWithData > 0 ? (totalAttained / clCountWithData) >= 0.75 : false;

                                        return (
                                          <tr key={student.regNo} className="hover:bg-slate-50/50 font-semibold text-slate-700">
                                            <td className="py-2.5 px-4 font-bold text-indigo-950">{student.regNo}</td>
                                            <td className="py-2.5 px-3 border-r border-slate-200 text-slate-900 font-sans font-semibold">{student.name}</td>
                                            {cellRender}
                                            <td className="py-2.5 px-3 text-center font-sans">
                                              {clCountWithData > 0 ? (
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${isComprehensiveAttained ? 'bg-blue-600 text-white shadow-xs' : 'bg-amber-100 text-amber-800'}`}>
                                                  {isComprehensiveAttained ? '✔ EXCELLENT / ATTAINED' : '⚠ CLO UNDER CRITERION'}
                                                </span>
                                              ) : (
                                                <span className="text-slate-400 text-xs italic">No OBE marks loaded</span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}

                                      {selectedCourse.students.length === 0 && (
                                        <tr>
                                          <td colSpan={7} className="py-12 bg-slate-50/50 text-center text-slate-505 font-sans">
                                            <FileText className="w-8 h-8 text-slate-350 mx-auto mb-2 animate-bounce" />
                                            <h5 className="font-bold text-slate-700">No student records to compile CLO performance</h5>
                                            <p className="text-[10px] text-slate-500 mt-1">Populate student registrations to generate automated reports.</p>
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        /* GA Based interactive report */
                        (() => {
                          const students = selectedCourse.students;
                          const qs = selectedCourse.obeQuestions || [];
                          const marks = selectedCourse.obeMarks || {};

                          // Compute dynamic CLO list based on database synchronized records
                          const cloListToRender = courseCLOs.length > 0
                            ? courseCLOs.map(c => ({
                                code: c.code,
                                description: c.description || 'No description supplied.',
                                mappedGA: c.mappedGA || c.mapped_ga || null
                              }))
                            : Array.from({ length: selectedCourse.cloCount || 4 }, (_, i) => ({
                                code: `CLO-${i + 1}`,
                                description: `Course Learning Outcome ${i + 1}`,
                                mappedGA: null
                              }));

                          // Group CLOs by GA code
                          const gaToCLOsMap: Record<string, typeof cloListToRender> = {};
                          cloListToRender.forEach(cloObj => {
                            const gaCode = cloObj.mappedGA || 'No GA';
                            if (!gaToCLOsMap[gaCode]) {
                              gaToCLOsMap[gaCode] = [];
                            }
                            gaToCLOsMap[gaCode].push(cloObj);
                          });

                          const sortedGAs = Object.keys(gaToCLOsMap).sort((a, b) => {
                            if (a === 'No GA') return 1;
                            if (b === 'No GA') return -1;
                            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
                          });

                          // Calculate GA averages & attainment rate for class
                          const gaPerformance = sortedGAs.map(gaCode => {
                            const clos = gaToCLOsMap[gaCode] || [];
                            let totalClassMax = 0;
                            let totalClassObs = 0;
                            let attainedStudentsCount = 0;

                            students.forEach(std => {
                              let stdMax = 0;
                              let stdObs = 0;
                              clos.forEach(cloObj => {
                                const cloQs = qs.filter(q => q.mappedCLOs.includes(cloObj.code));
                                cloQs.forEach(q => {
                                  stdMax += q.maxMarks;
                                  stdObs += marks[std.regNo]?.[q.id] ?? 0;
                                });
                              });

                              if (stdMax > 0) {
                                const stdPct = (stdObs / stdMax) * 100;
                                if (stdPct >= 50) {
                                  attainedStudentsCount++;
                                }
                              }
                              totalClassMax += stdMax;
                              totalClassObs += stdObs;
                            });

                            const classAvgPct = totalClassMax > 0 ? (totalClassObs / totalClassMax) * 100 : 0;
                            const attainmentRatePct = students.length > 0 ? (attainedStudentsCount / students.length) * 100 : 0;

                            return {
                              name: gaCode,
                              clos: clos,
                              classAvg: classAvgPct,
                              attainmentRate: attainmentRatePct
                            };
                          });

                          return (
                            <div className="space-y-6 font-sans">
                              
                              {/* GA Attainments Gauge Cards */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {gaPerformance.map(ga => (
                                  <div key={ga.name} className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3 transition-transform hover:translate-y-[-2px] hover:shadow-sm">
                                    <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                                      <span className="text-xs font-black text-indigo-950 uppercase tracking-widest">{formatGACodeToStandard(ga.name)}</span>
                                      <span className="text-[10px] bg-indigo-50 border border-indigo-200/50 text-indigo-800 font-bold px-2 py-0.5 rounded-full shrink-0">
                                        {ga.clos.length} CLOs
                                      </span>
                                    </div>

                                    <div className="text-[10.5px] text-slate-500 leading-relaxed min-h-[30px]">
                                      <span className="font-semibold text-slate-700">Mapped: </span>
                                      {ga.clos.map(c => c.code).join(', ') || 'None'}
                                    </div>

                                    <div className="space-y-1">
                                      <div className="flex justify-between text-xs font-semibold text-slate-500">
                                        <span>Average Score:</span>
                                        <span className="text-indigo-955 font-bold font-mono">{ga.classAvg.toFixed(1)}%</span>
                                      </div>
                                      <div className="w-full bg-slate-200 rounded-full h-2">
                                        <div
                                          className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                                          style={{ width: `${Math.min(100, ga.classAvg)}%` }}
                                        ></div>
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <div className="flex justify-between text-xs font-semibold text-slate-500">
                                        <span>Class Attainment (≥50%):</span>
                                        <span className={`font-bold font-mono ${ga.attainmentRate >= 60 ? 'text-blue-700' : 'text-amber-700'}`}>
                                          {ga.attainmentRate.toFixed(1)}%
                                        </span>
                                      </div>
                                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                                        <div
                                          className={`h-1.5 rounded-full transition-all duration-500 ${ga.attainmentRate >= 60 ? 'bg-blue-500' : 'bg-amber-500'}`}
                                          style={{ width: `${Math.min(100, ga.attainmentRate)}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Detailed Student GA Ledger Sheet */}
                              <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div>
                                    <h4 className="text-sm font-extrabold text-[#111827]">
                                      Student Individual GA Attainment Ledger
                                    </h4>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      List of students with computed Graduate Attribute aggregates based on mapped Course Outcomes.
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setReportType('ga');
                                      setActiveModal('marksheet-report');
                                    }}
                                    className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer font-sans shadow-xs"
                                  >
                                    <Award className="w-3.5 h-3.5" />
                                    <span>Print GA Report Sheet (PDF)</span>
                                  </button>
                                </div>

                                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-[#f8fafc] border-b border-slate-200 font-sans text-slate-800">
                                      <tr>
                                        <th className="py-2.5 px-4 font-bold">Registration No</th>
                                        <th className="py-2.5 px-3 font-bold border-r border-slate-200">FullName</th>
                                        {sortedGAs.map(gaCode => (
                                          <th key={gaCode} className="py-2.5 px-3 text-center border-r border-slate-200 font-bold bg-slate-100/10">
                                            {formatGACodeToStandard(gaCode)} (%)
                                          </th>
                                        ))}
                                        <th className="py-2.5 px-3 text-center font-bold">Comprehensive GA Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150 font-mono text-slate-705 text-xs">
                                      {students.map((student) => {
                                        let gaAttainedCount = 0;
                                        let gaTotalCount = 0;

                                        return (
                                          <tr key={student.regNo} className="hover:bg-slate-50/50 font-semibold text-slate-700">
                                            <td className="py-2.5 px-4 font-bold text-indigo-950">{student.regNo}</td>
                                            <td className="py-2.5 px-3 border-r border-slate-200 text-slate-900 font-sans font-semibold">{student.name}</td>
                                            {sortedGAs.map(gaCode => {
                                              const clos = gaToCLOsMap[gaCode] || [];
                                              let stdMax = 0;
                                              let stdObs = 0;
                                              clos.forEach(cloObj => {
                                                const cloQs = qs.filter(q => q.mappedCLOs.includes(cloObj.code));
                                                cloQs.forEach(q => {
                                                  stdMax += q.maxMarks;
                                                  stdObs += marks[student.regNo]?.[q.id] ?? 0;
                                                });
                                              });

                                              const pctVal = stdMax > 0 ? (stdObs / stdMax) * 100 : null;
                                              const attained = pctVal !== null ? pctVal >= 50 : false;
                                              if (pctVal !== null) {
                                                gaTotalCount++;
                                                if (attained) gaAttainedCount++;
                                              }

                                              return (
                                                <td key={gaCode} className="py-2 px-3 text-center border-r border-slate-200">
                                                  {pctVal !== null ? (
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${attained ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                                      {pctVal.toFixed(1)}%
                                                    </span>
                                                  ) : (
                                                    <span className="text-slate-400 text-[10px] italic">-</span>
                                                  )}
                                                </td>
                                              );
                                            })}
                                            <td className="py-2.5 px-3 text-center font-sans">
                                              {gaTotalCount > 0 ? (
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${gaAttainedCount === gaTotalCount ? 'bg-indigo-600 text-white shadow-xs' : 'bg-amber-100 text-amber-800'}`}>
                                                  {gaAttainedCount === gaTotalCount ? '✔ ALL GAs ATTAINED' : `⚠ ${gaTotalCount - gaAttainedCount} GA(s) UNFULFILLED`}
                                                </span>
                                              ) : (
                                                <span className="text-slate-400 text-xs italic">No OBE marks loaded</span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}

                                      {students.length === 0 && (
                                        <tr>
                                          <td colSpan={3 + sortedGAs.length} className="py-12 bg-slate-50/50 text-center text-slate-505 font-sans">
                                            <FileText className="w-8 h-8 text-slate-350 mx-auto mb-2 animate-bounce" />
                                            <h5 className="font-bold text-slate-700">No student records to compile GA performance</h5>
                                            <p className="text-[10px] text-slate-500 mt-1">Populate student registrations to generate automated reports.</p>
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      )}

                    </div>
                  )}

                </div>
              )}

            </div>
          </>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 font-sans shadow-xs">
            <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-bounce" />
            <h4 className="font-bold text-slate-700">No Target Course Selected</h4>
            <p className="text-xs text-slate-500 mt-1">Please select an assigned course from the sidebar to view outcomes and student registers.</p>
          </div>
        )}

            </div>
          </div>
        )}

      </main>

      {/* FOOTER METADATA */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-auto">
        <p>&copy; Iqra University Outcome Based Education (OBE) Management System. All rights reserved.</p>
      </footer>


      {/* WINDOWS-STYLE DIALOG WARNING / ALERT MODAL (Accurate to Screenshot #4) */}
      <AnimatePresence>
        {showZeroAlert?.show && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-300 rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-slate-900 font-sans"
            >
              {/* Header block resembling standard Win11 popups */}
              <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                <span className="text-xs font-bold text-slate-850">Invalid percentage distribution</span>
                <button
                  onClick={() => setShowZeroAlert(null)}
                  className="text-slate-400 hover:text-slate-900 text-sm font-semibold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Message block */}
              <div className="p-6 flex items-start gap-4">
                <div className="p-2 bg-amber-50 rounded-full text-amber-600 shrink-0 border border-amber-100">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm text-slate-700 leading-relaxed font-sans pt-1 font-medium">
                    {showZeroAlert.msg}
                  </p>
                </div>
              </div>

              {/* Action row with matching OK styling */}
              <div className="bg-slate-50 px-4 py-3 flex justify-end border-t border-slate-200">
                <button
                  onClick={() => setShowZeroAlert(null)}
                  className="px-6 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm outline-none transition-all cursor-pointer"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* SET MARKS UNIT MODAL - Restyled with fixed viewport constraints and beautiful internal scroll */}
      <AnimatePresence>
        {unitEditingCategory && selectedCourse && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800 font-sans"
            >
              
              {/* Modern Title Bar with Slate-50 Background (Locked on top) */}
              <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex items-center justify-between shrink-0">
                <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  Set Marks Unit ({unitEditingCategory})
                </span>
                <button
                  onClick={() => setUnitEditingCategory(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 font-semibold text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="p-5 space-y-4 overflow-y-auto flex-1 max-h-[calc(90vh-65px)]">

                {/* Success banner inside the modal */}
                {unitSaveSuccessMsg && (
                  <div className="bg-blue-50 border border-blue-300 border-l-4 border-l-blue-600 p-3.5 rounded-xl flex items-start gap-3 shadow-2xs animate-fade-in">
                    <Check className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-extrabold text-blue-950 uppercase tracking-wider">Saved Successfully</h4>
                      <p className="text-[11px] text-blue-850 mt-1 font-sans">
                        {unitSaveSuccessMsg}
                      </p>
                    </div>
                  </div>
                )}

                {/* Error banner when CLO selection is missing */}
                {unitCloValidationError && (
                  <div className="bg-rose-50 border border-rose-350 border-l-4 border-l-rose-700 p-3.5 rounded-xl flex items-start gap-3 shadow-2xs animate-fade-in">
                    <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-extrabold text-rose-950 uppercase tracking-wider">Unmapped CLO Detected</h4>
                      <p className="text-[11px] text-rose-850 mt-1 font-sans">
                        Please associate a <strong className="font-extrabold">Course Learning Outcome (CLO)</strong> for all of your questions before saving. Missing mappings are highlighted in red below.
                      </p>
                    </div>
                  </div>
                )}

                {/* Error banner when weightage exceeds 100% */}
                {totalUnitWeightSum > 100 && (
                  <div className="bg-rose-50 border border-rose-300 border-l-4 border-l-rose-600 p-3.5 rounded-xl flex items-start gap-3 shadow-2xs animate-fade-in">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-extrabold text-rose-950 uppercase tracking-wider">Weightage Limit Exceeded</h4>
                      <p className="text-[11px] text-rose-800 mt-1 font-sans">
                        The cumulative weightage of your units is <strong className="font-extrabold">{totalUnitWeightSum}%</strong>, which exceeds the allowed maximum of <strong>100%</strong>. Please adjust unit weightages.
                      </p>
                    </div>
                  </div>
                )}

                {/* Warning banner when weightage is below 100% */}
                {totalUnitWeightSum < 100 && (
                  <div className="bg-amber-50 border border-amber-300 border-l-4 border-l-amber-655 p-3.5 rounded-xl flex items-start gap-3 shadow-2xs animate-fade-in">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-extrabold text-amber-950 uppercase tracking-wider">Weightage Sum is Under 100%</h4>
                      <p className="text-[11px] text-amber-850 mt-1 font-sans">
                        The cumulative weightage of your units is <strong className="font-extrabold">{totalUnitWeightSum}%</strong>, which is currently less than the expected <strong>100%</strong>. Please adjust unit weightages to equal exactly 100%.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  
                  {/* Left Column: Data Grid Table */}
                  <div className="md:col-span-9 space-y-2">
                    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-xs">
                       <table className="w-full text-left text-xs font-sans">
                        <thead>
                          <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold">
                            <th className="py-2 px-2.5 w-8"></th>
                            <th className="py-2 px-2.5">Unit No</th>
                            <th className="py-2 px-2.5 text-center">Total Marks</th>
                            <th className="py-2 px-2.5 text-center">Weightage</th>
                            <th className="py-2 px-2.5 text-center">Mapped CLOs</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-slate-700 font-medium">
                          {tempUnits.map((unit, uIdx) => {
                            const isSelected = selectedUnitIndex === uIdx;
                            return (
                              <tr
                                key={unit.unitNo}
                                onClick={() => setSelectedUnitIndex(uIdx)}
                                className={`cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-indigo-50/70 text-indigo-950 font-bold border-l-4 border-l-indigo-600'
                                    : 'hover:bg-slate-50'
                                }`}
                              >
                                <td className="py-2 px-2.5 text-center text-indigo-600">
                                  {isSelected ? '▶' : ''}
                                </td>
                                <td className="py-2 px-2.5 font-bold">
                                  {unit.unitNo}
                                </td>
                                <td className="py-2 px-2.5 text-center text-sky-600 font-bold">
                                  {unit.totalMarks}
                                </td>
                                <td className={`py-2 px-2.5 text-center font-extrabold ${isSelected ? 'text-indigo-600' : 'text-slate-600'}`}>
                                  {unit.weightage}%
                                </td>
                                <td className="py-2 px-2.5 text-center">
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {unit.mappedCLOs && unit.mappedCLOs.length > 0 ? (
                                      unit.mappedCLOs.map(clo => (
                                        <span key={clo} className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-150 text-indigo-700 font-mono">
                                          {clo}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[10px] text-slate-400 italic">None</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-600">
                      <span>No of Best Units: <strong className="text-slate-800">0</strong></span>
                      <span>
                        Total Weights Sum:{" "}
                        <strong className={
                          totalUnitWeightSum > 100 
                            ? "text-rose-600 font-extrabold animate-pulse" 
                            : totalUnitWeightSum < 100 
                              ? "text-amber-600 font-bold" 
                              : "text-blue-600 font-extrabold pb-0.5 px-1 bg-blue-50 border border-blue-200 rounded"
                        }>
                          {totalUnitWeightSum}%
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Grid Action Buttons */}
                  <div className="md:col-span-3 flex flex-row md:flex-col gap-2 justify-center">
                    <button
                      onClick={handleAddUnitRow}
                      className="grow md:grow-0 py-2 px-4 bg-white hover:bg-slate-50 text-slate-850 border border-slate-250 text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer text-center"
                    >
                      Add
                    </button>
                    <button
                      onClick={handleRemoveUnitRow}
                      className="grow md:grow-0 py-2 px-4 bg-white hover:bg-slate-50 text-slate-850 border border-slate-250 text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer text-center"
                    >
                      Remove
                    </button>
                  </div>

                </div>

                {/* Bottom Section: Editor Card for highlighted row */}
                {tempUnits[selectedUnitIndex] && (() => {
                  const isPresentation = unitEditingCategory?.toLowerCase().includes('presentation');
                  const singularLabel = isPresentation ? 'Module' : 'Question';
                  const pluralLabel = isPresentation ? 'Modules' : 'Questions';
                  const shortPrefix = isPresentation ? 'M' : 'Q';

                  return (
                    <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <h4 className="text-xs uppercase tracking-wider font-bold text-slate-800 font-sans flex items-center gap-1.5">
                          <Sliders className="w-4 h-4 text-indigo-600" />
                          {unitEditingCategory} # {tempUnits[selectedUnitIndex].unitNo} Configuration cockpit
                        </h4>
                        <span className="text-[10px] font-mono font-bold bg-indigo-50 border border-indigo-150 text-indigo-700 px-2 py-0.5 rounded">
                          Active Unit
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-mono font-bold mb-1 uppercase tracking-wider">
                            Unit Weightage (%)
                          </label>
                          <input
                            type="number"
                            value={unitWeightage}
                            onChange={(e) => handleUnitWeightageChange(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 w-full font-mono outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-bold"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">Weightage of this unit towards the overall category percentage.</p>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-500 font-mono font-bold mb-1 uppercase tracking-wider">
                            Unit Total Marks
                          </label>
                          <input
                            type="number"
                            disabled={!!(tempUnits[selectedUnitIndex].questions && tempUnits[selectedUnitIndex].questions!.length > 0)}
                            value={unitTotalMarks}
                            onChange={(e) => handleUnitTotalMarksChange(e.target.value)}
                            className="bg-slate-100/70 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 w-full font-mono outline-none font-extrabold disabled:opacity-75 disabled:cursor-not-allowed"
                          />
                          <p className="text-[10px] text-slate-500 mt-1 font-sans">
                            {tempUnits[selectedUnitIndex].questions && tempUnits[selectedUnitIndex].questions!.length > 0
                              ? `✨ Summed and locked from sub-${pluralLabel.toLowerCase()} below.`
                              : `Set manually or add ${singularLabel.toLowerCase()} breakdown below.`}
                          </p>
                        </div>
                      </div>

                      {/* Highly Professional Questions Mapping Builder */}
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                          <div>
                            <h5 className="text-xs font-bold text-slate-900">{pluralLabel} & CLO Mapping</h5>
                            <p className="text-[10.5px] text-slate-500 mt-0.5">Define detailed {pluralLabel.toLowerCase()} and map each individually to Course Learning Outcomes (CLOs).</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddSubQuestion}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add {singularLabel}
                          </button>
                        </div>

                        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                          {!tempUnits[selectedUnitIndex].questions || tempUnits[selectedUnitIndex].questions!.length === 0 ? (
                            <div className="text-center py-6 px-4 border border-dashed border-slate-200 rounded-xl bg-white shadow-2xs space-y-4">
                              <div className="max-w-xs mx-auto space-y-1.5">
                                <Sliders className="w-5 h-5 text-slate-350 mx-auto opacity-75" />
                                <p className="text-[11.5px] font-bold text-slate-700">Direct Entry Mode (No {pluralLabel.toLowerCase()})</p>
                                <p className="text-[10px] text-slate-450 leading-relaxed font-sans">
                                  You are entering a single aggregate score for this unit. Map this entire unit to a Course Learning Outcome (CLO) below:
                                </p>
                              </div>

                              <div className="max-w-xs mx-auto text-left space-y-1">
                                <label className="block text-[9.5px] text-slate-500 font-mono font-black uppercase tracking-wider">
                                  Mapped CLO for Unit
                                </label>
                                <select
                                  id="direct-unit-clo-selector"
                                  value={tempUnits[selectedUnitIndex].mappedCLOs && tempUnits[selectedUnitIndex].mappedCLOs.length > 0 ? tempUnits[selectedUnitIndex].mappedCLOs[0] : ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const nextCLOs = val ? [val] : [];
                                    setTempUnits(prev => {
                                      const copy = [...prev];
                                      if (copy[selectedUnitIndex]) {
                                        copy[selectedUnitIndex] = {
                                          ...copy[selectedUnitIndex],
                                          mappedCLOs: nextCLOs
                                        };
                                      }
                                      return copy;
                                    });
                                  }}
                                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-sans font-bold focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
                                >
                                  <option value="" className="text-slate-400 font-semibold">-- Select CLO --</option>
                                  {Array.from({ length: selectedCourse.cloCount || 4 }, (_, i) => `CLO-${i + 1}`).map(clo => (
                                    <option key={clo} value={clo} className="text-slate-850 font-bold font-mono">
                                      {clo}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="border-t border-slate-100 pt-3 max-w-xs mx-auto text-center font-sans">
                                <p className="text-[9.5px] text-slate-400">
                                  Need a question-by-question breakdown? Click the <strong className="text-indigo-600 font-bold">Add {singularLabel}</strong> button on the top right to switch to partitioned mode.
                                </p>
                              </div>
                            </div>
                          ) : (
                            tempUnits[selectedUnitIndex].questions!.map((q, qIdx) => {
                              const isCloEmpty = !q.mappedCLOs || q.mappedCLOs.length === 0 || !q.mappedCLOs[0];
                              const isValidationErrorActive = unitCloValidationError && isCloEmpty;

                              return (
                                <div 
                                  key={q.id} 
                                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl p-2.5 transition-all shadow-2xs border ${
                                    isValidationErrorActive 
                                      ? "bg-rose-50 border-rose-450 ring-2 ring-rose-100 animate-pulse" 
                                      : "bg-white border-slate-200 hover:border-slate-300"
                                  }`}
                                >
                                  {/* Question Selector Label & Label Input */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className={`text-[10px] font-mono font-extrabold px-2 py-1 rounded transition-colors ${
                                      isValidationErrorActive
                                        ? "text-rose-700 bg-rose-100 ring-1 ring-rose-200"
                                        : "text-indigo-655 bg-indigo-50/75"
                                    }`}>
                                      {shortPrefix}{qIdx + 1}
                                    </span>
                                    <input
                                      type="text"
                                      value={q.name}
                                      onChange={(e) => handleUpdateSubQuestion(q.id, { name: e.target.value })}
                                      className="bg-transparent hover:bg-slate-50 focus:bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-1 text-xs text-slate-900 font-bold outline-none w-24 transition-all"
                                      placeholder="Label"
                                    />
                                  </div>

                                  {/* CLO Mapping Single Selection Dropdown */}
                                  <div className="flex items-center gap-1.5 grow max-w-xs font-sans">
                                    <label className={`text-[9px] font-mono font-bold uppercase tracking-widest shrink-0 transition-colors ${
                                      isValidationErrorActive ? "text-rose-600 font-extrabold animate-pulse" : "text-slate-400"
                                    }`}>CLO:</label>
                                    <select
                                      value={q.mappedCLOs && q.mappedCLOs.length > 0 ? q.mappedCLOs[0] : ""}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const nextCLOs = val ? [val] : [];
                                        handleUpdateSubQuestion(q.id, { mappedCLOs: nextCLOs });
                                        // Clear error state if CLO is now valid
                                        if (val) {
                                          setUnitCloValidationError(false);
                                        }
                                      }}
                                      className={`rounded-lg px-2 py-1 text-xs font-bold outline-none cursor-pointer w-full transition-all border ${
                                        isValidationErrorActive
                                          ? "bg-rose-50 border-rose-400 text-rose-900 focus:ring-1 focus:ring-rose-500 focus:border-rose-500 hover:bg-rose-100/30"
                                          : "bg-slate-50 hover:bg-white focus:bg-white border-slate-200 hover:border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800"
                                      }`}
                                    >
                                      <option value="" className="text-slate-400 font-semibold focus:bg-white">-- Select CLO --</option>
                                      {Array.from({ length: selectedCourse.cloCount || 4 }, (_, i) => `CLO-${i + 1}`).map(clo => (
                                        <option key={clo} value={clo} className="text-slate-800 font-bold font-mono focus:bg-white">
                                          {clo}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* Max Marks Input & Delete Action */}
                                  <div className="flex items-center gap-2 shrink-0 justify-end sm:justify-start">
                                    <label className="text-[9.5px] font-mono font-bold text-slate-400 uppercase tracking-widest shrink-0 font-sans">Marks:</label>
                                    <input
                                      type="number"
                                      value={q.maxMarks}
                                      onChange={(e) => handleUpdateSubQuestion(q.id, { maxMarks: parseFloat(e.target.value) || 0 })}
                                      className="bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-2 py-1 text-xs text-slate-955 w-14 font-mono font-extrabold text-center outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-bold"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSubQuestion(q.id)}
                                      className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                                      title={`Remove ${singularLabel.toLowerCase()}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-250">
                        <p className="text-[9.5px] text-slate-450 italic">{singularLabel} updates synchronize automatically above.</p>
                      </div>

                    </div>
                  );
                })()}

              </div>

              {/* OK and Cancel final Submission */}
              <div className="bg-slate-50 px-5 py-4 flex justify-end gap-2 border-t border-slate-200">
                <button
                  onClick={() => setUnitEditingCategory(null)}
                  className="px-5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUnitSettings}
                  className="px-6 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
                >
                  Ok
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* CREATE NEW COURSE DRAWER / DIALOG SHEET */}
      <AnimatePresence>
        {isAddingCourse && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-250 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden text-slate-800 shadow-2xl"
            >
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-1.5 font-sans">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  Define Course Specification
                </h3>
                <button
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  onClick={() => setIsAddingCourse(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddNewCourse} className="flex-1 flex flex-col overflow-hidden font-sans">
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                  <div>
                    <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                      DEPARTMENT ASSOCIATE *
                    </label>
                    <select
                      value={addDeptId}
                      onChange={(e) => {
                        const dept = e.target.value;
                        setAddDeptId(dept);
                        const firstProg = obeData?.programs?.find(p => String(p.departmentId).toLowerCase() === String(dept).toLowerCase())?.id || '';
                        setAddProgramId(firstProg);
                      }}
                      className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none"
                    >
                      {obeData && obeData.departments && obeData.departments.length > 0 ? (
                        obeData.departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))
                      ) : (
                        <option value="">No departments available</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                      EDUCATIONAL PROGRAM *
                    </label>
                    <select
                      value={addProgramId}
                      onChange={(e) => setAddProgramId(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none"
                    >
                      {(() => {
                        const allProgs = obeData?.programs || [];
                        const matchedProgs = allProgs.filter(p => !addDeptId || String(p.departmentId).toLowerCase() === String(addDeptId).toLowerCase());
                        const displayProgs = matchedProgs.length > 0 ? matchedProgs : allProgs;
                        if (displayProgs.length === 0) {
                          return <option value="">No programs available</option>;
                        }
                        return displayProgs.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                      COURSE CODE *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CS-301, BBA-402"
                      value={addCourseCode}
                      onChange={(e) => setAddCourseCode(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                      COURSE TITLE / NAME *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Software Quality Assurance"
                      value={addCourseTitle}
                      onChange={(e) => setAddCourseTitle(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                      COURSE TYPE *
                    </label>
                    <select
                      value={addCourseType}
                      onChange={(e) => setAddCourseType(e.target.value as 'Theory' | 'Lab')}
                      className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none"
                    >
                      <option value="Theory">Theory</option>
                      <option value="Lab">Lab</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                      CREDIT HOURS (CR. HR)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={addCreditHours}
                      onChange={(e) => setAddCreditHours(parseInt(e.target.value, 10))}
                      className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 p-6 border-t border-slate-200 bg-slate-50 shrink-0 rounded-b-2xl">
                  <button
                    type="button"
                    onClick={() => setIsAddingCourse(false)}
                    className="px-4 py-2 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    Register Course
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* EDIT EXISTING COURSE DRAWER / DIALOG SHEET */}
      <AnimatePresence>
        {isEditingCourse && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-250 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden text-slate-800 shadow-2xl"
            >
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between font-sans shrink-0">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-1.5">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  Edit Course Specification
                </h3>
                <button
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  onClick={() => setIsEditingCourse(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateCourse} className="flex-1 flex flex-col overflow-hidden font-sans">
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                  <div>
                    <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                      DEPARTMENT ASSOCIATE *
                    </label>
                    <select
                      value={editDeptId}
                      onChange={(e) => {
                        const dept = e.target.value;
                        setEditDeptId(dept);
                        const firstProg = obeData?.programs?.find(p => String(p.departmentId).toLowerCase() === String(dept).toLowerCase())?.id || '';
                        setEditProgramId(firstProg);
                      }}
                      className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none"
                    >
                      {obeData && obeData.departments && obeData.departments.length > 0 ? (
                        obeData.departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))
                      ) : (
                        <option value="">No departments available</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                      EDUCATIONAL PROGRAM *
                    </label>
                    <select
                      value={editProgramId}
                      onChange={(e) => setEditProgramId(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none"
                    >
                      {(() => {
                        const allProgs = obeData?.programs || [];
                        const matchedProgs = allProgs.filter(p => !editDeptId || String(p.departmentId).toLowerCase() === String(editDeptId).toLowerCase());
                        const displayProgs = matchedProgs.length > 0 ? matchedProgs : allProgs;
                        if (displayProgs.length === 0) {
                          return <option value="">No programs available</option>;
                        }
                        return displayProgs.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                      COURSE CODE *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CS-301, BBA-402"
                      value={editCourseCode}
                      onChange={(e) => setEditCourseCode(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                      COURSE TITLE / NAME *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Software Quality Assurance"
                      value={editCourseTitle}
                      onChange={(e) => setEditCourseTitle(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                      COURSE TYPE *
                    </label>
                    <select
                      value={editCourseType}
                      onChange={(e) => setEditCourseType(e.target.value as 'Theory' | 'Lab')}
                      className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none"
                    >
                      <option value="Theory">Theory</option>
                      <option value="Lab">Lab</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                      CREDIT HOURS (CR. HR)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={editCreditHours}
                      onChange={(e) => setEditCreditHours(parseInt(e.target.value, 10))}
                      className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 p-6 border-t border-slate-200 bg-slate-50 shrink-0 rounded-b-2xl">
                  <button
                    type="button"
                    onClick={() => setIsEditingCourse(false)}
                    className="px-4 py-2 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* DELETE COURSE SPECIFICATION CONFIRMATION OVERLAY */}
      <AnimatePresence>
        {courseToDeleteId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-rose-200 rounded-2xl w-full max-w-sm overflow-hidden text-slate-800 shadow-2xl"
            >
              <div className="bg-rose-50 border-b border-rose-100 px-6 py-4 flex items-center gap-2 font-sans">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-base text-rose-950">
                  Delete Specification
                </h3>
              </div>
              <div className="p-6 space-y-4 font-sans text-xs text-slate-650 leading-relaxed">
                <p>
                  Are you sure you want to stop teaching this course? This action is permanent and will completely reset the course weightage profile, exam items, and registered students roster from your workspace.
                </p>
                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
                  <button
                    type="button"
                    onClick={() => setCourseToDeleteId(null)}
                    className="px-4 py-2 hover:bg-slate-100 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteCourse}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MARKSHEET REPORT CUSTOMIZATION AND LIVE PREVIEW OVERLAY */}
      <AnimatePresence>
        {activeModal === 'marksheet-report' && selectedCourse && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-hidden font-sans print:hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-slate-100 border border-slate-250 rounded-2xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Top Control Bar */}
              <div className="bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-50 rounded-lg border border-blue-100">
                    <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-tight">Academic Mark Sheet Report Builder</h3>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">Customize metadata headers, verify live layout limits, and export perfectly aligned vector PDFs</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrintDirect}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-750 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print</span>
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={() => setActiveModal(null)}
                    className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-705 hover:text-slate-905 rounded-lg shadow-xs transition-colors cursor-pointer text-xs font-semibold px-3 py-2"
                  >
                    <X className="w-4 h-4" />
                    <span>Close Preview</span>
                  </button>
                </div>
              </div>

              {/* Main Dialog Body */}
              <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
                
                {/* Left Sidebar Layout (The Form Fields) */}
                <div className="w-full lg:w-80 lg:shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-5 overflow-y-auto space-y-4">
                  <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-widest border-b border-slate-150 pb-1.5">Configure Transcripts</h4>
                  


                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-slate-650 font-bold uppercase mb-1 font-mono">University Name</label>
                      <input
                        type="text"
                        value={reportCampus}
                        onChange={(e) => setReportCampus(e.target.value)}
                        className="w-full text-xs bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg p-2 text-slate-950 font-sans font-medium focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                        placeholder="Iqra University Chak Shahzad Campus Islamabad"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-650 font-bold uppercase mb-grow font-mono">Course Session / Discipline</label>
                      <input
                        type="text"
                        value={reportSession}
                        onChange={(e) => setReportSession(e.target.value)}
                        className="w-full text-xs bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg p-2 text-slate-950 font-sans font-medium focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                        placeholder="BS Computer Science (BSCS) (Fall-Morning)"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-650 font-bold uppercase mb-1 font-mono">Semester</label>
                      <input
                        type="text"
                        value={reportSemester}
                        onChange={(e) => setReportSemester(e.target.value)}
                        className="w-full text-xs bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg p-2 text-slate-950 font-sans font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                        placeholder="SPRING 2026"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-650 font-bold uppercase mb-1 font-mono">Section</label>
                        <input
                          type="text"
                          value={reportSection}
                          onChange={(e) => setReportSection(e.target.value)}
                          className="w-full text-xs bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg p-2 text-slate-950 font-sans font-bold text-center focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                          placeholder="A"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-650 font-bold uppercase mb-1 font-mono">Dated</label>
                        <input
                          type="date"
                          value={reportDated}
                          onChange={(e) => setReportDated(e.target.value)}
                          className="w-full text-xs bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg p-2 text-slate-950 font-sans focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-650 font-bold uppercase mb-1 font-mono">Instructor Name</label>
                      <input
                        type="text"
                        value={reportInstructor}
                        onChange={(e) => setReportInstructor(e.target.value)}
                        className="w-full text-xs bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg p-2 text-slate-950 font-sans font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                        placeholder="Prof. Dr. Jameel Ahmed"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Scrollable Live Document Preview Panel */}
                <div className="flex-1 bg-slate-300 p-4 sm:p-6 overflow-auto">
                  <div className="no-print origin-top scale-95 sm:scale-100 mx-auto w-fit pb-12">
                    <MarksheetDocument
                      course={selectedCourse}
                      campus={reportCampus}
                      semester={reportSemester}
                      section={reportSection}
                      offeredIn={reportOfferedIn}
                      session={reportSession}
                      instructor={reportInstructor}
                      dated={reportDated}
                      printDate={reportPrintDate}
                      isPrintView={false}
                      reportType={reportType}
                      courseCLOs={courseCLOs}
                    />
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      <AnimatePresence>
        {notification && (
          <Toast
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
