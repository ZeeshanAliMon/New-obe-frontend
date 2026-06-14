import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Search
} from 'lucide-react';
import { apiService, BASE_URL } from '../services/apiService';
import { Course, Department, Program, MarksCategory, UnitItem, UnitQuestion, CourseStudent, InstructorCourse, OBEData } from '../types';
import MarksEntrySpreadsheet from './MarksEntrySpreadsheet';

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
  if (marks >= 85) return 'A';
  if (marks >= 80) return 'A-';
  if (marks >= 75) return 'B+';
  if (marks >= 71) return 'B';
  if (marks >= 68) return 'B-';
  if (marks >= 64) return 'C+';
  if (marks >= 61) return 'C';
  if (marks >= 57) return 'C-';
  if (marks >= 53) return 'D+';
  if (marks >= 50) return 'D';
  return 'F';
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
  { name: 'Presentation', percentage: 0, units: 0 },
  { name: 'Lab Project', percentage: 0, units: 0 },
  { name: 'Problem Based Learning', percentage: 0, units: 0 },
  { name: 'Complex Problem', percentage: 0, units: 0 },
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
  'Presentation': [],
  'Lab Project': [],
  'Problem Based Learning': [],
  'Complex Problem': [],
  'Other Activities': [],
  'Viva': [],
  'Lab Performance': [],
  'Lab Reports': [],
  'Mid Term': [],
  'Final': [],
};

const normalizeCourse = (course: InstructorCourse): InstructorCourse => {
  let updatedCategories = (course.categories || []).filter(c => c.name !== 'Sessionals' && c.name !== 'Sessional');

  INITIAL_CATEGORIES.forEach(initCat => {
    const exists = updatedCategories.some(c => c.name === initCat.name);
    if (!exists) {
      updatedCategories.push({ ...initCat });
    }
  });

  const catOrder = INITIAL_CATEGORIES.map(c => c.name);
  updatedCategories.sort((a, b) => catOrder.indexOf(a.name) - catOrder.indexOf(b.name));

  const updatedUnitsData = { ...(course.unitsData || {}) };
  delete updatedUnitsData['Sessionals'];
  delete updatedUnitsData['Sessional'];

  INITIAL_CATEGORIES.forEach(initCat => {
    if (!updatedUnitsData[initCat.name]) {
      updatedUnitsData[initCat.name] = [];
    }
  });

  return {
    ...course,
    categories: updatedCategories,
    unitsData: updatedUnitsData,
  };
};

export const DEPARTMENT_PROGRAMS: Record<string, { id: string; name: string }[]> = {
  computing: [
    { id: 'bscs', name: 'Bachelor of Science in Computer Science (BSCS)' },
    { id: 'bsse', name: 'Bachelor of Science in Software Engineering (BSSE)' },
    { id: 'bsai', name: 'Bachelor of Science in Artificial Intelligence (BSAI)' },
    { id: 'bsit', name: 'BS Information Technology (BSIT)' },
  ],
  business: [
    { id: 'bba', name: 'Bachelor of Business Administration (BBA)' },
    { id: 'mba', name: 'Master of Business Administration (MBA)' },
    { id: 'bsaf', name: 'BS Accounting & Finance (BSAF)' },
  ]
};

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

const DEFAULT_COURSES: InstructorCourse[] = [];

