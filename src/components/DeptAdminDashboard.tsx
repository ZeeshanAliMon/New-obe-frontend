import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Department, Program, Course, Student, InstructorCourse } from '../types';
import { apiService } from '../services/apiService';
import { DEFAULT_TEMP_PASSWORD } from '../utils/config';
import { 
  BookOpen, 
  Users, 
  GraduationCap, 
  Plus, 
  Check, 
  FileSpreadsheet,
  Upload, 
  Search, 
  RefreshCw, 
  Link, 
  Unlink, 
  Trash2, 
  AlertCircle, 
  Sparkles, 
  LogOut, 
  Layers, 
  UserPlus, 
  Sliders, 
  Download,
  Info,
  BarChart3,
  Lock,
  Award,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  ArrowRight,
  Edit
} from 'lucide-react';
import * as XLSX from 'xlsx';
import FacultyDirectoryTab from './admin/FacultyDirectoryTab';
import { matchTeacher, getTeacherId } from '../utils/teacherUtils';
import { AnimatePresence } from 'motion/react';
import Toast from './Toast';

const getAutomaticAcademicYear = (): string => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth(); // 0 = January, 11 = December
  const currentYear = currentDate.getFullYear();
  // First 6 months (January to June) -> Spring, otherwise Fall
  const term = currentMonth < 6 ? 'Spring' : 'Fall';
  return `${term}-${currentYear}`;
};

const normalizeRegNo = (reg: any): string => {
  if (!reg) return '';
  return String(reg).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
};

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

const normalizeCourseCode = (code: any): string => {
  if (!code) return '';
  return String(code).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
};

const areProgramsCompatible = (prog1: any, prog2: any): boolean => {
  if (!prog1 || !prog2) return true;
  const p1 = String(prog1).trim().toLowerCase();
  const p2 = String(prog2).trim().toLowerCase();
  if (p1 === p2) return true;
  if (p1 === 'all' || p2 === 'all') return true;

  if (p1.includes(p2) || p2.includes(p1)) return true;

  const aliases: Record<string, string[]> = {
    'cs': ['bscs', 'mcs', 'ms-cs', 'phd-cs', 'bs-cs', 'computer science', 'computer-science', 'bachelor of science in computer science'],
    'se': ['bsse', 'ms-se', 'bs-se', 'software engineering', 'software-engineering', 'bachelor of science in software engineering'],
    'ai': ['bsai', 'ms-ai', 'bs-ai', 'artificial intelligence', 'artificial-intelligence', 'bachelor of science in artificial intelligence'],
    'it': ['bsit', 'ms-it', 'bs-it', 'information technology', 'information-technology', 'bachelor of science in information technology'],
    'bscs': ['cs', 'computer science', 'computer-science', 'bachelor of science in computer science'],
    'bsse': ['se', 'software engineering', 'software-engineering', 'bachelor of science in software engineering'],
    'bsai': ['ai', 'artificial intelligence', 'artificial-intelligence', 'bachelor of science in artificial intelligence'],
    'bsit': ['it', 'information technology', 'information-technology', 'bachelor of science in information technology']
  };

  if (aliases[p1]?.includes(p2) || aliases[p2]?.includes(p1)) return true;

  const cleanTerm = (p: string) => {
    let cp = p;
    if (cp.startsWith('bs')) cp = cp.slice(2);
    if (cp.startsWith('ms-') || cp.startsWith('ms')) cp = cp.slice(2);
    if (cp.startsWith('phd-') || cp.startsWith('phd')) cp = cp.slice(3);
    cp = cp.replace(/[-_ ]/g, '');
    if (cp === 'computerscience') return 'cs';
    if (cp === 'softwareengineering') return 'se';
    if (cp === 'artificialintelligence') return 'ai';
    if (cp === 'informationtechnology') return 'it';
    return cp;
  };

  const c1 = cleanTerm(p1);
  const c2 = cleanTerm(p2);
  if (c1 === c2) return true;

  return false;
};

const getAcademicYearOptions = (): string[] => {
  const currentYear = new Date().getFullYear();
  const options: string[] = [];
  // Generate options from currentYear - 3 to currentYear + 2
  for (let y = currentYear - 3; y <= currentYear + 2; y++) {
    options.push(`Spring-${y}`);
    options.push(`Fall-${y}`);
  }
  return options;
};

interface Teacher {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  designation?: string;
  departmentId: string;
  departmentName?: string;
}

interface SemesterPlan {
  programId: string;
  semester: string;
  courseCodes: string[];
}

interface StudentCourseBinding {
  studentRegNo: string;
  courseCode: string;
}

interface TeacherCourseAssignment {
  id?: string | number;
  teacherId: string;
  courseCode: string;
  programId?: string;
  section?: string;
  academicYear?: string;
  status?: 'active' | 'closed';
}

interface DeptAdminDashboardProps {
  onLogout: () => void;
  adminName?: string;
}

export default function DeptAdminDashboard({ onLogout, adminName = "Department Administrator" }: DeptAdminDashboardProps) {
  // Global Data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [semesterPlans, setSemesterPlans] = useState<SemesterPlan[]>([]);
  const [studentBindings, setStudentBindings] = useState<StudentCourseBinding[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherCourseAssignment[]>([]);
  const [adminProfile, setAdminProfile] = useState<{ departmentId?: string; departmentName?: string; employeeId?: string } | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');

  // Find which department this administrator manages.
  const managedDeptId = useMemo(() => {
    if (adminProfile?.departmentId) {
      return adminProfile.departmentId;
    }
    if (departments.length === 1) {
      return departments[0].id;
    }
    const nameLower = adminName.toLowerCase();
    const matched = departments.find(d => {
      const dName = (d.name || '').toLowerCase();
      const dId = (d.id || '').toLowerCase();
      return (dId && nameLower.includes(dId)) || (dName && nameLower.includes(dName));
    });
    if (matched) return matched.id;
    const saved = localStorage.getItem('IQRA_OBE_ADMIN_MANAGED_DEPT');
    if (saved && departments.some(d => d.id === saved)) {
      return saved;
    }
    return departments[0]?.id || '';
  }, [departments, adminName, adminProfile]);

  const activeDeptId = selectedDeptId || managedDeptId;

  // Programs belonging to the active admin's department
  const adminPrograms = useMemo(() => {
    return programs.filter(p => p.departmentId === activeDeptId);
  }, [programs, activeDeptId]);

  const currentDeptObj = useMemo(() => {
    return departments.find(d => d.id === activeDeptId);
  }, [departments, activeDeptId]);

  const [activeTab, setActiveTab] = useState<'semester-plans' | 'courses' | 'teachers' | 'teacher-assignments' | 'student-enrollment' | 'attainment-reports'>('semester-plans');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Custom confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  // Tab 6: Reports State
  const [selectedReportProg, setSelectedReportProg] = useState<string>('');
  const [selectedReportCourseCode, setSelectedReportCourseCode] = useState<string>('');
  const [programGAReport, setProgramGAReport] = useState<any>(null);
  const [courseAttainmentReport, setCourseAttainmentReport] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);

  // New 6 reports sub-tab states
  const [subReportTab, setSubReportTab] = useState<'legacy' | 'co-summary' | 'po-attainment' | 'gap-analysis' | 'at-risk' | 'instructor-performance' | 'cohort-comparison'>('legacy');
  const [coSummaryReport, setCoSummaryReport] = useState<any>(null);
  const [poAttainmentReport, setPoAttainmentReport] = useState<any>(null);
  const [gapAnalysisReport, setGapAnalysisReport] = useState<any>(null);
  const [atRiskReport, setAtRiskReport] = useState<any>(null);
  const [instructorPerformanceReport, setInstructorPerformanceReport] = useState<any>(null);
  const [cohortComparisonReport, setCohortComparisonReport] = useState<any>(null);

  // Filters for new reports
  const [coSummarySemester, setCoSummarySemester] = useState<string>('Fall 2025');
  const [coSummaryYear, setCoSummaryYear] = useState<string>('2025');
  const [atRiskSemester, setAtRiskSemester] = useState<string>('Fall 2025');
  const [cohortGaId, setCohortGaId] = useState<string>('GA-1');

  // Tab 1: Semester Plans Edit State
  const [selectedPlanProg, setSelectedPlanProg] = useState<string>('');
  const [selectedPlanSem, setSelectedPlanSem] = useState<string>('1st');
  const [planSearch, setPlanSearch] = useState<string>('');

  // Tab 2: Course Creation State
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseType, setCourseType] = useState<'core' | 'elective'>('core');
  const [courseCreditHours, setCourseCreditHours] = useState<number>(3);
  const [courseSubtype, setCourseSubtype] = useState<'Theory' | 'Lab'>('Theory');
  const [courseDept, setCourseDept] = useState('');
  const [courseProg, setCourseProg] = useState('');
  const [courseGAs, setCourseGAs] = useState<string[]>([]);
  const [courseSearch, setCourseSearch] = useState('');
  const [catalogProgFilter, setCatalogProgFilter] = useState<string>('all');
  const [catalogDeptFilter, setCatalogDeptFilter] = useState<string>('all');
  const [refreshingCourses, setRefreshingCourses] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  // Auto-select first program and department if not already selected
  useEffect(() => {
    if (departments.length > 0) {
      const targetDept = departments.find(d => String(d.id).toLowerCase() === String(activeDeptId).toLowerCase()) || departments[0];
      setCourseDept(prev => prev || String(targetDept.id));
      setTeacherDept(prev => prev || String(targetDept.id));
    }
  }, [departments, activeDeptId]);

  useEffect(() => {
    if (programs.length > 0) {
      setSelectedReportProg(prev => prev || String(programs[0].id));
      setSelectedPlanProg(prev => prev || String(programs[0].id));
      
      const deptProgs = programs.filter(p => String(p.departmentId).toLowerCase() === String(courseDept).toLowerCase());
      const defaultProg = deptProgs.length > 0 ? deptProgs[0] : programs[0];
      setCourseProg(prev => prev || String(defaultProg.id));
    }
  }, [programs, courseDept]);

  // Tab 3: Teacher Creation State
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherEmployeeId, setTeacherEmployeeId] = useState('');
  const [teacherDesignation, setTeacherDesignation] = useState('Lecturer');
  const [teacherDept, setTeacherDept] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');

  // Tab 4: Teacher Course Assignment State
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedCourseCodeForTeacher, setSelectedCourseCodeForTeacher] = useState('');
  const [selectedProgramForTeacher, setSelectedProgramForTeacher] = useState('');
  const [assignmentAcademicYear, setAssignmentAcademicYear] = useState(getAutomaticAcademicYear());
  const [assignmentSearch, setAssignmentSearch] = useState('');

  // Tab 5: Student Binding State
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentRegNo, setSelectedStudentRegNo] = useState<string>('');

  // Synchronize Tab 1 default program when adminPrograms load or change
  useEffect(() => {
    if (adminPrograms.length > 0) {
      const isValid = adminPrograms.some(p => p.id === selectedPlanProg);
      if (!isValid) {
        setSelectedPlanProg(adminPrograms[0].id);
      }
    }
  }, [adminPrograms, selectedPlanProg]);

  // Function to reload courses, departments, and programs fresh from backend database
  const reloadCoursesFromBackend = async () => {
    setRefreshingCourses(true);
    try {
      const [fetchedCourses, fetchedDepts, fetchedProgs] = await Promise.all([
        apiService.getCourses().catch(() => null),
        apiService.getDepartments().catch(() => null),
        apiService.getPrograms().catch(() => null)
      ]);
      if (fetchedCourses && fetchedCourses.length > 0) {
        setCourses(fetchedCourses);
      }
      if (fetchedDepts && fetchedDepts.length > 0) {
        setDepartments(fetchedDepts);
      }
      if (fetchedProgs && fetchedProgs.length > 0) {
        setPrograms(fetchedProgs);
      }
    } catch (e) {
      console.warn("Failed refreshing catalog from backend:", e);
    } finally {
      setRefreshingCourses(false);
    }
  };

  // Re-fetch courses from backend whenever opening courses tab
  useEffect(() => {
    if (activeTab === 'courses') {
      reloadCoursesFromBackend();
    }
  }, [activeTab]);

  // Synchronize Tab 3 Department default selection when activeDeptId loads/changes
  useEffect(() => {
    setTeacherDept(activeDeptId);
  }, [activeDeptId]);
  const [selectedCourseCodeForStudent, setSelectedCourseCodeForStudent] = useState('');
  const [studentCourseStatuses, setStudentCourseStatuses] = useState<Record<string, Record<string, 'studied' | 'studying' | 'failed' | 'later' | 'deferred'>>>({});
  // Semester sections open on the Student Enrollments tab; empty = only the student's current semester.
  const [enrollOpenSemesters, setEnrollOpenSemesters] = useState<Record<string, boolean>>({});
  const [studentTab, setStudentTab] = useState<'all' | 'studying' | 'failed' | 'studied' | 'deferred'>('all');
  const [expandedSemesters, setExpandedSemesters] = useState<Record<string, boolean>>({
    "1st": true,
    "2nd": true,
    "3rd": true,
    "4th": true,
    "5th": true,
    "6th": true,
    "7th": true,
    "8th": true
  });

  // Tab 6 Reports computed list
  const reportCourses = useMemo(() => {
    return courses.filter(c => c.departmentId === activeDeptId && (!selectedReportProg || c.programId === selectedReportProg));
  }, [courses, activeDeptId, selectedReportProg]);

  useEffect(() => {
    if (reportCourses.length > 0) {
      const codeExists = reportCourses.some(c => c.code === selectedReportCourseCode);
      if (!codeExists) {
        setSelectedReportCourseCode(reportCourses[0].code);
      }
    } else {
      setSelectedReportCourseCode('');
    }
  }, [reportCourses, selectedReportCourseCode]);

  // Fetch New Reports
  useEffect(() => {
    if (activeTab !== 'attainment-reports') return;

    const fetchNewReports = async () => {
      setLoadingReport(true);
      try {
        if (subReportTab === 'co-summary' && selectedReportProg) {
          const data = await apiService.getCOAttainmentSummary(selectedReportProg, coSummarySemester, coSummaryYear);
          setCoSummaryReport(data);
        } else if (subReportTab === 'po-attainment' && selectedReportProg) {
          const data = await apiService.getPOAttainment(selectedReportProg);
          setPoAttainmentReport(data);
        } else if (subReportTab === 'gap-analysis' && selectedReportProg) {
          const data = await apiService.getGapAnalysis(selectedReportProg);
          setGapAnalysisReport(data);
        } else if (subReportTab === 'at-risk' && selectedReportProg) {
          const data = await apiService.getAtRiskStudents(selectedReportProg, atRiskSemester);
          setAtRiskReport(data);
        } else if (subReportTab === 'instructor-performance') {
          const data = await apiService.getInstructorPerformance(activeDeptId);
          setInstructorPerformanceReport(data);
        } else if (subReportTab === 'cohort-comparison' && selectedReportProg) {
          const data = await apiService.getCohortComparison(selectedReportProg, cohortGaId);
          setCohortComparisonReport(data);
        }
      } catch (err) {
        console.warn("Failed to fetch sub report:", err);
      } finally {
        setLoadingReport(false);
      }
    };

    fetchNewReports();
  }, [subReportTab, selectedReportProg, coSummarySemester, coSummaryYear, atRiskSemester, cohortGaId, activeTab, activeDeptId]);

  // Fetch Program GA Attainment
  useEffect(() => {
    if (activeTab !== 'attainment-reports' || !selectedReportProg) return;

    const fetchProgramGAReport = async () => {
      setLoadingReport(true);
      try {
        const report = await apiService.getProgramGAAttainment(selectedReportProg);
        setProgramGAReport(report);
      } catch (err) {
        console.warn("Failed to fetch program GA report:", err);
        setProgramGAReport(null);
      } finally {
        setLoadingReport(false);
      }
    };

    fetchProgramGAReport();
  }, [selectedReportProg, activeTab]);

  // Fetch Course Attainment
  useEffect(() => {
    if (activeTab !== 'attainment-reports' || !selectedReportCourseCode || !selectedReportProg) {
      setCourseAttainmentReport(null);
      return;
    }

    const fetchCourseReport = async () => {
      try {
        const report = await apiService.getCourseAttainment(selectedReportCourseCode, selectedReportProg);
        setCourseAttainmentReport(report);
      } catch (err) {
        console.warn("Failed to fetch course attainment report:", err);
        setCourseAttainmentReport(null);
      }
    };

    fetchCourseReport();
  }, [selectedReportCourseCode, selectedReportProg, activeTab]);

  // Load all initial data and set fallback local storage structures
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Load basic OBE data from service or localStorage
      let obData;
      const isBackend = !!localStorage.getItem('access');

      // These requests don't depend on each other, so start them all now and
      // read the results below. They used to run one after another, so the
      // "Initializing" screen lasted the SUM of every round trip (slow on a
      // remote server) instead of the longest single one. Each result keeps the
      // exact error handling it had before.
      const settle = <T,>(p: Promise<T>): Promise<{ ok: boolean; value: T; error: any }> =>
        p.then((value) => ({ ok: true, value, error: null }), (error: any) => ({ ok: false, value: undefined as unknown as T, error }));
      const pProfile = settle(apiService.getDeptAdminProfile());
      const pStudents = settle(apiService.getStudents());
      const pTeachers = settle(apiService.getTeachers());
      const pPlans = settle(apiService.getSemesterPlans());
      const pAssignments = settle(apiService.getCourseAssignments());

      try {
        obData = await apiService.getAllData();
      } catch (err: any) {
        obData = { departments: [], programs: [], courses: [], gas: [] };
        setErrorMsg(err?.message || "Could not retrieve data from the backend server. Please make sure the server is online.");
      }
      let loadedDepts = obData.departments || [];
      if (loadedDepts.length === 0) {
        try {
          const directDepts = await apiService.getDepartments();
          if (Array.isArray(directDepts) && directDepts.length > 0) {
            loadedDepts = directDepts;
          }
        } catch (e) {
          console.warn("Direct getDepartments fallback check failed:", e);
        }
      }
      if (loadedDepts.length === 0) {
        const userDeptId = localStorage.getItem('IQRA_OBE_USER_DEPT_ID');
        const userDeptName = localStorage.getItem('IQRA_OBE_USER_DEPT_NAME');
        if (userDeptId || userDeptName) {
          loadedDepts = [{
            id: userDeptId || 'dept-1',
            name: userDeptName || 'Department of Computing and Technology',
            vision: '',
            mission: ''
          }];
        }
      }
      setDepartments(loadedDepts);
      setPrograms(obData.programs || []);
      setCourses(obData.courses || []);

      // 2. Load admin profile from backend
      try {
        const rProfile = await pProfile;
        if (!rProfile.ok) throw rProfile.error;
        setAdminProfile(rProfile.value);
      } catch (err) {
        console.warn("Failed to fetch admin profile from backend, using adminName detection.", err);
      }

      // 3. Load Students
      const rStudents = await pStudents;
      if (!rStudents.ok) throw rStudents.error;
      const studentList = rStudents.value;
      setStudents(studentList);

      // 4. Load Teachers from backend or fallback to Local Storage
      let loadedTeachers: Teacher[] = [];
      try {
        const rTeachers = await pTeachers;
        if (!rTeachers.ok) throw rTeachers.error;
        const fetchedTeachers = rTeachers.value;
        if (Array.isArray(fetchedTeachers)) {
          loadedTeachers = fetchedTeachers.map((t: any) => ({
            ...t,
            id: t.id,
            employeeId: t.employeeId || t.employee_id || t.id,
            name: t.name,
            email: t.email,
            departmentId: t.departmentId || t.department_id
          }));
        }
      } catch (err) {
        console.warn("Backend API for teachers offline:", err);
        loadedTeachers = [];
      }
      setTeachers(loadedTeachers);

      // 5. Load Semester Plans from backend or fallback to Local Storage
      let loadedPlans: SemesterPlan[] = [];
      try {
        const rPlans = await pPlans;
        if (!rPlans.ok) throw rPlans.error;
        const fetchedPlans = rPlans.value;
        if (Array.isArray(fetchedPlans)) {
          loadedPlans = fetchedPlans.map((p: any) => ({
            programId: p.programId,
            semester: p.semester,
            courseCodes: p.courseCodes || []
          }));
        }
      } catch (err) {
        console.warn("Backend API for semester plans offline:", err);
        loadedPlans = [];
      }
      setSemesterPlans(loadedPlans);

      // 6. Load Student Bindings
      let activeBindings: StudentCourseBinding[] = [];
      const localBindingsStr = localStorage.getItem('IQRA_OBE_STUDENT_BINDINGS');
      if (localBindingsStr) {
        try {
          activeBindings = JSON.parse(localBindingsStr);
        } catch (e) {
          activeBindings = [];
        }
      }
      setStudentBindings(activeBindings);

      // 7. Load Teacher Course Assignments from backend or fallback to Local Storage
      let loadedAssignments: TeacherCourseAssignment[] = [];
      try {
        const rAssignments = await pAssignments;
        if (!rAssignments.ok) throw rAssignments.error;
        const fetchedAssignments = rAssignments.value;
        if (Array.isArray(fetchedAssignments)) {
          loadedAssignments = fetchedAssignments.map((a: any) => ({
            id: a.courseId || a.id || a.assignment_id || a.assignmentId,
            teacherId: a.teacherId || a.instructor || a.employeeId,
            courseCode: a.courseCode || a.course_code || a.code,
            programId: a.programId || a.program_id || a.program,
            academicYear: a.academicYear || a.academic_year || 'Fall-2024',
            status: a.status || 'active'
          }));

          // Recover student-course bindings directly from assignments returned from the backend database
          if (isBackend) {
            const dbBindings: StudentCourseBinding[] = [];
            fetchedAssignments.forEach((a: any) => {
              const studentsList = a.students || a.enrolled_students || a.enrolledStudents || a.student_list || a.studentList || [];
              if (Array.isArray(studentsList)) {
                studentsList.forEach((s: any) => {
                  const regNoClean = String(s.regNo || s.reg_no || '').trim();
                  const cCodeClean = String(a.courseCode || a.course_code || a.code || '').trim();
                  if (regNoClean && cCodeClean) {
                    dbBindings.push({
                      studentRegNo: regNoClean,
                      courseCode: cCodeClean
                    });
                  }
                });
              }
            });
            console.log(`[DEBUG DeptAdmin] Recovered ${dbBindings.length} real student bindings from database assignments.`);
            
            // The backend now returns each assignment's real roster, so it is the
            // source of truth for every course that HAS an assignment. Drop
            // locally remembered bindings for those courses first, otherwise a
            // stale browser copy (e.g. old demo enrollments) gets merged back in
            // and re-pushed to the server on the next sync. Bindings for courses
            // with no assignment yet stay as they are. Skipped when the server
            // doesn't send rosters (older backend), so nothing is lost there.
            const backendSendsRosters = fetchedAssignments.length > 0 && fetchedAssignments.every((a: any) => Array.isArray(a.students));
            if (backendSendsRosters) {
              const assignedCodes = new Set(fetchedAssignments.map((a: any) => normalizeCourseCode(String(a.courseCode || a.course_code || a.code || ''))));
              activeBindings = activeBindings.filter(b => !assignedCodes.has(normalizeCourseCode(b.courseCode)));
            }

            // Merge dbBindings into activeBindings (ensuring no duplicates, matching with areRegNosEqual)
            // Hash lookup (was combined.some() per binding: with a few thousand
            // server enrollments that fuzzy scan was millions of comparisons and
            // froze the loading screen).
            const bindingKey = (b: StudentCourseBinding) => `${normalizeRegNo(b.studentRegNo)}|${String(b.courseCode).toLowerCase().trim()}`;
            const combined = [...activeBindings];
            const seenKeys = new Set(combined.map(bindingKey));
            dbBindings.forEach(dbb => {
              const k = bindingKey(dbb);
              if (!seenKeys.has(k)) {
                seenKeys.add(k);
                combined.push(dbb);
              }
            });
            activeBindings = combined;
            setStudentBindings(activeBindings);
            localStorage.setItem('IQRA_OBE_STUDENT_BINDINGS', JSON.stringify(activeBindings));
          }
        }
      } catch (err) {
        console.warn("Backend API for course assignments offline. Falling back to local storage.", err);
        const savedAssignments = localStorage.getItem('IQRA_OBE_TEACHER_ASSIGNMENTS');
        if (savedAssignments) {
          try {
            loadedAssignments = JSON.parse(savedAssignments);
          } catch (e) {
            loadedAssignments = [];
          }
        } else {
          loadedAssignments = [];
        }
      }
      // Deduplicate loadedAssignments to guarantee no duplicate teacher assignments
      const uniqueAssignmentsMap = new Map<string, TeacherCourseAssignment>();
      loadedAssignments.forEach(a => {
        const teacherKey = String(a.teacherId || '').trim().toLowerCase();
        const courseKey = String(a.courseCode || '').trim().toLowerCase();
        const programKey = String(a.programId || 'all').trim().toLowerCase();
        const yearKey = String(a.academicYear || 'Fall-2024').trim().toLowerCase();
        const key = `${teacherKey}_${courseKey}_${programKey}_${yearKey}`;
        if (!uniqueAssignmentsMap.has(key)) {
          uniqueAssignmentsMap.set(key, a);
        }
      });
      loadedAssignments = Array.from(uniqueAssignmentsMap.values());
      localStorage.setItem('IQRA_OBE_TEACHER_ASSIGNMENTS', JSON.stringify(loadedAssignments));

      setTeacherAssignments(loadedAssignments);

      // Automatically sync to instructor courses on load of Admin dashboard
      // Deferred a tick so the dashboard appears first; the sync is background work.
      const courseSnapshot = obData.courses || [];
      setTimeout(() => syncToInstructorCourses(courseSnapshot, loadedTeachers, loadedAssignments, activeBindings, studentList), 0);

    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to synchronize department administration records.");
    } finally {
      setLoading(false);
    }
  };

  // Synchronizes changes in student/teacher assignments to the global `IQRA_OBE_INSTRUCTOR_COURSES`
  // so that the Instructor Dashboard seamlessly reflects the updated course schedules and student lists.
  const syncToInstructorCourses = (
    currentCourses: Course[],
    currentTeachers: Teacher[],
    currentAssignments: TeacherCourseAssignment[],
    currentBindings: StudentCourseBinding[],
    currentStudents: Student[],
    // Course codes whose roster must be sent even if it is now EMPTY (a reset
    // can leave a course with nobody; the server only clears it if told so).
    forceSyncCodes?: Set<string>
  ) => {
    // 1. Get existing InstructorCourses list
    let existingInstructorCourses: InstructorCourse[] = [];
    try {
      existingInstructorCourses = apiService.getLocalInstructorCourses();
    } catch (e) {
      existingInstructorCourses = [];
    }

    // 2. We want to construct or update the list of InstructorCourses.
    // For each teacher assignment, we make sure an InstructorCourse exists.
    // If a course is not assigned to any teacher, it won't appear in the instructor's courses.
    const assignmentMap = new Map<string, { teacherId: string; courseCode: string; programId?: string; academicYear?: string }>();

    // Deduplicate currentAssignments to avoid duplicate instructor courses
    const uniqueAssignmentsMap = new Map<string, TeacherCourseAssignment>();
    currentAssignments.forEach(a => {
      const teacherKey = String(a.teacherId || '').trim().toLowerCase();
      const courseKey = String(a.courseCode || '').trim().toLowerCase();
      const programKey = String(a.programId || 'all').trim().toLowerCase();
      const yearKey = String(a.academicYear || 'Fall-2024').trim().toLowerCase();
      const key = `${teacherKey}_${courseKey}_${programKey}_${yearKey}`;
      if (!uniqueAssignmentsMap.has(key)) {
        uniqueAssignmentsMap.set(key, a);
      }
    });
    const deduplicatedAssignments = Array.from(uniqueAssignmentsMap.values());

    // Which students are bound to each course code. Matching a binding to a
    // student uses the fuzzy areRegNosEqual, so do it once per DISTINCT binding
    // registration number (≤ number of students) instead of for every
    // student × binding × assignment, which was tens of millions of checks.
    const regMatchCache = new Map<string, Set<Student>>();
    const studentsMatchingReg = (reg: string): Set<Student> => {
      let hit = regMatchCache.get(reg);
      if (!hit) {
        hit = new Set(currentStudents.filter(st => areRegNosEqual(reg, st.regNo)));
        regMatchCache.set(reg, hit);
      }
      return hit;
    };
    const boundStudentsByCode = new Map<string, Set<Student>>();
    currentBindings.forEach(b => {
      const codeKey = normalizeCourseCode(b.courseCode);
      let set = boundStudentsByCode.get(codeKey);
      if (!set) { set = new Set(); boundStudentsByCode.set(codeKey, set); }
      studentsMatchingReg(b.studentRegNo).forEach(st => set!.add(st));
    });

    const updatedInstructorCourses: InstructorCourse[] = deduplicatedAssignments.map(assignment => {
      const teacher = currentTeachers.find(t => matchTeacher(t, assignment.teacherId));
      const assignmentProgClean = assignment.programId ? String(assignment.programId).trim().toLowerCase() : '';
      const course = currentCourses.find(c => c.code === assignment.courseCode && (!assignmentProgClean || String(c.programId).trim().toLowerCase() === assignmentProgClean)) || currentCourses.find(c => c.code === assignment.courseCode);
      const matchedDept = departments.find(d => d.id === (course?.departmentId || activeDeptId || ''));
      
      const defaultDeptProgram = programs.find(p => p.departmentId === activeDeptId)?.id || programs[0]?.id || '';
      const fallbackProgramId = course?.programId || programs.find(p => p.departmentId === course?.departmentId)?.id || defaultDeptProgram;
      const finalProgramId = assignment.programId || fallbackProgramId;
      const matchedProg = programs.find(p => p.id === finalProgramId);

      const employeeId = teacher?.employeeId || assignment.teacherId;
      let academicYear = assignment.academicYear || 'Fall-2024';
      academicYear = academicYear.replace(/ /g, '-');
      if (academicYear) {
        academicYear = academicYear.charAt(0).toUpperCase() + academicYear.slice(1);
      }
      const uniqId = `course-assigned-${assignment.courseCode}-${employeeId}-${finalProgramId}-${academicYear}`;

      // The id the backend knows this course by (falls back to the guessed one for
      // assignments that have no backend id yet).
      const effectiveId = assignment.id ? String(assignment.id) : uniqId;
      assignmentMap.set(effectiveId, {
        teacherId: employeeId,
        courseCode: assignment.courseCode,
        // The assignment's OWN program (may be none). Re-creating a missing
        // assignment with a guessed program would make a different course.
        programId: assignment.programId || undefined,
        academicYear: academicYear || 'Fall-2024'
      });

      // Find matching students for this course based on bindings
      const boundHere = boundStudentsByCode.get(normalizeCourseCode(assignment.courseCode));
      const courseStudents = currentStudents
        .filter(s => !!boundHere && boundHere.has(s))
        .map(s => {
          // Preserve existing marks if student was already in this course
          const existingCourse = existingInstructorCourses.find(ec => ec.id === uniqId) || 
                                 existingInstructorCourses.find(ec => ec.code === assignment.courseCode && !ec.id.includes('-'));
          const existingStudent = existingCourse?.students.find(es => areRegNosEqual(es.regNo, s.regNo));
          return {
            regNo: s.regNo,
            name: s.name,
            marks: existingStudent?.marks || {}
          };
        });

      // Find if this course already has initialized units/categories, otherwise set defaults
      const existingCourse = existingInstructorCourses.find(ec => ec.id === uniqId) || 
                             existingInstructorCourses.find(ec => ec.code === assignment.courseCode && !ec.id.includes('-'));
      
      const codeStr = String(assignment.courseCode || course?.code || '').trim().toUpperCase();
      const titleStr = String(course?.title || '').trim().toLowerCase();
      const isLab = course?.courseType === 'Lab' || codeStr.endsWith('L') || titleStr.includes('lab');

      const standardCategories = isLab ? [
        { name: "Mid Term", percentage: 20, units: 1 },
        { name: "Final", percentage: 30, units: 1 },
        { name: "Lab Reports", percentage: 10, units: 3 },
        { name: "Lab Performance", percentage: 10, units: 3 },
        { name: "Viva", percentage: 5, units: 1 },
        { name: "Assignments", percentage: 5, units: 3 },
        { name: "Quizzes", percentage: 5, units: 3 },
        { name: "Open Ended Lab", percentage: 5, units: 1 },
        { name: "Other Activities", percentage: 5, units: 1 },
        { name: "Project", percentage: 5, units: 1 }
      ] : [
        { name: "Assignments", percentage: 15, units: 3 },
        { name: "Quizzes", percentage: 10, units: 3 },
        { name: "Class Participation", percentage: 5, units: 1 },
        { name: "Class Project", percentage: 15, units: 1 },
        { name: "Presentation", percentage: 5, units: 1 },
        { name: "Mid Term", percentage: 20, units: 1 },
        { name: "Final", percentage: 30, units: 1 }
      ];

      const standardUnitsData = isLab ? {
        "Mid Term": [{ unitNo: 1, passing: 15, totalMarks: 30, weightage: 100 }],
        "Final": [{ unitNo: 1, passing: 20, totalMarks: 40, weightage: 100 }],
        "Lab Reports": [
          { unitNo: 1, passing: 5, totalMarks: 10, weightage: 33.3 },
          { unitNo: 2, passing: 5, totalMarks: 10, weightage: 33.3 },
          { unitNo: 3, passing: 5, totalMarks: 10, weightage: 33.4 }
        ],
        "Lab Performance": [
          { unitNo: 1, passing: 5, totalMarks: 10, weightage: 33.3 },
          { unitNo: 2, passing: 5, totalMarks: 10, weightage: 33.3 },
          { unitNo: 3, passing: 5, totalMarks: 10, weightage: 33.4 }
        ],
        "Viva": [{ unitNo: 1, passing: 5, totalMarks: 10, weightage: 100 }],
        "Assignments": [
          { unitNo: 1, passing: 5, totalMarks: 10, weightage: 33.3 },
          { unitNo: 2, passing: 5, totalMarks: 10, weightage: 33.3 },
          { unitNo: 3, passing: 5, totalMarks: 10, weightage: 33.4 }
        ],
        "Quizzes": [
          { unitNo: 1, passing: 5, totalMarks: 10, weightage: 33.3 },
          { unitNo: 2, passing: 5, totalMarks: 10, weightage: 33.3 },
          { unitNo: 3, passing: 5, totalMarks: 10, weightage: 33.4 }
        ],
        "Open Ended Lab": [{ unitNo: 1, passing: 5, totalMarks: 10, weightage: 100 }],
        "Other Activities": [{ unitNo: 1, passing: 5, totalMarks: 10, weightage: 100 }],
        "Project": [{ unitNo: 1, passing: 15, totalMarks: 30, weightage: 100 }]
      } : {
        "Assignments": [
          { unitNo: 1, passing: 5, totalMarks: 10, weightage: 33.3 },
          { unitNo: 2, passing: 5, totalMarks: 10, weightage: 33.3 },
          { unitNo: 3, passing: 5, totalMarks: 10, weightage: 33.4 }
        ],
        "Quizzes": [
          { unitNo: 1, passing: 5, totalMarks: 10, weightage: 33.3 },
          { unitNo: 2, passing: 5, totalMarks: 10, weightage: 33.3 },
          { unitNo: 3, passing: 5, totalMarks: 10, weightage: 33.4 }
        ],
        "Class Participation": [{ unitNo: 1, passing: 5, totalMarks: 10, weightage: 100 }],
        "Class Project": [{ unitNo: 1, passing: 15, totalMarks: 30, weightage: 100 }],
        "Presentation": [{ unitNo: 1, passing: 5, totalMarks: 10, weightage: 100 }],
        "Mid Term": [{ unitNo: 1, passing: 15, totalMarks: 30, weightage: 100 }],
        "Final": [{ unitNo: 1, passing: 20, totalMarks: 40, weightage: 100 }]
      };

      const baseTitle = course?.title || 'Unknown Course';
      const finalTitle = assignment.programId && matchedProg ? `${baseTitle} (${matchedProg.code.toUpperCase()})` : baseTitle;

      return {
        id: assignment.id ? String(assignment.id) : (existingCourse?.id || uniqId),
        code: assignment.courseCode,
        title: finalTitle,
        courseType: isLab ? 'Lab' : 'Theory',
        departmentId: course?.departmentId || activeDeptId || '',
        departmentName: matchedDept?.name || 'Department of Computing and Technology',
        programId: finalProgramId,
        programName: matchedProg?.name || 'Bachelor of Science in Computer Science',
        creditHours: course?.creditHours !== undefined ? course.creditHours : 3,
        categories: existingCourse?.categories || standardCategories,
        unitsData: existingCourse?.unitsData || standardUnitsData,
        students: courseStudents,
        obeQuestions: existingCourse?.obeQuestions || [],
        obeMarks: existingCourse?.obeMarks || {},
        selectedGradingSystem: existingCourse?.selectedGradingSystem || 'relative',
        academicYear: academicYear || existingCourse?.academicYear || 'Fall-2024',
        status: assignment.status || existingCourse?.status || 'active'
      };
    });

    // Save to local storage
    if (!apiService.isBackendUser()) {
      localStorage.setItem('IQRA_OBE_INSTRUCTOR_COURSES', JSON.stringify(updatedInstructorCourses));
    } else {
      // Bypassing apiService.saveInstructorCourses(updatedInstructorCourses) for Dept Admin.
      // Admins do not have the Instructor permission to POST to /api/instructor/courses/.
      // Assignments are managed through course assignments, and student enrollment is done via enrollStudents.
      console.log('[DEBUG DeptAdmin] Bypassing saveInstructorCourses call in backend mode to avoid permission checks.');
    }

    // Sync enrollments to backend sequentially to avoid SQLite database locks (500 errors)
    (async () => {
      const failures: string[] = [];
      for (const ic of updatedInstructorCourses) {
        if ((ic.students && ic.students.length > 0) || forceSyncCodes?.has(normalizeCourseCode(ic.code))) {
          try {
            await apiService.enrollStudents(
              ic.id,
              ic.students.map(s => ({ regNo: s.regNo, name: s.name }))
            );
          } catch (e: any) {
            console.warn('Enrollment sync failed, attempting self-healing for:', ic.id, e);
            const errMsg = e.message || '';
            if (errMsg.toLowerCase().includes('not found')) {
              // Try to recreate assignment on backend
              const details = assignmentMap.get(ic.id);
              if (details) {
                try {
                  console.log('Re-creating missing assignment on backend for self-healing:', details);
                  await apiService.assignCourse(
                    details.teacherId,
                    details.courseCode,
                    details.programId,
                    details.academicYear
                  );
                  // Retry enrollment
                  await apiService.enrollStudents(
                    ic.id,
                    ic.students.map(s => ({ regNo: s.regNo, name: s.name }))
                  );
                  console.log('Self-healing enrollment sync successful for:', ic.id);
                  continue; // Succeeded! Skip warning toast
                } catch (retryErr: any) {
                  console.error('Self-healing retry failed:', retryErr);
                }
              }
            }
            // Self-healing failed or didn't apply: remember it, report once below.
            failures.push(`${ic.code}: ${e.message}`);
          }
        }
      }
      if (failures.length > 0) {
        triggerNotification(
          failures.length === 1
            ? `Enrollment was not saved to the server — ${failures[0]}`
            : `Enrollment was not saved for ${failures.length} courses (e.g. ${failures[0]}). Please retry.`,
          true
        );
      }
    })();
  };

  // Show a status update or feedback message helper
  const triggerNotification = (message: string, isError: boolean = false) => {
    if (isError) {
      setErrorMsg(message);
      setSuccessMsg(null);
    } else {
      setSuccessMsg(message);
      setErrorMsg(null);
    }
    setTimeout(() => {
      setErrorMsg(null);
      setSuccessMsg(null);
    }, 2000);
  };

  // === CORE FUNCTIONALITIES ===

  // 1. Create Course Manually
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim() || !courseTitle.trim()) {
      triggerNotification("Please fill in the course code and title", true);
      return;
    }

    const uppercaseCode = courseCode.trim().toUpperCase();
    const cleanProg = String(courseProg).trim().toLowerCase();
    if (courses.some(c => c.code === uppercaseCode && String(c.programId).trim().toLowerCase() === cleanProg)) {
      triggerNotification(`Course with code ${uppercaseCode} for program ${courseProg} already exists`, true);
      return;
    }

    if (courses.some(c => c.code === uppercaseCode && 
      String(c.programId).toLowerCase() === String(courseProg).toLowerCase())) {
      triggerNotification(`Course with code ${uppercaseCode} already exists in the catalog for this program.`, true);
      return;
    }

    const newCourse: Course = {
      id: `course-manual-${Date.now()}`,
      code: uppercaseCode,
      title: courseTitle.trim(),
      type: courseType,
      departmentId: courseDept,
      programId: courseProg,
      mappedGAs: courseGAs,
      creditHours: courseCreditHours,
      courseType: courseSubtype
    };

    try {
      const created = await apiService.createCourse(newCourse);
      const updatedCourses = [...courses, created];
      setCourses(updatedCourses);

      // Clean inputs
      setCourseCode('');
      setCourseTitle('');
      setCourseGAs([]);
      setCourseCreditHours(3);
      setCourseSubtype('Theory');

      triggerNotification(`Course ${uppercaseCode} - ${created.title} created successfully!`);
    } catch (err) {
      triggerNotification("Failed to save the new course.", true);
    }
  };

  const handleDeleteCourse = (course: Course) => {
    setConfirmDialog({
      isOpen: true,
      title: "Confirm Course Deletion",
      message: `Are you sure you want to permanently delete the course "${course.code} - ${course.title}"? This will automatically delete all faculty assignments, student enrollments, and related materials for this course.`,
      confirmText: "Delete Course & Materials",
      cancelText: "Cancel",
      isDanger: true,
      onConfirm: async () => {
        try {
          triggerNotification("Removing all teacher assignments, student bindings, and course materials...", false);
          
          // 1. Fetch all backend instructor courses to find any matching records
          let backendInstructorCourses: InstructorCourse[] = [];
          try {
            backendInstructorCourses = await apiService.getInstructorCourses();
          } catch (e) {
            console.warn("Failed to fetch backend instructor courses, using local fallback list:", e);
            backendInstructorCourses = apiService.getLocalInstructorCourses();
          }

          const matchingInstructorCourses = backendInstructorCourses.filter(
            ic => ic.code === course.code || ic.id.includes(course.code)
          );

          // 2. Clear enrolled students from these instructor courses on the backend first
          for (const ic of matchingInstructorCourses) {
            try {
              console.log(`Bypassing constraints: Clearing student enrollments for matching course ${ic.id}`);
              await apiService.enrollStudents(ic.id, []);
            } catch (e) {
              console.warn(`Failed to clear enrolled students for ${ic.id}:`, e);
            }
          }

          // 3. Delete the matching instructor courses on the backend
          for (const ic of matchingInstructorCourses) {
            try {
              console.log(`Deleting matching instructor course ${ic.id}`);
              await apiService.deleteInstructorCourse(ic.id);
            } catch (e) {
              console.warn(`Failed to delete instructor course ${ic.id}:`, e);
            }
          }

          // 4. Force remove all teacher assignments & predicted instructor courses
          const matchingAssignments = teacherAssignments.filter(a => a.courseCode === course.code);
          for (const assignment of matchingAssignments) {
            const teacherId = assignment.teacherId;
            const programId = assignment.programId;
            const t = teachers.find(x => matchTeacher(x, teacherId));
            const employeeId = t?.employeeId || teacherId;
            const assignmentProgId = assignment?.programId || programId;
            const cleanCourseProg = assignmentProgId ? String(assignmentProgId).trim().toLowerCase() : '';
            const finalProgId = assignmentProgId || courses.find(c => c.code === course.code && (!cleanCourseProg || String(c.programId).trim().toLowerCase() === cleanCourseProg))?.programId || courses.find(c => c.code === course.code)?.programId || programs.find(p => p.departmentId === activeDeptId)?.id || programs[0]?.id || '';
            
            let acadYear = assignment?.academicYear || 'Fall-2024';
            acadYear = acadYear.replace(/ /g, '-');
            if (acadYear) {
              acadYear = acadYear.charAt(0).toUpperCase() + acadYear.slice(1);
            }
            const backendCourseId = `course-assigned-${course.code}-${employeeId}-${finalProgId}-${acadYear}`;

            // If we didn't already process this ID, try to clean it up now
            if (!matchingInstructorCourses.some(ic => ic.id === backendCourseId)) {
              try {
                await apiService.enrollStudents(backendCourseId, []);
              } catch (e) {
                console.warn("Failed to unenroll predicted course ID:", e);
              }
              try {
                await apiService.deleteInstructorCourse(backendCourseId);
              } catch (e) {
                console.warn("Failed to delete predicted instructor course record:", e);
              }
            }

            try {
              await apiService.removeCourseAssignment(teacherId, course.code, programId, acadYear);
            } catch (e) {
              console.warn("Failed to remove course assignment on backend:", e);
            }
          }

          // 5. Add to deleted courses blacklist in localStorage immediately to ensure it never reappears on frontend
          const deletedCourseKeys = JSON.parse(localStorage.getItem('IQRA_OBE_DELETED_COURSES') || '[]');
          const key = `${course.code}-${course.programId || ''}`.toLowerCase().trim();
          if (!deletedCourseKeys.includes(key)) {
            deletedCourseKeys.push(key);
          }
          if (course.id && !deletedCourseKeys.includes(String(course.id).toLowerCase().trim())) {
            deletedCourseKeys.push(String(course.id).toLowerCase().trim());
          }
          localStorage.setItem('IQRA_OBE_DELETED_COURSES', JSON.stringify(deletedCourseKeys));

          // Also remove it from local fallback DB just in case
          try {
            const dataStr = localStorage.getItem('IQRA_OBE_FALLBACK_DB');
            if (dataStr) {
              const parsed = JSON.parse(dataStr);
              if (Array.isArray(parsed.courses)) {
                parsed.courses = parsed.courses.filter((c: any) => c.code !== course.code);
                localStorage.setItem('IQRA_OBE_FALLBACK_DB', JSON.stringify(parsed));
              }
            }
          } catch (errDb) {
            console.error(errDb);
          }

          // 6. Clear out local state assignments & student bindings
          const updatedAssignments = teacherAssignments.filter(a => a.courseCode !== course.code);
          setTeacherAssignments(updatedAssignments);
          localStorage.setItem('IQRA_OBE_TEACHER_ASSIGNMENTS', JSON.stringify(updatedAssignments));

          const cleanedBindings = studentBindings.filter(b => b.courseCode !== course.code);
          setStudentBindings(cleanedBindings);
          localStorage.setItem('IQRA_OBE_STUDENT_BINDINGS', JSON.stringify(cleanedBindings));

          // 7. Delete the course from the catalog database (wrap in try catch so if backend blocks with DB integrity, we still succeed locally)
          let idToDelete = course.id || course.code;
          // Fallback in case ID is a client-side generated string and we are using a backend
          if (idToDelete.startsWith('course-')) {
            const matchingRealCourse = courses.find(
              c => c.code === course.code && 
                   String(c.programId).trim().toLowerCase() === String(course.programId).trim().toLowerCase() && 
                   c.id && 
                   !c.id.startsWith('course-')
            );
            if (matchingRealCourse) {
              idToDelete = matchingRealCourse.id;
            } else {
              idToDelete = course.code;
            }
          }

          try {
            await apiService.deleteCourse(idToDelete, course.programId);
          } catch (apiErr) {
            console.warn("Backend course deletion rejected or failed (e.g. constraints), deleting from local views instead:", apiErr);
          }
          
          const updatedCourses = courses.filter(c => !(c.id === course.id || (c.code === course.code && String(c.programId).trim().toLowerCase() === String(course.programId).trim().toLowerCase())));
          setCourses(updatedCourses);

          // 8. Update the sync layer
          syncToInstructorCourses(updatedCourses, teachers, updatedAssignments, cleanedBindings, students);

          triggerNotification(`Course ${course.code} and all related materials deleted successfully.`);
        } catch (err: any) {
          triggerNotification(err.message || "Failed to delete the course.", true);
        }
      }
    });
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;

    if (!editingCourse.code.trim() || !editingCourse.title.trim()) {
      triggerNotification("Please fill in course code and title", true);
      return;
    }

    const uppercaseCode = editingCourse.code.trim().toUpperCase();
    const cleanProg = String(editingCourse.programId).trim().toLowerCase();
    if (courses.some(c => c.code === uppercaseCode && 
      String(c.programId).toLowerCase() === String(editingCourse.programId).toLowerCase() && 
      c.id !== editingCourse.id)) {
      triggerNotification(`Another course with code ${uppercaseCode} for program ${editingCourse.programId} already exists`, true);
      return;
    }

    try {
      const updatedCourseData: Course = {
        ...editingCourse,
        code: uppercaseCode,
        title: editingCourse.title.trim(),
      };

      const updated = await apiService.updateCourse(editingCourse.id, updatedCourseData, editingCourse.programId);
      setCourses(prev => prev.map(c => c.id === editingCourse.id ? { ...c, ...updated } : c));
      setEditingCourse(null);
      triggerNotification(`Course ${uppercaseCode} updated successfully!`);
    } catch (err: any) {
      triggerNotification(err.message || "Failed to update course.", true);
    }
  };

  // 2. Import Courses from Excel File
  const handleImportCoursesExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus({ type: 'idle', message: 'Reading file...' });

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          setImportStatus({ type: 'error', message: 'The Excel file is empty.' });
          return;
        }

        // Helper function to robustly search and retrieve row values by potential headers
        const getRowValue = (rowObj: any, possibleKeys: string[]): any => {
          if (!rowObj) return null;
          const keys = Object.keys(rowObj);
          
          // 1. First try exact case-insensitive match (trimmed)
          for (const pk of possibleKeys) {
            const matchedKey = keys.find(k => k.trim().toLowerCase() === pk.trim().toLowerCase());
            if (matchedKey !== undefined) {
              return rowObj[matchedKey];
            }
          }
          
          // 2. Next try partial substring matching (trimmed)
          for (const pk of possibleKeys) {
            const matchedKey = keys.find(k => {
              const kClean = k.trim().toLowerCase();
              const pkClean = pk.trim().toLowerCase();
              return kClean.includes(pkClean) || pkClean.includes(kClean);
            });
            if (matchedKey !== undefined) {
              return rowObj[matchedKey];
            }
          }
          return null;
        };

        let importedCount = 0;
        let skippedCount = 0;

        const coursesToCreate: Course[] = [];
        const coursesToUpdate: { id: string; programId: string; data: Partial<Course> }[] = [];

        data.forEach((row, idx) => {
          const rawCode = getRowValue(row, ['course code', 'code', 'coursecode']);
          const rawTitle = getRowValue(row, ['course title', 'title', 'coursetitle']);
          const rawType = getRowValue(row, ['type', 'course type']) || 'core';
          const rawDept = getRowValue(row, ['department id', 'departmentid', 'department', 'dept']) || activeDeptId || '';
          const rawProg = getRowValue(row, ['program id', 'programid', 'program', 'prog']) || programs[0]?.id || '';
          const rawCredits = getRowValue(row, ['credit hours', 'credithours', 'credits', 'credit_hours', 'credit']);
          const rawSubtype = getRowValue(row, ['course subtype', 'coursesubtype', 'subtype', 'course type', 'course_subtype', 'course_type', 'sub', 'course sub', 'course_sub']);

          if (rawCode && rawTitle) {
            const codeClean = String(rawCode).trim().toUpperCase();
            const progClean = String(rawProg).trim().toLowerCase();
            const titleClean = String(rawTitle).trim();
            const typeClean: 'core' | 'elective' = String(rawType).toLowerCase().includes('elective') ? 'elective' : 'core';
            const deptClean = String(rawDept).trim().toLowerCase();

            // Parse Credit Hours properly (defaults to 3)
            let creditHours = 3;
            if (rawCredits !== undefined && rawCredits !== null && String(rawCredits).trim() !== '') {
              const parsed = parseInt(String(rawCredits).trim(), 10);
              if (!isNaN(parsed)) {
                creditHours = parsed;
              }
            }

            // Parse Course Subtype (Theory or Lab) - extremely robust matching
            let parsedSubtype: 'Theory' | 'Lab' = 'Theory';
            if (rawSubtype && String(rawSubtype).trim().toLowerCase().includes('lab')) {
              parsedSubtype = 'Lab';
            } else if (codeClean.endsWith('L') || titleClean.toLowerCase().includes('lab')) {
              parsedSubtype = 'Lab';
            }

            // Find if there is an existing course with same code & program in our current list
            const existingCourse = courses.find(
              c => c.code === codeClean &&
              String(c.programId).trim().toLowerCase() === progClean
            );

            if (existingCourse) {
              // Check if any critical attribute changed (like updating Theory to Lab)
              const hasChanges =
                existingCourse.title !== titleClean ||
                existingCourse.type !== typeClean ||
                existingCourse.creditHours !== creditHours ||
                existingCourse.courseType !== parsedSubtype;

              if (hasChanges) {
                coursesToUpdate.push({
                  id: existingCourse.id,
                  programId: existingCourse.programId || progClean,
                  data: {
                    title: titleClean,
                    type: typeClean,
                    creditHours: creditHours,
                    courseType: parsedSubtype
                  }
                });
                importedCount++;
              } else {
                skippedCount++;
              }
            } else {
              // Completely new course or duplicate in current file
              const existingPendingIdx = coursesToCreate.findIndex(
                c => c.code === codeClean && String(c.programId).trim().toLowerCase() === progClean
              );
              if (existingPendingIdx >= 0) {
                // Merge/update duplicate row in the file
                coursesToCreate[existingPendingIdx] = {
                  ...coursesToCreate[existingPendingIdx],
                  title: titleClean,
                  type: typeClean,
                  creditHours: creditHours,
                  courseType: parsedSubtype
                };
              } else {
                const newC: Course = {
                  id: `course-imported-${Date.now()}-${idx}`,
                  code: codeClean,
                  title: titleClean,
                  type: typeClean,
                  departmentId: deptClean,
                  programId: progClean,
                  mappedGAs: [],
                  creditHours: creditHours,
                  courseType: parsedSubtype
                };
                coursesToCreate.push(newC);
                importedCount++;
              }
            }
          }
        });

        if (importedCount > 0) {
          const isBackend = !!localStorage.getItem('access');
          let finalCourseList = [...courses];

          if (isBackend) {
            setImportStatus({ type: 'idle', message: `Syncing ${importedCount} courses with backend server...` });
            
            const createdCourses: Course[] = [];
            const updatedCourses: Course[] = [];
            const failedCourses: { code: string; title: string; reason: string }[] = [];

            // Process courses in batches of 3 to avoid overwhelming single-worker backend servers
            const BATCH_SIZE = 3;

            // 1. Create new courses in controlled batches
            for (let i = 0; i < coursesToCreate.length; i += BATCH_SIZE) {
              const chunk = coursesToCreate.slice(i, i + BATCH_SIZE);
              await Promise.all(chunk.map(async (c) => {
                try {
                  const res = await apiService.createCourse(c);
                  createdCourses.push(res);
                } catch (cErr: any) {
                  console.warn(`Failed to create course ${c.code}:`, cErr);
                  // Attempt update as fallback if creation failed (e.g. course already exists in backend DB)
                  try {
                    const resUp = await apiService.updateCourse(c.code, c, c.programId);
                    updatedCourses.push(resUp);
                  } catch (upErr: any) {
                    failedCourses.push({
                      code: c.code,
                      title: c.title,
                      reason: cErr.message || 'Server rejected course'
                    });
                  }
                }
              }));
            }

            // 2. Update existing changed courses in controlled batches
            for (let i = 0; i < coursesToUpdate.length; i += BATCH_SIZE) {
              const chunk = coursesToUpdate.slice(i, i + BATCH_SIZE);
              await Promise.all(chunk.map(async (up) => {
                try {
                  const res = await apiService.updateCourse(up.id, up.data, up.programId);
                  updatedCourses.push(res);
                } catch (upErr: any) {
                  console.warn(`Failed to update course ${up.id}:`, upErr);
                  failedCourses.push({
                    code: up.id,
                    title: up.data.title || up.id,
                    reason: upErr.message || 'Server rejected update'
                  });
                }
              }));
            }

            // 3. Assemble the updated state list incorporating all successes
            const updatedCodes = new Set([
              ...coursesToUpdate.map(up => up.id),
              ...createdCourses.map(c => c.id),
              ...createdCourses.map(c => c.code),
              ...updatedCourses.map(c => c.id),
              ...updatedCourses.map(c => c.code)
            ]);
            const unaffectedCourses = courses.filter(c => !updatedCodes.has(c.id) && !updatedCodes.has(c.code));
            finalCourseList = [...unaffectedCourses, ...createdCourses, ...updatedCourses];

            if (failedCourses.length > 0) {
              const sampleFail = failedCourses.slice(0, 2).map(f => `${f.code} (${f.reason})`).join(', ');
              const moreText = failedCourses.length > 2 ? ` and ${failedCourses.length - 2} other(s)` : '';
              console.warn("Backend bulk sync finished with partial failures:", failedCourses);
              setImportStatus({
                type: 'error',
                message: `Synced ${createdCourses.length + updatedCourses.length} courses. ${failedCourses.length} course(s) could not be registered: ${sampleFail}${moreText}.`
              });
              triggerNotification(`Synced ${createdCourses.length + updatedCourses.length} courses (${failedCourses.length} failed).`, true);
            }
          } else {
            // Offline fallback / local storage only
            const currentLocalData = ({ departments: [], programs: [], courses: [], gas: [], students: [], assessments: [], enrollments: [], peos: [] });
            let localCourses = [...currentLocalData.courses];

            // Apply updates
            localCourses = localCourses.map(c => {
              const updateItem = coursesToUpdate.find(up => up.id === c.id);
              if (updateItem) {
                return { ...c, ...updateItem.data, courseType: updateItem.data.courseType };
              }
              return c;
            });

            // Add new ones
            localCourses = [...localCourses, ...coursesToCreate];

            const updatedDB = { ...currentLocalData, courses: localCourses };
            apiService.saveLocalStorageData(updatedDB);
            finalCourseList = localCourses;
          }

          setCourses(finalCourseList);
          setImportStatus({ 
            type: 'success', 
            message: `Successfully processed ${importedCount} courses! (${coursesToCreate.length} created, ${coursesToUpdate.length} updated, skipped ${skippedCount} exact duplicates)` 
          });
          triggerNotification(`Processed ${importedCount} courses successfully!`);
        } else {
          setImportStatus({ 
            type: 'error', 
            message: `No new or updated courses were imported. (Skipped ${skippedCount} exact duplicates)` 
          });
        }
      } catch (err: any) {
        console.error(err);
        setImportStatus({ type: 'error', message: 'Failed to parse Excel file. Check column headers.' });
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadExcelTemplate = () => {
    const headers = [
      ["Course Code", "Course Title", "Type", "Credit Hours", "Course Subtype", "Department ID", "Program ID"],
      ["CS-312", "Web Engineering", "core", 3, "Theory", departments[0]?.id || "DEPT_ID", programs[0]?.id || "PROG_ID"],
      ["CS-312L", "Web Engineering Lab", "core", 1, "Lab", departments[0]?.id || "DEPT_ID", programs[0]?.id || "PROG_ID"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Courses Template");
    XLSX.writeFile(wb, "iqra_courses_import_template.xlsx");
  };

  // 3. Add Teachers
  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName.trim() || !teacherEmail.trim() || !teacherEmployeeId.trim()) {
      triggerNotification("Please fill in teacher name, institutional email, and employee ID", true);
      return;
    }

    const lowercaseEmail = teacherEmail.trim().toLowerCase();
    const empId = teacherEmployeeId.trim().toUpperCase();

    if (teachers.some(t => t.email.toLowerCase() === lowercaseEmail)) {
      triggerNotification(`Teacher with email ${lowercaseEmail} already registered`, true);
      return;
    }
    if (teachers.some(t => matchTeacher(t, empId))) {
      triggerNotification(`Teacher with employee ID ${empId} already registered`, true);
      return;
    }

    try {
      const payload = {
        name: teacherName.trim(),
        email: lowercaseEmail,
        employeeId: empId,
        designation: teacherDesignation,
        departmentId: teacherDept
      };

      const createdTeacher = await apiService.createTeacher(payload);

      const newTeacher: Teacher = {
        id: createdTeacher.employeeId || empId,
        employeeId: createdTeacher.employeeId || empId,
        name: createdTeacher.name || payload.name,
        email: createdTeacher.email || payload.email,
        departmentId: createdTeacher.departmentId || payload.departmentId,
        designation: createdTeacher.designation || payload.designation,
        departmentName: createdTeacher.departmentName
      };

      const updatedTeachers = [...teachers, newTeacher];
      setTeachers(updatedTeachers);
      localStorage.setItem('IQRA_OBE_TEACHERS', JSON.stringify(updatedTeachers));

      setTeacherName('');
      setTeacherEmail('');
      setTeacherEmployeeId('');
      setTeacherDesignation('Lecturer');

      triggerNotification(`Teacher ${newTeacher.name} registered. Default login password: ${DEFAULT_TEMP_PASSWORD}`);
    } catch (err: any) {
      console.error(err);
      triggerNotification(err.message || "Failed to onboard faculty.", true);
    }
  };

  const handleDeleteTeacher = (id: string) => {
    const t = teachers.find(x => matchTeacher(x, id));
    if (!t) return;
    
    setConfirmDialog({
      isOpen: true,
      title: "Remove Faculty Member",
      message: `Are you sure you want to remove teacher ${t.name}?`,
      confirmText: "Remove Teacher",
      cancelText: "Cancel",
      isDanger: true,
      onConfirm: async () => {
        try {
          const empId = getTeacherId(t);
          await apiService.deleteTeacher(empId);

          const updatedTeachers = teachers.filter(x => !matchTeacher(x, empId));
          const updatedAssignments = teacherAssignments.filter(x => x.teacherId !== t.id && x.teacherId !== empId);

          setTeachers(updatedTeachers);
          setTeacherAssignments(updatedAssignments);

          localStorage.setItem('IQRA_OBE_TEACHERS', JSON.stringify(updatedTeachers));
          localStorage.setItem('IQRA_OBE_TEACHER_ASSIGNMENTS', JSON.stringify(updatedAssignments));

          // Get all course codes that still have an active assignment after this removal
          const activeCourseCodesAfterRemoval = new Set(updatedAssignments.map(a => a.courseCode));

          // Drop bindings for courses that no longer have any teacher assigned
          const cleanedBindings = studentBindings.filter(b =>
            activeCourseCodesAfterRemoval.has(b.courseCode)
          );
          setStudentBindings(cleanedBindings);
          localStorage.setItem('IQRA_OBE_STUDENT_BINDINGS', JSON.stringify(cleanedBindings));

          syncToInstructorCourses(courses, updatedTeachers, updatedAssignments, cleanedBindings, students);
          triggerNotification(`Teacher ${t.name} and their assignments successfully deleted.`);
        } catch (err: any) {
          console.error(err);
          triggerNotification(err.message || `Failed to delete teacher ${t.name}`, true);
        }
      }
    });
  };

  // 4. Assign Course to Teacher
  const handleAssignCourseToTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId || !selectedCourseCodeForTeacher) {
      triggerNotification("Please select both a teacher and a course", true);
      return;
    }

    // Check if assignment already exists with same parameters
    const exists = teacherAssignments.some(
      a => a.teacherId === selectedTeacherId && 
           a.courseCode === selectedCourseCodeForTeacher &&
           a.programId === (selectedProgramForTeacher || undefined) &&
           a.academicYear === assignmentAcademicYear
    );

    if (exists) {
      triggerNotification(`This teacher assignment for course code ${selectedCourseCodeForTeacher} in program/term ${assignmentAcademicYear} already exists.`, true);
      return;
    }

    // Validation check: Another teacher cannot teach the same course in the same program/academic year
    const targetProg = selectedProgramForTeacher || undefined;
    const conflictingAssignment = teacherAssignments.find(a => {
      // Must be the same course code
      if (a.courseCode !== selectedCourseCodeForTeacher) return false;
      // Must be the same academic year
      if (a.academicYear !== assignmentAcademicYear) return false;
      // Must be a different teacher
      if (a.teacherId === selectedTeacherId) return false;

      // Program check:
      if (targetProg) {
        // Conflicting if the existing is "All Programs (Shared)" (undefined) or matches our target program
        return !a.programId || a.programId === targetProg;
      }
      // If we are assigning to "All Programs", it conflicts with any existing assignment for this course
      return true;
    });

    if (conflictingAssignment) {
      const conflictingTeacher = teachers.find(t => matchTeacher(t, conflictingAssignment.teacherId));
      const conflictingProgObj = programs.find(p => p.id === conflictingAssignment.programId);
      const progDesc = conflictingProgObj ? conflictingProgObj.code.toUpperCase() : 'All Programs (Shared)';
      
      triggerNotification(
        `Cannot assign course: ${selectedCourseCodeForTeacher} is already being taught by ${conflictingTeacher?.name || 'another teacher'} in ${progDesc} for ${assignmentAcademicYear}.`,
        true
      );
      return;
    }

    let assignmentId: string | number | undefined;

    try {
      const resData = await apiService.assignCourse(
        selectedTeacherId,
        selectedCourseCodeForTeacher,
        selectedProgramForTeacher || undefined,
        assignmentAcademicYear
      );
      if (resData && (resData.courseId || resData.id)) {
        assignmentId = resData.courseId || resData.id;
      }
    } catch (err: any) {
      console.error(err);
      triggerNotification(err.message || "Failed to save course assignment to backend.", true);
      return;
    }

    const newAssignment: TeacherCourseAssignment = {
      id: assignmentId,
      teacherId: selectedTeacherId,
      courseCode: selectedCourseCodeForTeacher,
      programId: selectedProgramForTeacher || undefined,
      academicYear: assignmentAcademicYear,
      status: 'active'
    };

    const updatedAssignments = [...teacherAssignments, newAssignment];
    setTeacherAssignments(updatedAssignments);
    localStorage.setItem('IQRA_OBE_TEACHER_ASSIGNMENTS', JSON.stringify(updatedAssignments));

    // Instantly sync changes into IQRA_OBE_INSTRUCTOR_COURSES
    syncToInstructorCourses(courses, teachers, updatedAssignments, studentBindings, students);

    const teacherObj = teachers.find(t => matchTeacher(t, selectedTeacherId));
    const progObj = programs.find(p => p.id === selectedProgramForTeacher);
    const suffix = progObj ? ` for ${progObj.code.toUpperCase()}` : '';
    triggerNotification(`Successfully assigned course ${selectedCourseCodeForTeacher}${suffix} to ${teacherObj?.name}`);
  };

  const handleRemoveTeacherAssignment = async (teacherId: string, courseCode: string, programId?: string) => {
    const assignment = teacherAssignments.find(
      a => a.teacherId === teacherId && 
           a.courseCode === courseCode && 
           a.programId === programId
    );
    const t = teachers.find(x => matchTeacher(x, teacherId));
    const employeeId = t?.employeeId || teacherId;
    const assignmentProgId = assignment?.programId || programId;
    const cleanCourseProg = assignmentProgId ? String(assignmentProgId).trim().toLowerCase() : '';
    const finalProgId = assignmentProgId || courses.find(c => c.code === courseCode && (!cleanCourseProg || String(c.programId).trim().toLowerCase() === cleanCourseProg))?.programId || courses.find(c => c.code === courseCode)?.programId || programs.find(p => p.departmentId === activeDeptId)?.id || programs[0]?.id || '';
    
    let acadYear = assignment?.academicYear || 'Fall-2024';
    acadYear = acadYear.replace(/ /g, '-');
    if (acadYear) {
      acadYear = acadYear.charAt(0).toUpperCase() + acadYear.slice(1);
    }
    const backendCourseId = `course-assigned-${courseCode}-${employeeId}-${finalProgId}-${acadYear}`;

    try {
      await apiService.removeCourseAssignment(teacherId, courseCode, programId, acadYear);
      await apiService.deleteInstructorCourse(backendCourseId);
    } catch (err: any) {
      console.warn("Failed to remove course assignment or instructor course from backend. Syncing locally.", err);
      if (err && err.message) {
        triggerNotification(`Warning: ${err.message}`, true);
      }
    }

    const updatedAssignments = teacherAssignments.filter(
      a => !(a.teacherId === teacherId && 
             a.courseCode === courseCode && 
             a.programId === programId)
    );
    setTeacherAssignments(updatedAssignments);
    localStorage.setItem('IQRA_OBE_TEACHER_ASSIGNMENTS', JSON.stringify(updatedAssignments));

    // Get all course codes that still have an active assignment after this removal
    const activeCourseCodesAfterRemoval = new Set(updatedAssignments.map(a => a.courseCode));

    // Drop bindings for courses that no longer have any teacher assigned
    const cleanedBindings = studentBindings.filter(b =>
      activeCourseCodesAfterRemoval.has(b.courseCode)
    );
    setStudentBindings(cleanedBindings);
    localStorage.setItem('IQRA_OBE_STUDENT_BINDINGS', JSON.stringify(cleanedBindings));

    syncToInstructorCourses(courses, teachers, updatedAssignments, cleanedBindings, students);
    triggerNotification(`Removed course assignment ${courseCode} from teacher.`);
  };

  const handleFinalizeCourse = (assignment: TeacherCourseAssignment) => {
    const teacher = teachers.find(t => matchTeacher(t, assignment.teacherId));
    const assignmentProgClean = assignment.programId ? String(assignment.programId).trim().toLowerCase() : '';
    const course = courses.find(c => c.code === assignment.courseCode && (!assignmentProgClean || String(c.programId).trim().toLowerCase() === assignmentProgClean)) || courses.find(c => c.code === assignment.courseCode);
    const defaultDeptProgram = programs.find(p => p.departmentId === activeDeptId)?.id || programs[0]?.id || '';
    const fallbackProgramId = course?.programId || programs.find(p => p.departmentId === course?.departmentId)?.id || defaultDeptProgram;
    const finalProgramId = assignment.programId || fallbackProgramId;
    const employeeId = teacher?.employeeId || assignment.teacherId;
    let acadYear = assignment.academicYear || 'Fall-2024';
    acadYear = acadYear.replace(/ /g, '-');
    if (acadYear) {
      acadYear = acadYear.charAt(0).toUpperCase() + acadYear.slice(1);
    }
    const courseId = `course-assigned-${assignment.courseCode}-${employeeId}-${finalProgramId}-${acadYear}`;

    setConfirmDialog({
      isOpen: true,
      title: "Close Semester & Finalize Course",
      message: `Are you sure you want to CLOSE THE SEMESTER for course ${assignment.courseCode} (${course?.title || ''})?\n\nThis will lock the course, snapshot current student marks, compute final letter grades & GPA, and finalize official transcripts. Instructors will NO LONGER be able to modify any marks.`,
      confirmText: "Close Semester",
      cancelText: "Cancel",
      isDanger: true,
      onConfirm: async () => {
        try {
          // 1. Hit the backend finalize-course endpoint
          await apiService.finalizeCourse(courseId, acadYear);

          // 2. Locally mark assignment as closed
          const updatedAssignments = teacherAssignments.map(a => {
            if (a.teacherId === assignment.teacherId && a.courseCode === assignment.courseCode && a.programId === assignment.programId) {
              return { ...a, status: 'closed' as const };
            }
            return a;
          });

          setTeacherAssignments(updatedAssignments);
          localStorage.setItem('IQRA_OBE_TEACHER_ASSIGNMENTS', JSON.stringify(updatedAssignments));

          // 3. Instantly sync changes to InstructorCourses
          syncToInstructorCourses(courses, teachers, updatedAssignments, studentBindings, students);

          triggerNotification(`Successfully finalized and closed ${assignment.courseCode} for academic year ${acadYear}. Transcripts generated!`);
        } catch (err: any) {
          console.error(err);
          const errMsgLower = (err.message || '').toLowerCase();
          const isCourseNotFound = errMsgLower.includes("not found") || errMsgLower.includes("404") || errMsgLower.includes("permission");
          
          if (isCourseNotFound) {
            // Resilient fallback: Allow local finalization/close so the Admin is not blocked
            const updatedAssignments = teacherAssignments.map(a => {
              if (a.teacherId === assignment.teacherId && a.courseCode === assignment.courseCode && a.programId === assignment.programId) {
                return { ...a, status: 'closed' as const };
              }
              return a;
            });

            setTeacherAssignments(updatedAssignments);
            localStorage.setItem('IQRA_OBE_TEACHER_ASSIGNMENTS', JSON.stringify(updatedAssignments));

            // Instantly sync changes to InstructorCourses
            syncToInstructorCourses(courses, teachers, updatedAssignments, studentBindings, students);

            triggerNotification(
              `Closed locally! ${assignment.courseCode} has been finalized in your local workspace. (The instructor hasn't initialized/saved this course on the server yet.)`,
              false
            );
          } else {
            triggerNotification(err.message || "Failed to finalize and close course.", true);
          }
        }
      }
    });
  };

  // 5. Manage Predefined Plans
  const handleAddCourseToSemesterPlan = async (code: string) => {
    const updatedPlans = semesterPlans.map(plan => {
      if (plan.programId === selectedPlanProg && plan.semester === selectedPlanSem) {
        if (plan.courseCodes.includes(code)) return plan;
        return { ...plan, courseCodes: [...plan.courseCodes, code] };
      }
      return plan;
    });

    // If plan doesn't exist yet, create it
    const planExists = semesterPlans.some(p => p.programId === selectedPlanProg && p.semester === selectedPlanSem);
    let finalPlans = updatedPlans;
    if (!planExists) {
      finalPlans = [...semesterPlans, { programId: selectedPlanProg, semester: selectedPlanSem, courseCodes: [code] }];
    }

    const activePlan = finalPlans.find(p => p.programId === selectedPlanProg && p.semester === selectedPlanSem);
    if (activePlan) {
      try {
        await apiService.saveSemesterPlan(activePlan.programId, activePlan.semester, activePlan.courseCodes);
      } catch (err) {
        console.warn("Failed to save semester plan to backend.", err);
      }
    }

    setSemesterPlans(finalPlans);
    localStorage.setItem('IQRA_OBE_SEMESTER_PLANS', JSON.stringify(finalPlans));
    triggerNotification(`Added course ${code} to ${selectedPlanProg.toUpperCase()} ${selectedPlanSem} plan.`);
  };

  const handleRemoveCourseFromSemesterPlan = async (code: string) => {
    const updatedPlans = semesterPlans.map(plan => {
      if (plan.programId === selectedPlanProg && plan.semester === selectedPlanSem) {
        return { ...plan, courseCodes: plan.courseCodes.filter(c => c !== code) };
      }
      return plan;
    });

    const activePlan = updatedPlans.find(p => p.programId === selectedPlanProg && p.semester === selectedPlanSem);
    if (activePlan) {
      try {
        await apiService.saveSemesterPlan(activePlan.programId, activePlan.semester, activePlan.courseCodes);
      } catch (err) {
        console.warn("Failed to update semester plan on backend.", err);
      }
    }

    setSemesterPlans(updatedPlans);
    localStorage.setItem('IQRA_OBE_SEMESTER_PLANS', JSON.stringify(updatedPlans));
    triggerNotification(`Removed course ${code} from ${selectedPlanProg.toUpperCase()} ${selectedPlanSem} plan.`);
  };

  // Courses a student is bound to that are NOT in the semester plan of their own
  // program + current semester (e.g. demo data that enrolled everyone in every
  // course). Students with no plan for their semester are left alone.
  const getOffPlanBindings = (student: Student): StudentCourseBinding[] => {
    const sem = String(student.semester || '1st').trim().toLowerCase();
    const plan = semesterPlans.find(p =>
      areProgramsCompatible(p.programId, String(student.programId || '').trim().toLowerCase()) &&
      String(p.semester || '').trim().toLowerCase() === sem
    );
    if (!plan) return [];
    const allowed = new Set(plan.courseCodes.map(c => normalizeCourseCode(c)));
    return studentBindings.filter(b =>
      areRegNosEqual(b.studentRegNo, student.regNo) && !allowed.has(normalizeCourseCode(b.courseCode))
    );
  };

  // Students (in this department) that have off-plan courses, for the bulk button.
  const offPlanStudents = useMemo(() => {
    const regIndex = new Map<string, Student>();
    students.forEach(st => regIndex.set(normalizeRegNo(st.regNo), st));
    const planCache = new Map<string, Set<string> | null>();
    const planFor = (st: Student) => {
      const key = `${String(st.programId || '').toLowerCase()}|${String(st.semester || '1st').toLowerCase()}`;
      if (!planCache.has(key)) {
        const plan = semesterPlans.find(p =>
          areProgramsCompatible(p.programId, String(st.programId || '').trim().toLowerCase()) &&
          String(p.semester || '').trim().toLowerCase() === String(st.semester || '1st').trim().toLowerCase()
        );
        planCache.set(key, plan ? new Set(plan.courseCodes.map(c => normalizeCourseCode(c))) : null);
      }
      return planCache.get(key)!;
    };
    const found = new Set<Student>();
    studentBindings.forEach(b => {
      const st = regIndex.get(normalizeRegNo(b.studentRegNo));
      if (!st || st.departmentId !== activeDeptId) return;
      const allowed = planFor(st);
      if (allowed && !allowed.has(normalizeCourseCode(b.courseCode))) found.add(st);
    });
    return Array.from(found);
  }, [students, studentBindings, semesterPlans, activeDeptId]);

  // Remove every off-plan binding for the given students, then push the
  // corrected rosters to the server (the enroll call replaces the roster).
  const resetStudentsToPlan = (targets: Student[]) => {
    const offKeys = new Set<string>();
    const touchedCodes = new Set<string>();
    let removeCount = 0;
    targets.forEach(st => {
      getOffPlanBindings(st).forEach(b => {
        offKeys.add(`${normalizeRegNo(b.studentRegNo)}|${normalizeCourseCode(b.courseCode)}`);
        touchedCodes.add(normalizeCourseCode(b.courseCode));
      });
    });
    const kept = studentBindings.filter(b => {
      const off = offKeys.has(`${normalizeRegNo(b.studentRegNo)}|${normalizeCourseCode(b.courseCode)}`);
      if (off) removeCount++;
      return !off;
    });
    setStudentBindings(kept);
    localStorage.setItem('IQRA_OBE_STUDENT_BINDINGS', JSON.stringify(kept));
    syncToInstructorCourses(courses, teachers, teacherAssignments, kept, students, touchedCodes);
    triggerNotification(`Removed ${removeCount} extra course enrollment${removeCount === 1 ? '' : 's'} for ${targets.length} student${targets.length === 1 ? '' : 's'}.`);
  };

  const confirmResetToPlan = (targets: Student[]) => {
    const extra = targets.reduce((n, st) => n + getOffPlanBindings(st).length, 0);
    setConfirmDialog({
      isOpen: true,
      title: 'Reset to semester plan',
      message: `This removes ${extra} enrollment${extra === 1 ? '' : 's'} outside the semester plan for ${targets.length} student${targets.length === 1 ? '' : 's'}, keeping only the courses of their own semester.\n\nMarks entered for those courses are removed with them. Closed courses are not changed.`,
      confirmText: 'Reset to plan',
      cancelText: 'Cancel',
      isDanger: true,
      onConfirm: async () => resetStudentsToPlan(targets),
    });
  };

  // 6. Retrieve Registered Students & Auto-enroll based on Semester Plan
  const handleAutoEnrollStudents = () => {
    if (students.length === 0) {
      triggerNotification("No registered students found in Admissions.", true);
      return;
    }

    let enrollCount = 0;
    const newBindings: StudentCourseBinding[] = [...studentBindings];

    students.forEach(student => {
      const sem = String(student.semester || '1st').trim().toLowerCase();
      const prog = String(student.programId || '').trim().toLowerCase();

      // Find the predefined plan for this program and semester
      const plan = semesterPlans.find(p => 
        areProgramsCompatible(p.programId, prog) && 
        String(p.semester || '').trim().toLowerCase() === sem
      );
      if (plan && plan.courseCodes.length > 0) {
        plan.courseCodes.forEach(code => {
          // Check if already bound
          const alreadyBound = newBindings.some(
            b => areRegNosEqual(b.studentRegNo, student.regNo) && 
                 normalizeCourseCode(b.courseCode) === normalizeCourseCode(code)
          );
          if (!alreadyBound) {
            newBindings.push({ studentRegNo: student.regNo, courseCode: code });
            enrollCount++;
          }
        });
      }
    });

    setStudentBindings(newBindings);
    localStorage.setItem('IQRA_OBE_STUDENT_BINDINGS', JSON.stringify(newBindings));

    // Propagate to teacher dashboard courses immediately
    syncToInstructorCourses(courses, teachers, teacherAssignments, newBindings, students);

    if (enrollCount > 0) {
      triggerNotification(`Auto-enrollment complete! Enrolled students into ${enrollCount} semester-plan courses.`);
    } else {
      triggerNotification("All students are already fully enrolled according to their semester plans.", false);
    }
  };

  // 7. Manual Bind/Unbind for Specific Student
  const handleManualBindCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentRegNo || !selectedCourseCodeForStudent) {
      triggerNotification("Please select both a student and a course", true);
      return;
    }

    const alreadyBound = studentBindings.some(
      b => areRegNosEqual(b.studentRegNo, selectedStudentRegNo) && 
           normalizeCourseCode(b.courseCode) === normalizeCourseCode(selectedCourseCodeForStudent)
    );

    if (alreadyBound) {
      triggerNotification("Student is already enrolled in this course.", true);
      return;
    }

    const newBinding: StudentCourseBinding = {
      studentRegNo: selectedStudentRegNo,
      courseCode: selectedCourseCodeForStudent
    };

    const updatedBindings = [...studentBindings, newBinding];
    setStudentBindings(updatedBindings);
    localStorage.setItem('IQRA_OBE_STUDENT_BINDINGS', JSON.stringify(updatedBindings));

    syncToInstructorCourses(courses, teachers, teacherAssignments, updatedBindings, students);

    // Remember this was a deliberate enrollment, so a curriculum course from
    // another semester still counts as Studying and survives auto-enroll cleanup.
    const updatedStatuses = {
      ...studentCourseStatuses,
      [selectedStudentRegNo]: {
        ...(studentCourseStatuses[selectedStudentRegNo] || {}),
        [selectedCourseCodeForStudent]: 'studying' as const
      },
      [normalizeRegNo(selectedStudentRegNo)]: {
        ...(studentCourseStatuses[normalizeRegNo(selectedStudentRegNo)] || {}),
        [normalizeCourseCode(selectedCourseCodeForStudent)]: 'studying' as const
      }
    };
    setStudentCourseStatuses(updatedStatuses);
    localStorage.setItem('IQRA_OBE_STUDENT_COURSE_STATUSES', JSON.stringify(updatedStatuses));

    const studentObj = students.find(s => areRegNosEqual(s.regNo, selectedStudentRegNo));
    triggerNotification(`Manually enrolled ${studentObj?.name || selectedStudentRegNo} in course ${selectedCourseCodeForStudent}`);
    setSelectedCourseCodeForStudent('');
  };

  const handleManualUnbindCourse = (regNo: string, code: string) => {
    const updatedBindings = studentBindings.filter(
      b => !(areRegNosEqual(b.studentRegNo, regNo) && 
             normalizeCourseCode(b.courseCode) === normalizeCourseCode(code))
    );
    setStudentBindings(updatedBindings);
    localStorage.setItem('IQRA_OBE_STUDENT_BINDINGS', JSON.stringify(updatedBindings));

    syncToInstructorCourses(courses, teachers, teacherAssignments, updatedBindings, students);

    const studentObj = students.find(s => areRegNosEqual(s.regNo, regNo));
    triggerNotification(`Unenrolled ${studentObj?.name || regNo} from course ${code}`);
  };

  // Student academic pathway course status helpers
  const getStatusOverride = (studentRegNo: string, courseCode: string) => {
    const studentOverrides = studentCourseStatuses[studentRegNo] || studentCourseStatuses[normalizeRegNo(studentRegNo)];
    return studentOverrides ? (studentOverrides[courseCode] || studentOverrides[normalizeCourseCode(courseCode)]) : undefined;
  };

  // True when the course belongs to the student's program curriculum but to a
  // DIFFERENT semester than the one the student is in. A binding for such a
  // course is only a real enrollment if the admin explicitly chose it
  // (Repeat / Enroll Early); otherwise it is a stale enrollment, e.g. a student
  // who ended up on every curriculum course's roster.
  const isOffSemesterCurriculumCourse = (student: Student, courseCode: string): boolean => {
    const codeKey = normalizeCourseCode(courseCode);
    const coursePlans = semesterPlans.filter(
      p => areProgramsCompatible(p.programId, student.programId) && p.courseCodes.some(cc => normalizeCourseCode(cc) === codeKey)
    );
    if (coursePlans.length === 0) return false; // elective / outside course
    const studentSem = String(student.semester || '1st').trim().toLowerCase();
    return !coursePlans.some(p => String(p.semester || '').trim().toLowerCase() === studentSem);
  };

  const getCourseStatus = (studentRegNo: string, courseCode: string): 'studied' | 'studying' | 'failed' | 'later' | 'deferred' => {
    const student = students.find(s => areRegNosEqual(s.regNo, studentRegNo));
    const overrideStatus = getStatusOverride(studentRegNo, courseCode);

    // 1. Is it currently bound/enrolled? If so, check if there is an active teacher assigned to this course.
    const hasTeacherAssigned = teacherAssignments.some(
      a => normalizeCourseCode(a.courseCode) === normalizeCourseCode(courseCode) && (!a.programId || areProgramsCompatible(a.programId, student?.programId))
    );

    const isStudying = studentBindings.some(
      b => areRegNosEqual(b.studentRegNo, studentRegNo) &&
           normalizeCourseCode(b.courseCode) === normalizeCourseCode(courseCode)
    );
    const isGenuineEnrollment = !student || overrideStatus === 'studying' || !isOffSemesterCurriculumCourse(student, courseCode);
    if (isStudying && hasTeacherAssigned && isGenuineEnrollment) return 'studying';

    // 2. Is there an explicit override?
    // If override is 'studying' but it's not in bindings anymore, it means it was unenrolled, so treat as deferred/failed/etc.
    if (overrideStatus && overrideStatus !== 'studying') {
      return overrideStatus;
    }

    // 3. Fallback to default calculation based on student's current semester vs course's semester
    if (!student) return 'deferred';

    // Find the course's semester in the student's program plans
    const coursePlan = semesterPlans.find(
      p => areProgramsCompatible(p.programId, student.programId) && p.courseCodes.some(cc => normalizeCourseCode(cc) === normalizeCourseCode(courseCode))
    );

    if (!coursePlan) {
      // Not in the regular curriculum for this program (e.g. general department course)
      return 'deferred';
    }

    const parseSem = (semStr: string): number => {
      const num = parseInt(semStr);
      return isNaN(num) ? 1 : num;
    };

    const studentSemNum = parseSem(student.semester || '1st');
    const courseSemNum = parseSem(coursePlan.semester);

    if (courseSemNum < studentSemNum) {
      return 'studied'; // By default, courses in previous semesters are already completed
    } else if (courseSemNum === studentSemNum) {
      return 'deferred'; // Remaining/Deferred (not currently in bindings, but in current semester)
    } else {
      return 'later'; // Future semester
    }
  };

  const updateStudentCourseStatus = (studentRegNo: string, courseCode: string, newStatus: 'studied' | 'studying' | 'failed' | 'later' | 'deferred') => {
    // 1. Update bindings based on the new status
    let updatedBindings = [...studentBindings];
    const isCurrentlyEnrolled = studentBindings.some(
      b => areRegNosEqual(b.studentRegNo, studentRegNo) && 
           normalizeCourseCode(b.courseCode) === normalizeCourseCode(courseCode)
    );

    if (newStatus === 'studying') {
      if (!isCurrentlyEnrolled) {
        updatedBindings.push({ studentRegNo, courseCode });
      }
    } else {
      if (isCurrentlyEnrolled) {
        updatedBindings = updatedBindings.filter(
          b => !(areRegNosEqual(b.studentRegNo, studentRegNo) && 
                 normalizeCourseCode(b.courseCode) === normalizeCourseCode(courseCode))
        );
      }
    }

    setStudentBindings(updatedBindings);
    localStorage.setItem('IQRA_OBE_STUDENT_BINDINGS', JSON.stringify(updatedBindings));
    syncToInstructorCourses(courses, teachers, teacherAssignments, updatedBindings, students);

    // 2. Update custom statuses
    const updatedStatuses = {
      ...studentCourseStatuses,
      [studentRegNo]: {
        ...(studentCourseStatuses[studentRegNo] || {}),
        [courseCode]: newStatus
      },
      [normalizeRegNo(studentRegNo)]: {
        ...(studentCourseStatuses[normalizeRegNo(studentRegNo)] || {}),
        [normalizeCourseCode(courseCode)]: newStatus
      }
    };
    setStudentCourseStatuses(updatedStatuses);
    localStorage.setItem('IQRA_OBE_STUDENT_COURSE_STATUSES', JSON.stringify(updatedStatuses));

    const studentObj = students.find(s => areRegNosEqual(s.regNo, studentRegNo));
    const studentProgClean = studentObj?.programId ? String(studentObj.programId).trim().toLowerCase() : '';
    const courseObj = courses.find(c => normalizeCourseCode(c.code) === normalizeCourseCode(courseCode) && (!studentProgClean || String(c.programId).trim().toLowerCase() === studentProgClean)) || courses.find(c => normalizeCourseCode(c.code) === normalizeCourseCode(courseCode));
    
    // Custom notifications depending on transition
    let msg = `Updated ${courseCode} status for ${studentObj?.name || studentRegNo}`;
    if (newStatus === 'studying') {
      msg = `Enrolled ${studentObj?.name || studentRegNo} in ${courseCode} - ${courseObj?.title || 'Course'}`;
    } else if (newStatus === 'failed') {
      msg = `Marked ${courseCode} as Failed / Backlog for ${studentObj?.name}. They need to register for this backlog course.`;
    } else if (newStatus === 'studied') {
      msg = `Marked ${courseCode} as Already Studied / Passed for ${studentObj?.name}.`;
    } else if (newStatus === 'deferred') {
      msg = `Unenrolled ${studentObj?.name} from ${courseCode} (Moved to Deferred / Remaining).`;
    }
    triggerNotification(msg);
  };


  // === FILTER & SEARCH CALCULATIONS ===

  // Active Semester Plan Courses
  const activeSemesterPlanCourses = useMemo(() => {
    const plan = semesterPlans.find(p => p.programId === selectedPlanProg && p.semester === selectedPlanSem);
    return plan ? plan.courseCodes : [];
  }, [semesterPlans, selectedPlanProg, selectedPlanSem]);

  // Available courses (global courses that are NOT in any semester plan of the selected program)
  const availableCoursesForPlan = useMemo(() => {
    return courses.filter(c => {
      // Filter by department of current plan
      const deptMatch = c.departmentId === (programs.find(p => String(p.id).trim().toLowerCase() === String(selectedPlanProg).trim().toLowerCase())?.departmentId || activeDeptId);
      
      const programMatch = !c.programId || 
        String(c.programId).trim().toLowerCase() === String(selectedPlanProg).trim().toLowerCase();

      const isAlreadyInAnyPlan = semesterPlans
        .filter(p => String(p.programId).trim().toLowerCase() === String(selectedPlanProg).trim().toLowerCase())
        .some(p => p.courseCodes.includes(c.code));
      const searchMatch = planSearch === '' || 
        c.code.toLowerCase().includes(planSearch.toLowerCase()) || 
        c.title.toLowerCase().includes(planSearch.toLowerCase());
      
      return deptMatch && programMatch && !isAlreadyInAnyPlan && searchMatch;
    });
  }, [courses, selectedPlanProg, semesterPlans, planSearch, programs]);

  // Course Filter List (Tab 2)
  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      const isSameDept = c.departmentId === activeDeptId;
      if (!isSameDept) return false;

      const isSameProg = !selectedPlanProg || 
        String(c.programId).trim().toLowerCase() === String(selectedPlanProg).trim().toLowerCase();
      if (!isSameProg) return false;

      const q = courseSearch.toLowerCase().trim();
      return q === '' || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q);
    });
  }, [courses, courseSearch, selectedPlanProg, activeDeptId]);

  // Teacher Filter List (Tab 3)
  const filteredTeachers = useMemo(() => {
    return teachers.filter(t => {
      const isSameDept = t.departmentId === activeDeptId;
      if (!isSameDept) return false;
      const q = teacherSearch.toLowerCase().trim();
      return q === '' || t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q);
    });
  }, [teachers, teacherSearch, activeDeptId]);

  // Teacher Assignments Grid (Tab 4)
  const filteredAssignments = useMemo(() => {
    const list = teacherAssignments.filter(a => {
      const teacher = teachers.find(t => matchTeacher(t, a.teacherId));
      const assignmentProgClean = a.programId ? String(a.programId).trim().toLowerCase() : '';
      const course = courses.find(c => c.code === a.courseCode && (!assignmentProgClean || String(c.programId).trim().toLowerCase() === assignmentProgClean)) || courses.find(c => c.code === a.courseCode);
      if (!course || course.departmentId !== activeDeptId) {
        return false;
      }
      const q = assignmentSearch.toLowerCase().trim();

      return q === '' || 
        (teacher?.name || '').toLowerCase().includes(q) || 
        a.courseCode.toLowerCase().includes(q) || 
        (course?.title || '').toLowerCase().includes(q);
    });

    const uniqueMap = new Map<string, TeacherCourseAssignment>();
    list.forEach(a => {
      const teacherKey = String(a.teacherId || '').trim().toLowerCase();
      const courseKey = String(a.courseCode || '').trim().toLowerCase();
      const programKey = String(a.programId || 'all').trim().toLowerCase();
      const yearKey = String(a.academicYear || 'Fall-2024').trim().toLowerCase();
      const key = `${teacherKey}_${courseKey}_${programKey}_${yearKey}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, a);
      }
    });
    return Array.from(uniqueMap.values());
  }, [teacherAssignments, teachers, courses, assignmentSearch, activeDeptId]);

  // Student Filter List (Tab 5)
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const isSameDept = s.departmentId === activeDeptId;
      if (!isSameDept) return false;
      const q = studentSearch.toLowerCase().trim();
      return q === '' || s.name.toLowerCase().includes(q) || s.regNo.toLowerCase().includes(q);
    });
  }, [students, studentSearch, activeDeptId]);

  // Selected student's current bindings
  const selectedStudentCurrentCourses = useMemo(() => {
    if (!selectedStudentRegNo) return [];
    const student = students.find(s => areRegNosEqual(s.regNo, selectedStudentRegNo));
    const studentProgClean = student?.programId ? String(student.programId).trim().toLowerCase() : '';
    return studentBindings
      .filter(b => areRegNosEqual(b.studentRegNo, selectedStudentRegNo))
      .map(b => courses.find(c => c.code === b.courseCode && (!studentProgClean || areProgramsCompatible(c.programId, studentProgClean))) || courses.find(c => c.code === b.courseCode))
      .filter((c): c is Course => !!c);
  }, [selectedStudentRegNo, studentBindings, courses, students]);

  // Available courses to bind manually for selected student (of their department/program)
  const availableCoursesForSelectedStudent = useMemo(() => {
    if (!selectedStudentRegNo) return [];
    const student = students.find(s => areRegNosEqual(s.regNo, selectedStudentRegNo));
    if (!student) return [];

    const enrolledCodes = selectedStudentCurrentCourses.map(c => c.code);

    return courses.filter(c => {
      // Must be same program or department and not already enrolled
      const isSameProgram = areProgramsCompatible(c.programId, student.programId);
      const isSameDept = c.departmentId === student.departmentId;
      const isNotEnrolled = !enrolledCodes.includes(c.code);
      return (isSameProgram || isSameDept) && isNotEnrolled;
    });
  }, [selectedStudentRegNo, students, courses, selectedStudentCurrentCourses]);


  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800">
        <div className="text-center space-y-4">
          <img 
            src="/iqralogo.png" 
            alt="Iqra University Logo" 
            className="mx-auto h-20 w-auto object-contain mb-2 animate-pulse"
            referrerPolicy="no-referrer"
          />
          <p className="text-sm font-sans font-semibold text-indigo-950 animate-pulse">Initializing Department Administrative Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
      {/* HEADER SECTION */}
      <header id="dept-admin-header" className="bg-[#111030] text-white border-b border-indigo-950 px-6 py-3.5 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md transition-all">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-extrabold font-display tracking-tight flex items-center gap-2">
            <span className="text-white hover:text-indigo-200 transition-colors">Iqra University OBE</span>
            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-indigo-500/30">
              DEPARTMENT CONTROL
            </span>
          </h1>
        </div>

        <div className="flex items-center flex-wrap gap-4">
          {/* Program Selector */}
          {adminPrograms.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="header-program-select" className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                Program:
              </label>
              <select
                id="header-program-select"
                value={selectedPlanProg}
                onChange={(e) => setSelectedPlanProg(e.target.value)}
                className="bg-[#1a1740] hover:bg-[#201d4d] border border-indigo-500/30 text-indigo-100 px-3.5 py-1.5 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer transition-all min-w-[220px]"
              >
                {adminPrograms.map((p, idx) => (
                  <option key={`${p.id}-${idx}`} value={p.id} className="bg-[#111030] text-white font-semibold">
                    {p.code.toUpperCase()} — {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            id="btn-logout"
            onClick={onLogout}
            className="px-3.5 py-1.5 bg-transparent hover:bg-white/10 text-white hover:text-white rounded-lg transition-all border border-white/20 hover:border-white/40 flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
            title="Sign out of Department Module"
          >
            <LogOut className="w-3.5 h-3.5 text-white/95" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Sub-Navbar Navigation */}
      <div id="sub-navbar" className="bg-white border-b border-slate-200 px-6 py-2 shrink-0 flex items-center gap-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setActiveTab('semester-plans')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'semester-plans'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Semester Plans</span>
          </button>

          <button
            onClick={() => setActiveTab('courses')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'courses'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Course Catalog</span>
          </button>

          <button
            onClick={() => setActiveTab('teachers')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'teachers'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Faculty Directory</span>
          </button>

          <button
            onClick={() => setActiveTab('teacher-assignments')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'teacher-assignments'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Teacher Assignments</span>
          </button>

          <button
            onClick={() => setActiveTab('student-enrollment')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'student-enrollment'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Student Enrollments</span>
          </button>
        </div>
      </div>

      {/* DYNAMIC NOTIFICATIONS */}
      <AnimatePresence>
        {successMsg && (
          <Toast
            message={successMsg}
            type="success"
            onClose={() => setSuccessMsg(null)}
          />
        )}
        {errorMsg && (
          <Toast
            message={errorMsg}
            type="error"
            onClose={() => setErrorMsg(null)}
          />
        )}
      </AnimatePresence>

      {/* DASHBOARD CONTENT WRAPPER */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 flex flex-col gap-8">
        
        {/* ACTIVE MODULE CONTAINER */}
        <section className="w-full">
          
          {/* TAB 1: PREDEFINED SEMESTER PLANS */}
          {activeTab === 'semester-plans' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Predefined Semester Plans</h2>
                    <p className="text-xs text-slate-500">Manage the fixed curriculum set of courses studying in each academic semester.</p>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <div>
                      <select 
                        value={selectedPlanSem} 
                        onChange={(e) => setSelectedPlanSem(e.target.value)}
                        className="bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-black text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer min-w-[140px]"
                      >
                        {['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map(s => (
                          <option key={s} value={s}>{s} Semester</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* CURRENT SEMESTER MAP */}
                <div className="bg-indigo-50/40 border border-indigo-100/50 rounded-2xl p-5 mb-8">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-950 mb-3.5 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600 animate-pulse" />
                    <span>Fixed Course Plan: {programs.find(p => p.id === selectedPlanProg)?.code} • {selectedPlanSem} Semester</span>
                  </h3>
                  
                  {activeSemesterPlanCourses.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl text-xs font-medium">
                      No courses mapped to this semester yet. Pick from the catalog list below to append.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {activeSemesterPlanCourses.map((code, idx) => {
                        const planProgClean = selectedPlanProg ? String(selectedPlanProg).trim().toLowerCase() : '';
                        const matchC = courses.find(c => c.code === code && (!planProgClean || String(c.programId).trim().toLowerCase() === planProgClean)) || courses.find(c => c.code === code);
                        return (
                          <div 
                            key={`${code}-${idx}`} 
                            className="bg-white border border-slate-200 hover:border-indigo-200 p-3.5 rounded-xl shadow-sm flex items-start justify-between gap-3 group transition-all"
                          >
                            <div className="min-w-0">
                              <span className="inline-block bg-slate-100 text-slate-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider mb-1.5">
                                {code}
                              </span>
                              <h4 className="text-xs font-bold text-slate-800 truncate">{matchC?.title || 'Unknown Course'}</h4>
                              <p className="text-[10px] font-semibold text-slate-400 capitalize">{matchC?.type || 'core'} course</p>
                            </div>
                            <button 
                              onClick={() => handleRemoveCourseFromSemesterPlan(code)}
                              className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                              title="Remove from Semester Plan"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ADD COURSES TO CURRICULUM SECTION */}
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-t border-slate-100 pt-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Available Core/Elective Courses</h3>
                    <div className="relative max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Search global catalog..." 
                        value={planSearch} 
                        onChange={(e) => setPlanSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-1.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl outline-none text-xs font-medium transition-all"
                      />
                    </div>
                  </div>

                  {availableCoursesForPlan.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs font-medium bg-slate-50 border border-slate-200/60 rounded-xl">
                      No matching courses available to add.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                      {availableCoursesForPlan.map((c, idx) => (
                        <div 
                          key={`${c.id}-${idx}`}
                          className="bg-slate-50/50 border border-slate-200 hover:bg-white hover:border-slate-300 p-3.5 rounded-xl flex items-center justify-between gap-4 transition-all"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="bg-slate-200 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono">
                                {c.code}
                              </span>
                              <span className="bg-slate-100 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded capitalize">
                                {c.type}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-700 truncate">{c.title}</h4>
                          </div>
                          <button
                            onClick={() => handleAddCourseToSemesterPlan(c.code)}
                            className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all shadow-sm shrink-0 cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}


          {/* TAB 2: COURSE CATALOG & EXCEL IMPORT */}
          {activeTab === 'courses' && (
            <div className="space-y-6">
              {/* CREATE MANUAL COURSE */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900 mb-1">Manage Course Catalog</h2>
                <p className="text-xs text-slate-500 mb-6">Create courses individually or import standard curriculum mappings in bulk.</p>

                <form onSubmit={handleCreateCourse} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Course Code</label>
                    <input 
                      type="text" 
                      placeholder="e.g. SE-312"
                      value={courseCode}
                      onChange={(e) => setCourseCode(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl text-xs font-medium outline-none transition-all uppercase"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Course Title</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Web Engineering"
                      value={courseTitle}
                      onChange={(e) => setCourseTitle(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl text-xs font-medium outline-none transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Course Type</label>
                    <select 
                      value={courseType} 
                      onChange={(e) => setCourseType(e.target.value as 'core' | 'elective')}
                      className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none transition-all"
                    >
                      <option value="core">Core Course</option>
                      <option value="elective">Elective Course</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Course Subtype</label>
                    <select 
                      value={courseSubtype} 
                      onChange={(e) => setCourseSubtype(e.target.value as 'Theory' | 'Lab')}
                      className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none transition-all"
                    >
                      <option value="Theory">Theory</option>
                      <option value="Lab">Lab (Practical)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Credit Hours</label>
                    <select 
                      value={courseCreditHours} 
                      onChange={(e) => setCourseCreditHours(parseInt(e.target.value, 10))}
                      className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none transition-all"
                    >
                      <option value="1">1 Credit Hour</option>
                      <option value="2">2 Credit Hours</option>
                      <option value="3">3 Credit Hours</option>
                      <option value="4">4 Credit Hours</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Department</label>
                    <select 
                      value={courseDept} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setCourseDept(val);
                        // Default first program of dept
                        const pList = programs.filter(p => String(p.departmentId).toLowerCase() === String(val).toLowerCase());
                        if (pList.length > 0) {
                          setCourseProg(pList[0].id);
                        } else {
                          setCourseProg('');
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none transition-all"
                    >
                      {departments.length > 0 ? (
                        departments.map((d, idx) => (
                          <option key={`${d.id}-${idx}`} value={d.id}>{d.name}</option>
                        ))
                      ) : (
                        <option value="">No departments available</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Program (Curriculum)</label>
                    <select 
                      value={courseProg} 
                      onChange={(e) => setCourseProg(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none transition-all"
                    >
                      {(() => {
                        const deptProgs = programs.filter(p => !courseDept || String(p.departmentId).toLowerCase() === String(courseDept).toLowerCase());
                        const displayProgs = deptProgs.length > 0 ? deptProgs : programs;
                        if (displayProgs.length === 0) {
                          return <option value="">No programs available</option>;
                        }
                        return displayProgs.map((p, idx) => (
                          <option key={`${p.id}-${idx}`} value={p.id}>{p.code} - {p.name}</option>
                        ));
                      })()}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button 
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Register Course</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* IMPORT EXCEL — one compact row (was a tall card with a big drop zone) */}
              <div className="bg-white border border-slate-200/80 rounded-2xl px-5 py-4 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-5">
                  <div className="flex items-center gap-3 lg:w-64 shrink-0">
                    <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100">
                      <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Import Courses in Bulk</h3>
                      <p className="text-[11px] text-slate-500">Upload an Excel sheet (.xlsx, .xls)</p>
                    </div>
                  </div>

                  <label className="flex-1 relative flex items-center justify-center gap-2 border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-600 transition-all cursor-pointer">
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleImportCoursesExcel}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="h-4 w-4 text-slate-400" />
                    <span>Drop Excel file here or <span className="text-indigo-600 underline">browse</span></span>
                  </label>

                  <button
                    onClick={downloadExcelTemplate}
                    className="flex items-center justify-center gap-1.5 border border-slate-200 hover:bg-slate-50 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 transition-all cursor-pointer shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Template</span>
                  </button>
                </div>

                {importStatus.type !== 'idle' && (
                  <div className={`mt-3 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs border ${
                    importStatus.type === 'success'
                      ? 'bg-blue-50 border-blue-100 text-blue-800'
                      : 'bg-rose-50 border-rose-100 text-rose-800'
                  }`}>
                    {importStatus.type === 'success'
                      ? <Check className="h-4 w-4 mt-0.5 shrink-0" />
                      : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                    <p className="leading-relaxed">
                      <span className="font-bold">{importStatus.type === 'success' ? 'Import successful. ' : 'Import failed. '}</span>
                      {importStatus.message}
                    </p>
                  </div>
                )}
              </div>

              {/* COURSE LISTING TABLE */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Current Catalog Registry</h3>
                    <p className="text-[11px] text-slate-500">
                      Showing {filteredCourses.length} of {courses.filter(c => c.departmentId === activeDeptId).length} department courses.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 max-w-lg w-full justify-end">
                    {/* Search bar */}
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input 
                        type="text" 
                        id="course-catalog-search-input"
                        placeholder="Search code or title..." 
                        value={courseSearch}
                        onChange={(e) => setCourseSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl outline-none text-xs font-medium transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      <tr>
                        <th className="px-5 py-3 text-left">Code</th>
                        <th className="px-5 py-3 text-left">Title</th>
                        <th className="px-5 py-3 text-left">Type</th>
                        <th className="px-5 py-3 text-left">Subtype</th>
                        <th className="px-5 py-3 text-left">Credits</th>
                        <th className="px-5 py-3 text-left">Curriculum Program</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-600 bg-white">
                      {filteredCourses.map((c, idx) => {
                        const matchedProg = programs.find(p => String(p.id).trim().toLowerCase() === String(c.programId).trim().toLowerCase());
                        return (
                          <tr key={`${c.id}-${idx}`} className="hover:bg-slate-50/50 transition-all">
                            <td className="px-5 py-3.5 text-indigo-600 font-mono font-bold uppercase">{c.code}</td>
                            <td className="px-5 py-3.5 text-slate-800 font-bold">{c.title}</td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                c.type === 'core' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
                              }`}>
                                {c.type}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                c.courseType === 'Lab' ? 'bg-blue-50 text-blue-600' : 'bg-sky-50 text-sky-600'
                              }`}>
                                {c.courseType || 'Theory'}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 font-mono text-slate-700 font-bold">
                              {c.creditHours !== undefined ? `${c.creditHours} Cr. Hr` : '3 Cr. Hr'}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500">{matchedProg?.name || 'Computing Global'}</td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setEditingCourse(c)}
                                  className="text-indigo-600 hover:text-indigo-800 font-bold hover:bg-indigo-50 px-2.5 py-1.5 rounded-xl border border-transparent hover:border-indigo-100 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                                  title="Edit Course"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteCourse(c)}
                                  className="text-red-500 hover:text-red-700 font-bold hover:bg-red-50 px-2.5 py-1.5 rounded-xl border border-transparent hover:border-red-100 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                                  title="Delete Course"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}


          {/* TAB 3: FACULTY MANAGEMENT */}
          {activeTab === 'teachers' && (
            <FacultyDirectoryTab
              teachers={teachers}
              departments={departments}
              teacherAssignments={teacherAssignments}
              managedDeptId={activeDeptId}
              onAddTeacher={async (name, email, employeeId, designation) => {
                const lowercaseEmail = email.trim().toLowerCase();
                const empId = employeeId.trim().toUpperCase();

                if (teachers.some(t => t.email.toLowerCase() === lowercaseEmail)) {
                  triggerNotification(`Teacher with email ${lowercaseEmail} already registered`, true);
                  return;
                }
                if (teachers.some(t => matchTeacher(t, empId))) {
                  triggerNotification(`Teacher with employee ID ${empId} already registered`, true);
                  return;
                }

                try {
                  const newT: Teacher = await apiService.createTeacher({
                    name,
                    email: lowercaseEmail,
                    employeeId: empId,
                    designation,
                    departmentId: activeDeptId,
                    password: DEFAULT_TEMP_PASSWORD
                  } as any);

                  const updatedTeachers = [...teachers, newT];
                  setTeachers(updatedTeachers);
                  triggerNotification(`Successfully onboarded ${name}. Temporary password is "${DEFAULT_TEMP_PASSWORD}".`);
                } catch (err: any) {
                  triggerNotification(err.message || 'Failed to onboard teacher', true);
                }
              }}
              onDeleteTeacher={handleDeleteTeacher}
            />
          )}


          {/* TAB 4: TEACHER COURSE ASSIGNMENT */}
          {activeTab === 'teacher-assignments' && (() => {
            const inputCls = 'w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl text-sm font-medium text-slate-700 outline-none transition-all';
            const labelCls = 'block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5';
            const initialsOf = (name: string) =>
              (name || '?').replace(/^(dr|prof|mr|ms|mrs)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
            return (
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
              {/* Header + assign form */}
              <div className="px-5 sm:px-6 pt-5 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Teacher Course Assignments</h2>
                <p className="text-xs text-slate-500 mt-0.5">Assign courses to faculty members. This automatically provisions their digital grading spreadsheets.</p>
              </div>

              <form onSubmit={handleAssignCourseToTeacher} className="px-5 sm:px-6 py-4 bg-slate-50/60 border-y border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.3fr_1.6fr_1.2fr_0.9fr_auto] gap-3 items-end">
                <div className="min-w-0">
                  <label className={labelCls}>Teacher</label>
                  <select value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)} className={inputCls} required>
                    <option key="placeholder-select-faculty" value="">Select faculty...</option>
                    {teachers.map((t, idx) => (
                      <option key={`${t.id || 'teacher'}-${idx}`} value={t.employeeId || t.id}>{t.name} ({t.employeeId || t.id})</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className={labelCls}>Course</label>
                  <select value={selectedCourseCodeForTeacher} onChange={(e) => setSelectedCourseCodeForTeacher(e.target.value)} className={inputCls} required>
                    <option key="placeholder-select-course" value="">Select course...</option>
                    {courses.filter(c => c.departmentId === activeDeptId).map((c, idx) => {
                      const progObj = programs.find(p => String(p.id).trim().toLowerCase() === String(c.programId).trim().toLowerCase());
                      const progLabel = progObj ? progObj.code.toUpperCase() : 'Common';
                      return (
                        <option key={`${c.id || c.code}-${idx}`} value={c.code}>
                          {c.code} — {c.title} ({progLabel})
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className={labelCls}>Program <span className="normal-case font-normal text-slate-400">(optional)</span></label>
                  <select value={selectedProgramForTeacher} onChange={(e) => setSelectedProgramForTeacher(e.target.value)} className={inputCls}>
                    <option key="placeholder-all-programs" value="">All programs (shared)</option>
                    {adminPrograms.map((p, idx) => (
                      <option key={`${p.id}-${idx}`} value={p.id}>{p.code.toUpperCase()} - {p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className={labelCls}>Academic Year</label>
                  <select value={assignmentAcademicYear} onChange={(e) => setAssignmentAcademicYear(e.target.value)} className={inputCls} required>
                    {getAcademicYearOptions().map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Link className="h-4 w-4" />
                  <span>Assign</span>
                </button>
              </form>

              {/* Assignments list */}
              <div className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Assigned Courses</h3>
                  <p className="text-xs text-slate-500">{filteredAssignments.length} assignment{filteredAssignments.length === 1 ? '' : 's'}</p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search teacher or course..."
                    value={assignmentSearch}
                    onChange={(e) => setAssignmentSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl outline-none text-sm transition-all"
                  />
                </div>
              </div>

              {filteredAssignments.length === 0 ? (
                <div className="px-6 py-12 text-center border-t border-slate-100">
                  <p className="text-sm font-semibold text-slate-700">{assignmentSearch.trim() ? 'No assignments match your search' : 'No courses assigned yet'}</p>
                  <p className="text-xs text-slate-500 mt-1">{assignmentSearch.trim() ? 'Try a different teacher or course.' : 'Use the form above to assign a course to a teacher.'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto border-t border-slate-100">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                        <th className="text-left font-semibold px-5 sm:px-6 py-3">Teacher</th>
                        <th className="text-left font-semibold px-3 py-3">Course</th>
                        <th className="hidden md:table-cell text-left font-semibold px-3 py-3">Program</th>
                        <th className="text-left font-semibold px-3 py-3">Term</th>
                        <th className="text-center font-semibold px-3 py-3">Status</th>
                        <th className="text-right font-semibold px-5 sm:px-6 py-3 w-24">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAssignments.map((a, idx) => {
                        const teacher = teachers.find(t => matchTeacher(t, a.teacherId));
                        const assignmentProgClean = a.programId ? String(a.programId).trim().toLowerCase() : '';
                        const course = courses.find(c => c.code === a.courseCode && (!assignmentProgClean || String(c.programId).trim().toLowerCase() === assignmentProgClean)) || courses.find(c => c.code === a.courseCode);
                        const prog = programs.find(p => String(p.id).trim().toLowerCase() === String(a.programId).trim().toLowerCase());
                        const isClosed = a.status === 'closed';

                        return (
                          <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-5 sm:px-6 py-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-9 w-9 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center text-xs font-bold shrink-0">
                                  {initialsOf(teacher?.name || '')}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 truncate">{teacher?.name || 'Unknown Teacher'}</p>
                                  <p className="text-xs text-slate-500 truncate">{teacher?.email || ''}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-mono text-xs font-bold text-indigo-700">{a.courseCode}</p>
                              <p className="text-slate-700">{course?.title || ''}</p>
                            </td>
                            <td className="hidden md:table-cell px-3 py-3">
                              <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${prog ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                {prog ? prog.code.toUpperCase() : 'All programs'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{a.academicYear || 'Fall-2024'}</td>
                            <td className="px-3 py-3 text-center">
                              {isClosed ? (
                                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-slate-200">
                                  <Lock className="w-3 h-3" />
                                  Closed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-blue-100">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="px-5 sm:px-6 py-3 text-right">
                              <button
                                onClick={() => handleRemoveTeacherAssignment(a.teacherId, a.courseCode, a.programId)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                                title="Unassign this course from the teacher"
                              >
                                <Unlink className="h-3.5 w-3.5" />
                                <span>Unassign</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            );
          })()}


          {/* TAB 5: STUDENT ENROLLMENTS */}
          {activeTab === 'student-enrollment' && (() => {
            const selStudent = selectedStudentRegNo === '' ? undefined : students.find(x => areRegNosEqual(x.regNo, selectedStudentRegNo));
            const orderedSemestersList = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
            const progPlans = selStudent ? semesterPlans.filter(p => areProgramsCompatible(p.programId, selStudent.programId)) : [];
            const sortedPlans = [...progPlans].sort((x, y) => orderedSemestersList.indexOf(x.semester) - orderedSemestersList.indexOf(y.semester));
            const curriculumCodes: string[] = Array.from(new Set(progPlans.flatMap(p => p.courseCodes))) as string[];
            const matchedProg = selStudent ? programs.find(p => String(p.id).trim().toLowerCase() === String(selStudent.programId).trim().toLowerCase()) : undefined;

            let studiedCount = 0, studyingCount = 0, laterCount = 0;
            if (selStudent) {
              curriculumCodes.forEach(code => {
                const stat = getCourseStatus(selStudent.regNo, code);
                if (stat === 'studied') studiedCount++;
                else if (stat === 'studying') studyingCount++;
                else if (stat === 'later') laterCount++;
              });
              studyingCount += selectedStudentCurrentCourses.filter(c => !curriculumCodes.includes(c.code)).length;
            }

            const statusBadge = (status: string) => {
              const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap';
              if (status === 'studied') return <span className={`${base} bg-blue-50 text-blue-700 border-blue-100`}><Check className="h-3 w-3" />Completed</span>;
              if (status === 'studying') return <span className={`${base} bg-indigo-50 text-indigo-700 border-indigo-100`}><BookOpen className="h-3 w-3" />Studying</span>;
              if (status === 'failed') return <span className={`${base} bg-red-50 text-red-700 border-red-100`}><AlertCircle className="h-3 w-3" />Failed</span>;
              if (status === 'deferred') return <span className={`${base} bg-amber-50 text-amber-700 border-amber-100`}><Clock className="h-3 w-3" />Deferred</span>;
              return <span className={`${base} bg-slate-100 text-slate-500 border-slate-200`}>Upcoming</span>;
            };

            const btn = 'text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer whitespace-nowrap';
            const actionButtons = (regNo: string, code: string, status: string) => {
              const go = (to: any) => () => updateStudentCourseStatus(regNo, code, to);
              if (status === 'studying') return (<>
                <button onClick={go('studied')} className={`${btn} bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-100`} title="Mark as passed">Pass</button>
                <button onClick={go('failed')} className={`${btn} bg-red-50 hover:bg-red-100 text-red-700 border-red-100`} title="Mark as failed (needs repeat)">Fail</button>
                <button onClick={go('deferred')} className={`${btn} bg-white hover:bg-slate-50 text-slate-600 border-slate-200`} title="Unenroll and defer to later">Drop</button>
              </>);
              if (status === 'failed' || status === 'deferred') return (<>
                <button onClick={go('studying')} className={`${btn} bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600`} title="Enroll in the current term">Enroll</button>
                <button onClick={go('studied')} className={`${btn} bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-100`} title="Mark as already passed">Mark Passed</button>
              </>);
              if (status === 'studied') return (<>
                <button onClick={go('failed')} className={`${btn} bg-white hover:bg-red-50 text-red-600 border-slate-200`} title="Change status to failed">Mark Failed</button>
                <button onClick={go('studying')} className={`${btn} bg-white hover:bg-slate-50 text-slate-600 border-slate-200`} title="Repeat course enrollment">Repeat</button>
              </>);
              return <button onClick={go('studying')} className={`${btn} bg-white hover:bg-slate-50 text-slate-600 border-slate-200`} title="Enroll early">Enroll Early</button>;
            };

            const courseRow = (code: string, title: string, type: string | undefined, status: string, idx: number) => (
              <div key={`${code}-${idx}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs font-bold text-indigo-700 w-16 shrink-0">{code}</span>
                  <span className="text-sm font-medium text-slate-800 truncate" title={title}>{title}</span>
                  {type === 'elective' && <span className="hidden md:inline text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Elective</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0 sm:justify-end">
                  {statusBadge(status)}
                  <div className="flex items-center gap-1.5">{actionButtons(selStudent!.regNo, code, status)}</div>
                </div>
              </div>
            );

            const tabBtn = (id: 'all' | 'studying' | 'studied', label: string) => (
              <button
                key={id}
                onClick={() => setStudentTab(id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  studentTab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >{label}</button>
            );

            return (
            <div className="space-y-4">
              {/* Slim header with the bulk sync action */}
              <div className="bg-white border border-slate-200/80 rounded-2xl px-5 py-3.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Student Enrollments</h2>
                  <p className="text-xs text-slate-500">Auto-enroll registered students into their program's semester plan, or adjust individual students below.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                  {offPlanStudents.length > 0 && (
                    <button
                      onClick={() => confirmResetToPlan(offPlanStudents)}
                      className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold py-2.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                      title="Remove courses outside each student's own semester plan"
                    >
                      <AlertCircle className="h-4 w-4" />
                      <span>Fix {offPlanStudents.length} over-enrolled</span>
                    </button>
                  )}
                  <button
                    onClick={handleAutoEnrollStudents}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Sync & Auto-Enroll</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start">
                {/* Student list */}
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden lg:sticky lg:top-4">
                  <div className="p-3 border-b border-slate-100">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search student..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl outline-none text-sm transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 px-1">{filteredStudents.length} student{filteredStudents.length === 1 ? '' : 's'}</p>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
                    {filteredStudents.length === 0 && <p className="text-xs text-slate-400 text-center py-8">No students found.</p>}
                    {filteredStudents.map(st => {
                      const pr = programs.find(p => String(p.id).trim().toLowerCase() === String(st.programId).trim().toLowerCase());
                      const isSelected = selectedStudentRegNo === st.regNo;
                      return (
                        <button
                          key={st.regNo}
                          onClick={() => setSelectedStudentRegNo(st.regNo)}
                          className={`w-full text-left px-4 py-2.5 transition-colors cursor-pointer border-l-2 ${
                            isSelected ? 'bg-indigo-50 border-indigo-600' : 'border-transparent hover:bg-slate-50'
                          }`}
                        >
                          <p className="text-sm font-semibold text-slate-900 truncate">{st.name}</p>
                          <p className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
                            <span className="font-mono">{st.regNo}</span>
                            <span>{pr?.code || String(st.programId).toUpperCase()} • {st.semester || '1st'}</span>
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected student */}
                <div className="min-w-0">
                  {!selStudent ? (
                    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm py-16 px-6 text-center">
                      <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <h4 className="text-sm font-semibold text-slate-700">No student selected</h4>
                      <p className="text-xs text-slate-500 mt-1">Pick a student from the list to review or edit their courses.</p>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
                      {/* Student header with inline stats */}
                      <div className="px-5 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-slate-100">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-slate-900">{selStudent.name}</h3>
                            <span className="bg-slate-100 text-slate-600 text-[11px] font-semibold px-2 py-0.5 rounded-md font-mono">{selStudent.regNo}</span>
                            {studyingCount > 5 && (
                              <span className="bg-amber-50 text-amber-700 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-amber-100">Overloaded ({studyingCount} courses)</span>
                            )}
                            {getOffPlanBindings(selStudent).length > 0 && (
                              <button
                                onClick={() => confirmResetToPlan([selStudent])}
                                className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-amber-300 text-amber-800 bg-white hover:bg-amber-50 transition-all cursor-pointer"
                                title="Remove courses outside this student's own semester plan"
                              >
                                Reset to semester plan ({getOffPlanBindings(selStudent).length} extra)
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{matchedProg?.name || 'Undergraduate student'} • <span className="font-semibold text-indigo-600">{selStudent.semester || '1st'} Semester</span></p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {[['Completed', studiedCount, 'text-blue-700 bg-blue-50 border-blue-100'], ['Studying', studyingCount, 'text-indigo-700 bg-indigo-50 border-indigo-100'], ['Upcoming', laterCount, 'text-slate-700 bg-slate-50 border-slate-200']].map(([label, n, cls]) => (
                            <div key={label as string} className={`min-w-[84px] px-3 py-1.5 rounded-xl border text-center ${cls}`}>
                              <div className="text-base font-bold leading-tight">{n as number}</div>
                              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Elective / outside course, one row */}
                      <form onSubmit={handleManualBindCourse} className="px-5 py-3 bg-slate-50/60 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2.5">
                        <label className="text-xs font-semibold text-slate-600 shrink-0">Add elective / outside course</label>
                        <select
                          value={selectedCourseCodeForStudent}
                          onChange={(e) => setSelectedCourseCodeForStudent(e.target.value)}
                          className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all"
                          required
                        >
                          <option key="placeholder-choose-course" value="">Choose course...</option>
                          {availableCoursesForSelectedStudent.map((c, idx) => {
                            const progObj = programs.find(p => String(p.id).trim().toLowerCase() === String(c.programId).trim().toLowerCase());
                            const progLabel = progObj ? progObj.code.toUpperCase() : 'Common';
                            return (
                              <option key={`${c.id || c.code}-${idx}`} value={c.code}>
                                {c.code} — {c.title} ({c.type}) [{progLabel}]
                              </option>
                            );
                          })}
                        </select>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0 cursor-pointer">
                          <Plus className="h-4 w-4" />
                          <span>Enroll</span>
                        </button>
                      </form>

                      {/* View switch */}
                      <div className="px-5 pt-3">
                        <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-0.5">
                          {tabBtn('all', 'All Curriculum')}
                          {tabBtn('studying', 'Studying Now')}
                          {tabBtn('studied', 'Completed')}
                        </div>
                      </div>

                      {/* Course list: scrolls inside the card so the page itself stays short */}
                      <div className="px-5 py-3">
                        <div className="max-h-[52vh] overflow-y-auto rounded-xl border border-slate-200">
                          {studentTab !== 'all' ? (() => {
                            const filteredCourses = courses.filter(c => {
                              const inCurriculum = curriculumCodes.includes(c.code);
                              const isEnrolled = studentBindings.some(
                                b => areRegNosEqual(b.studentRegNo, selStudent.regNo) &&
                                     normalizeCourseCode(b.courseCode) === normalizeCourseCode(c.code)
                              );
                              if (!inCurriculum && !isEnrolled) return false;
                              return getCourseStatus(selStudent.regNo, c.code) === studentTab;
                            });
                            if (filteredCourses.length === 0) {
                              return <p className="text-center py-10 text-xs text-slate-500">No {studentTab === 'studying' ? 'courses currently being studied' : 'completed courses'} for this student.</p>;
                            }
                            return <div className="divide-y divide-slate-100">{filteredCourses.map((c, idx) => courseRow(c.code, c.title, c.type, getCourseStatus(selStudent.regNo, c.code), idx))}</div>;
                          })() : (
                            sortedPlans.length === 0 ? (
                              <p className="text-center py-10 text-xs text-slate-500">No semester plan found for this student's program.</p>
                            ) : (
                              <div className="divide-y divide-slate-200">
                                {sortedPlans.map(plan => {
                                  // The student's current semester is open by default; the rest stay collapsed.
                                  const isExpanded = enrollOpenSemesters[plan.semester] ?? (plan.semester === (selStudent.semester || '1st'));
                                  return (
                                    <div key={plan.semester}>
                                      <button
                                        onClick={() => setEnrollOpenSemesters({ ...enrollOpenSemesters, [plan.semester]: !isExpanded })}
                                        className="w-full bg-slate-50 hover:bg-slate-100/70 px-4 py-2.5 flex items-center justify-between text-left transition-colors cursor-pointer"
                                      >
                                        <span className="flex items-center gap-2">
                                          <span className="text-sm font-semibold text-slate-800">{plan.semester} Semester</span>
                                          <span className="text-[11px] text-slate-500">{plan.courseCodes.length} courses</span>
                                        </span>
                                        {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                                      </button>
                                      {isExpanded && (
                                        <div className="divide-y divide-slate-100 bg-white">
                                          {plan.courseCodes.map((code, idx) => {
                                            const planProgClean = plan.programId ? String(plan.programId).trim().toLowerCase() : '';
                                            const cObj = courses.find(c => c.code === code && (!planProgClean || String(c.programId).trim().toLowerCase() === planProgClean)) || courses.find(c => c.code === code);
                                            if (!cObj) return null;
                                            return courseRow(code, cObj.title, cObj.type, getCourseStatus(selStudent.regNo, code), idx);
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            );
          })()}

        </section>
      </main>

      {/* EDIT COURSE MODAL */}
      {editingCourse && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 relative animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Edit className="h-4.5 w-4.5 text-indigo-600" />
                <span>Edit Course: {editingCourse.code}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingCourse(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 hover:bg-slate-50 rounded-lg cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateCourse} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Course Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingCourse.code}
                  onChange={(e) => setEditingCourse({ ...editingCourse, code: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Course Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingCourse.title}
                  onChange={(e) => setEditingCourse({ ...editingCourse, title: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Course Type
                  </label>
                  <select
                    value={editingCourse.type}
                    onChange={(e) => setEditingCourse({ ...editingCourse, type: e.target.value as 'core' | 'elective' })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 text-xs font-semibold"
                  >
                    <option value="core">Core</option>
                    <option value="elective">Elective</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Course Subtype
                  </label>
                  <select
                    value={editingCourse.courseType || 'Theory'}
                    onChange={(e) => setEditingCourse({ ...editingCourse, courseType: e.target.value as 'Theory' | 'Lab' })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 text-xs font-semibold"
                  >
                    <option value="Theory">Theory</option>
                    <option value="Lab">Lab</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Credit Hours
                  </label>
                  <select
                    value={editingCourse.creditHours !== undefined ? editingCourse.creditHours : 3}
                    onChange={(e) => setEditingCourse({ ...editingCourse, creditHours: parseInt(e.target.value, 10) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 text-xs font-semibold"
                  >
                    <option value={1}>1 Credit Hour</option>
                    <option value={2}>2 Credit Hours</option>
                    <option value={3}>3 Credit Hours</option>
                    <option value={4}>4 Credit Hours</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Curriculum Program
                  </label>
                  <select
                    value={editingCourse.programId || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, programId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 text-xs font-semibold"
                  >
                    {programs.map((p, idx) => (
                      <option key={`${p.id}-${idx}`} value={p.id}>{p.name}</option>
                    ))}
                    <option key="placeholder-global-program" value="">None (Global)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCourse(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION DIALOG */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4 relative animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl shrink-0 ${confirmDialog.isDanger ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-slate-900">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap">{confirmDialog.message}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
              >
                {confirmDialog.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const onConf = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await onConf();
                }}
                className={`px-4 py-2 text-white rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  confirmDialog.isDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {confirmDialog.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