export default function InstructorDashboard({ onLogout, instructorName = 'Prof. Dr. Jameel Ahmed' }: InstructorDashboardProps) {
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [obeData, setObeData] = useState<OBEData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activeCourseId, setActiveCourseId] = useState<string>(() => {
    const saved = localStorage.getItem('IQRA_OBE_INSTRUCTOR_ACTIVE_ID');
    if (saved === 'course-1' || saved === 'course-2') return '';
    if (saved) return saved;
    return '';
  });

  const [selectedObeAssKey, setSelectedObeAssKey] = useState<string>('');
  const [selectedMarksCategoryName, setSelectedMarksCategoryName] = useState<string>('');
  const [activeUnitConfigNo, setActiveUnitConfigNo] = useState<number | null>(null);
  const lastActiveCourseIdRef = useRef<string>('');

  // Load from API on mount, fallback offline if server not reachable
  useEffect(() => {
    let active = true;

    // Load available departments and programs dynamically
    apiService.getAllData().then(res => {
      if (active) {
        setObeData(res);
        if (res.departments && res.departments.length > 0) {
          const firstDeptId = res.departments[0].id;
          setAddDeptId(firstDeptId);
          setEditDeptId(firstDeptId);
          const firstProg = res.programs?.find(p => p.departmentId === firstDeptId)?.id || '';
          setAddProgramId(firstProg);
          setEditProgramId(firstProg);
        }
      }
    }).catch(err => {
      console.warn("Could not load departments & programs dynamically from backend, checking offline storage...", err);
      const offline = apiService.getLocalStorageData();
      if (active && offline) {
        setObeData(offline);
        if (offline.departments && offline.departments.length > 0) {
          const firstDeptId = offline.departments[0].id;
          setAddDeptId(firstDeptId);
          setEditDeptId(firstDeptId);
          const firstProg = offline.programs?.find(p => p.departmentId === firstDeptId)?.id || '';
          setAddProgramId(firstProg);
          setEditProgramId(firstProg);
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
          
          // Make sure an active course is selected if none currently chosen
          const savedActive = localStorage.getItem('IQRA_OBE_INSTRUCTOR_ACTIVE_ID');
          if (!savedActive || savedActive === 'course-1' || savedActive === 'course-2') {
            if (normalized.length > 0) {
              setActiveCourseId(normalized[0].id);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load instructor courses from server. Falling back to offline client cache.", err);
        if (active) {
          setErrorMsg("Connection to backend offline. Running in offline sandbox mode.");
          const offlineCourses = apiService.getLocalInstructorCourses();
          const filtered = offlineCourses.filter(c => c.id !== 'course-1' && c.id !== 'course-2');
          const normalized = filtered.map(normalizeCourse);
          setCourses(normalized);

          // Make sure an active course is selected if none currently chosen
          const savedActive = localStorage.getItem('IQRA_OBE_INSTRUCTOR_ACTIVE_ID');
          if (!savedActive || savedActive === 'course-1' || savedActive === 'course-2') {
            if (normalized.length > 0) {
              setActiveCourseId(normalized[0].id);
            }
          }
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
      localStorage.setItem('IQRA_OBE_INSTRUCTOR_COURSES', JSON.stringify(courses));
      apiService.saveInstructorCourses(courses).catch(err => {
        console.warn("Failed to sync instructor courses to backend", err);
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
  const [activeModal, setActiveModal] = useState<'about' | 'help' | null>(null);

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
  const [addDeptId, setAddDeptId] = useState('computing');
  const [addProgramId, setAddProgramId] = useState('bscs');
  const [addCourseCode, setAddCourseCode] = useState('');
  const [addCourseTitle, setAddCourseTitle] = useState('');
  const [addCreditHours, setAddCreditHours] = useState(3);

  // Form states for editing course
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [editCourseCode, setEditCourseCode] = useState('');
  const [editCourseTitle, setEditCourseTitle] = useState('');
  const [editDeptId, setEditDeptId] = useState('computing');
  const [editProgramId, setEditProgramId] = useState('bscs');
  const [editCreditHours, setEditCreditHours] = useState(3);

  // Edit Student states
  const [editingStudentReg, setEditingStudentReg] = useState<string | null>(null);
  const [editStudentRegVal, setEditStudentRegVal] = useState<string>('');
  const [editStudentNameVal, setEditStudentNameVal] = useState<string>('');

  // Single Course context helper
  const selectedCourse = useMemo(() => {
    return courses.find(c => c.id === activeCourseId) || null;
  }, [courses, activeCourseId]);

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
      const activeCats = selectedCourse.categories.filter(cat => cat.percentage > 0);
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
  const handleOpenUnitEditor = (categoryName: string) => {
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

    const normalizedUnits = actualUnits.map(u => ({
      ...u,
      mappedCLOs: u.mappedCLOs || [],
      questions: u.questions || []
    }));

    setTempUnits(normalizedUnits);
    setSelectedUnitIndex(0);
    if (normalizedUnits[0]) {
      setUnitTotalMarks(normalizedUnits[0].totalMarks.toString());
      setUnitPassMarks(normalizedUnits[0].passing.toString());
      setUnitWeightage(normalizedUnits[0].weightage.toString());
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
      alert("Please enter a question name (e.g. Question 1).");
      return;
    }
    const maxM = parseFloat(qMaxMarks);
    if (isNaN(maxM) || maxM <= 0) {
      alert("Max marks must be greater than 0.");
      return;
    }
    if (qClos.length === 0) {
      alert("Please map this question to at least one CLO target.");
      return;
    }
    if (!selectedObeAssKey) {
      alert("Please select an assessment component first.");
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
        return {
          ...c,
          obeQuestions: updatedQuestions
        };
      }
      return c;
    }));

    resetObeForm();
  };

  const handleDeleteObeQuestion = (qId: string) => {
    if (!selectedCourse) return;
    if (!confirm("Are you sure you want to delete this OBE question? Student marks entered for this question will also be removed permanently.")) return;

    const updatedQuestions = (selectedCourse.obeQuestions || []).filter(q => q.id !== qId);
    
    const updatedMarks = { ...(selectedCourse.obeMarks || {}) };
    Object.keys(updatedMarks).forEach(reg => {
      const stdMarks = { ...updatedMarks[reg] };
      delete stdMarks[qId];
      updatedMarks[reg] = stdMarks;
    });

    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        return {
          ...c,
          obeQuestions: updatedQuestions,
          obeMarks: updatedMarks
        };
      }
      return c;
    }));
  };

  const handleSaveObeMark = (regNo: string, qId: string, value: number) => {
    if (!selectedCourse) return;
    
    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        const copyMarks = { ...(c.obeMarks || {}) };
        if (!copyMarks[regNo]) {
          copyMarks[regNo] = {};
        }
        copyMarks[regNo] = {
          ...copyMarks[regNo],
          [qId]: value
        };
        return {
          ...c,
          obeMarks: copyMarks
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
          if (std.regNo === regNo) {
            const nextMarks = { ...(std.marks || {}) };
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
              marks: nextMarks
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

  const handleSaveUnitDirectMark = (regNo: string, categoryName: string, unitNo: number, value: number) => {
    if (!selectedCourse) return;
    
    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        const updatedStudents = c.students.map(std => {
          if (std.regNo === regNo) {
            const nextMarks = { ...(std.marks || {}) };
            nextMarks[`${categoryName}-${unitNo}`] = value;
            return {
              ...std,
              marks: nextMarks
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

    const newCourse: InstructorCourse = {
      id: `course-${Date.now()}`,
      code: addCourseCode.toUpperCase().trim(),
      title: addCourseTitle.trim(),
      departmentId: addDeptId,
      departmentName: deptName,
      programId: addProgramId,
      programName: programObj ? programObj.name : undefined,
      creditHours: addCreditHours,
      categories: JSON.parse(JSON.stringify(INITIAL_CATEGORIES)),
      unitsData: JSON.parse(JSON.stringify(INITIAL_UNITS_DATA)),
      students: [],
    };

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
        return {
          ...c,
          code: editCourseCode.toUpperCase().trim(),
          title: editCourseTitle.trim(),
          departmentId: editDeptId,
          departmentName: deptName,
          programId: editProgramId,
          programName: programObj ? programObj.name : undefined,
          creditHours: editCreditHours
        };
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
      alert("Please set the total weightage to 100%");
      return;
    }
    if (currentTotalWeight < 100) {
      setSaveStatus('error-under');
      alert("Please set the total weightage to 100%");
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
    setCourses(prev =>
      prev.map(c => {
        if (c.code === selectedCourse.code) {
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
          const newQ: UnitQuestion = {
            id: Date.now().toString() + '_' + nextNo,
            name: questionName.trim() || `Question ${nextNo}`,
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

          return {
            ...c,
            unitsData: {
              ...c.unitsData,
              [categoryName]: updatedUnitsList
            }
          };
        }
        return c;
      })
    );
  };

  const handleClearInlineQuestions = (categoryName: string, unitNo: number) => {
    if (!selectedCourse) return;
    setCourses(prev =>
      prev.map(c => {
        if (c.code === selectedCourse.code) {
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

          return {
            ...c,
            unitsData: {
              ...c.unitsData,
              [categoryName]: updatedUnitsList
            }
          };
        }
        return c;
      })
    );
  };

  const handleWizardPartition = (categoryName: string, unitNo: number, numQuestions: number) => {
    if (!selectedCourse || numQuestions <= 0) return;
    setCourses(prev =>
      prev.map(c => {
        if (c.code === selectedCourse.code) {
          const updatedUnitsData = { ...c.unitsData };
          const existingUnits = updatedUnitsData[categoryName] || [];
          let unitItem = existingUnits.find(u => u.unitNo === unitNo);
          
          const maxUnitValue = unitItem ? unitItem.totalMarks : 10;
          const share = parseFloat((maxUnitValue / numQuestions).toFixed(1));
          
          const newQuestionsList: UnitQuestion[] = [];
          for (let i = 1; i <= numQuestions; i++) {
            let qMarks = share;
            if (i === numQuestions) {
              const currentSum = parseFloat((share * (numQuestions - 1)).toFixed(1));
              qMarks = parseFloat((maxUnitValue - currentSum).toFixed(1));
            }

            newQuestionsList.push({
              id: `${Date.now().toString()}_w_${i}`,
              name: `Q${i}`,
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

          return {
            ...c,
            unitsData: {
              ...c.unitsData,
              [categoryName]: updatedUnitsList
            }
          };
        }
        return c;
      })
    );
  };

  // Sub-question management for Units
  const handleAddSubQuestion = () => {
    setTempUnits(prev => {
      const copy = [...prev];
      const unit = copy[selectedUnitIndex];
      if (unit) {
        const qList = unit.questions || [];
        const nextNo = qList.length + 1;
        const newQuestion: UnitQuestion = {
          id: Date.now().toString() + '_' + nextNo,
          name: `Question ${nextNo}`,
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
    setTempUnits(prev => [
      ...prev,
      {
        unitNo: nextNo,
        passing: 5,
        totalMarks: 10,
        weightage: 10,
        mappedCLOs: []
      }
    ]);
    setSelectedUnitIndex(tempUnits.length);
  };

  const handleRemoveUnitRow = () => {
    if (tempUnits.length <= 1) {
      alert("At least 1 unit is required.");
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
      alert(`Validation Error: Total weightage sum must be exactly 100% to save! Your current weightage sum is ${weightSum.toFixed(1)}%. Please adjust unit weightages to sum up to exactly 100% before saving.`);
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

        return {
          ...c,
          categories: copyCats,
          unitsData: copyUnitsData
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
    const cleanReg = newStudentReg.toUpperCase().trim();

    // Check duplicate
    if (selectedCourse.students.some(s => s.regNo === cleanReg)) {
      alert(`Student with registration number "${cleanReg}" already enrolled!`);
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
          students: c.students.filter(s => s.regNo !== reg)
        };
      }
      return c;
    }));
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

    const cleanNewRegNo = editStudentRegVal.trim().toUpperCase();
    const cleanNewName = editStudentNameVal.trim();

    if (!cleanNewRegNo) {
      alert("Registration number cannot be empty!");
      return;
    }
    if (!cleanNewName) {
      alert("Student name cannot be empty!");
      return;
    }

    // Check duplication if they changed registration number
    if (cleanNewRegNo !== oldRegNo) {
      const exists = selectedCourse.students.some(s => s.regNo === cleanNewRegNo);
      if (exists) {
        alert(`Student with registration number "${cleanNewRegNo}" already exists!`);
        return;
      }
    }

    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        return {
          ...c,
          students: c.students.map(s => {
            if (s.regNo === oldRegNo) {
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
          alert("No valid student records could be parsed. Ensure Column 1 has the Registration Number and Column 2 has the Student Name.");
          setParsedStudents([]);
        } else {
          setParsedStudents(list);
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse sheet. Please ensure it is a valid Excel (.xlsx, .xls) or CSV template file.");
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
        alert("Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.");
      }
    }
  };

  const handleExcelImportExecute = () => {
    if (!selectedCourse || parsedStudents.length === 0) return;

    const addedList: CourseStudent[] = [];
    parsedStudents.forEach(item => {
      // Avoid duplicate enrollment within the course
      if (!selectedCourse.students.some(s => s.regNo === item.regNo) && !addedList.some(s => s.regNo === item.regNo)) {
        addedList.push(item);
      }
    });

    if (addedList.length === 0) {
      alert("All parsed student registration numbers from the Excel sheet are already enrolled in this course.");
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
            if (s.regNo === studentRegNo) {
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
        if (cat.units > 0) {
          let catSum = 0;
          let totalWeightSum = 0;
          const existingUnits = selectedCourse.unitsData[cat.name] || [];
          
          for (let u = 1; u <= cat.units; u++) {
            const matchingUnit = existingUnits.find(unit => unit.unitNo === u);
            const totalMarks = matchingUnit ? matchingUnit.totalMarks : 10;
            const weightage = matchingUnit ? matchingUnit.weightage : (100 / cat.units);
            
            totalWeightSum += weightage;
            const mark = getStudentMark(student, cat.name, u, totalMarks, selectedCourse.unitsData);
            if (totalMarks > 0) {
              catSum += (mark / totalMarks) * weightage;
            }
          }
          
          const divisor = totalWeightSum > 0 ? totalWeightSum : 100;
          const categoryContribution = (catSum / divisor) * cat.percentage;
          aggregate += categoryContribution;
        } else {
          aggregate += 0;
        }
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
      const grade = getLetterGrade(tMarks);
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
          <div className="mx-auto w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl animate-pulse shadow-lg">IU</div>
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

  return (
    <div className="min-h-screen flex flex-col font-sans frosted-bg text-slate-800">
      
      {/* CLASSIC DESKTOP WINDOWS-STYLE MENU BAR HEADER */}
      <header 
        id="instructor-portal-header" 
        className="bg-[#f1f5f9] border-[#cbd5e1] border-b shrink-0 sticky top-0 z-40 select-none relative"
      >
        <div className="mx-auto flex flex-wrap items-center justify-between px-3 py-1.5 max-w-[1700px]">
          
          {/* Menu items list */}
          <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            
            {/* BACK TO LOGIN */}
            <button
              onClick={onLogout}
              className="px-3.5 py-1.5 text-xs font-sans font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 hover:scale-[1.02] text-white border border-slate-800 shadow-xs mr-2"
              title="Back to login selection"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-white shrink-0" />
              <span>Back</span>
            </button>

            {/* FILE MENU */}
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === 'file' ? null : 'file')}
                onMouseEnter={() => openMenu && setOpenMenu('file')}
                className={getNavbarItemClass(openMenu === 'file')}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>File</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
              {openMenu === 'file' && (
                <div className="absolute left-0 mt-1 w-60 bg-white border border-slate-300 rounded-lg shadow-xl py-1 z-50">
                  <button
                    onClick={() => { setIsAddingCourse(true); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded focus:outline-none font-medium"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Add Course Teaches</span>
                  </button>
                  <div className="border-t border-slate-100 my-1"></div>
                  <button
                    onClick={() => { onLogout(); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded focus:outline-none font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>Sign out / Logout</span>
                  </button>
                </div>
              )}
            </div>

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

            {/* EDIT ITEMS DROP DOWN */}
            <div className="relative">
              <button
                onClick={() => {
                  setActiveTab('edit-items');
                  setOpenMenu(openMenu === 'edit-items' ? null : 'edit-items');
                }}
                onMouseEnter={() => {
                  if (openMenu) {
                    setOpenMenu('edit-items');
                    setActiveTab('edit-items');
                  }
                }}
                className={getNavbarItemClass(openMenu === 'edit-items' || activeTab === 'edit-items')}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Items</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
              {openMenu === 'edit-items' && selectedCourse && (
                <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg shadow-xl py-1 z-50 max-h-96 overflow-y-auto font-sans">
                  <div className="px-3.5 py-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider font-sans">
                    Assessment Components
                  </div>
                  {selectedCourse.categories.map(cat => (
                    <button
                      key={cat.name}
                      onClick={() => { 
                      handleOpenUnitEditor(cat.name); 
                      setActiveTab('edit-items');
                      setOpenMenu(null); 
                    }}
                      className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded focus:outline-none font-medium"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>{cat.name}</span>
                    </button>
                  ))}
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
                <span>Add Student</span>
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
                  <div className="px-3.5 py-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider font-sans">
                    Assessment Components
                  </div>
                  {selectedCourse.categories.filter(cat => cat.percentage > 0).map(cat => (
                    <button
                      key={cat.name}
                      onClick={() => {
                        setSelectedMarksCategoryName(cat.name);
                        setActiveTab('enter-marks');
                        setOpenMenu(null);
                      }}
                      className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded focus:outline-none font-medium"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>{cat.name}</span>
                    </button>
                  ))}
                  {selectedCourse.categories.filter(cat => cat.percentage > 0).length === 0 && (
                    <div className="px-3.5 py-2 text-xs text-slate-400 italic">
                      No active components configured
                    </div>
                  )}
                </div>
              )}
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
                      handleExportCourseSheet();
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded text-left font-medium"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Export Marks Ledger (Excel)</span>
                  </button>
                  <button
                    onClick={() => { window.print(); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded text-left font-medium"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Print Outcome Evaluation Report</span>
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
              User: <strong className="text-indigo-950 font-extrabold">{selectedCourse ? selectedCourse.departmentName : 'Department of Computing and Technology'} Instructor</strong>
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
                  <option key={c.id} value={c.id}>{c.code} — {c.title} {c.programId ? `(${c.programId.toUpperCase()})` : ''}</option>
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





          </div>

          {/* Right side course lock / configurations */}
          <div className="flex items-center">
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors shadow-xs hover:border-slate-400 shrink-0 font-sans"
            >
              <LogOut className="w-3 h-3 text-slate-500" />
              Logout
            </button>
          </div>

        </div>
      </header>

      {/* MAIN LAYOUT CANVAS */}
      <main className="grow max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">

        {errorMsg && (
          <div className="bg-amber-55 border border-amber-200 text-amber-850 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in duration-200 text-xs shadow-xs font-sans">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        
        {successMsg && successMsg !== 'Weightage configuration updated successfully!' && (
          <div className="bg-emerald-900/30 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-lg flex items-center gap-3 animate-in fade-in duration-200 text-sm">
            <Check className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Empty State Banner */}
        {courses.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 p-12 rounded-3xl text-center max-w-md mx-auto my-12 shadow-sm font-sans">
            <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-800 mb-2">No Courses Enrolled</h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              You are currently not teaching any course specifications. Click the button below to register a subject and start setting outcomes.
            </p>
            <button
              onClick={() => setIsAddingCourse(true)}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              Add Your First Course
            </button>
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
                  : Array.from(new Set(courses.map(c => c.departmentId))).map((depId: string) => ({
                      id: depId,
                      name: depId === 'computing'
                        ? 'Department of Computing and Technology'
                        : depId === 'business'
                          ? 'Department of Business Administration'
                          : `Department of ${depId.toUpperCase()}`
                    }));

                return departmentsList.map((dept) => {
                  const deptCourses = courses.filter(c => c.departmentId === dept.id);
                  const isComputing = dept.id === 'computing';
                  const isBusiness = dept.id === 'business';
                  
                  // Accent color mapping
                  const dotColor = isComputing ? 'bg-indigo-600' : isBusiness ? 'bg-amber-500' : 'bg-rose-500';
                  const borderBorder = isComputing ? 'border-indigo-100' : isBusiness ? 'border-rose-100' : 'border-slate-150';
                  const textHeaderColor = isComputing ? 'text-indigo-950' : isBusiness ? 'text-amber-950' : 'text-slate-800';
                  
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
                          const selectedStyle = isComputing 
                            ? 'bg-indigo-50/50 border-indigo-600 text-slate-900 shadow-sm ring-1 ring-indigo-600 pl-3.5 border-l-4 border-l-indigo-600'
                            : isBusiness
                              ? 'bg-amber-50/15 border-amber-600 text-slate-900 shadow-sm ring-1 ring-amber-600 pl-3.5 border-l-4 border-l-amber-500'
                              : 'bg-rose-50/15 border-rose-600 text-slate-900 shadow-sm ring-1 ring-rose-600 pl-3.5 border-l-4 border-l-rose-500';
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
                                      ? (isComputing ? 'bg-indigo-100 text-indigo-700' : isBusiness ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700') 
                                      : 'bg-slate-200 text-slate-650'
                                  }`}>
                                    {c.code}
                                  </span>
                                  {c.programId && (
                                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md tracking-wide ${
                                      isSelected
                                        ? (isComputing ? 'bg-indigo-100/70 text-indigo-850' : isBusiness ? 'bg-amber-100/70 text-amber-850' : 'bg-rose-100/70 text-rose-850') 
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
                                  {c.creditHours} Cr. Hr • {c.students.length} Students
                                </p>
                              </div>
                              
                              {/* Action buttons */}
                              <div className="flex items-center gap-1 shrink-0 self-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditCourse(c);
                                  }}
                                  className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-indigo-605 transition-colors cursor-pointer"
                                  title="Edit Course Specification"
                                >
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCourse(c.id);
                                  }}
                                  className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                  title="Delete Course Specification"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
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

              {/* DEFINED COURSE ACTION */}
              <button
                onClick={() => setIsAddingCourse(true)}
                className="w-full mt-4 flex items-center justify-center gap-2 py-2 border-2 border-dashed border-slate-250 hover:border-indigo-600 hover:bg-indigo-50/10 rounded-xl text-xs font-bold text-slate-600 hover:text-indigo-700 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Define Course Specification</span>
              </button>



            </div>
            )}

            {/* RIGHT COLUMN: MAIN OUTCOME ASSESSMENT INTERFACES */}
            <div className={`${showSidebar ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-6`}>
              
              {selectedCourse ? (
                <>
                  {/* INSTRUCTOR CONTENT HEADER */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-350 pb-3 gap-3">
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans flex items-center gap-2">
                        <BookOpenCheck className="w-5 h-5 text-indigo-600" />
                        {selectedCourse.code} — {selectedCourse.title}
                      </h2>
                    </div>
                  </div>

                  {/* TAB PANES */}
                  <div className="bg-white/85 border border-slate-200/80 backdrop-blur-md rounded-2xl p-4 sm:p-6 shadow-md text-slate-800">
                    {/* TAB 1: SET WEIGHTAGE */}
                    {activeTab === 'weightage' && selectedCourse && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* Weightage Data Grid left column */}
                    <div className="lg:col-span-7 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                              <th className="py-2.5 px-4 w-12 text-center">Sel</th>
                              <th className="py-2.5 px-4">Marks Title</th>
                              <th className="py-2.5 px-4 text-center border-l border-slate-200/60 bg-indigo-50/10">Percentage</th>
                              <th className="py-2.5 px-4 text-center border-l border-slate-200/60">No of Units</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-mono text-slate-755">
                            {tempCategories.map((item, idx) => (
                              <tr
                                key={item.name}
                                onClick={() => setSelectedWeightIndex(idx)}
                                className={`cursor-pointer transition-colors ${
                                  selectedWeightIndex === idx
                                    ? 'bg-indigo-50/50 text-indigo-950 font-bold border-l-4 border-l-indigo-600'
                                    : 'hover:bg-slate-50'
                                }`}
                              >
                                <td className="py-2.5 px-4 text-center">
                                  <div className="flex items-center justify-center">
                                    {selectedWeightIndex === idx ? (
                                      <span className="text-indigo-600 text-[10px]">▶</span>
                                    ) : (
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-4 font-sans text-slate-800">
                                  {item.name}
                                </td>
                                <td className="py-2.5 px-4 text-center font-bold text-indigo-600 border-l border-slate-200/60 bg-indigo-50/10">
                                  {item.percentage}%
                                </td>
                                <td className="py-2.5 px-4 text-center text-slate-650 border-l border-slate-200/60">
                                  {item.units}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50 border-t border-slate-200 text-xs font-semibold text-slate-800">
                              <td colSpan={2} className="py-2.5 px-4 text-right pr-4 font-sans text-slate-550 border-r border-slate-150">
                                Total Weightage:
                              </td>
                              <td className="py-2.5 px-4 text-center bg-white border-r border-slate-150">
                                <span className={`px-2 py-0.5 rounded font-mono text-xs font-extrabold ${
                                  currentTotalWeight === 100
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                    : 'bg-rose-50 text-rose-700 border border-rose-300 animate-pulse'
                                }`}>
                                  {currentTotalWeight.toFixed(2)}%
                                </span>
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* Row Editor Card right column */}
                    <div className="lg:col-span-5">
                      {tempCategories[selectedWeightIndex] ? (
                        <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-4 space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <span className="text-[10px] font-mono text-indigo-600 uppercase tracking-widest font-extrabold">
                              Active Component Editor
                            </span>
                            <span className="text-xs font-bold text-indigo-950 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-lg">
                              {tempCategories[selectedWeightIndex].name}
                            </span>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-[10px] uppercase tracking-wider text-slate-600 mb-1 font-bold font-mono">
                                Category Percentage (%)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={editWeightPercent}
                                onChange={(e) => handleWeightPercentChange(e.target.value)}
                                className="bg-white text-slate-950 text-xs px-3 py-1.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none w-full font-mono font-bold"
                              />
                              <p className="text-[10px] text-slate-500 mt-1 font-sans">
                                Percentage weight of student's aggregate.
                              </p>
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase tracking-wider text-slate-600 mb-1 font-bold font-mono">
                                Number of Units
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="20"
                                value={editWeightUnits}
                                onChange={(e) => handleWeightUnitsChange(e.target.value)}
                                className="bg-white text-slate-950 text-xs px-3 py-1.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none w-full font-mono font-bold"
                              />
                              <p className="text-[10px] text-slate-500 mt-1 font-sans">
                                Number of assessment units (e.g. 3 quizzes).
                              </p>
                            </div>
                          </div>

                          <div className="flex justify-end pt-2">
                            <button
                              onClick={handleUpdateCategorySingle}
                              className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer text-center"
                            >
                              Update Highlighted Row
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-[#f8fafc] border border-dashed border-slate-300 rounded-xl p-6 text-center text-slate-450 text-xs">
                          Select a row to adjust values
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submission and reset actions */}
                  <div className="pt-4 border-t border-slate-200 space-y-3">
                    {saveStatus === 'error-over' && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs font-sans shadow-2xs">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <div>
                          <span className="font-bold">Error:</span> Total weightage must be exactly 100%. Currently it is <strong className="font-mono">{currentTotalWeight.toFixed(2)}%</strong> (which is greater than 100%). Please set the total weightage to 100%.
                        </div>
                      </div>
                    )}
                    {saveStatus === 'error-under' && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs font-sans shadow-2xs">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <div>
                          <span className="font-bold">Error:</span> Total weightage must be exactly 100%. Currently it is <strong className="font-mono">{currentTotalWeight.toFixed(2)}%</strong> (which is less than 100%). Please set the total weightage to 100%.
                        </div>
                      </div>
                    )}
                    {saveStatus === 'success' && (
                      <div className="bg-emerald-50 border border-emerald-300 border-l-4 border-l-emerald-600 p-3.5 rounded-xl flex items-start gap-3 shadow-2xs animate-fade-in text-xs font-sans">
                        <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">Saved Successfully</h4>
                          <p className="text-[11px] text-emerald-850 mt-1 font-sans font-medium">
                            Weightage configuration updated successfully!
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[11px] text-slate-500 font-sans">
                        Changes above require selecting <strong className="font-bold">Ok</strong> to finalize.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleResetWeightage}
                          className="px-4 py-1.5 hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveAllWeightage}
                          className={`px-5 py-1.5 text-white text-xs font-bold rounded-lg shadow-md flex items-center gap-1.5 transition-all ${
                            saveStatus === 'success'
                              ? 'bg-emerald-600 hover:bg-emerald-700 font-extrabold px-6 scale-105'
                              : saveStatus === 'error-over'
                              ? 'bg-rose-600 hover:bg-rose-700 scale-105'
                              : saveStatus === 'error-under'
                              ? 'bg-rose-600 hover:bg-rose-700 scale-105'
                              : 'bg-indigo-600 hover:bg-indigo-700'
                          }`}
                        >
                          <Save className="w-3.5 h-3.5" />
                          Ok
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: EDIT ITEMS */}
              {activeTab === 'edit-items' && selectedCourse && (
                <div className="space-y-6">
                  
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                      <ClipboardList className="w-4 h-4 text-indigo-600" />
                      Configure Category Unit Marks Details
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Choose an assessment item below to adjust each individual unit's total marks and relative weights. Items set to 0% cannot have unit configs.
                    </p>
                  </div>

                  {/* Categories Selector list representing the dropdown items visually */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selectedCourse.categories.map(cat => {
                      const hasWeight = cat.percentage > 0;
                      return (
                        <div
                          key={cat.name}
                          onClick={() => handleOpenUnitEditor(cat.name)}
                          className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                            hasWeight
                              ? 'bg-white border-slate-200 hover:border-indigo-600/80 hover:bg-slate-50/50 hover:shadow-sm relative overflow-hidden group'
                              : 'bg-slate-100/40 border-dashed border-slate-300 opacity-60 hover:opacity-100 hover:border-slate-400'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-xs font-bold text-slate-800 select-none whitespace-nowrap">
                              {cat.name}
                            </h4>
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold ${
                              hasWeight ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-200 text-slate-500'
                            }`}>
                              {cat.percentage}% Weight
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 font-mono">
                            <span>Units: {cat.units}</span>
                            <span className="text-indigo-650 opacity-0 group-hover:opacity-100 font-bold transition-opacity font-sans">
                              Edit Units &rarr;
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Note: Assessment Design Principle is persistently mounted at the base of the left sidebar list context. */}

                </div>
              )}

              {/* TAB 3: REGISTER STUDENTS */}
              {activeTab === 'students' && selectedCourse && (
                <div className="space-y-6">
                  

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* ENROLL FORM */}
                    <div className="lg:col-span-4 space-y-6">
                      
                      <form onSubmit={handleAddNewStudent} className="bg-[#f8fafc] p-4 rounded-xl border border-slate-205 shadow-xs space-y-4">
                        <h4 className="text-xs uppercase tracking-wider font-bold text-indigo-950 border-b border-slate-200 pb-2">
                          Single Enrollment
                        </h4>

                        <div>
                          <label className="block text-[10px] text-slate-600 uppercase font-mono font-bold mb-1">
                            Registration Number *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. FA-2017/BS EE-045"
                            value={newStudentReg}
                            onChange={(e) => setNewStudentReg(e.target.value)}
                            className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-slate-950 text-xs w-full outline-none focus:ring-2 focus:ring-indigo-150 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-600 uppercase font-mono font-bold mb-1">
                            Student Name (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Muhammad Ali"
                            value={newStudentName}
                            onChange={(e) => setNewStudentName(e.target.value)}
                            className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-slate-950 text-xs w-full outline-none focus:ring-2 focus:ring-indigo-150"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
                        >
                          Enroll Student
                        </button>
                      </form>

                      {/* BULK UPLOAD FORM (Excel Sheet Import) */}
                      <div className="bg-[#f8fafc] p-4 rounded-xl border border-slate-205 shadow-xs space-y-4 font-sans text-slate-800">
                        <h4 className="text-xs uppercase tracking-wider font-bold text-indigo-950 border-b border-slate-200 pb-2 flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          Import from Excel / CSV Sheet
                        </h4>

                        {!fileName ? (
                          <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById('excel-file-picker')?.click()}
                            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 ${
                              isDragging 
                                ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 scale-[1.01]' 
                                : 'border-slate-300 hover:border-indigo-500 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              id="excel-file-picker"
                              type="file"
                              accept=".xlsx,.xls,.csv"
                              onChange={handleFileChange}
                              className="hidden"
                            />
                            <Upload className={`w-8 h-8 transition-transform duration-200 ${isDragging ? 'text-indigo-600 animate-bounce' : 'text-slate-400'}`} />
                            <div>
                              <p className="text-xs font-bold text-slate-800">
                                Click to select or drag & drop excel file
                              </p>
                              <p className="text-[10px] text-slate-500 mt-1">
                                Supports Excel (.xlsx, .xls) and CSV (.csv) stylesheets
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3 bg-white border border-slate-200 rounded-lg p-3">
                            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 truncate" title={fileName}>
                                    {fileName}
                                  </p>
                                  <p className="text-[10px] text-emerald-600 font-semibold font-mono">
                                    {parsedStudents.length} student records parsed successfully
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setFileName('');
                                  setParsedStudents([]);
                                }}
                                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded transition-colors text-[10px] font-bold font-mono cursor-pointer"
                              >
                                Clear
                              </button>
                            </div>

                            {parsedStudents.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-[10px] text-slate-500 uppercase font-mono font-bold">
                                  Preview (First 3 parsed rows)
                                </p>
                                <div className="border border-slate-100 rounded-lg overflow-hidden bg-slate-50/50">
                                  <table className="w-full text-left text-[10px] font-sans">
                                    <thead>
                                      <tr className="bg-slate-100 text-slate-655 font-bold border-b border-slate-200">
                                        <th className="py-1 px-2.5">Reg Number</th>
                                        <th className="py-1 px-2.5">Student Name</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-mono text-slate-705">
                                      {parsedStudents.slice(0, 3).map((std, i) => (
                                        <tr key={i}>
                                          <td className="py-1 px-2.5 font-bold uppercase text-indigo-900">{std.regNo}</td>
                                          <td className="py-1 px-2.5 max-w-[120px] truncate">{std.name}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {parsedStudents.length > 3 && (
                                    <p className="text-[9px] text-slate-500 italic p-1 bg-white text-center border-t border-slate-100 border-b">
                                      ... and {parsedStudents.length - 3} more student records
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            <button
                              onClick={handleExcelImportExecute}
                              disabled={parsedStudents.length === 0}
                              className={`w-full py-2 font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs border text-center ${
                                parsedStudents.length > 0
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              }`}
                            >
                              Enroll parsed students
                            </button>
                          </div>
                        )}

                        <div className="bg-amber-50/85 border-l-4 border-amber-500 p-2.5 rounded text-[10px] text-amber-900 leading-relaxed max-w-full">
                          <strong className="font-bold flex items-center gap-1 text-amber-955 mb-0.5 uppercase tracking-wide">
                            <Info className="w-3.5 h-3.5 text-amber-600" />
                            Format requirement:
                          </strong>
                          Sheet layout must have <strong className="font-bold font-mono">Registration No</strong> as column 1 (Column A) and <strong className="font-bold font-mono text-xs">Student Name</strong> as column 2 (Column B). Header row is skipped automatically.
                        </div>
                      </div>

                    </div>

                    {/* ENROLLED MATRIX */}
                    <div className="lg:col-span-8 bg-white rounded-xl border border-slate-205 overflow-hidden shadow-xs">
                      <div className="overflow-auto max-h-[380px]">
                        <table className="w-full text-left text-xs font-sans relative">
                          <thead className="sticky top-0 bg-slate-50 z-20 shadow-xs border-b border-slate-200">
                            <tr className="bg-slate-50 text-slate-705 font-bold">
                              <th className="py-2.5 px-4 w-12 text-center sticky top-0 bg-slate-50 z-20">S.#</th>
                              <th className="py-2.5 px-4 font-sans sticky top-0 bg-slate-50 z-20">Registration No.</th>
                              <th className="py-2.5 px-4 font-sans sticky top-0 bg-slate-50 z-20">Student Name</th>
                              <th className="py-2.5 px-4 text-center w-28 font-sans sticky top-0 bg-slate-50 z-20">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-mono text-slate-700">
                          {selectedCourse.students.map((student, index) => {
                            const isEditing = editingStudentReg === student.regNo;
                            return (
                              <tr key={student.regNo} className={isEditing ? "bg-indigo-50/40" : "hover:bg-slate-55"}>
                                <td className="py-3 px-4 text-center text-slate-400 font-mono">
                                  {index + 1}
                                </td>
                                {isEditing ? (
                                  <>
                                    <td className="py-2 px-3">
                                      <input
                                        type="text"
                                        value={editStudentRegVal}
                                        onChange={(e) => setEditStudentRegVal(e.target.value)}
                                        className="bg-white border border-slate-300 rounded px-2 py-1 text-indigo-700 font-bold font-mono text-[11px] w-full focus:ring-2 focus:ring-indigo-400 outline-none"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleUpdateStudentDetail(student.regNo);
                                          if (e.key === 'Escape') handleCancelEditStudent();
                                        }}
                                        autoFocus
                                      />
                                    </td>
                                    <td className="py-2 px-3">
                                      <input
                                        type="text"
                                        value={editStudentNameVal}
                                        onChange={(e) => setEditStudentNameVal(e.target.value)}
                                        className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-sans text-xs w-full focus:ring-2 focus:ring-indigo-400 outline-none"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleUpdateStudentDetail(student.regNo);
                                          if (e.key === 'Escape') handleCancelEditStudent();
                                        }}
                                      />
                                    </td>
                                    <td className="py-2 px-4 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          onClick={() => handleUpdateStudentDetail(student.regNo)}
                                          className="text-emerald-600 hover:text-emerald-700 p-1.5 rounded hover:bg-emerald-50 transition-all font-sans cursor-pointer"
                                          title="Save changes"
                                        >
                                          <Check className="w-3.5 h-3.5 mx-auto" />
                                        </button>
                                        <button
                                          onClick={handleCancelEditStudent}
                                          className="text-slate-400 hover:text-slate-600 p-1.5 rounded hover:bg-slate-100 transition-all font-sans cursor-pointer"
                                          title="Cancel edit"
                                        >
                                          <X className="w-3.5 h-3.5 mx-auto" />
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="py-3 px-4 text-indigo-650 font-bold font-mono text-[11px]">
                                      {student.regNo}
                                    </td>
                                    <td className="py-3 px-4 font-sans text-slate-800">
                                      {student.name}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button
                                          onClick={() => handleStartEditStudent(student)}
                                          className="text-slate-400 hover:text-indigo-600 p-1.5 rounded hover:bg-indigo-50 transition-all font-sans cursor-pointer"
                                          title="Edit student details"
                                        >
                                          <Pencil className="w-3.5 h-3.5 mx-auto" />
                                        </button>
                                        <button
                                          onClick={() => handleUnenrollStudent(student.regNo)}
                                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50 transition-all font-sans cursor-pointer"
                                          title="Unenroll student"
                                        >
                                          <Trash2 className="w-3.5 h-3.5 mx-auto" />
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                          {selectedCourse.students.length === 0 && (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-500 font-sans">
                                No students enrolled yet. Register students to view the assessment grid.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: CLO SPECIFICATION */}
            {activeTab === 'clo' && selectedCourse && (
              <div id="clo-setup-view" className="space-y-6 animate-fadeIn">
                <div className="bg-[#f8fafc] border-b border-slate-200 pb-4">
                  <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded border border-indigo-150">Course Learning Outcomes</span>
                  <h3 className="text-base font-extrabold text-slate-900 mt-1 flex items-center gap-1.5 font-sans">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    CLO Setup & Management
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Configure the exact number of active Course Learning Outcomes (CLOs) for {selectedCourse.code}. This will dynamically adjust the mapping checklists throughout the portal.
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold font-sans text-slate-700">
                      Total Number of CLOs for {selectedCourse.code} — {selectedCourse.title}
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="clo-count-input"
                        type="number"
                        min="1"
                        max="20"
                        defaultValue={selectedCourse.cloCount || 4}
                        className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-950 w-32 font-mono outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <button
                        onClick={() => {
                          const inputVal = (document.getElementById('clo-count-input') as HTMLInputElement)?.value;
                          const newCount = parseInt(inputVal) || 4;
                          if (newCount < 1 || newCount > 20) {
                            alert("Please enter a valid number of CLOs between 1 and 20.");
                            return;
                          }
                          // Save to courses state
                          setCourses(prev => prev.map(c => {
                            if (c.id === selectedCourse.id) {
                              return { ...c, cloCount: newCount };
                            }
                            return c;
                          }));
                          setSaveStatus('success');
                          setTimeout(() => setSaveStatus('idle'), 3000);
                        }}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 font-sans"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save CLOs
                      </button>
                    </div>
                  </div>

                  {saveStatus === 'success' && (
                    <div className="bg-emerald-50 border border-emerald-250 text-emerald-700 px-4 py-2.5 rounded-lg flex items-center gap-2 text-xs font-sans shadow-2xs">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold">Success:</span> Saved {selectedCourse.cloCount || 4} CLO components for this course successfully!
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-700 mb-2.5 font-sans">
                      Active Course Outcomes List:
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: selectedCourse.cloCount || 4 }, (_, idx) => (
                        <div 
                          key={idx}
                          className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold font-mono shadow-3xs flex items-center gap-1.5"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                          CLO-{idx + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: GRADING SYSTEM SETUP */}
            {activeTab === 'grading-system' && selectedCourse && (
              <div id="grading-system-view" className="space-y-6 animate-fadeIn">
                <div className="bg-[#f8fafc] border-b border-slate-200 pb-4">
                  <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded border border-indigo-150">Grading Configuration</span>
                  <h3 className="text-base font-extrabold text-slate-900 mt-1 flex items-center gap-1.5 font-sans">
                    <Award className="w-4 h-4 text-indigo-600" />
                    Course Grading System Setup
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Configure and select the active evaluation scheme. Select a standard ready-made template or build a customized grading structure below.
                  </p>
                </div>

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
                              { grade: 'C+', percentage: '60% - 64%', points: '2.3' },
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
                            <input 
                              type="text"
                              value={row.percentage}
                              onChange={(e) => {
                                const list = JSON.parse(JSON.stringify(tempCustomGrades || selectedCourse.customGradingSystem || DEFAULT_CUSTOM_GRADES));
                                list[idx].percentage = e.target.value;
                                setTempCustomGrades(list);
                              }}
                              className="flex-1 text-xs text-center text-slate-800 bg-white border border-slate-300 rounded px-1.5 py-0.5 font-mono outline-none focus:border-indigo-500"
                              placeholder="e.g. 80% - 84%"
                            />
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
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 cursor-default'
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
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-mono text-slate-700">
                          {selectedCourse.students.map((std, idx) => {
                            const activeCats = selectedCourse.categories.filter(c => c.percentage > 0);
                            
                            let aggregate = 0;
                            const catGrades = activeCats.map(cat => {
                              let catSum = 0;
                              let totalWeightSum = 0;
                              const existingUnits = selectedCourse.unitsData[cat.name] || [];
                              if (cat.units > 0) {
                                for (let u = 1; u <= cat.units; u++) {
                                  const matchingUnit = existingUnits.find(unit => unit.unitNo === u);
                                  const totalMarks = matchingUnit ? matchingUnit.totalMarks : 10;
                                  const weightage = matchingUnit ? matchingUnit.weightage : (100 / cat.units);
                                  
                                  totalWeightSum += weightage;
                                  const mark = getStudentMark(std, cat.name, u, totalMarks, selectedCourse.unitsData);
                                  if (totalMarks > 0) {
                                    catSum += (mark / totalMarks) * weightage;
                                  }
                                }
                              }
                              const divisor = totalWeightSum > 0 ? totalWeightSum : 100;
                              const categoryContribution = (catSum / divisor) * cat.percentage;
                              aggregate += categoryContribution;
                              return parseFloat(categoryContribution.toFixed(1));
                            });

                            return (
                              <tr key={std.regNo} className="hover:bg-slate-55">
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
                              </tr>
                            );
                          })}
                          {selectedCourse.students.length === 0 && (
                            <tr>
                              <td colSpan={4 + selectedCourse.categories.filter(c => c.percentage > 0).length} className="py-8 text-center text-slate-500 font-sans">
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
                    selectedCourse={selectedCourse}
                    setCourses={setCourses}
                    selectedCategoryName={selectedMarksCategoryName}
                    setSelectedCategoryName={setSelectedMarksCategoryName}
                    handleSaveQuestionMark={handleSaveQuestionMark}
                    handleSaveUnitDirectMark={handleSaveUnitDirectMark}
                    handleAddInlineQuestion={handleAddInlineQuestion}
                    handleWizardPartition={handleWizardPartition}
                    handleClearInlineQuestions={handleClearInlineQuestions}
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
                                        <span className="text-[9px] font-black bg-emerald-100 border border-emerald-200 text-emerald-800 rounded px-1.5 py-0.2 select-none font-mono">
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
                                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-150' 
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
                                      <span className="text-[14px] font-black text-emerald-600 font-mono">
                                        {localPassRate.toFixed(0)}%
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
                                      <table className="w-full text-left border-collapse text-xs table-fixed">
                                        <thead className="bg-[#f8fafc] border-b border-slate-200 select-none">
                                          <tr className="divide-x divide-slate-200 font-semibold text-slate-600 text-center">
                                            <th className="py-2.5 w-12 sticky left-0 bg-[#f8fafc] z-10">S.#</th>
                                            <th className="py-2.5 w-28 sticky left-12 bg-[#f8fafc] z-10 text-left pl-3">Reg No</th>
                                            <th className="py-2.5 w-40 sticky left-40 bg-[#f8fafc] z-10 text-left pl-3">Student Name</th>
                                            
                                            {unitQuestions.map(q => (
                                              <th key={q.id} className="py-2.5 w-24 bg-white font-sans text-center">
                                                <div className="flex flex-col items-center justify-center space-y-0.5 leading-tight">
                                                  <span className="font-extrabold text-slate-800 tracking-wide">{q.name}</span>
                                                  <span className="text-[9px] text-[#4f46e5] font-mono">Max {q.maxMarks}m</span>
                                                  {q.mappedCLOs && q.mappedCLOs.length > 0 && (
                                                    <span className="text-[8.5px] font-bold bg-amber-50 border border-amber-200 text-amber-805 rounded px-1 scale-95 origin-center font-mono">
                                                      {q.mappedCLOs.join(', ')}
                                                    </span>
                                                  )}
                                                </div>
                                              </th>
                                            ))}
                                            
                                            <th className="py-2.5 w-24 bg-indigo-50/50 text-[#4f46e5] font-black font-sans text-center">Obtained</th>
                                            <th className="py-2.5 w-20 bg-[#f8fafc] text-center">Percent</th>
                                            <th className="py-2.5 w-20 bg-[#f8fafc] text-center">Status</th>
                                          </tr>
                                        </thead>
                                        
                                        <tbody className="divide-y divide-slate-150 font-mono text-slate-700">
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
                                              const scorePercent = totalMarksMax > 0 ? ((obtainedScore / totalMarksMax) * 100).toFixed(0) : '0';

                                              return (
                                                <tr key={student.regNo} className="group hover:bg-slate-50/30 divide-x divide-slate-150">
                                                  <td className="p-2 text-center text-slate-400 bg-slate-50 group-hover:bg-[#f8fafc] sticky left-0 z-10 transition-colors">
                                                    {stdIdx + 1}
                                                  </td>
                                                  <td className="p-2 pl-3 font-extrabold text-indigo-950 bg-white group-hover:bg-[#fafbff] sticky left-12 z-10 text-[10.5px] tracking-wide truncate transition-colors">
                                                    {student.regNo}
                                                  </td>
                                                  <td className="p-2 pl-3 font-bold text-slate-700 bg-white group-hover:bg-[#fafbff] sticky left-40 z-10 text-left truncate transition-colors">
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
                                                              const numVal = val === '' ? 0 : parseFloat(val);
                                                              handleSaveQuestionMark(student.regNo, curCat, curUnit, q.id, numVal);
                                                            }
                                                          }}
                                                          onBlur={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            if (isNaN(val) || val < 0) {
                                                              handleSaveQuestionMark(student.regNo, curCat, curUnit, q.id, 0);
                                                            } else if (val > q.maxMarks) {
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
                                                        ? 'bg-emerald-50 border-emerald-250 text-emerald-800' 
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
                                        <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-705 shadow-sm">
                                          <tr className="divide-x divide-slate-150 text-center">
                                            <td colSpan={3} className="py-2.5 font-sans font-bold text-[10px] uppercase text-slate-500 sticky left-0 bg-slate-50 z-10 border-r text-center">
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
                                                <td key={q.id} className="py-2.5 bg-white">
                                                  <span className="text-slate-955 block font-black text-xs">{avg.toFixed(1)}</span>
                                                  <span className="text-[9px] text-slate-400 font-normal">{avgPercent.toFixed(0)}% avg</span>
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
                                                  <td className="py-2.5 text-indigo-650 bg-indigo-50/20 font-black text-xs text-center">
                                                    {overallAverage.toFixed(1)} / {totalMarksMax}
                                                  </td>
                                                  <td className="py-2.5 bg-slate-50 text-center font-bold text-slate-650">
                                                    {overallAveragePct.toFixed(0)}%
                                                  </td>
                                                  <td className="py-2.5 bg-slate-50 border-r-0"></td>
                                                </>
                                              );
                                            })()}
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  </div>

                                  {/* INLINE QUESTION MANAGEMENT DESK */}
                                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-3xs space-y-4">
                                    <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                                      <div>
                                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Live Question Matrix Editor</h4>
                                        <p className="text-[10.5px] text-slate-500 mt-0.5 font-sans">Modify labels, assign scores, or alter Course Outcomes dynamically without switching screens.</p>
                                      </div>
                                      <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-[#4f46e5] text-[10px] font-black rounded font-mono uppercase tracking-wider">
                                        Active
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {/* CURRENT LIST */}
                                      <div className="space-y-2 border border-slate-100 rounded-lg p-3 bg-slate-50/50 max-h-52 overflow-y-auto">
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block font-sans">Active Subquestions</span>
                                        {unitQuestions.map((q, qIndex) => (
                                          <div key={q.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200">
                                            <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded text-indigo-700 bg-indigo-50">
                                                Q{qIndex + 1}
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
                                                      return {
                                                        ...c,
                                                        unitsData: { ...c.unitsData, [curCat]: nextU }
                                                      };
                                                    }
                                                    return c;
                                                  }));
                                                }}
                                                className="text-rose-500 hover:text-rose-755 p-1 hover:bg-rose-50 rounded transition-all cursor-pointer"
                                                title="Delete question"
                                              >
                                                <Trash className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>

                                      {/* ADD QUESTION INLINE */}
                                      <div className="bg-white border border-slate-205 p-3 rounded-lg space-y-3 z-10 shadow-2xs">
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block font-sans">Quick Create Question</span>
                                        
                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Label</label>
                                            <input
                                              type="text"
                                              value={inlineQName}
                                              onChange={(e) => setInlineQName(e.target.value)}
                                              placeholder="e.g. Q1a"
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
                                                    setInlineQMappedCLOs(prev => {
                                                      if (prev.includes(clo)) return prev.filter(c => c !== clo);
                                                      return [...prev, clo];
                                                    });
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
                                              alert("Please enter a question label (e.g. Q1).");
                                              return;
                                            }
                                            const marks = parseFloat(inlineQMaxMarks);
                                            if (isNaN(marks) || marks <= 0) {
                                              alert("Please enter a valid positive number for marks.");
                                              return;
                                            }
                                            if (inlineQMappedCLOs.length === 0) {
                                              alert("Please map this question to at least one CLO target.");
                                              return;
                                            }
                                            
                                            handleAddInlineQuestion(curCat, curUnit, inlineQName, marks, inlineQMappedCLOs);
                                            setInlineQName('');
                                            setInlineQMappedCLOs([]);
                                          }}
                                          className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5 font-sans cursor-pointer"
                                        >
                                          <Plus className="w-3.5 h-3.5" />
                                          Add Question to Matrix
                                        </button>
                                      </div>
                                    </div>
                                  </div>
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
                                            <tr className="divide-x divide-slate-200 font-semibold text-slate-600 text-center">
                                              <th className="py-2.5 w-12 sticky left-0 bg-[#f8fafc] z-10">S.#</th>
                                              <th className="py-2.5 w-28 sticky left-12 bg-[#f8fafc] z-10 text-left pl-3">Reg No</th>
                                              <th className="py-2.5 w-40 sticky left-40 bg-[#f8fafc] z-10 text-left pl-3">Student Name</th>
                                              <th className="py-2.5 bg-white text-center text-[#4f46e5] font-black">Obtained score</th>
                                              <th className="py-2.5 w-20 bg-[#f8fafc]">Percent</th>
                                              <th className="py-2.5 w-20 bg-[#f8fafc]">Status</th>
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
                                                const scorePercentStr = totalMarksMax > 0 ? ((rawPoints / totalMarksMax) * 100).toFixed(0) : '0';

                                                return (
                                                  <tr key={student.regNo} className="group hover:bg-slate-50/30 divide-x divide-slate-150">
                                                    <td className="p-2 text-center text-slate-400 bg-slate-50 group-hover:bg-[#f8fafc] sticky left-0 z-10 transition-colors">
                                                      {stdIdx + 1}
                                                    </td>
                                                    <td className="p-2 pl-3 font-extrabold text-indigo-950 bg-white group-hover:bg-[#fafbff] sticky left-12 z-10 text-[10.5px] tracking-wide truncate transition-colors">
                                                      {student.regNo}
                                                    </td>
                                                    <td className="p-2 pl-3 font-bold text-slate-700 bg-white group-hover:bg-[#fafbff] sticky left-40 z-10 text-left truncate transition-colors">
                                                      {student.name}
                                                    </td>
                                                    <td className="p-1.5 text-center flex items-center justify-center gap-1.5 bg-white">
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
                                                            handleSaveUnitDirectMark(student.regNo, curCat, curUnit, numVal);
                                                          }
                                                        }}
                                                        onBlur={(e) => {
                                                          const val = parseFloat(e.target.value);
                                                          if (isNaN(val) || val < 0) {
                                                            handleSaveUnitDirectMark(student.regNo, curCat, curUnit, 0);
                                                          } else if (val > totalMarksMax) {
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
                                                    
                                                    <td className="p-2 text-center text-slate-500 font-bold bg-white">
                                                      {scorePercentStr}%
                                                    </td>

                                                    <td className="p-2 text-center bg-white">
                                                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black border ${
                                                        isPassed 
                                                          ? 'bg-emerald-50 border-emerald-250 text-emerald-805' 
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
                                              <td colSpan={3} className="py-2.5 font-sans font-bold text-[10px] uppercase text-slate-500 sticky left-0 bg-slate-50 z-10 border-r text-center">
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
                                                    <td className="py-2.5 bg-white text-center text-indigo-650 font-black text-xs">
                                                      {average.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">/ {totalMarksMax}</span>
                                                    </td>
                                                    <td className="py-2.5 bg-white text-slate-600 text-center">
                                                      {avgPercent.toFixed(0)}%
                                                    </td>
                                                    <td className="py-2.5 bg-white border-r-0"></td>
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
                                                alert("Please enter a question label (e.g. Q1).");
                                                return;
                                              }
                                              const marks = parseFloat(inlineQMaxMarks);
                                              if (isNaN(marks) || marks <= 0) {
                                                alert("Please enter a valid positive number for marks.");
                                                return;
                                              }
                                              if (inlineQMappedCLOs.length === 0) {
                                                alert("Please associate this question with at least one Course Learning Outcome (CLO).");
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
                            Map to CLOs (Tick Boxes)
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
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      if (checked) {
                                        setQClos(prev => prev.filter(c => c !== clo));
                                      } else {
                                        setQClos(prev => [...prev, clo]);
                                      }
                                    }}
                                    className="accent-indigo-600 rounded text-indigo-600 shrink-0 cursor-pointer text-xs"
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
                                  {selectedCourse.students.map((student) => (
                                    <tr key={student.regNo} className="hover:bg-slate-50/50 font-medium text-slate-700 text-xs">
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
                                                let num = parseFloat(e.target.value);
                                                if (isNaN(num)) num = 0;
                                                if (num < 0) num = 0;
                                                if (num > q.maxMarks) num = q.maxMarks;
                                                handleSaveObeMark(student.regNo, q.id, num);
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

                  {/* SUB-TAB 3: CLO REPORTS */}
                  {obeSubTab === 'reports' && (
                    <div className="space-y-6">
                      
                      {/* Overall CLO Attainments Visual Gauge cards */}
                      {(() => {
                        const students = selectedCourse.students;
                        const qs = selectedCourse.obeQuestions || [];
                        const marks = selectedCourse.obeMarks || {};

                        const cloPerformance = Array.from({ length: selectedCourse.cloCount || 4 }, (_, i) => `CLO-${i + 1}`).map(clo => {
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
                                    <span className="text-xs font-black text-indigo-950 uppercase tracking-widest">{clo.name}</span>
                                    <span className="text-[10px] bg-indigo-50 border border-indigo-200/50 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                                      {clo.mappedQs} Qs
                                    </span>
                                  </div>

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
                                      <span className={`font-bold font-mono ${clo.attainmentRate >= 60 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                        {clo.attainmentRate.toFixed(1)}%
                                      </span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                                      <div
                                        className={`h-1.5 rounded-full transition-all duration-500 ${clo.attainmentRate >= 60 ? 'bg-emerald-500' : 'bg-amber-500'}`}
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
                                  onClick={() => window.print()}
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
                                      {Array.from({ length: selectedCourse.cloCount || 4 }, (_, i) => `CLO-${i + 1}`).map(clo => (
                                        <th key={clo} className="py-2.5 px-3 text-center border-r border-slate-200 font-bold bg-slate-100/10">
                                          {clo} (%)
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
 
                                      const cellRender = Array.from({ length: selectedCourse.cloCount || 4 }, (_, i) => `CLO-${i + 1}`).map(clo => {
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
                                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${attained ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
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
                                              <span className={`px-3 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${isComprehensiveAttained ? 'bg-emerald-600 text-white shadow-xs' : 'bg-amber-100 text-amber-800'}`}>
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
                      })()}

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
                  <div className="bg-emerald-50 border border-emerald-300 border-l-4 border-l-emerald-600 p-3.5 rounded-xl flex items-start gap-3 shadow-2xs animate-fade-in">
                    <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">Saved Successfully</h4>
                      <p className="text-[11px] text-emerald-850 mt-1 font-sans">
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
                              : "text-emerald-600 font-extrabold pb-0.5 px-1 bg-emerald-50 border border-emerald-200 rounded"
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
                {tempUnits[selectedUnitIndex] && (
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
                            ? "✨ Summed and locked from sub-questions below."
                            : "Set manually or add question breakdown below."}
                        </p>
                      </div>
                    </div>

                    {/* Highly Professional Questions Mapping Builder */}
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                        <div>
                          <h5 className="text-xs font-bold text-slate-900">Questions & CLO Mapping</h5>
                          <p className="text-[10.5px] text-slate-500 mt-0.5">Define detailed questions and map each individually to Course Learning Outcomes (CLOs).</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddSubQuestion}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Question
                        </button>
                      </div>

                      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {!tempUnits[selectedUnitIndex].questions || tempUnits[selectedUnitIndex].questions!.length === 0 ? (
                          <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-white/50">
                            <Sliders className="w-6 h-6 text-slate-350 mx-auto opacity-75 animate-pulse" />
                            <p className="text-[11.5px] font-bold text-slate-500 mt-2">No sub-questions added yet</p>
                            <p className="text-[10px] text-slate-450 mt-0.5 px-4">
                              Click the <strong className="text-indigo-600">Add Question</strong> button above to start partition and map each part of this assessment dynamically to different CLOs.
                            </p>
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
                                    Q{qIdx + 1}
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
                                    title="Remove question"
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

                    <div className="flex justify-between items-center pt-2 border-t border-slate-250">
                      <p className="text-[9.5px] text-slate-450 italic">Sub-question updates synchronize automatically above.</p>
                      <button
                        onClick={handleUpdateUnitSingle}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                      >
                        Update Unit Summary
                      </button>
                    </div>

                  </div>
                )}

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
              className="bg-white border border-slate-250 rounded-2xl w-full max-w-md overflow-hidden text-slate-800 shadow-2xl"
            >
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
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

              <form onSubmit={handleAddNewCourse} className="p-6 space-y-4 font-sans">
                
                <div>
                  <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                    DEPARTMENT ASSOCIATE *
                  </label>
                  <select
                    value={addDeptId}
                    onChange={(e) => {
                      const dept = e.target.value;
                      setAddDeptId(dept);
                      const firstProg = obeData?.programs?.find(p => p.departmentId === dept)?.id || '';
                      setAddProgramId(firstProg);
                    }}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none"
                  >
                    {obeData && obeData.departments && obeData.departments.length > 0 ? (
                      obeData.departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))
                    ) : (
                      <option value="">Loading Departments...</option>
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
                    {obeData && obeData.programs ? (
                      obeData.programs.filter(p => p.departmentId === addDeptId).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))
                    ) : (
                      <option value="">Loading Programs...</option>
                    )}
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

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 mt-6">
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
              className="bg-white border border-slate-250 rounded-2xl w-full max-w-md overflow-hidden text-slate-800 shadow-2xl"
            >
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between font-sans">
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

              <form onSubmit={handleUpdateCourse} className="p-6 space-y-4 font-sans">
                
                <div>
                  <label className="block text-xs text-slate-600 font-mono font-bold mb-1">
                    DEPARTMENT ASSOCIATE *
                  </label>
                  <select
                    value={editDeptId}
                    onChange={(e) => {
                      const dept = e.target.value;
                      setEditDeptId(dept);
                      const firstProg = obeData?.programs?.find(p => p.departmentId === dept)?.id || '';
                      setEditProgramId(firstProg);
                    }}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 text-xs w-full focus:ring-2 focus:ring-indigo-150 outline-none"
                  >
                    {obeData && obeData.departments && obeData.departments.length > 0 ? (
                      obeData.departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))
                    ) : (
                      <option value="">Loading Departments...</option>
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
                    {obeData && obeData.programs ? (
                      obeData.programs.filter(p => p.departmentId === editDeptId).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))
                    ) : (
                      <option value="">Loading Programs...</option>
                    )}
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

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 mt-6">
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

    </div>
  );
}
