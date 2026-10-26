import { useState, useEffect, useMemo } from 'react';
import { ChartCard, HBarChart, DonutChart, HeatmapChart, GroupedColumnChart, StackedBarChart, CHART } from './charts/ReportCharts';
import { Department, Program, GA, OBEData, ProgramObjective, Course } from '../types';
import { apiService } from '../services/apiService';
import { 
  Check, 
  Settings, 
  Lock, 
  Eye, 
  LogOut, 
  Loader2, 
  Search, 
  ChevronLeft, 
  ChevronRight,  
  ArrowLeft, 
  GraduationCap, 
  BookOpen, 
  AlertCircle, 
  Award, 
  Compass, 
  Sliders, 
  HelpCircle,
  FileText,
  Layout,
  Info,
  Download,
  Printer,
  TrendingUp,
  BarChart2,
  Edit,
  Trash2,
  X,
  Building,
  PieChart,
  Users,
  Target,
  AlertTriangle,
  Layers,
  GitBranch,
  UserCheck,
  RefreshCw
} from 'lucide-react';

interface QADashboardProps {
  onLogout: () => void;
}

type ActiveViewModule = 'allocation' | 'po_mapping' | 'vision_mission' | 'po_configure' | 'more_reports';

function naturalCompare(s1: string, s2: string): number {
  const aParts = s1.split(/(\d+)/);
  const bParts = s2.split(/(\d+)/);
  const length = Math.min(aParts.length, bParts.length);
  for (let i = 0; i < length; i++) {
    const aPart = aParts[i];
    const bPart = bParts[i];
    if (aPart !== bPart) {
      const aNum = parseInt(aPart, 10);
      const bNum = parseInt(bPart, 10);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      return aPart.localeCompare(bPart);
    }
  }
  return aParts.length - bParts.length;
}

export default function QADashboard({ onLogout }: QADashboardProps) {
  const [data, setData] = useState<OBEData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // GA Attainment Report States
  const [students, setStudents] = useState<any[]>([]);


  // Core navigation selectors directly in header
  const [activeDeptId, setActiveDeptId] = useState<string>(() => {
    return localStorage.getItem('IQRA_OBE_USER_DEPT_ID') || '';
  });
  const [activeProgramId, setActiveProgramId] = useState<string>('');
  const [activeModule, setActiveModule] = useState<ActiveViewModule>('vision_mission');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [searchPhrase, setSearchPhrase] = useState('');

  // States for inline departmental charter editing
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [tempVision, setTempVision] = useState('');
  const [tempMission, setTempMission] = useState('');

  // States for inline program charter editing
  const [editingProgramInline, setEditingProgramInline] = useState<boolean>(false);
  const [tempProgramVision, setTempProgramVision] = useState('');
  const [tempProgramMission, setTempProgramMission] = useState('');
  const [isEditingVmInline, setIsEditingVmInline] = useState<boolean>(false);
  const [isEditingPoInline, setIsEditingPoInline] = useState<boolean>(false);

  // More Reports state
  const [moreReportType, setMoreReportType] = useState<'ga_program' | 'ga_batch' | 'ga_semester' | 'clo_attainment' | 'po_attainment' | 'co_summary' | 'at_risk' | 'gap_analysis' | 'instructor_performance' | 'cohort_comparison'>('ga_program');
  const [moreReportProgramId, setMoreReportProgramId] = useState<string>('');
  const [moreReportBatch, setMoreReportBatch] = useState<string>('');
  const [moreReportSemester, setMoreReportSemester] = useState<string>('');
  // Pass mark for the Reports page: use the threshold the report itself returns
  // (attainmentThreshold / threshold), falling back to the backend default of 50%.
  const reportThreshold = (d: any): number => {
    const t = Number(d?.attainmentThreshold ?? d?.threshold);
    return Number.isFinite(t) && t > 0 ? t : 50;
  };
  // CLO attainment %: course-attainment sends `attainmentPercentage`,
  // co-attainment-summary sends `attainmentPercent`.
  const cloPct = (c: any): number => Number(c?.attainmentPercentage ?? c?.attainmentPercent ?? 0);
  const [moreReportCourseCode, setMoreReportCourseCode] = useState<string>('');
  const [moreReportGaId, setMoreReportGaId] = useState<string>('');
  const [moreReportData, setMoreReportData] = useState<any>(null);
  const [moreReportLoading, setMoreReportLoading] = useState(false);
  const [moreReportError, setMoreReportError] = useState<string | null>(null);

  // Dropdown states for Desktop-Style Menu Bar
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [openReportSub, setOpenReportSub] = useState<'clo' | 'plo' | null>(null);
  const [activeModal, setActiveModal] = useState<'about' | 'clos' | 'plos' | 'statistics' | 'integrity' | 'help' | 'add_program' | 'edit_program_vm' | 'add_course' | 'edit_course' | null>(null);
  const [viewVmModal, setViewVmModal] = useState<{ type: 'department' | 'program'; id: string; name: string; code?: string; vision: string; mission: string } | null>(null);
  const [isEditingVm, setIsEditingVm] = useState(false);
  const [editVmVision, setEditVmVision] = useState('');
  const [editVmMission, setEditVmMission] = useState('');

  // Pagination for 44 courses to prevent vertical scrolling
  const [currentPage, setCurrentPage] = useState(1);
  const coursesPerPage = 11;

  // Global Configuration protection flag
  const [isConfiguring, setIsConfiguring] = useState(false);

  // Local editing states
  const [editVision, setEditVision] = useState('');
  const [editMission, setEditMission] = useState('');
  const [editProgramVision, setEditProgramVision] = useState('');
  const [editProgramMission, setEditProgramMission] = useState('');
  const [editPOs, setEditPOs] = useState<ProgramObjective[]>([]);
  const [savingLoad, setSavingLoad] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Form states for creating custom program
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramCode, setNewProgramCode] = useState('');
  const [seedGAsChecked, setSeedGAsChecked] = useState(false);

  // Form states for adding course
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseType, setNewCourseType] = useState<'core' | 'elective'>('core');
  const [newCourseDeptId, setNewCourseDeptId] = useState<string>('');
  const [newCourseProgramId, setNewCourseProgramId] = useState<string>('');

  // Course Editing states
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editCourseCode, setEditCourseCode] = useState('');
  const [editCourseTitle, setEditCourseTitle] = useState('');
  const [editCourseType, setEditCourseType] = useState<'core' | 'elective'>('core');
  const [editCourseDeptId, setEditCourseDeptId] = useState('');
  const [editCourseProgramId, setEditCourseProgramId] = useState('');

  // Load backend or fallback mockups
  useEffect(() => {
    fetchData();
  }, [activeDeptId]);

  // Close the desktop menu when the user clicks anywhere else
  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const fetchData = async () => {
    const isBackend = !!localStorage.getItem('access');
    try {
      setLoading(true);
      const res = await apiService.getAllData();
      
      setData({
        departments: res.departments || [],
        programs: res.programs || [],
        courses: res.courses || [],
        gas: res.gas || []
      });
      setError(null);
    } catch (err: any) {
      console.warn("Backend server error or offline:", err);
      setError(err?.message || "Could not retrieve data from the backend server. Please make sure the server is online.");
      setData({
        departments: [],
        programs: [],
        courses: [],
        gas: []
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-sync activeDeptId when departments load
  useEffect(() => {
    if (data?.departments && data.departments.length > 0) {
      if (!activeDeptId || !data.departments.some(d => d.id === activeDeptId)) {
        setActiveDeptId(data.departments[0].id);
      }
    }
  }, [data]);

  // Synchronize department states when selected department changes
  const activeDepartment = useMemo(() => {
    if (!data || !activeDeptId) return null;
    return data.departments.find(d => d.id === activeDeptId) || null;
  }, [data, activeDeptId]);

  const activeProgram = useMemo(() => {
    if (!data || !activeProgramId) return null;
    return data.programs.find(p => p.id === activeProgramId) || null;
  }, [data, activeProgramId]);

  useEffect(() => {
    if (activeDepartment) {
      setEditVision(activeDepartment.vision);
      setEditMission(activeDepartment.mission);
    }
  }, [activeDepartment]);

  useEffect(() => {
    if (activeProgram) {
      setEditPOs(JSON.parse(JSON.stringify(activeProgram.pos)));
      setEditProgramVision(activeProgram.vision || '');
      setEditProgramMission(activeProgram.mission || '');
      if (activeProgram.id !== activeProgramId) {
        setActiveProgramId(activeProgram.id);
      }
    }
  }, [activeProgram]);

  useEffect(() => {
    if (activeDeptId) {
      setNewCourseDeptId(activeDeptId);
    }
  }, [activeDeptId]);

  useEffect(() => {
    if (activeProgramId) {
      setNewCourseProgramId(activeProgramId);
    }
  }, [activeProgramId]);

  useEffect(() => {
    if (data && activeDeptId) {
      const activeProgObj = data.programs.find(p => p.id === activeProgramId);
      if (activeProgramId !== '' && (!activeProgObj || activeProgObj.departmentId !== activeDeptId)) {
        setActiveProgramId('');
      }
    }
  }, [activeDeptId, data]);

  // Reset page and inline editor when selectors change
  useEffect(() => {
    setCurrentPage(1);
    setIsEditingVmInline(false);
  }, [activeDeptId, activeProgramId, selectedCourseId, searchPhrase, activeModule]);

  // Batch code for the "GA Attainment by Batch" picker. Matches the backend's
  // batch lookup (reg_no starts with the code, or contains "-<code>-"):
  //   "SP23-BSCS-014" -> SP23, "052-FA23-22040" -> FA23, "BSCS-2024-003" -> 2024
  const getRegNoBatch = (regNo: string): string | null => {
    const parts = String(regNo || '').trim().toUpperCase().split('-');
    const term = parts.find(p => /^(FA|SP|SU)\d{2}$/.test(p));
    if (term) return term;
    const year = parts.find(p => /^20\d{2}$/.test(p));
    return year || null;
  };

  // Students for the batch picker (loaded once, when that report is opened)
  useEffect(() => {
    if (activeModule !== 'more_reports' || moreReportType !== 'ga_batch' || students.length > 0) return;
    apiService.getStudents()
      .then(list => { if (Array.isArray(list)) setStudents(list); })
      .catch(err => console.warn('Failed to load students for batch list:', err));
  }, [activeModule, moreReportType, students.length]);

  // Filtered definitions of GAs matching selected program securely
  const filteredGAs = useMemo(() => {
    if (!data) return [];
    // GAs are program-specific (programId = 'bscs', 'bsse', 'bba' etc.)
    // Filter by active program first; fall back to department if no program selected
    const byProgram = activeProgramId
      ? data.gas.filter(g =>
          String(g.programId).trim().toLowerCase() === String(activeProgramId).trim().toLowerCase()
        )
      : [];
    const list = byProgram.length > 0
      ? byProgram
      : data.gas.filter(g =>
          String(g.departmentId).trim().toLowerCase() === String(activeDeptId).trim().toLowerCase()
        );
    // Sort naturally so that GA-10 comes after GA-9
    return [...list].sort((a, b) => naturalCompare(a.id, b.id));
  }, [data, activeDeptId, activeProgramId]);

  // Filtered courses matching selected department and selectors
  const filteredCourses = useMemo(() => {
    if (!data || !activeDeptId) return [];
    let list = data.courses.filter(c => 
      c.departmentId === activeDeptId && 
      String(c.programId).trim().toLowerCase() === String(activeProgramId).trim().toLowerCase()
    );

    if (selectedCourseId !== 'all') {
      list = list.filter(c => c.id === selectedCourseId);
    }

    if (searchPhrase.trim() !== '') {
      const q = searchPhrase.toLowerCase();
      list = list.filter(c => 
        c.code.toLowerCase().includes(q) || 
        c.title.toLowerCase().includes(q)
      );
    }

    return list;
  }, [data, activeDeptId, activeProgramId, selectedCourseId, searchPhrase]);

  // Paginated course display
  const paginatedCourses = useMemo(() => {
    const startIndex = (currentPage - 1) * coursesPerPage;
    return filteredCourses.slice(startIndex, startIndex + coursesPerPage);
  }, [filteredCourses, currentPage]);

  const totalPages = Math.ceil(filteredCourses.length / coursesPerPage) || 1;

  // Real-time Graduate Attribute Allocation Metrics for reports statistics chart & integrity panel
  const gaStats = useMemo(() => {
    if (!data || !activeDeptId) return [];
    const coursesInDept = data.courses.filter(c => 
      c.departmentId === activeDeptId && 
      String(c.programId).trim().toLowerCase() === String(activeProgramId).trim().toLowerCase()
    );
    const total = coursesInDept.length || 1;
    return filteredGAs.map(ga => {
      const count = coursesInDept.filter(c => c.mappedGAs.includes(ga.id)).length;
      const pct = Math.round((count / total) * 100);
      return { ...ga, count, pct };
    });
  }, [data, activeDeptId, activeProgramId, filteredGAs]);

  // Find any courses with no attributes mapped for mapping integrity audit checks
  const unmappedCourses = useMemo(() => {
    if (!data || !activeDeptId) return [];
    return data.courses.filter(c => 
      c.departmentId === activeDeptId && 
      String(c.programId).trim().toLowerCase() === String(activeProgramId).trim().toLowerCase() && 
      c.mappedGAs.length === 0
    );
  }, [data, activeDeptId, activeProgramId]);

  // Real-time matrix click toggler: toggles a tick in course mapping instantly!
  const handleToggleCourseGA = async (course: Course, gaId: string) => {
    if (!isConfiguring || !data) return;

    const isMapped = course.mappedGAs.includes(gaId);
    const updatedMapped = isMapped 
      ? course.mappedGAs.filter(id => id !== gaId) 
      : [...course.mappedGAs, gaId];

    // Optimistic state upgrade for flawless feedback
    const updatedCourses = data.courses.map(c => 
      c.id === course.id ? { ...c, mappedGAs: updatedMapped } : c
    );
    setData({ ...data, courses: updatedCourses });

    try {
      await apiService.updateCourse(course.id, { mappedGAs: updatedMapped, programId: course.programId });
    } catch (e: any) {
      // Roll the optimistic update back to the pre-click state and tell the user.
      // Swallowing this is what made mappings look saved but vanish on logout.
      setData({ ...data, courses: data.courses });
      console.error("Failed to save GA mapping:", e);
      showNotification(
        `Could not save GA mapping for ${course.code}: ${e?.message || 'server error'}. Change was not saved.`,
        "error"
      );
    }
  };

  // Real-time PO mapping click toggler: toggles Yes/empty in PO to GA matrix!
  const handleTogglePOGA = async (poIdx: number, gaId: string) => {
    if (!isConfiguring || !activeProgram || !data) return;

    const updatedPOs = editPOs.map((po, idx) => {
      if (idx !== poIdx) return po;
      const possesses = po.mappedGAs.includes(gaId);
      return {
        ...po,
        mappedGAs: possesses ? po.mappedGAs.filter(id => id !== gaId) : [...po.mappedGAs, gaId]
      };
    });

    setEditPOs(updatedPOs);

    const updatedPrograms = data.programs.map(p => 
      p.id === activeProgram.id ? { ...p, pos: updatedPOs } : p
    );
    setData({ ...data, programs: updatedPrograms });

    try {
      await apiService.updateProgram(activeProgram.id, { pos: updatedPOs });
    } catch (e: any) {
      // Same failure mode as the course/GA toggle above: roll back the optimistic
      // update and surface the error rather than leaving the UI showing a mapping
      // that was never persisted.
      setEditPOs(editPOs);
      setData({ ...data, programs: data.programs });
      console.error("Failed to save PO/GA mapping:", e);
      showNotification(
        `Could not save PO/GA mapping: ${e?.message || 'server error'}. Change was not saved.`,
        "error"
      );
    }
  };

  // Handle saving of edited school missions
  const handleSaveVisionMission = async () => {
    if (!activeDepartment || !data) return;
    try {
      setSavingLoad(true);
      const updated = await apiService.updateDepartment(activeDepartment.id, {
        vision: editVision,
        mission: editMission
      });
      const upgraded = data.departments.map(d => d.id === activeDepartment.id ? updated : d);
      setData({ ...data, departments: upgraded });
      showNotification("Department Mission & Vision saved successfully.", "success");
    } catch (e) {
      showNotification("Failed to sync department vision data", "error");
    } finally {
      setSavingLoad(false);
    }
  };

  // Handle saving of edited program vision and mission
  const handleSaveProgramVisionMission = async () => {
    if (!activeProgram || !data) return;
    try {
      setSavingLoad(true);
      const updated = await apiService.updateProgram(activeProgram.id, {
        vision: editProgramVision,
        mission: editProgramMission
      });
      const upgraded = data.programs.map(p => p.id === activeProgram.id ? { ...p, ...updated } : p);
      setData({ ...data, programs: upgraded });
      showNotification("Program Mission & Vision saved successfully.", "success");
    } catch (e) {
      showNotification("Failed to sync program vision data", "error");
    } finally {
      setSavingLoad(false);
    }
  };

  const handleSaveVmModal = async () => {
    if (!viewVmModal || !data) return;
    try {
      setSavingLoad(true);
      if (viewVmModal.type === 'department') {
        const updated = await apiService.updateDepartment(viewVmModal.id, {
          vision: editVmVision,
          mission: editVmMission
        });
        const upgradedDepts = data.departments.map(d => d.id === viewVmModal.id ? { ...d, ...updated } : d);
        setData({ ...data, departments: upgradedDepts });
        setViewVmModal({
          ...viewVmModal,
          vision: editVmVision,
          mission: editVmMission
        });
        showNotification("Department Vision & Mission saved successfully.", "success");
      } else {
        const updated = await apiService.updateProgram(viewVmModal.id, {
          vision: editVmVision,
          mission: editVmMission
        });
        const upgradedProgs = data.programs.map(p => p.id === viewVmModal.id ? { ...p, ...updated } : p);
        setData({ ...data, programs: upgradedProgs });
        setViewVmModal({
          ...viewVmModal,
          vision: editVmVision,
          mission: editVmMission
        });
        showNotification("Program Vision & Mission saved successfully.", "success");
      }
      setIsEditingVm(false);
    } catch (err) {
      showNotification("Failed to update Vision & Mission details.", "error");
    } finally {
      setSavingLoad(false);
    }
  };

  // Handle adding custom program
  const handleAddProgram = async () => {
    if (!newProgramName.trim() || !newProgramCode.trim() || !data) {
      showNotification("Please provide name and code details for the program.", "error");
      return;
    }

    const newId = newProgramCode.trim().toLowerCase();
    
    // Check if program exists
    if (data.programs.some(p => p.id === newId)) {
      showNotification("A program with this code already exists.", "error");
      return;
    }

    const codeUpper = newProgramCode.trim().toUpperCase();
    const seededGAs: GA[] = [];

    if (seedGAsChecked) {
      if (codeUpper === 'SE' || codeUpper.includes('SOFTWARE')) {
        seededGAs.push(
          { id: `GA-${codeUpper}-1`, name: 'SE-Philosophy & Principles', description: 'Deep comprehension of engineering principles, lifecycle models, and system metrics.', departmentId: activeDeptId, programId: newId },
          { id: `GA-${codeUpper}-2`, name: 'Software Requirements Analysis', description: 'Skill to solicit, organize, validate, and trace stakeholder and technical system specifications.', departmentId: activeDeptId, programId: newId },
          { id: `GA-${codeUpper}-3`, name: 'Software Design & Architecture', description: 'Creating modular, maintainable, secure software systems utilizing architecture blueprints and patterns.', departmentId: activeDeptId, programId: newId },
          { id: `GA-${codeUpper}-4`, name: 'Software Coding & Verification', description: 'Write secure, clean code, applying testing paradigms, coverage metrics, and clean integration strategies.', departmentId: activeDeptId, programId: newId },
          { id: `GA-${codeUpper}-5`, name: 'Modern CAD/CASE Tool Usage', description: 'Select and master version control systems (Git), CI/CD pipelines, container fabrics, and testing runners.', departmentId: activeDeptId, programId: newId },
          { id: `GA-${codeUpper}-6`, name: 'Agile Team Coordination', description: 'Function as an active member inside Scrum/Kanban teams, leading project milestones with clear transparency.', departmentId: activeDeptId, programId: newId },
          { id: `GA-${codeUpper}-7`, name: 'Technical System Communication', description: 'Prepare professional Software Requirement Specifications (SRS), technical proposals, and presentations.', departmentId: activeDeptId, programId: newId },
          { id: `GA-${codeUpper}-8`, name: 'Societal & Safety Security Compliance', description: 'Assessing the impacts on health, legal, cybersecurity, and societal norms during software deployment.', departmentId: activeDeptId, programId: newId },
          { id: `GA-${codeUpper}-9`, name: 'Professional Ethics in Computing', description: 'Uphold intellectual property, security compliance frameworks, and professional computing ethics.', departmentId: activeDeptId, programId: newId },
          { id: `GA-${codeUpper}-10`, name: 'Agile Continuous Self-Learning', description: 'Ability to independent search, master, and adopt new technologies, framework languages, or engineering stacks.', departmentId: activeDeptId, programId: newId }
        );
      } else if (codeUpper === 'AI' || codeUpper.includes('ARTIFICIAL') || codeUpper.includes('INTEL')) {
        seededGAs.push(
          { id: `GA-${codeUpper}-1`, name: 'Mathematical Modeling & Statistics', description: 'Formulate probabilistic models, linear algebra matrices, and optimization cost functions.', departmentId: activeDeptId, programId: newId },
          { id: `GA-${codeUpper}-2`, name: 'Knowledge Representation', description: 'Design knowledge graphs, rule-based systems, and symbolic inference engines to represent logic.', departmentId: activeDeptId, programId: newId },
          { id: `GA-${codeUpper}-3`, name: 'Supervised & Unsupervised ML', description: 'Build and tune classical machine learning classifiers, regression curves, and clustering models.', departmentId: activeDeptId, programId: newId },
          { id: `GA-${codeUpper}-4`, name: 'Neural Networks & Deep Learning', description: 'Configure deep multilayer perceptrons, convolutional units (CNNs), and attention transformers.', departmentId: activeDeptId, programId: newId },
          { id: `GA-${codeUpper}-5`, name: 'Perception (NLP & Vision)', description: 'Synthesize algorithms for natural language understandability, language translation, and high-fidelity video processing.', departmentId: activeDeptId, programId: newId },
          { id: `GA-${codeUpper}-6`, name: 'Trustworthy AI & Anti-bias Ethics', description: 'Diagnose discrimination bias, protect training dataset privacy, and engineer transparent, explainable AI.', departmentId: activeDeptId, programId: newId },
          { id: `GA-${codeUpper}-7`, name: 'AI Engineering & HPC Pipelines', description: 'Leverage hyperparameter systems, high-performance GPUs, vector and feature databases.', departmentId: activeDeptId, programId: newId },
          { id: `GA-${codeUpper}-8`, name: 'Experimental Rigor & Validation', description: 'Develop hypothesis tests, cross-validation scoring splits, and analytical error budgets.', departmentId: activeDeptId, programId: newId },
          { id: `GA-${codeUpper}-9`, name: 'Autonomous Cooperation Systems', description: 'Deploy multi-agent reinforcement learning architectures and collaborative robotic structures.', departmentId: activeDeptId, programId: newId },
          { id: `GA-${codeUpper}-10`, name: 'Ethical Aligns & AI Alignment', description: 'Assess long-term safety, human-in-the-loop validation, and sustainable power-efficient computing limits.', departmentId: activeDeptId, programId: newId }
        );
      } else {
        // General program GAs
        for (let index = 1; index <= 10; index++) {
          seededGAs.push({
            id: `GA-${codeUpper}-${index}`,
            name: `${codeUpper} Core Attribute ${index}`,
            description: `Acquire and demonstrate profound competency and continuous professional leadership in domain requirement #${index} specifically tailored for the ${newProgramName.trim()} program.`,
            departmentId: activeDeptId,
            programId: newId
          });
        }
      }
    }

    const defaultPOs: ProgramObjective[] = [
      { id: 'PO1', text: 'Theoretical comprehension and fundamental engineering/science grounding in ' + codeUpper + '.', mappedGAs: [] },
      { id: 'PO2', text: 'Problem analysis, research validation and algorithmic optimization synthesis in ' + codeUpper + '.', mappedGAs: [] },
      { id: 'PO3', text: 'Critical tool utilization, design deployment, and modern software/AI systems mastery.', mappedGAs: [] },
      { id: 'PO4', text: 'Professional ethics, societal safety considerations, and collaborative team communication.', mappedGAs: [] }
    ];

    const newProg: Program = {
      id: newId,
      name: newProgramName.trim(),
      code: newProgramCode.trim().toUpperCase(),
      departmentId: activeDeptId,
      pos: defaultPOs,
      vision: 'To emerge as a premier center of excellence for training and consulting in ' + newProgramName.trim() + '.',
      mission: 'To impart professional leadership capabilities, technical expertise, and lifelong knowledge of ethical values in ' + newProgramName.trim() + '.'
    };

    try {
      setSavingLoad(true);
      await apiService.createProgram(newProg, seededGAs);
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          programs: [...prev.programs, newProg],
          gas: [...prev.gas, ...seededGAs]
        };
      });
      // Set active program to the newly added program
      setActiveProgramId(newId);
      // Reset fields
      setNewProgramName('');
      setNewProgramCode('');
      setSeedGAsChecked(false);
      setActiveModal(null);
      if (seededGAs.length > 0) {
        showNotification(`Program ${newProg.code} successfully registered! Standard Graduate Attributes (GA-${codeUpper}-1 to GA-${codeUpper}-10) have been generated uniquely for this program.`, "success");
      } else {
        showNotification(`Program ${newProg.code} successfully registered without any pre-defined Graduate Attributes.`, "success");
      }
    } catch (e) {
      showNotification("Error saving new program.", "error");
    } finally {
      setSavingLoad(false);
    }
  };

  // Handle adding custom course
  const handleAddCourse = async () => {
    if (!newCourseCode.trim() || !newCourseTitle.trim() || !data) {
      showNotification("Please provide course registration info containing valid code and title.", "error");
      return;
    }

    const newId = 'C_' + Math.random().toString(36).substr(2, 9);
    
    // Check if code matches existing course in the department
    if (data.courses.some(c => c.code.trim().toUpperCase() === newCourseCode.trim().toUpperCase() && c.departmentId === newCourseDeptId && c.programId === newCourseProgramId)) {
      showNotification("A course with this exact code is already registered under this program.", "error");
      return;
    }

    const newC: Course = {
      id: newId,
      code: newCourseCode.trim().toUpperCase(),
      title: newCourseTitle.trim(),
      type: newCourseType,
      mappedGAs: [],
      departmentId: newCourseDeptId,
      programId: newCourseProgramId
    };

    try {
      setSavingLoad(true);
      await apiService.createCourse(newC);
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          courses: [...prev.courses, newC]
        };
      });
      // Reset forms
      setNewCourseCode('');
      setNewCourseTitle('');
      setNewCourseType('core');
      setActiveModal(null);
      showNotification(`Course "${newC.code} — ${newC.title}" successfully added! You can now map GAs to this course in the Active Allocation Matrix.`, "success");
    } catch (err) {
      showNotification("Error adding custom course.", "error");
    } finally {
      setSavingLoad(false);
    }
  };

  // Handle editing custom course
  const handleEditCourseSubmit = async () => {
    if (!editingCourse || !editCourseCode.trim() || !editCourseTitle.trim() || !data) {
      showNotification("Please provide valid course code and title.", "error");
      return;
    }

    try {
      setSavingLoad(true);
      const updatedSpecs: Partial<Course> = {
        code: editCourseCode.trim().toUpperCase(),
        title: editCourseTitle.trim(),
        type: editCourseType,
        departmentId: editCourseDeptId,
        programId: editCourseProgramId
      };

      const updated = await apiService.updateCourse(editingCourse.id, updatedSpecs);
      
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          courses: prev.courses.map(c => c.id === editingCourse.id ? { ...c, ...updated } : c)
        };
      });

      setEditingCourse(null);
      setActiveModal(null);
      showNotification("Course specifications updated successfully!", "success");
    } catch (err) {
      showNotification("Error saving course changes.", "error");
    } finally {
      setSavingLoad(false);
    }
  };

  // Handle direct text updates to the Program Objectives text fields
  const handlePOTextChange = (idx: number, txt: string) => {
    setEditPOs(prev => prev.map((p, i) => i === idx ? { ...p, text: txt } : p));
  };

  // Commit updated objectives to backend/local mock storage
  const handleSavePOTexts = async () => {
    if (!activeProgram || !data) return;
    try {
      setSavingLoad(true);
      const updated = await apiService.updateProgram(activeProgram.id, { pos: editPOs });
      const upgraded = data.programs.map(p => p.id === activeProgram.id ? updated : p);
      setData({ ...data, programs: upgraded });
      showNotification("Program Objectives updated and synchronized successfully.", "success");
    } catch (e) {
      showNotification("Failed to sync objectives", "error");
    } finally {
      setSavingLoad(false);
    }
  };

  // Export active department matrix to downloadable CSV file
  const handleExportCSV = () => {
    if (!data || !activeDepartment) {
      showNotification("No active data to export.", "error");
      return;
    }
    const coursesInDept = data.courses.filter(c => c.departmentId === activeDeptId);
    const gasInDept = [...data.gas.filter(g => g.departmentId === activeDeptId)].sort((a, b) => naturalCompare(a.id, b.id));
    
    let csv = "Course Code,Course Title," + gasInDept.map(g => g.id).join(",") + "\n";
    coursesInDept.forEach(c => {
      const row = [
        `"${c.code.replace(/"/g, '""')}"`,
        `"${c.title.replace(/"/g, '""')}"`
      ];
      gasInDept.forEach(g => {
        row.push(c.mappedGAs.includes(g.id) ? "✓" : "");
      });
      csv += row.join(",") + "\n";
    });
    
    // Create and trigger file download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `resultmate_obe_allocation_${activeDeptId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export full database state to downloadable JSON backup file
  const handleExportJSON = () => {
    if (!data) {
      showNotification("No active database loaded.", "error");
      return;
    }
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `resultmate_obe_snapshot.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden frosted-bg text-slate-800 font-sans">
      
      {/* Premium Corporate Top Header */}
      <header id="qa-header" className="bg-[#1e1b4b] text-white border-b border-indigo-950 px-6 py-2.5 shrink-0 flex items-center justify-between shadow-sm select-none">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold font-display tracking-tight flex items-center gap-2">
            <span>Iqra University OBE</span>
            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-indigo-500/30">
              QA CONTROL
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-logout"
            onClick={onLogout}
            className="px-3.5 py-1.5 bg-transparent hover:bg-white/10 text-white hover:text-white rounded-lg transition-all border border-white/20 hover:border-white/40 flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
            title="Sign out of QA Module"
          >
            <LogOut className="w-3.5 h-3.5 text-white/95" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Classic Desktop-styled horizontal Menu Bar */}
      <header className="bg-[#f1f5f9] border-b border-slate-300 z-40 shrink-0 select-none relative">
        <div className="mx-auto flex flex-wrap items-center justify-between px-3 py-1.5 max-w-[1700px]">
          
          {/* Menu triggers */}
          <div className="flex flex-wrap items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            
            {/* VISION & MISSION MENU */}
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === 'vision_mission_dropdown' ? null : 'vision_mission_dropdown')}
                onMouseEnter={() => openMenu && setOpenMenu('vision_mission_dropdown')}
                className={`px-3 py-1 text-xs font-sans font-semibold text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded cursor-pointer transition-all ${openMenu === 'vision_mission_dropdown' ? 'bg-slate-200 text-slate-900 shadow-sm' : ''}`}
              >
                Vision &amp; Mission
              </button>
              {openMenu === 'vision_mission_dropdown' && (
                <div className="absolute left-0 mt-1 w-80 bg-white border border-slate-300 rounded-lg shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                  <div className="px-3.5 py-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider font-sans">
                    Academic Department
                  </div>
                  {activeDepartment && (
                    <button
                      onClick={() => {
                        setActiveProgramId('');
                        setActiveModule('vision_mission');
                        setOpenMenu(null);
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs text-indigo-950 bg-indigo-50/50 hover:bg-indigo-50 hover:text-indigo-950 flex items-start gap-2 rounded font-bold text-left border-l-2 border-indigo-500 focus:outline-none"
                    >
                      <Building className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <span className="leading-snug">{activeDepartment.name}</span>
                    </button>
                  )}

                  <div className="border-t border-slate-100 my-1.5"></div>
                  
                  <div className="px-3.5 py-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider font-sans">
                    Department Programs
                  </div>
                  
                  <div className="max-h-60 overflow-y-auto">
                    {data?.programs
                      .filter(p => !activeDeptId || p.departmentId === activeDeptId)
                      .map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setActiveProgramId(p.id);
                            setActiveModule('vision_mission');
                            setOpenMenu(null);
                          }}
                          className="w-full text-left px-3.5 py-1.5 text-xs text-slate-705 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded text-left font-medium focus:outline-none"
                        >
                          <Compass className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{p.code} — {p.name}</span>
                        </button>
                      ))}
                    {(!data?.programs || data.programs.filter(p => !activeDeptId || p.departmentId === activeDeptId).length === 0) && (
                      <div className="px-3.5 py-2 text-xs text-slate-400 italic">No programs registered</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* PROGRAM OBJECTIVE MENU */}
            <div className="relative">
              <button
                onClick={() => {
                  setOpenMenu(openMenu === 'program_objective_dropdown' ? null : 'program_objective_dropdown');
                  setActiveModule('po_configure');
                }}
                onMouseEnter={() => openMenu && setOpenMenu('program_objective_dropdown')}
                className={`px-3 py-1 text-xs font-sans font-semibold text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded cursor-pointer transition-all ${openMenu === 'program_objective_dropdown' || activeModule === 'po_configure' ? 'bg-indigo-900 text-white shadow-sm font-bold' : ''}`}
              >
                Program Objective
              </button>
              {openMenu === 'program_objective_dropdown' && (
                <div className="absolute left-0 mt-1 w-80 bg-white border border-slate-300 rounded-lg shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-100" onClick={(e) => e.stopPropagation()}>
                  <div className="px-3.5 py-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider font-sans">
                    Program Objectives List
                  </div>
                  <div className="space-y-0.5">
                    {activeProgram ? (
                      activeProgram.pos.map((po, idx) => (
                        <button
                          key={po.id}
                          onClick={() => {
                            setActiveModule('po_configure');
                            setOpenMenu(null);
                          }}
                          className="w-full text-left px-3.5 py-1.5 text-xs text-slate-705 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded text-left font-medium focus:outline-none"
                        >
                          <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0 font-serif">
                            {idx + 1}
                          </span>
                          <span className="truncate">{po.id}: {po.text || 'Not defined yet'}</span>
                        </button>
                      ))
                    ) : (
                      ['PO-1', 'PO-2', 'PO-3', 'PO-4'].map((poCode, idx) => (
                        <button
                          key={poCode}
                          onClick={() => {
                            setActiveModule('po_configure');
                            setOpenMenu(null);
                          }}
                          className="w-full text-left px-3.5 py-1.5 text-xs text-slate-405 hover:bg-indigo-50 flex items-center gap-2 rounded text-left font-medium focus:outline-none"
                        >
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-mono">{poCode} Objective</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* COURSES TO GA MAPPING BUTTON */}
            <button
              onClick={() => {
                setActiveModule('allocation');
                setOpenMenu(null);
              }}
              className={`px-3 py-1 text-xs font-sans font-semibold text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded cursor-pointer transition-all ${activeModule === 'allocation' ? 'bg-indigo-900 text-white shadow-sm font-bold' : ''}`}
            >
              Courses to GA mapping
            </button>

            {/* GA TO PO MAPPING BUTTON */}
            <button
              onClick={() => {
                setActiveModule('po_mapping');
                setOpenMenu(null);
              }}
              className={`px-3 py-1 text-xs font-sans font-semibold text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded cursor-pointer transition-all ${activeModule === 'po_mapping' ? 'bg-indigo-900 text-white shadow-sm font-bold' : ''}`}
            >
              GA to PO mapping
            </button>



            {/* MORE REPORTS NAV BUTTON */}
            <button
              onClick={() => { setActiveModule('more_reports'); setOpenMenu(null); }}
              className={`px-3 py-1 text-xs font-sans font-semibold rounded cursor-pointer transition-all ${activeModule === 'more_reports' ? 'bg-indigo-900 text-white shadow-sm font-bold' : 'text-slate-700 hover:bg-slate-200 hover:text-slate-900'}`}
            >
              Reports
            </button>

            {/* ABOUT MENU */}
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === 'about' ? null : 'about')}
                onMouseEnter={() => openMenu && setOpenMenu('about')}
                className={`px-3 py-1 text-xs font-sans font-semibold text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded cursor-pointer transition-all ${openMenu === 'about' ? 'bg-slate-200 text-slate-900 shadow-sm' : ''}`}
              >
                About
              </button>
              {openMenu === 'about' && (
                <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                  <button
                    onClick={() => { setActiveModal('about'); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded font-medium text-left"
                  >
                    <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>About ResultMate OBE v4.6</span>
                  </button>
                  <button
                    onClick={() => { setActiveModal('help'); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-750 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded text-left"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>OBE Mapping guidelines manual</span>
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Quick status display */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-500 font-mono tracking-tight font-semibold hidden sm:inline">
              User: <strong className="text-indigo-950 font-extrabold">{activeDepartment?.name || "Computing"} QA Supervisor</strong>
            </span>
          </div>

        </div>

        {/* Quick Toolbar (Desktop Icon Bar styled) */}
        <div className="bg-[#f8fafc] border-t border-slate-200 px-6 py-2 flex flex-wrap items-center justify-between gap-4 select-none">
          
          {/* Leftside selectors: Quick action selectors & filters */}
          <div className="flex flex-wrap items-center gap-4">
            
            {/* Active Department Indicator */}
            <div className="flex items-center gap-2 bg-indigo-50/50 px-3 py-1 border border-indigo-100 rounded-lg shadow-xs animate-fade-in text-xs font-bold text-indigo-950">
              <span className="text-[9px] text-indigo-650 font-bold tracking-wide uppercase">ACTIVE DEPARTMENT:</span>
              <span>{activeDepartment?.name || activeDeptId.toUpperCase()}</span>
            </div>

            {/* Active Program Selector */}
            <div className="flex items-center gap-2 bg-indigo-50/50 px-3 py-1 border border-indigo-100 rounded-lg shadow-xs text-xs font-bold text-indigo-950 animate-fade-in">
              <span className="text-[9px] text-indigo-650 font-bold tracking-wide uppercase shrink-0">PROGRAM:</span>
              <select
                value={activeProgramId}
                onChange={(e) => {
                  const val = e.target.value;
                  setActiveProgramId(val);
                  setSelectedCourseId('all');
                }}
                className="bg-transparent border-none text-indigo-950 text-xs font-bold font-sans focus:outline-none cursor-pointer pr-1"
              >
                <option value="" className="bg-white text-slate-800 font-sans font-semibold">-- Select Program --</option>
                {data?.programs
                  .filter(p => p.departmentId === activeDeptId)
                  .map(p => (
                    <option key={p.id} value={p.id} className="bg-white text-slate-800 font-sans font-semibold">
                      {p.code} — {p.name}
                    </option>
                  ))}
              </select>
            </div>




            {/* Course Filter Search Bar inside the Quick toolbar */}
            {activeModule === 'allocation' && (
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Isolate Course:</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none cursor-pointer max-w-[210px] shadow-xs"
                >
                  <option value="all">Show All Courses</option>
                  {data?.courses.filter(c => c.departmentId === activeDeptId && String(c.programId).trim().toLowerCase() === String(activeProgramId).trim().toLowerCase()).map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
                  ))}
                </select>
              </div>
            )}

          </div>

          {/* Right side config lock toggles */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsConfiguring(!isConfiguring)}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold tracking-wider rounded-lg transition-all shadow-xs shrink-0 ${
                isConfiguring 
                  ? 'bg-rose-500 text-white ring-4 ring-rose-200 animate-pulse'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
              title={isConfiguring ? "Click to lock mappings" : "Click to unlock checking attributes"}
            >
              {isConfiguring ? <Settings className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
              {isConfiguring ? 'Lock Edit Mode' : 'Unlock Edit Mode'}
            </button>
            
          </div>

        </div>
      </header>

      {/* Main Sandbox Panel Area */}
      <main className="flex-1 overflow-auto p-3 md:p-4 pb-12">

        {error && (
          <div className="mb-6 bg-amber-55 border border-amber-200 text-amber-850 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in duration-200 text-xs shadow-xs font-sans max-w-[1700px] mx-auto">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[300px]">
            <Loader2 className="w-8 h-8 text-[#0B1E36] animate-spin mb-3" />
            <span className="text-xs font-mono tracking-widest text-slate-500">SYNCHRONIZING UNIVERSITY CURRICULA...</span>
          </div>
        ) : !data ? (
          <div className="bg-red-50/80 backdrop-blur-md border border-red-200 rounded-2xl p-6 max-w-lg mx-auto mt-12 text-center shadow-lg">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h4 className="font-serif font-bold text-slate-800 text-lg mb-2">Registry Failed</h4>
            <p className="text-sm text-slate-600 mb-4">The OBE database files were unreachable.</p>
            <button onClick={fetchData} className="px-5 py-2 bg-indigo-600 text-white text-xs rounded-md">Retry</button>
          </div>
        ) : (
          <div className="max-w-[1700px] mx-auto space-y-6">

            {activeProgramId === '' && activeModule !== 'vision_mission' ? (
              <div className="max-w-xl mx-auto py-16 px-8 text-center bg-white border border-slate-200 rounded-3xl shadow-sm animate-in fade-in duration-300">
                <GraduationCap className="w-14 h-14 text-indigo-900/30 mx-auto mb-4" />
                <h3 className="font-serif font-bold text-lg text-slate-900 mb-2">No Program Selected</h3>
                <p className="text-slate-600 text-xs max-w-sm mx-auto leading-relaxed mb-5">
                  Please select an academic program from the dropdown in the navigation bar to view and manage its OBE curriculum mappings.
                </p>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-950 bg-indigo-50 border border-indigo-100/60 px-3.5 py-1.5 rounded-lg">
                  <span>💡 Select a program above to get started</span>
                </div>
              </div>
            ) : (
              <>



            {/* ----------------- MODULE VIEW 1: COURSE TO GA ALLOCATION (DEFAULT) ----------------- */}
            {activeModule === 'allocation' && (
              <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
                
                {/* Section Header */}
                <div className="bg-slate-50 border-b border-slate-200 p-5 px-6 flex flex-wrap items-center justify-between gap-4 select-none">
                  <div>
                    <h3 className="font-serif font-bold text-lg text-indigo-950">
                      {activeDepartment?.name} — Course to Graduate Attributes (GA) allocation
                    </h3>
                    <p className="text-xs text-slate-700 font-sans mt-0.5">
                      Displays mapped graduate requirements. In configuration mode, click on coordinate cells (✓) to map/unmap attributes in real time.
                    </p>
                  </div>

                  {/* Right side course filters & status */}
                  <div className="flex items-center gap-4">
                    {/* Search Field */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search code/title..."
                        value={searchPhrase}
                        onChange={(e) => setSearchPhrase(e.target.value)}
                        className="pl-8 pr-3 py-1.5 focus:outline-none border border-indigo-200/50 rounded-lg text-xs bg-white/70 focus:bg-white w-[180px] text-slate-800 transition-all outline-none"
                      />
                    </div>
                    
                    <span className="text-[10px] bg-white/50 backdrop-blur-md border border-white/65 rounded-lg px-2.5 py-1.5 text-indigo-950 font-bold uppercase tracking-wider shadow-sm">
                      {filteredCourses.length} Curricula Displayed
                    </span>
                  </div>
                </div>

                {/* Table Coordinate Matrix  */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-indigo-600/10 text-indigo-950 border-b border-indigo-100 text-[11px] font-bold tracking-wider select-none">
                        <th className="py-3 px-4 border-r border-indigo-100 w-[55px] text-center">Sr. No.</th>
                        <th className="py-3 px-4 border-r border-indigo-100 w-[110px]">Course Code</th>
                        <th className="py-3 px-4 border-r border-indigo-100 min-w-[280px]">Course Title</th>
                        
                        {/* Dynamic Attribute Column Blocks */}
                        {filteredGAs.map((ga, index) => (
                          <th 
                            key={ga.id} 
                            className="py-2 px-1 text-center border-r border-indigo-100 w-[78px] align-baseline bg-indigo-50/50 group relative"
                            title={ga.description}
                          >
                            <div className="text-[9px] uppercase tracking-tighter text-indigo-700 font-mono mb-1">
                              {ga.id}
                            </div>
                            <span className="block text-[10px] text-slate-800 font-semibold line-clamp-1 truncate leading-tight leading-3" style={{ fontSize: '9.5px' }}>
                              {ga.name}
                            </span>
                            
                            {/* Hover definition card */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 hidden group-hover:block bg-indigo-950/95 backdrop-blur-md text-white p-3 rounded-xl text-[11px] font-sans font-normal w-[240px] z-50 text-left shadow-xl pointer-events-none">
                              <span className="block font-bold text-indigo-300 mb-1">{ga.id}: {ga.name}</span>
                              <p className="text-slate-200 leading-relaxed font-normal">{ga.description}</p>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-100/40 text-xs">
                      {paginatedCourses.map((course, idx) => {
                        const serialNumber = (currentPage - 1) * coursesPerPage + idx + 1;
                        return (
                          <tr 
                            key={course.id} 
                            className={`hover:bg-indigo-50/45 transition-colors ${
                              selectedCourseId === course.id ? 'bg-indigo-50 font-semibold border-y border-indigo-200' : ''
                            }`}
                          >
                            {/* Serial */}
                            <td className="py-2 px-4 border-r border-indigo-100 text-center font-mono text-slate-500 bg-indigo-50/20 w-[55px]">
                              {serialNumber}
                            </td>
                            {/* Code */}
                            <td className="py-2 px-4 border-r border-indigo-100 font-mono font-bold text-indigo-950 w-[110px]">
                              {course.code}
                            </td>
                            {/* Title */}
                            <td className="py-2 px-4 border-r border-[#e0e7ff] font-medium text-slate-800">
                              <div className="flex items-center justify-between gap-2">
                                <span className="break-words">{course.title}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {course.type === 'elective' && (
                                    <span className="text-[8px] bg-sky-100 text-sky-800 border border-sky-200 font-bold px-1.5 py-0.5 rounded uppercase">
                                      Elective
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* GA mapping nodes */}
                            {filteredGAs.map(ga => {
                              const isMapped = course.mappedGAs.includes(ga.id);
                              return (
                                <td 
                                  key={ga.id}
                                  onClick={() => handleToggleCourseGA(course, ga.id)}
                                  className={`border-r border-indigo-100 text-center p-1 cursor-pointer transition-all ${
                                    isConfiguring 
                                      ? 'hover:bg-indigo-100/50 hover:scale-105 active:scale-95' 
                                      : 'cursor-default'
                                  } ${isMapped ? 'bg-indigo-50/30' : ''}`}
                                >
                                  {isMapped ? (
                                    <div className="flex items-center justify-center">
                                      <span className="w-5 h-5 rounded-md bg-indigo-600 flex items-center justify-center text-white font-black text-[10px] shadow-sm">
                                        ✓
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400/40 block text-center select-none font-normal">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}

                      {paginatedCourses.length === 0 && (
                        <tr>
                          <td colSpan={13} className="py-12 text-center text-slate-400 bg-slate-50">
                            <Sliders className="w-8 h-8 mx-auto opacity-30 mb-2" />
                            No matching courses found in database records. Change course highlight filter above.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Senior-friendly big pagination bar to avoid vertical scrolling at all */}
                {selectedCourseId === 'all' && filteredCourses.length > coursesPerPage && (
                  <div className="bg-[#F8FAFC] border-t border-slate-200 py-3 px-6 flex items-center justify-between select-none">
                    <span className="text-xs text-slate-500">
                      Showing <strong className="text-slate-800">{(currentPage - 1) * coursesPerPage + 1}</strong> to <strong className="text-slate-800">{Math.min(currentPage * coursesPerPage, filteredCourses.length)}</strong> of <strong className="text-slate-800">{filteredCourses.length}</strong> available courses in curriculum
                    </span>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-md text-xs font-semibold bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" /> Previous Block
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }).map((_, pIdx) => (
                          <button
                            key={pIdx}
                            onClick={() => setCurrentPage(pIdx + 1)}
                            className={`w-7 h-7 text-xs rounded font-bold transition-all ${
                              currentPage === pIdx + 1
                                ? 'bg-[#0B1E36] text-white'
                                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {pIdx + 1}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-md text-xs font-semibold bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                      >
                        Next Block <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* isolated selected card with single overview if highlighted */}
                {selectedCourseId !== 'all' && paginatedCourses[0] && (
                  <div className="p-4 bg-amber-50/50 border-t border-amber-300 text-xs flex flex-wrap items-center justify-between gap-4">
                    <div className="flex gap-2">
                      <strong className="text-amber-900 border-r border-[#D97706] pr-2 uppercase">Isolate Analysis View:</strong>
                      <span className="text-slate-700">{paginatedCourses[0].code} - {paginatedCourses[0].title} is selected. Switch to "Show All Courses" in dropdown to inspect entire matrix profile.</span>
                    </div>
                    <button 
                      onClick={() => setSelectedCourseId('all')}
                      className="px-3 py-1 bg-white border border-amber-300 hover:bg-amber-100 text-[11px] rounded font-bold text-amber-950 shadow-sm"
                    >
                      Clear Highlights / Reset Matrix
                    </button>
                  </div>
                )}

              </div>
            )}

            {/* ----------------- MODULE VIEW 2: PO TO GA MAPPING MATRIX ----------------- */}
            {activeModule === 'po_mapping' && activeProgram && (
              <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden max-w-4xl mx-auto">
                
                {/* Section Header */}
                <div className="bg-slate-50 border-b border-slate-200 p-5 px-6">
                  <h3 className="font-serif font-bold text-lg text-indigo-950">
                    Program Objectives Mapping with Graduate Attributes (PO to GA Matrix)
                  </h3>
                  <p className="text-xs text-slate-700 font-sans mt-0.5">
                    Aligns high-level objectives (PO1 to PO4) with critical graduate qualities (GAs).
                  </p>
                </div>

                <div className="p-6">
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-indigo-600/10 border-b border-indigo-100 text-xs font-bold text-indigo-950">
                          <th className="py-3 px-4 border-r border-indigo-100 text-left">Graduate Attributes (GAs) Code & Descriptor</th>
                          <th className="py-3 px-2 border-r border-indigo-100 text-center w-[110px]">PO-1</th>
                          <th className="py-3 px-2 border-r border-indigo-100 text-center w-[110px]">PO-2</th>
                          <th className="py-3 px-2 border-r border-indigo-100 text-center w-[110px]">PO-3</th>
                          <th className="py-3 px-2 text-center w-[110px]">PO-4</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-indigo-100/40 text-xs">
                        {filteredGAs.map((ga) => (
                           <tr key={ga.id} className="hover:bg-indigo-50/25" style={{ height: '54px' }}>
                            {/* GA descriptor card */}
                            <td className="py-2.5 px-4 border-r border-indigo-100">
                              <span className="inline-block px-1.5 py-0.5 bg-indigo-50 text-indigo-950 font-mono font-bold text-[10px] rounded mr-3">
                                {ga.id}
                              </span>
                              <strong className="text-slate-800 text-[12px]">{ga.name}</strong>
                              <p className="text-slate-500 text-[10.5px] mt-0.5 leading-relaxed">{ga.description}</p>
                            </td>

                            {/* Mapping Coordinators */}
                            {activeProgram.pos.map((po, poIdx) => {
                              const doesMap = po.mappedGAs.includes(ga.id);
                              return (
                                <td
                                  key={po.id}
                                  onClick={() => handleTogglePOGA(poIdx, ga.id)}
                                  className={`border-r border-indigo-100 text-center p-2 transition-all ${
                                    isConfiguring 
                                      ? 'hover:bg-indigo-100/50 hover:scale-105 cursor-pointer text-indigo-900 border-y border-indigo-100/40' 
                                      : 'cursor-default'
                                  } ${doesMap ? 'bg-blue-500/10' : ''}`}
                                >
                                  {doesMap ? (
                                    <div className="flex items-center justify-center">
                                      <span className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center text-white font-black text-[10px] shadow-sm">
                                        ✓
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 block select-none">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>



                </div>

              </div>
            )}

            {/* ----------------- MODULE VIEW 3: UNIVERSITY & DEPARTMENT VISION/MISSION ----------------- */}
            {activeModule === 'vision_mission' && activeDepartment && (
              <div className="max-w-4xl mx-auto space-y-6 animate-in duration-200 fade-in-25">
                
                {/* Department or Program Specific Brand Identity Sheets */}
                <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
                  
                  {activeProgram ? (
                    <>
                      <div className="bg-indigo-900/90 text-white p-6 select-none flex items-center justify-between border-b border-indigo-800">
                        <div>
                          <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-200 font-bold">PROGRAM SPECIFIC CHARTER</span>
                          <h3 className="font-serif font-bold text-lg">{activeProgram.name} ({activeProgram.code}) Vision &amp; Mission</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {isEditingVmInline ? (
                            <>
                              <button
                                onClick={async () => {
                                  await handleSaveProgramVisionMission();
                                  setIsEditingVmInline(false);
                                }}
                                disabled={savingLoad}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-105"
                              >
                                {savingLoad ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                <span>Save Changes</span>
                              </button>
                              <button
                                onClick={() => {
                                  setEditProgramVision(activeProgram.vision || '');
                                  setEditProgramMission(activeProgram.mission || '');
                                  setIsEditingVmInline(false);
                                }}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-605 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Cancel</span>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                setEditProgramVision(activeProgram.vision || '');
                                setEditProgramMission(activeProgram.mission || '');
                                setIsEditingVmInline(true);
                              }}
                              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-105"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit Charter</span>
                            </button>
                          )}
                          <GraduationCap className="w-8 h-8 opacity-40 text-white hidden sm:block ml-2" />
                        </div>
                      </div>

                      <div className="p-6 md:p-8 space-y-8">
                        
                        {/* Program Vision Block */}
                        <div className="space-y-4 bg-slate-50 border border-slate-200 p-8 rounded-3xl shadow-xs text-left relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div>
                          <div className="flex items-center gap-2 pl-2">
                            <Award className="w-5 h-5 text-indigo-650 shrink-0" />
                            <h4 className="font-sans font-extrabold text-slate-950 text-base tracking-wide uppercase">PROGRAM VISION STATEMENT</h4>
                          </div>
                          
                          {(isConfiguring || isEditingVmInline) ? (
                            <div className="space-y-2 pl-2">
                              <textarea
                                value={editProgramVision}
                                onChange={(e) => setEditProgramVision(e.target.value)}
                                rows={3}
                                className="w-full p-4 text-base bg-white border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-normal"
                                placeholder="Type program vision statement..."
                              />
                              <p className="text-[10px] text-slate-400 italic">This will alter the active program vision across all linked interfaces.</p>
                            </div>
                          ) : (
                            <p className="font-sans text-base leading-relaxed italic text-slate-900 pl-9 py-1 font-medium">
                              "{editProgramVision || '(Program vision statement undefined)'}"
                            </p>
                          )}
                        </div>

                        {/* Program Mission Block */}
                        <div className="space-y-4 bg-slate-50 border border-slate-200 p-8 rounded-3xl shadow-xs text-left relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div>
                          <div className="flex items-center gap-2 pl-2">
                            <Compass className="w-5 h-5 text-indigo-650 shrink-0" />
                            <h4 className="font-sans font-extrabold text-slate-950 text-base tracking-wide uppercase">PROGRAM MISSION STATEMENT</h4>
                          </div>

                          {(isConfiguring || isEditingVmInline) ? (
                            <div className="space-y-2 pl-2">
                              <textarea
                                value={editProgramMission}
                                onChange={(e) => setEditProgramMission(e.target.value)}
                                rows={5}
                                className="w-full p-4 text-base bg-white border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-normal"
                                placeholder="Type program mission statement..."
                              />
                              <p className="text-[10px] text-slate-400 italic">This will alter the active program mission across all linked interfaces.</p>
                            </div>
                          ) : (
                            <p className="font-sans text-base leading-relaxed text-slate-900 pl-9 py-1 font-medium">
                              {editProgramMission || '(Program mission statement undefined)'}
                            </p>
                          )}
                        </div>

                        {/* Configuration Program Save Area */}
                        {(isConfiguring || isEditingVmInline) && (
                           <div className="flex justify-end border-t border-indigo-100 pt-5 gap-3">
                             <button
                               onClick={() => {
                                 setEditProgramVision(activeProgram.vision || '');
                                 setEditProgramMission(activeProgram.mission || '');
                                 setIsEditingVmInline(false);
                               }}
                               className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                             >
                               Cancel
                             </button>
                             <button
                               onClick={async () => {
                                 await handleSaveProgramVisionMission();
                                 setIsEditingVmInline(false);
                               }}
                               disabled={savingLoad}
                               className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 duration-100"
                             >
                               {savingLoad ? <Loader2 className="w-4 h-4 animate-spin" /> : '💾 SAVE PROGRAM CHARTER CHANGES'}
                             </button>
                           </div>
                        )}

                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-indigo-900/90 text-white p-6 select-none flex items-center justify-between border-b border-indigo-800">
                        <div>
                          <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-200 font-bold">DEPARTMENT SPECIFIC CHARTER</span>
                          <h3 className="font-serif font-bold text-lg">{activeDepartment.name} Vision &amp; Mission</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {isEditingVmInline ? (
                            <>
                              <button
                                onClick={async () => {
                                  await handleSaveVisionMission();
                                  setIsEditingVmInline(false);
                                }}
                                disabled={savingLoad}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-105"
                              >
                                {savingLoad ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                <span>Save Changes</span>
                              </button>
                              <button
                                onClick={() => {
                                  setEditVision(activeDepartment.vision || '');
                                  setEditMission(activeDepartment.mission || '');
                                  setIsEditingVmInline(false);
                                }}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-605 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Cancel</span>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                setEditVision(activeDepartment.vision || '');
                                setEditMission(activeDepartment.mission || '');
                                setIsEditingVmInline(true);
                              }}
                              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-105"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit Charter</span>
                            </button>
                          )}
                          <GraduationCap className="w-8 h-8 opacity-40 text-white hidden sm:block ml-2" />
                        </div>
                      </div>

                      <div className="p-6 md:p-8 space-y-8">
                        
                        {/* Department Vision Block */}
                        <div className="space-y-4 bg-slate-50 border border-slate-200 p-8 rounded-3xl shadow-xs text-left relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div>
                          <div className="flex items-center gap-2 pl-2">
                            <Award className="w-5 h-5 text-indigo-650 shrink-0" />
                            <h4 className="font-sans font-extrabold text-slate-950 text-base tracking-wide uppercase">DEPARTMENT VISION STATEMENT</h4>
                          </div>
                          
                          {(isConfiguring || isEditingVmInline) ? (
                            <div className="space-y-2 pl-2">
                              <textarea
                                value={editVision}
                                onChange={(e) => setEditVision(e.target.value)}
                                rows={3}
                                className="w-full p-4 text-base bg-white border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-normal"
                                placeholder="Type department vision statement..."
                              />
                              <p className="text-[10px] text-slate-400 italic">This will alter the active department vision across all linked interfaces.</p>
                            </div>
                          ) : (
                            <p className="font-sans text-base leading-relaxed italic text-slate-900 pl-9 py-1 font-medium">
                              "{editVision || '(Department vision statement undefined)'}"
                            </p>
                          )}
                        </div>

                        {/* Department Mission Block */}
                        <div className="space-y-4 bg-slate-50 border border-slate-200 p-8 rounded-3xl shadow-xs text-left relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div>
                          <div className="flex items-center gap-2 pl-2">
                            <Compass className="w-5 h-5 text-indigo-650 shrink-0" />
                            <h4 className="font-sans font-extrabold text-slate-950 text-base tracking-wide uppercase">DEPARTMENT MISSION STATEMENT</h4>
                          </div>

                          {(isConfiguring || isEditingVmInline) ? (
                            <div className="space-y-2 pl-2">
                              <textarea
                                value={editMission}
                                onChange={(e) => setEditMission(e.target.value)}
                                rows={5}
                                className="w-full p-4 text-base bg-white border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-normal"
                                placeholder="Type department mission statement..."
                              />
                              <p className="text-[10px] text-slate-400 italic">This will alter the active department mission across all linked interfaces.</p>
                            </div>
                          ) : (
                            <p className="font-sans text-base leading-relaxed text-slate-900 pl-9 py-1 font-medium">
                              {editMission || '(Department mission statement undefined)'}
                            </p>
                          )}
                        </div>

                        {/* Configuration Department Save Area */}
                        {(isConfiguring || isEditingVmInline) && (
                           <div className="flex justify-end border-t border-indigo-100 pt-5 gap-3">
                             <button
                               onClick={() => {
                                 setEditVision(activeDepartment.vision || '');
                                 setEditMission(activeDepartment.mission || '');
                                 setIsEditingVmInline(false);
                               }}
                               className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                             >
                               Cancel
                             </button>
                             <button
                               onClick={async () => {
                                 await handleSaveVisionMission();
                                 setIsEditingVmInline(false);
                               }}
                               disabled={savingLoad}
                               className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 duration-100"
                             >
                               {savingLoad ? <Loader2 className="w-4 h-4 animate-spin" /> : '💾 SAVE DEPARTMENT CHARTER CHANGES'}
                             </button>
                           </div>
                        )}

                      </div>
                    </>
                  )}

                </div>

              </div>
            )}

            {/* ----------------- MODULE VIEW 4: CONFIGURE PROGRAM OBJECTIVES ----------------- */}
            {activeModule === 'po_configure' && activeProgram && (
              <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden max-w-4xl mx-auto animate-in duration-200 fade-in-25">
                
                <div className="bg-indigo-900/90 text-white p-6 select-none flex items-center justify-between border-b border-indigo-800">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-200 font-bold">PROGRAM OBJECTIVES</span>
                    <h3 className="font-serif font-bold text-lg">{activeProgram.name} ({activeProgram.code}) Program Educational Objectives</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditingPoInline ? (
                      <>
                        <button
                          onClick={async () => {
                            await handleSavePOTexts();
                            setIsEditingPoInline(false);
                          }}
                          disabled={savingLoad}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-105"
                        >
                          {savingLoad ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span>Save Objectives</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditPOs(JSON.parse(JSON.stringify(activeProgram.pos)));
                            setIsEditingPoInline(false);
                          }}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-605 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setEditPOs(JSON.parse(JSON.stringify(activeProgram.pos)));
                          setIsEditingPoInline(true);
                        }}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-105"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit Objectives</span>
                      </button>
                    )}
                    <GraduationCap className="w-8 h-8 opacity-40 text-white hidden sm:block ml-2" />
                  </div>
                </div>

                <div className="p-6 md:p-8 space-y-6">
                  {editPOs.map((po, idx) => (
                    <div key={po.id} className="space-y-4 bg-slate-50 border border-slate-200 p-6 rounded-3xl shadow-xs text-left relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div>
                      
                      {/* PO label & metadata */}
                      <div className="flex items-center justify-between pl-2">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-indigo-650 text-white flex items-center justify-center font-bold text-xs shrink-0 font-serif shadow-sm">
                            {idx + 1}
                          </span>
                          <div>
                            <h4 className="font-sans font-extrabold text-slate-950 text-sm tracking-wide uppercase">PROGRAM EDUCATIONAL OBJECTIVE {idx + 1}</h4>
                            <span className="text-[9px] text-indigo-900/60 font-mono tracking-wider font-extrabold uppercase">{po.id}</span>
                          </div>
                        </div>

                        {/* Associated Attributes tag pill count */}
                        <div className="flex items-center gap-1 bg-white border border-slate-200/60 px-2.5 py-1 rounded-full shadow-2xs">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-sans">GAs Mapped:</span>
                          <span className="text-xs text-indigo-750 font-mono font-bold">{po.mappedGAs.length}</span>
                        </div>
                      </div>

                      {/* PO statement */}
                      {(isConfiguring || isEditingPoInline) ? (
                        <div className="space-y-2 pl-2">
                          <textarea
                            value={po.text}
                            onChange={(e) => handlePOTextChange(idx, e.target.value)}
                            rows={3}
                            className="w-full p-4 text-base bg-white border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-normal"
                            placeholder={`Define program objective ${po.id}...`}
                          />
                          <p className="text-[10px] text-slate-400 italic font-sans">This will alter the objective definition across all curriculum matrices.</p>
                        </div>
                      ) : (
                        <p className="font-sans text-base leading-relaxed italic text-slate-900 pl-9 py-1 font-medium">
                          "{po.text || '(Objective statement not configured yet. Edit Objectives to define.)'}"
                        </p>
                      )}

                      {/* Dynamic list of GAs associated with this PO */}
                      <div className="pl-9 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9.5px] font-mono text-indigo-950/60 font-bold uppercase tracking-wider">Mapped Graduate Attributes:</span>
                        {po.mappedGAs.map(gid => (
                          <span key={gid} className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200/50 font-mono font-bold text-[9px] text-indigo-950">
                            {gid}
                          </span>
                        ))}
                        {po.mappedGAs.length === 0 && (
                          <span className="text-[10px] text-indigo-400 italic font-sans">No associated GAs mapped. Go to PO to GA Mapping sheet.</span>
                        )}
                      </div>

                    </div>
                  ))}

                  {/* Configuration Save Footer Area */}
                  {(isConfiguring || isEditingPoInline) && (
                     <div className="flex justify-end border-t border-indigo-100 pt-5 gap-3">
                       <button
                         onClick={() => {
                           setEditPOs(JSON.parse(JSON.stringify(activeProgram.pos)));
                           setIsEditingPoInline(false);
                         }}
                         className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                       >
                         Cancel
                       </button>
                       <button
                         onClick={async () => {
                           await handleSavePOTexts();
                           setIsEditingPoInline(false);
                         }}
                         disabled={savingLoad}
                         className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 duration-100"
                       >
                         {savingLoad ? <Loader2 className="w-4 h-4 animate-spin" /> : '💾 SAVE PROGRAM OBJECTIVES CHANGES'}
                       </button>
                     </div>
                  )}

                </div>

              </div>
            )}

              </>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                MORE REPORTS MODULE
            ═══════════════════════════════════════════════════════════════ */}
            {activeModule === 'more_reports' && (
              <div className="space-y-4 max-w-7xl mx-auto animate-in duration-200 fade-in-25">

                {/* Report type + filters: one compact card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="mb-3">
                    <h2 className="text-lg font-bold text-slate-900">Reports</h2>
                    <p className="text-xs text-slate-500">Institutional reports for HEC compliance, accreditation and quality assurance.</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'ga_program',            label: 'GA Attainment\nby Program',       icon: <Award className="w-5 h-5" />,          color: 'indigo' },
                      { id: 'ga_batch',              label: 'GA Attainment\nby Batch',          icon: <Users className="w-5 h-5" />,          color: 'violet' },
                      { id: 'ga_semester',           label: 'GA Attainment\nby Semester',       icon: <Layers className="w-5 h-5" />,         color: 'purple' },
                      { id: 'clo_attainment',        label: 'CLO Attainment\nby Course',        icon: <Target className="w-5 h-5" />,         color: 'blue' },
                      { id: 'co_summary',            label: 'CO Attainment\nSummary (HEC)',     icon: <FileText className="w-5 h-5" />,       color: 'sky' },
                      { id: 'po_attainment',         label: 'PO Attainment\n(HEC Compliance)',  icon: <BarChart2 className="w-5 h-5" />,      color: 'teal' },
                      { id: 'at_risk',               label: 'At-Risk\nStudents',                icon: <AlertTriangle className="w-5 h-5" />,  color: 'amber' },
                      { id: 'gap_analysis',          label: 'Curriculum\nGap Analysis',         icon: <GitBranch className="w-5 h-5" />,      color: 'orange' },
                      { id: 'instructor_performance',label: 'Instructor\nPerformance',          icon: <UserCheck className="w-5 h-5" />,      color: 'rose' },
                      { id: 'cohort_comparison',     label: 'Cohort\nComparison',               icon: <TrendingUp className="w-5 h-5" />,     color: 'green' },
                    ].map(rt => (
                      <button
                        key={rt.id}
                        onClick={() => { setMoreReportType(rt.id as any); setMoreReportData(null); setMoreReportError(null); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap cursor-pointer transition-all
                          ${moreReportType === rt.id
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700'
                          }`}
                      >
                        <span className={`[&>svg]:w-3.5 [&>svg]:h-3.5 ${moreReportType === rt.id ? 'text-white' : 'text-slate-400'}`}>{rt.icon}</span>
                        {String(rt.label).replace('\n', ' ')}
                      </button>
                    ))}
                  </div>

                {/* Filters (same card) */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-wrap gap-4 items-end">

                    {/* Program — needed for most reports */}
                    {['ga_program','ga_semester','clo_attainment','co_summary','po_attainment','at_risk','gap_analysis','cohort_comparison'].includes(moreReportType) && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Programme</label>
                        <select
                          value={moreReportProgramId}
                          onChange={e => { setMoreReportProgramId(e.target.value); setMoreReportData(null); }}
                          className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[160px]"
                        >
                          <option value="">— Select Programme —</option>
                          {(data?.programs || []).filter(p => !activeDeptId || p.departmentId === activeDeptId).map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.code?.toUpperCase()})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Batch */}
                    {['ga_batch'].includes(moreReportType) && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Batch</label>
                        <select
                          value={moreReportBatch}
                          onChange={e => { setMoreReportBatch(e.target.value); setMoreReportData(null); }}
                          className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[140px]"
                        >
                          <option value="">— Select Batch —</option>
                          {Array.from(new Set(students
                            .filter((s: any) => !s.departmentId || !activeDeptId || String(s.departmentId).toLowerCase() === String(activeDeptId).toLowerCase())
                            .map((s: any) => getRegNoBatch(s.regNo))
                            .filter(Boolean))).sort().map(b => (
                            <option key={b as string} value={(b as string).toLowerCase()}>{b as string}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Semester */}
                    {['co_summary','at_risk'].includes(moreReportType) && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Semester</label>
                        <select
                          value={moreReportSemester}
                          onChange={e => { setMoreReportSemester(e.target.value); setMoreReportData(null); }}
                          className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[130px]"
                        >
                          <option value="">All Semesters</option>
                          {['1st','2nd','3rd','4th','5th','6th','7th','8th'].map(s => (
                            <option key={s} value={s}>{s} Semester</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Course Code */}
                    {['clo_attainment'].includes(moreReportType) && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Course</label>
                        <select
                          value={moreReportCourseCode}
                          onChange={e => { setMoreReportCourseCode(e.target.value); setMoreReportData(null); }}
                          className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[180px]"
                        >
                          <option value="">— Select Course —</option>
                          {(data?.courses || []).map((c: any) => (
                            <option key={c.id} value={c.code}>{c.code} — {c.title}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Department for instructor performance */}
                    {['instructor_performance'].includes(moreReportType) && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Department</label>
                        <select
                          value={activeDeptId}
                          disabled
                          className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 min-w-[180px] opacity-70"
                        >
                          {(data?.departments || []).map((d: any) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                        <span className="text-[9px] text-slate-400">Using active department</span>
                      </div>
                    )}

                    {/* GA ID for cohort comparison */}
                    {['cohort_comparison'].includes(moreReportType) && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Graduate Attribute (optional)</label>
                        <select
                          value={moreReportGaId}
                          onChange={e => { setMoreReportGaId(e.target.value); setMoreReportData(null); }}
                          className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[180px]"
                        >
                          <option value="">All GAs</option>
                          {(data?.gas || []).filter((g: any) => !moreReportProgramId || g.programId === moreReportProgramId).map((g: any) => (
                            <option key={g.id} value={g.id}>{g.id} — {g.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Generate Button */}
                    <button
                      onClick={async () => {
                        setMoreReportData(null);
                        setMoreReportError(null);
                        setMoreReportLoading(true);
                        try {
                          let result: any = null;
                          const BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'https://zeeshanbalti.pythonanywhere.com/api';

                          const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access') || ''}` };

                          const get = async (path: string) => {
                            const r = await fetch(`${BASE}${path}`, { headers });
                            if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
                            return r.json();
                          };

                          if (moreReportType === 'ga_program') {
                            if (!moreReportProgramId) throw new Error('Please select a programme.');
                            result = await get(`/reports/program-ga-attainment/?programId=${encodeURIComponent(moreReportProgramId)}`);
                          } else if (moreReportType === 'ga_batch') {
                            if (!moreReportBatch) throw new Error('Please select a batch.');
                            result = await get(`/reports/batch-ga-attainment/?batch=${encodeURIComponent(moreReportBatch)}&departmentId=${encodeURIComponent(activeDeptId)}`);
                          } else if (moreReportType === 'ga_semester') {
                            if (!moreReportProgramId) throw new Error('Please select a programme.');
                            result = await get(`/reports/program-ga-attainment-by-semester/?programId=${encodeURIComponent(moreReportProgramId)}`);
                          } else if (moreReportType === 'clo_attainment') {
                            if (!moreReportCourseCode) throw new Error('Please select a course.');
                            const params = new URLSearchParams({ courseCode: moreReportCourseCode });
                            if (moreReportProgramId) params.set('programId', moreReportProgramId);
                            result = await get(`/reports/course-attainment/?${params}`);
                          } else if (moreReportType === 'co_summary') {
                            if (!moreReportProgramId) throw new Error('Please select a programme.');
                            const params = new URLSearchParams({ programId: moreReportProgramId });
                            if (moreReportSemester) params.set('semester', moreReportSemester);
                            result = await get(`/reports/co-attainment-summary/?${params}`);
                          } else if (moreReportType === 'po_attainment') {
                            if (!moreReportProgramId) throw new Error('Please select a programme.');
                            result = await get(`/reports/po-attainment/?programId=${encodeURIComponent(moreReportProgramId)}`);
                          } else if (moreReportType === 'at_risk') {
                            if (!moreReportProgramId) throw new Error('Please select a programme.');
                            const params = new URLSearchParams({ programId: moreReportProgramId });
                            if (moreReportSemester) params.set('semester', moreReportSemester);
                            result = await get(`/reports/at-risk-students/?${params}`);
                          } else if (moreReportType === 'gap_analysis') {
                            if (!moreReportProgramId) throw new Error('Please select a programme.');
                            result = await get(`/reports/gap-analysis/?programId=${encodeURIComponent(moreReportProgramId)}`);
                          } else if (moreReportType === 'instructor_performance') {
                            if (!activeDeptId) throw new Error('No active department selected.');
                            result = await get(`/reports/instructor-performance/?departmentId=${encodeURIComponent(activeDeptId)}`);
                          } else if (moreReportType === 'cohort_comparison') {
                            if (!moreReportProgramId) throw new Error('Please select a programme.');
                            const params = new URLSearchParams({ programId: moreReportProgramId });
                            if (moreReportGaId) params.set('gaId', moreReportGaId);
                            result = await get(`/reports/cohort-comparison/?${params}`);
                          }

                          setMoreReportData(result);
                        } catch (e: any) {
                          setMoreReportError(e?.message || 'Failed to generate report.');
                        } finally {
                          setMoreReportLoading(false);
                        }
                      }}
                      disabled={moreReportLoading}
                      className="flex items-center gap-2 px-5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {moreReportLoading
                        ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating...</>
                        : <><BarChart2 className="w-3.5 h-3.5" /> Generate Report</>
                      }
                    </button>
                  </div>
                </div>
                </div>

                {/* Error */}
                {moreReportError && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-red-700">Failed to generate report</p>
                      <p className="text-xs text-red-600 mt-0.5">{moreReportError}</p>
                    </div>
                  </div>
                )}

                {/* Results */}
                {moreReportData && !moreReportLoading && (
                  <div className="qa-print-area bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">

                    {/* Print button */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        Report Results
                      </h3>
                      <button
                        onClick={() => window.print()}
                        className="print:hidden flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                      >
                        <Printer className="w-3.5 h-3.5" /> Print
                      </button>
                    </div>

                    {/* GA Program / Batch / Semester attainment */}
                    {(moreReportType === 'ga_program' || moreReportType === 'ga_batch') && moreReportData.attributes && (
                      <div className="space-y-3">
                        <div className="flex gap-3 flex-wrap text-xs">
                          {moreReportData.programName && <span className="bg-indigo-100 text-indigo-800 font-bold px-3 py-1 rounded-full">{moreReportData.programName}</span>}
                          {moreReportData.batch && <span className="bg-violet-100 text-violet-800 font-bold px-3 py-1 rounded-full">Batch: {moreReportData.batch?.toUpperCase()}</span>}
                          {moreReportData.studentCount != null && <span className="bg-slate-100 text-slate-700 font-bold px-3 py-1 rounded-full">{moreReportData.studentCount} Students</span>}
                          <span className="bg-amber-100 text-amber-800 font-bold px-3 py-1 rounded-full">Threshold: {reportThreshold(moreReportData)}%</span>
                        </div>
                        {(() => {
                          const gaPass = (ga: any) => ga.attainmentStatus ? (ga.attainmentStatus === 'Passed' || ga.attainmentStatus === 'Attained') : (ga.averageAttainment ?? 0) >= reportThreshold(moreReportData);
                          const passed = moreReportData.attributes.filter(gaPass).length;
                          return (
                            <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
                              <ChartCard title="Attainment by Graduate Attribute" subtitle="Average attainment of each GA against the threshold">
                                <HBarChart
                                  threshold={reportThreshold(moreReportData)}
                                  passLabel="Passed" failLabel="Audit Required"
                                  items={moreReportData.attributes.map((ga: any) => ({ label: String(ga.id), detail: ga.title, value: ga.averageAttainment ?? 0, pass: gaPass(ga) }))}
                                />
                              </ChartCard>
                              <ChartCard title="Status breakdown" subtitle="Number of GAs by status">
                                <DonutChart centerLabel="GAs" slices={[
                                  { label: 'Passed', value: passed, color: CHART.good },
                                  { label: 'Audit Required', value: moreReportData.attributes.length - passed, color: CHART.critical },
                                ]} />
                              </ChartCard>
                            </div>
                          );
                        })()}
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="text-left px-3 py-2 font-black text-slate-600 uppercase tracking-wider">GA</th>
                              <th className="text-left px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Title</th>
                              <th className="text-center px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Attainment %</th>
                              <th className="text-center px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Status</th>
                              <th className="text-center px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Courses</th>
                            </tr>
                          </thead>
                          <tbody>
                            {moreReportData.attributes.map((ga: any, i: number) => (
                              <tr key={ga.id || i} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2 font-black text-indigo-700">{ga.id}</td>
                                <td className="px-3 py-2 text-slate-700">{ga.title}</td>
                                <td className="px-3 py-2 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${(ga.averageAttainment ?? 0) >= reportThreshold(moreReportData) ? 'bg-green-500' : 'bg-red-400'}`} style={{ width: `${Math.min(100, ga.averageAttainment ?? 0)}%` }} />
                                    </div>
                                    <span className="font-bold text-slate-800">{(ga.averageAttainment ?? 0).toFixed(1)}%</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${ga.attainmentStatus === 'Passed' || ga.attainmentStatus === 'Attained' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {ga.attainmentStatus ?? ((ga.averageAttainment ?? 0) >= reportThreshold(moreReportData) ? 'Passed' : 'Audit Required')}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center text-slate-500">{ga.contributingCoursesCount ?? ga.assessedCount ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* GA by Semester */}
                    {moreReportType === 'ga_semester' && moreReportData.semesters && (
                      <div className="space-y-4">
                        {(() => {
                          const sems: any[] = moreReportData.semesters;
                          const gaIds: string[] = [];
                          sems.forEach(sem => (sem.attributes || []).forEach((ga: any) => { if (!gaIds.includes(String(ga.id))) gaIds.push(String(ga.id)); }));
                          const lookup = (gaId: string, semKey: string) => {
                            const sem = sems.find(x => String(x.semester) === semKey);
                            const ga = (sem?.attributes || []).find((g: any) => String(g.id) === gaId);
                            return ga ? (ga.averageAttainment ?? 0) : null;
                          };
                          return gaIds.length > 0 && (
                            <ChartCard title="GA attainment heatmap" subtitle="Darker cells mean higher attainment. Each column is a semester.">
                              <HeatmapChart rows={gaIds} cols={sems.map(x => String(x.semester))} value={lookup} rowLabel="GA" colLabel={c => `Sem ${c}`} />
                            </ChartCard>
                          );
                        })()}
                        {moreReportData.semesters.map((sem: any, i: number) => (
                          <div key={i} className="border border-slate-200 rounded-2xl overflow-hidden">
                            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                              <span className="text-xs font-black text-slate-700">{sem.semester} Semester</span>
                            </div>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-100">
                                  <th className="text-left px-3 py-2 font-black text-slate-500 uppercase tracking-wider">GA</th>
                                  <th className="text-left px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Title</th>
                                  <th className="text-center px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Attainment %</th>
                                  <th className="text-center px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(sem.attributes || []).map((ga: any, j: number) => (
                                  <tr key={j} className="border-b border-slate-50 hover:bg-slate-50">
                                    <td className="px-3 py-2 font-bold text-indigo-700">{ga.id}</td>
                                    <td className="px-3 py-2 text-slate-700">{ga.title}</td>
                                    <td className="px-3 py-2 text-center font-bold">{(ga.averageAttainment ?? 0).toFixed(1)}%</td>
                                    <td className="px-3 py-2 text-center">
                                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${(ga.averageAttainment ?? 0) >= reportThreshold(moreReportData) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {(ga.averageAttainment ?? 0) >= reportThreshold(moreReportData) ? 'Passed' : 'Audit Required'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* CLO Attainment by Course */}
                    {moreReportType === 'clo_attainment' && moreReportData.clos && (
                      <div className="space-y-3">
                        <div className="flex gap-3 flex-wrap text-xs">
                          <span className="bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded-full">{moreReportData.courseCode} — {moreReportData.courseTitle}</span>
                          {moreReportData.classSize != null && <span className="bg-slate-100 text-slate-700 font-bold px-3 py-1 rounded-full">{moreReportData.classSize} Students</span>}
                          <span className="bg-amber-100 text-amber-800 font-bold px-3 py-1 rounded-full">Threshold: {reportThreshold(moreReportData)}%</span>
                        </div>
                        {(() => {
                          const clos: any[] = moreReportData.clos;
                          const passed = clos.filter(c => cloPct(c) >= reportThreshold(moreReportData)).length;
                          return (
                            <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
                              <ChartCard title="Attainment by CLO" subtitle="Percentage of students attaining each CLO">
                                <HBarChart
                                  threshold={reportThreshold(moreReportData)}
                                  passLabel="Passed" failLabel="Needs Work"
                                  items={clos.map(c => ({ label: String(c.code), detail: c.description, value: cloPct(c), pass: cloPct(c) >= reportThreshold(moreReportData), extra: [`Mapped GA: ${c.mappedGA || '—'}`, `Passed: ${c.passedCount ?? '—'} / ${c.totalCount ?? '—'}`] }))}
                                />
                              </ChartCard>
                              <ChartCard title="CLO status" subtitle="Number of CLOs by status">
                                <DonutChart centerLabel="CLOs" slices={[
                                  { label: 'Passed', value: passed, color: CHART.good },
                                  { label: 'Needs Work', value: clos.length - passed, color: CHART.critical },
                                ]} />
                              </ChartCard>
                            </div>
                          );
                        })()}
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="text-left px-3 py-2 font-black text-slate-600 uppercase tracking-wider">CLO</th>
                              <th className="text-left px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Description</th>
                              <th className="text-center px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Mapped GA</th>
                              <th className="text-center px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Attainment %</th>
                              <th className="text-center px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Passed</th>
                              <th className="text-center px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {moreReportData.clos.map((clo: any, i: number) => (
                              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2 font-black text-blue-700">{clo.code}</td>
                                <td className="px-3 py-2 text-slate-600">{clo.description}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className="bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full text-[10px]">{clo.mappedGA || '—'}</span>
                                </td>
                                <td className="px-3 py-2 text-center font-bold">{cloPct(clo).toFixed(1)}%</td>
                                <td className="px-3 py-2 text-center text-slate-500">{clo.passedCount ?? '—'} / {clo.totalCount ?? '—'}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${cloPct(clo) >= reportThreshold(moreReportData) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {cloPct(clo) >= reportThreshold(moreReportData) ? 'Passed' : 'Needs Work'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* CO Attainment Summary */}
                    {moreReportType === 'co_summary' && moreReportData.courses && (
                      <div className="space-y-3">
                        <div className="flex gap-3 flex-wrap text-xs">
                          <span className="bg-sky-100 text-sky-800 font-bold px-3 py-1 rounded-full">{moreReportData.programId?.toUpperCase()}</span>
                          {moreReportData.semester && <span className="bg-slate-100 text-slate-700 font-bold px-3 py-1 rounded-full">{moreReportData.semester} Semester</span>}
                        </div>
                        {(() => {
                          const courses: any[] = moreReportData.courses;
                          const allClos = courses.flatMap(c => c.clos || []);
                          const passed = allClos.filter((c: any) => cloPct(c) >= reportThreshold(moreReportData)).length;
                          const avg = (c: any) => (c.clos || []).length ? (c.clos || []).reduce((a: number, x: any) => a + cloPct(x), 0) / (c.clos || []).length : null;
                          return (
                            <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
                              <ChartCard title="Average CLO attainment by course" subtitle="Mean of each course's CLO attainment">
                                <HBarChart
                                  threshold={reportThreshold(moreReportData)}
                                  passLabel={`At / above ${reportThreshold(moreReportData)}%`} failLabel={`Below ${reportThreshold(moreReportData)}%`}
                                  items={courses.map(c => { const v = avg(c); return { label: String(c.courseCode), detail: c.courseTitle, value: v, pass: v != null && v >= reportThreshold(moreReportData), extra: [`${(c.clos || []).length} CLOs`] }; })}
                                />
                              </ChartCard>
                              <ChartCard title="CLO status across courses" subtitle="All CLOs in this report">
                                <DonutChart centerLabel="CLOs" slices={[
                                  { label: 'Passed', value: passed, color: CHART.good },
                                  { label: 'Audit Required', value: allClos.length - passed, color: CHART.critical },
                                ]} />
                              </ChartCard>
                            </div>
                          );
                        })()}
                        {moreReportData.courses.map((course: any, i: number) => (
                          <div key={i} className="border border-slate-200 rounded-2xl overflow-hidden">
                            <div className="bg-slate-50 px-4 py-2 flex items-center gap-3 border-b border-slate-200">
                              <span className="font-black text-xs text-slate-800">{course.courseCode}</span>
                              <span className="text-xs text-slate-500">{course.courseTitle}</span>
                            </div>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-100">
                                  <th className="text-left px-3 py-2 font-black text-slate-500 uppercase tracking-wider">CLO</th>
                                  <th className="text-left px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Description</th>
                                  <th className="text-center px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Mapped GA</th>
                                  <th className="text-center px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Attainment %</th>
                                  <th className="text-center px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(course.clos || []).map((clo: any, j: number) => (
                                  <tr key={j} className="border-b border-slate-50 hover:bg-slate-50">
                                    <td className="px-3 py-2 font-bold text-sky-700">{clo.code}</td>
                                    <td className="px-3 py-2 text-slate-600">{clo.description}</td>
                                    <td className="px-3 py-2 text-center"><span className="bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full text-[10px]">{clo.mappedGA || '—'}</span></td>
                                    <td className="px-3 py-2 text-center font-bold">{cloPct(clo).toFixed(1)}%</td>
                                    <td className="px-3 py-2 text-center">
                                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${cloPct(clo) >= reportThreshold(moreReportData) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {cloPct(clo) >= reportThreshold(moreReportData) ? 'Passed' : 'Audit Required'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* PO Attainment */}
                    {moreReportType === 'po_attainment' && moreReportData.pos && (
                      <div className="space-y-3">
                        <div className="flex gap-3 flex-wrap text-xs">
                          <span className="bg-teal-100 text-teal-800 font-bold px-3 py-1 rounded-full">{moreReportData.programName}</span>
                          <span className="text-[10px] text-slate-400">HEC Program Outcome Compliance Report</span>
                        </div>
                        {(() => {
                          const pos: any[] = moreReportData.pos;
                          const colorOf = (st: string) => st === 'Met' ? CHART.good : st === 'Partially Met' ? CHART.warning : CHART.critical;
                          const count = (st: string) => pos.filter(p => p.status === st).length;
                          const other = pos.length - count('Met') - count('Partially Met');
                          return (
                            <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
                              <ChartCard title="Attainment by Program Outcome" subtitle="Bar colour shows HEC compliance status">
                                <HBarChart
                                  showThreshold={false}
                                  legend={[{ color: CHART.good, label: 'Met' }, { color: CHART.warning, label: 'Partially Met' }, { color: CHART.critical, label: 'Not Met' }]}
                                  items={pos.map(p => ({ label: String(p.id), detail: p.text, value: p.attainmentPercent ?? 0, color: colorOf(p.status), status: p.status, extra: (p.contributingGAs || []).length ? [`GAs: ${(p.contributingGAs || []).map((g: any) => g.gaId).join(', ')}`] : [] }))}
                                />
                              </ChartCard>
                              <ChartCard title="Compliance status" subtitle="Number of POs by status">
                                <DonutChart centerLabel="POs" slices={[
                                  { label: 'Met', value: count('Met'), color: CHART.good },
                                  { label: 'Partially Met', value: count('Partially Met'), color: CHART.warning },
                                  { label: 'Not Met', value: other, color: CHART.critical },
                                ]} />
                              </ChartCard>
                            </div>
                          );
                        })()}
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="text-left px-3 py-2 font-black text-slate-600 uppercase tracking-wider">PO</th>
                              <th className="text-left px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Description</th>
                              <th className="text-center px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Attainment %</th>
                              <th className="text-center px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Status</th>
                              <th className="text-left px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Contributing GAs</th>
                            </tr>
                          </thead>
                          <tbody>
                            {moreReportData.pos.map((po: any, i: number) => (
                              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 align-top">
                                <td className="px-3 py-2 font-black text-teal-700">{po.id}</td>
                                <td className="px-3 py-2 text-slate-600">{po.text}</td>
                                <td className="px-3 py-2 text-center font-bold">{(po.attainmentPercent ?? 0).toFixed(1)}%</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${po.status === 'Met' ? 'bg-green-100 text-green-700' : po.status === 'Partially Met' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                    {po.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex flex-wrap gap-1">
                                    {(po.contributingGAs || []).map((ga: any, j: number) => (
                                      <span key={j} className="bg-indigo-50 text-indigo-700 font-bold text-[10px] px-2 py-0.5 rounded-full border border-indigo-200">
                                        {ga.gaId} ({(ga.attainmentPercent ?? 0).toFixed(0)}%)
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* At-Risk Students */}
                    {moreReportType === 'at_risk' && moreReportData.students && (
                      <div className="space-y-3">
                        <div className="flex gap-3 flex-wrap text-xs">
                          <span className="bg-amber-100 text-amber-800 font-bold px-3 py-1 rounded-full">{moreReportData.atRiskCount ?? moreReportData.students.length} At-Risk Students</span>
                          <span className="text-[10px] text-slate-400">Students failing 2+ CLOs below {reportThreshold(moreReportData)}%</span>
                        </div>
                        {moreReportData.students.length > 0 && (() => {
                          const students: any[] = moreReportData.students;
                          const perCourse: Record<string, number> = {};
                          students.forEach(st => Array.from(new Set((st.failedCLOs || []).map((f: any) => String(f.courseCode)))).forEach((code: any) => { perCourse[code] = (perCourse[code] || 0) + 1; }));
                          const courseRows = Object.entries(perCourse).sort((a, b) => b[1] - a[1]);
                          const buckets = [2, 3, 4, 5].map(n => ({
                            label: n === 5 ? '5+ CLOs' : `${n} CLOs`,
                            value: students.filter(st => { const k = (st.failedCLOs || []).length; return n === 5 ? k >= 5 : k === n; }).length,
                          }));
                          const fewer = students.filter(st => (st.failedCLOs || []).length < 2).length;
                          return (
                            <div className="grid gap-3 lg:grid-cols-2">
                              <ChartCard title="At-risk students per course" subtitle="Students with at least one failed CLO in the course">
                                <HBarChart colorByStatus={false} showThreshold={false} unit="students" max={0}
                                  items={courseRows.map(([code, n]) => ({ label: code, value: n }))} />
                              </ChartCard>
                              <ChartCard title="How many CLOs each student is failing" subtitle="Number of students by failed-CLO count">
                                <HBarChart colorByStatus={false} showThreshold={false} unit="students" max={0}
                                  items={[...(fewer ? [{ label: '1 CLO', value: fewer }] : []), ...buckets]} />
                              </ChartCard>
                            </div>
                          );
                        })()}
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="text-left px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Reg No</th>
                              <th className="text-left px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Name</th>
                              <th className="text-center px-3 py-2 font-black text-slate-600 uppercase tracking-wider">CLOs Below Threshold</th>
                              <th className="text-center px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Courses</th>
                              <th className="text-center px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Avg Failed-CLO %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {moreReportData.students.map((s: any, i: number) => (
                              <tr key={i} className="border-b border-slate-100 hover:bg-amber-50">
                                <td className="px-3 py-2 font-mono font-bold text-amber-700">{s.regNo}</td>
                                <td className="px-3 py-2 font-bold text-slate-700">{s.name}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className="bg-red-100 text-red-700 font-black px-2 py-0.5 rounded-full">{(s.failedCLOs || []).length}</span>
                                </td>
                                <td className="px-3 py-2 text-center text-slate-500">{Array.from(new Set((s.failedCLOs || []).map((f: any) => f.courseCode))).join(', ') || '—'}</td>
                                <td className="px-3 py-2 text-center font-bold">{(s.failedCLOs || []).length ? `${((s.failedCLOs || []).reduce((a: number, f: any) => a + Number(f.attainment ?? 0), 0) / (s.failedCLOs || []).length).toFixed(1)}%` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Gap Analysis */}
                    {moreReportType === 'gap_analysis' && moreReportData.attributes && (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-500">GAs with zero or low course coverage — indicates curriculum gaps requiring attention.</p>
                        {(() => {
                          const atts: any[] = moreReportData.attributes;
                          const kind = (st: string) => st === 'No Coverage' ? 'none' : (st === 'Partial Coverage' || st === 'Mapped but No CLOs' || st === 'Low Attainment') ? 'partial' : 'ok';
                          const colorOf = (st: string) => ({ none: CHART.critical, partial: CHART.warning, ok: CHART.good } as any)[kind(st)];
                          return (
                            <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
                              <ChartCard title="Course coverage by GA" subtitle="Number of mapped courses per GA. Bar colour shows coverage status.">
                                <HBarChart showThreshold={false} unit="courses" max={0}
                                  legend={[{ color: CHART.good, label: 'Covered' }, { color: CHART.warning, label: 'Partial / Low' }, { color: CHART.critical, label: 'No Coverage' }]}
                                  items={atts.map(g => ({ label: String(g.gaId), detail: g.gaName, value: g.mappedCoursesCount ?? 0, color: colorOf(g.status), status: g.status, extra: [`Active CLOs: ${g.activeCLOsCount ?? 0}`, `Avg attainment: ${g.avgAttainment != null ? Number(g.avgAttainment).toFixed(1) + '%' : '—'}`] }))}
                                />
                              </ChartCard>
                              <ChartCard title="Coverage status" subtitle="Number of GAs by status">
                                <DonutChart centerLabel="GAs" slices={[
                                  { label: 'Covered', value: atts.filter(g => kind(g.status) === 'ok').length, color: CHART.good },
                                  { label: 'Partial / Low', value: atts.filter(g => kind(g.status) === 'partial').length, color: CHART.warning },
                                  { label: 'No Coverage', value: atts.filter(g => kind(g.status) === 'none').length, color: CHART.critical },
                                ]} />
                              </ChartCard>
                            </div>
                          );
                        })()}
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="text-left px-3 py-2 font-black text-slate-600 uppercase tracking-wider">GA</th>
                              <th className="text-left px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Name</th>
                              <th className="text-center px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Mapped Courses</th>
                              <th className="text-center px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Active CLOs</th>
                              <th className="text-center px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Avg Attainment</th>
                              <th className="text-center px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {moreReportData.attributes.map((g: any, i: number) => (
                              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2 font-black text-orange-700">{g.gaId}</td>
                                <td className="px-3 py-2 text-slate-700">{g.gaName}</td>
                                <td className="px-3 py-2 text-center font-bold">{g.mappedCoursesCount ?? 0}</td>
                                <td className="px-3 py-2 text-center font-bold">{g.activeCLOsCount ?? 0}</td>
                                <td className="px-3 py-2 text-center font-bold">{g.avgAttainment != null ? `${Number(g.avgAttainment).toFixed(1)}%` : '—'}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] 
                                    ${g.status === 'No Coverage' ? 'bg-red-100 text-red-700' :
                                      (g.status === 'Partial Coverage' || g.status === 'Mapped but No CLOs' || g.status === 'Low Attainment') ? 'bg-amber-100 text-amber-700' :
                                      'bg-green-100 text-green-700'}`}>
                                    {g.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Instructor Performance */}
                    {moreReportType === 'instructor_performance' && moreReportData.instructors && (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-500">Instructors with courses below the {reportThreshold(moreReportData)}% attainment threshold.</p>
                        {moreReportData.instructors.length > 0 && (() => {
                          const insts: any[] = moreReportData.instructors;
                          const allCourses = insts.flatMap(i => i.courses || []);
                          const below = allCourses.filter((c: any) => c.belowThreshold).length;
                          return (
                            <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
                              <ChartCard title="Courses per instructor" subtitle="On-track vs below-target courses">
                                <StackedBarChart
                                  parts={[{ label: 'On Track', color: CHART.good }, { label: 'Below Target', color: CHART.critical }]}
                                  rows={insts.map(i => ({ label: String(i.name || i.employeeId || '—'), values: [(i.courses || []).filter((c: any) => !c.belowThreshold).length, (i.courses || []).filter((c: any) => c.belowThreshold).length] }))}
                                />
                              </ChartCard>
                              <ChartCard title="All courses" subtitle="Courses by status">
                                <DonutChart centerLabel="courses" slices={[
                                  { label: 'On Track', value: allCourses.length - below, color: CHART.good },
                                  { label: 'Below Target', value: below, color: CHART.critical },
                                ]} />
                              </ChartCard>
                            </div>
                          );
                        })()}
                        {moreReportData.instructors.map((inst: any, i: number) => (
                          <div key={i} className="border border-slate-200 rounded-2xl overflow-hidden">
                            <div className="bg-slate-50 px-4 py-2 flex items-center gap-3 border-b border-slate-200">
                              <UserCheck className="w-3.5 h-3.5 text-rose-600" />
                              <span className="font-black text-xs text-slate-800">{inst.name}</span>
                              <span className="text-xs text-slate-400">{inst.employeeId}</span>
                              <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${inst.coursesBelowThreshold > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {inst.coursesBelowThreshold ?? 0} courses below threshold
                              </span>
                            </div>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-100">
                                  <th className="text-left px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Course</th>
                                  <th className="text-center px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Avg Attainment</th>
                                  <th className="text-center px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Semester</th>
                                  <th className="text-center px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(inst.courses || []).map((c: any, j: number) => (
                                  <tr key={j} className="border-b border-slate-50 hover:bg-slate-50">
                                    <td className="px-3 py-2 font-bold text-slate-700">{c.courseCode} — {c.courseTitle}</td>
                                    <td className="px-3 py-2 text-center font-bold">{c.avgCLOAttainment != null ? `${Number(c.avgCLOAttainment).toFixed(1)}%` : '—'}</td>
                                    <td className="px-3 py-2 text-center text-slate-500">{c.semester ?? '—'}</td>
                                    <td className="px-3 py-2 text-center">
                                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${!c.belowThreshold ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {!c.belowThreshold ? 'On Track' : 'Below Target'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Cohort Comparison */}
                    {moreReportType === 'cohort_comparison' && moreReportData.cohorts && (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-500">GA attainment across academic years / batches ({moreReportData.gaId || 'All GAs'}).</p>
                        {moreReportData.cohorts.length > 0 && (() => {
                          const cohorts: any[] = moreReportData.cohorts;
                          const gas: string[] = Array.from(new Set(cohorts.map(c => String(c.gaId))));
                          const years: string[] = Array.from(new Set(cohorts.map(c => String(c.academicYear)))).sort();
                          const val = (ga: string, yr: string) => { const c = cohorts.find(x => String(x.gaId) === ga && String(x.academicYear) === yr); return c ? Number(c.attainmentPercent ?? 0) : null; };
                          return (
                            <ChartCard title="GA attainment by academic year" subtitle={years.length > 1 ? 'Each colour is an academic year; darker = more recent' : `Academic year ${years[0]}`}>
                              <GroupedColumnChart categories={gas} series={years} value={val} threshold={moreReportData.threshold ?? undefined} />
                            </ChartCard>
                          );
                        })()}
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="text-left px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Academic Year</th>
                              <th className="text-left px-3 py-2 font-black text-slate-600 uppercase tracking-wider">GA</th>
                              <th className="text-center px-3 py-2 font-black text-slate-600 uppercase tracking-wider">Attainment %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {moreReportData.cohorts.map((c: any, i: number) => (
                              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2 font-bold text-green-700">{c.academicYear}</td>
                                <td className="px-3 py-2 font-bold text-indigo-700">{c.gaId}</td>
                                <td className="px-3 py-2 text-center font-bold">{Number(c.attainmentPercent ?? 0).toFixed(1)}%</td>
</tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Fallback for unexpected shapes */}
                    {!['attributes','semesters','clos','courses','pos','students','instructors','cohorts'].some(k => moreReportData[k]) && (
                      <pre className="text-[10px] text-slate-500 bg-slate-50 rounded-2xl p-4 overflow-auto max-h-96 whitespace-pre-wrap">
                        {JSON.stringify(moreReportData, null, 2)}
                      </pre>
                    )}

                  </div>
                )}

              </div>
            )}

            </div>
          
        )}

      </main>

      {/* Vision & Mission Modal Popup */}
      {viewVmModal && (
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none animate-in fade-in duration-150" 
          onClick={() => { setViewVmModal(null); setIsEditingVm(false); }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Titlebar */}
            <div className="bg-[#1e1b4b] text-white px-5 py-4 flex items-center justify-between border-b border-indigo-950">
              <div className="flex items-center gap-2.5">
                <GraduationCap className="w-5 h-5 text-indigo-300" />
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-200 block">
                    {viewVmModal.type === 'department' ? 'DEPARTMENT SPECIFICATION' : 'PROGRAM SPECIFICATION'}
                  </span>
                  <h3 className="text-sm font-bold text-white leading-tight">
                    {viewVmModal.name} {viewVmModal.code ? `(${viewVmModal.code})` : ''}
                  </h3>
                </div>
              </div>
              <button 
                onClick={() => { setViewVmModal(null); setIsEditingVm(false); }}
                className="text-white/70 hover:text-white cursor-pointer hover:bg-white/15 rounded-lg p-1.5 transition-all focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              
              {/* Vision Section */}
              <div className="space-y-3 bg-slate-50 border border-slate-200 p-6 rounded-2xl text-left relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div>
                <div className="flex items-center justify-between gap-2 pl-1">
                  <div className="flex items-center gap-2">
                    <Award className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                    <h4 className="font-sans font-black text-slate-900 text-xs tracking-wider uppercase">VISION STATEMENT</h4>
                  </div>
                  {!isEditingVm && (
                    <button
                      onClick={() => {
                        setIsEditingVm(true);
                        setEditVmVision(viewVmModal.vision);
                        setEditVmMission(viewVmModal.mission);
                      }}
                      className="text-indigo-600 hover:text-indigo-950 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors focus:outline-none"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
                {isEditingVm ? (
                  <div className="pl-7 pr-1 py-0.5">
                    <textarea
                      value={editVmVision}
                      onChange={(e) => setEditVmVision(e.target.value)}
                      rows={3}
                      className="w-full text-slate-800 text-sm bg-white border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all leading-relaxed font-sans font-medium"
                      placeholder="Enter vision statement..."
                    />
                  </div>
                ) : (
                  <p className="text-slate-800 text-sm leading-relaxed italic pl-7 py-0.5 font-medium">
                    "{viewVmModal.vision || 'Vision statement undefined.'}"
                  </p>
                )}
              </div>

              {/* Mission Section */}
              <div className="space-y-3 bg-slate-50 border border-slate-200 p-6 rounded-2xl text-left relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div>
                <div className="flex items-center justify-between gap-2 pl-1">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                    <h4 className="font-sans font-black text-slate-900 text-xs tracking-wider uppercase">MISSION STATEMENT</h4>
                  </div>
                  {!isEditingVm && (
                    <button
                      onClick={() => {
                        setIsEditingVm(true);
                        setEditVmVision(viewVmModal.vision);
                        setEditVmMission(viewVmModal.mission);
                      }}
                      className="text-indigo-600 hover:text-indigo-950 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors focus:outline-none"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
                {isEditingVm ? (
                  <div className="pl-7 pr-1 py-0.5">
                    <textarea
                      value={editVmMission}
                      onChange={(e) => setEditVmMission(e.target.value)}
                      rows={5}
                      className="w-full text-slate-800 text-sm bg-white border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all leading-relaxed font-sans font-medium"
                      placeholder="Enter mission statement..."
                    />
                  </div>
                ) : (
                  <p className="text-slate-800 text-sm leading-relaxed pl-7 py-0.5 font-medium whitespace-pre-line">
                    {viewVmModal.mission || 'Mission statement undefined.'}
                  </p>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
              {isEditingVm ? (
                <>
                  <button
                    onClick={() => setIsEditingVm(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-lg transition-colors cursor-pointer focus:outline-none"
                    disabled={savingLoad}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveVmModal}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer focus:outline-none flex items-center gap-1.5"
                    disabled={savingLoad}
                  >
                    {savingLoad ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setIsEditingVm(true);
                      setEditVmVision(viewVmModal.vision);
                      setEditVmMission(viewVmModal.mission);
                    }}
                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-950 text-xs font-bold rounded-lg transition-colors cursor-pointer focus:outline-none flex items-center gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => setViewVmModal(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-lg transition-colors cursor-pointer focus:outline-none"
                  >
                    Dismiss
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Modal Windows (ResultMate Desktop Style) */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none" onClick={() => setActiveModal(null)}>
          <div 
            className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Titlebar */}
            <div className="bg-[#1e293b] text-slate-100 px-4 py-2.5 flex items-center justify-between border-b border-indigo-950">
              <span className="text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2">
                {activeModal === 'about' && 'About ResultMate OBE v4.6'}
                {activeModal === 'clos' && 'Course CLO-GA Distribution Sheet'}
                {activeModal === 'plos' && 'PLO Program Educational Outcomes Guidelines'}
                {activeModal === 'statistics' && 'Attribute Distribution Histogram Diagram'}
                {activeModal === 'integrity' && 'OBE Alignment Integrity Auditor'}
                {activeModal === 'help' && 'OBE Mapping Guidelines and Manual'}
                {activeModal === 'add_program' && 'Register New Academic Program'}
                {activeModal === 'edit_program_vm' && 'Modify Program Mission & Vision Charter'}
                {activeModal === 'add_course' && 'Add Program Curricular Course'}
                {activeModal === 'edit_course' && 'Edit Course Specification Details'}
              </span>
              <button 
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white cursor-pointer hover:bg-slate-800 rounded-md px-2 py-0.5 text-xs font-bold transition-all"
              >
                ✕
              </button>
            </div>

            {/* Modal scrollable Content Area */}
            <div className="p-6 overflow-y-auto flex-1 text-slate-700 text-xs leading-relaxed space-y-4">
              
              {/* 1. ABOUT MODAL */}
              {activeModal === 'about' && (
                <div className="space-y-4 font-sans text-xs">
                  <div className="flex items-center gap-4 bg-slate-50 p-4 border border-slate-200 rounded-lg">
                    <FileText className="w-10 h-10 text-indigo-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">ResultMate OBE Management platform</h4>
                      <p className="text-slate-500 text-[11px] font-mono mt-0.5">Hitec Corporate Suite : Version 4.6.0.41</p>
                      <p className="text-slate-500 text-[11px] font-mono">Date built: June 2026</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold text-slate-900">Institution & Licensing Information:</p>
                    <table className="w-full border-collapse border border-slate-200 text-slate-700 text-[11px]">
                      <tbody>
                        <tr className="bg-slate-50">
                          <td className="border border-slate-200 px-3 py-1.5 font-bold w-1/3">Registered Owner</td>
                          <td className="border border-slate-200 px-3 py-1.5 text-slate-900 font-medium">Iqra University Division of Quality Assurance</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 px-3 py-1.5 font-bold">Licensing Status</td>
                          <td className="border border-slate-200 px-3 py-1.5 text-indigo-700 font-bold">Active Enterprise Unlimited Site License</td>
                        </tr>
                        <tr className="bg-slate-50">
                          <td className="border border-slate-200 px-3 py-1.5 font-bold">Linked Faculties</td>
                          <td className="border border-slate-200 px-3 py-1.5 font-mono">Department of Computing / Business Administration</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 px-3 py-1.5 font-bold">System Status</td>
                          <td className="border border-slate-200 px-3 py-1.5 text-blue-700 font-bold">OBE Curricular Database Synced</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded text-slate-600 block">
                    ResultMate is designed to streamline academic curriculum mappings under international quality frameworks (such as Washington Accord & CAC accreditation criteria). Any alterations to definitions must be performed by authorized QA Senior Supervisors.
                  </div>
                </div>
              )}

              {/* 2. COURSE CLO MODAL */}
              {activeModal === 'clos' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                    <div>
                      <h4 className="font-bold text-slate-900">Course Outcomes Integration Matrix</h4>
                      <p className="text-slate-500 text-[11px] mt-0.5">Active Faculty: {activeDepartment?.name}</p>
                    </div>
                    <span className="font-mono font-bold bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded text-[10px]">
                      Total: {data?.courses.filter(c => c.departmentId === activeDeptId).length} Courses Listed
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold text-[10px] border-b border-slate-200 uppercase tracking-wider">
                          <th className="px-3 py-2 w-24">Code</th>
                          <th className="px-3 py-2">Course Name</th>
                          <th className="px-3 py-2 text-center w-28">Mapped Attributes</th>
                          <th className="px-3 py-2 text-center w-28">Alignment Ratio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {data?.courses.filter(c => c.departmentId === activeDeptId).map(c => {
                          const mappedCount = c.mappedGAs.length;
                          const ratio = Math.round((mappedCount / filteredGAs.length) * 100);
                          return (
                            <tr key={c.id} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-mono font-bold text-slate-900">{c.code}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">{c.title}</td>
                              <td className="px-3 py-2 text-center">
                                {mappedCount === 0 ? (
                                  <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 rounded font-bold text-[9px] text-rose-600 block">
                                    UNMAPPED
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded font-mono font-bold text-[9.5px] text-indigo-900 block">
                                    {mappedCount} mapped
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                                    <div 
                                      className={`h-full rounded-full ${mappedCount === 0 ? 'bg-rose-500' : 'bg-blue-500'}`}
                                      style={{ width: `${Math.max(ratio, mappedCount > 0 ? 10 : 0)}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-[9.5px] w-8 text-right font-bold text-slate-600">{ratio}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3. PLO PROGRAM DETAILED OUTCOMES MODAL */}
              {activeModal === 'plos' && (
                <div className="space-y-4">
                  <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                    <h4 className="font-bold text-slate-900 uppercase text-xs">Graduate Attributes (GAs) / Program Learning Outcomes (PLOs)</h4>
                    <p className="text-slate-600 text-[11px] mt-0.5">Under international QA accreditation models, standard outcomes definitions are loaded for {activeDepartment?.name}.</p>
                  </div>

                  <div className="space-y-2.5">
                    {filteredGAs.map(ga => {
                      const frequency = data?.courses.filter(c => c.departmentId === activeDeptId && c.mappedGAs.includes(ga.id)).length || 0;
                      return (
                        <div key={ga.id} className="p-3 border border-slate-200 rounded-lg hover:border-indigo-200 transition-colors bg-white/55">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[10px] border border-indigo-100">
                              {ga.id}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Mapped in: <strong className="text-slate-700 font-bold">{frequency} courses</strong>
                            </span>
                          </div>
                          <strong className="text-slate-950 font-bold block text-[11px] mt-0.5">{ga.name}</strong>
                          <p className="text-slate-500 text-[10.5px] leading-relaxed mt-1">{ga.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. STATISTICS HISTOGRAM DIAGRAM MODAL */}
              {activeModal === 'statistics' && (
                <div className="space-y-5">
                  <div className="bg-indigo-50 p-3.5 rounded-lg border border-indigo-100 text-center">
                    <h4 className="font-bold text-indigo-950 text-xs">GRADUATE ATTRIBUTE MAPPING HISTOGRAM</h4>
                    <p className="text-slate-600 text-[10.5px] mt-0.5">Real-time mapping statistics showing frequency distribution per Graduate Attribute across all active curriculum paths.</p>
                  </div>

                  {/* CUSTOM SVG BAR GRAPH */}
                  <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-inner flex flex-col items-center">
                    <span className="text-[10px] font-mono text-slate-400 mb-2">Attribute Frequency Chart (Total courses linked out of department)</span>
                    <div className="w-full h-44 flex items-end gap-1 px-4 border-b border-slate-300 pb-1.5 pt-4">
                      {gaStats.map(stat => {
                        const heightPct = Math.min(100, Math.max(8, stat.pct));
                        return (
                          <div key={stat.id} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                            {/* Hover label pill */}
                            <div className="absolute bottom-full mb-1 bg-[#1e293b] text-white font-mono font-bold text-[9px] px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 whitespace-nowrap">
                              {stat.count} Courses ({stat.pct}%)
                            </div>
                            
                            {/* Bar container */}
                            <div 
                              className="w-full bg-indigo-600 rounded-t-sm hover:bg-blue-500 cursor-pointer transition-all duration-300"
                              style={{ height: `${heightPct}%` }}
                            />
                            
                            {/* ID indicator */}
                            <span className="font-mono text-[9px] font-black text-slate-700 mt-1">{stat.id}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* GRID LISTING THE MATRIX METRICS */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <table className="w-full border-collapse text-left text-[10.5px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="px-3 py-2 w-16">ID</th>
                          <th className="px-3 py-2">Graduate Outcome Specification</th>
                          <th className="px-3 py-2 text-right w-24">Link Count</th>
                          <th className="px-3 py-2 text-right w-28">Ratio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {gaStats.map(stat => (
                          <tr key={stat.id} className="hover:bg-slate-50">
                            <td className="px-3 py-1.5 font-mono font-bold text-indigo-700">{stat.id}</td>
                            <td className="px-3 py-1.5 font-semibold text-slate-800">{stat.name}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-slate-600 font-bold">{stat.count} courses</td>
                            <td className="px-3 py-1.5 text-right font-mono font-black text-slate-900">{stat.pct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 5. INTEGRITY AUDIT AUDITOR MODAL */}
              {activeModal === 'integrity' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-slate-100 p-4 rounded-xl border border-slate-200">
                    {unmappedCourses.length === 0 ? (
                      <Check className="w-8 h-8 text-blue-600 font-black shrink-0" />
                    ) : (
                      <AlertCircle className="w-8 h-8 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <h4 className="font-bold text-slate-900">OBE Alignment Integrity Dashboard Index</h4>
                      <p className="text-[11px] text-slate-500">Auto-calculated compliance criteria across mapped objectives & statements.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Academics Integrity Checklist Score</h5>
                    
                    {/* Checklist 1 */}
                    <div className="flex items-start justify-between p-3 border border-slate-200 rounded bg-white">
                      <div className="space-y-0.5">
                        <strong className="block font-bold text-slate-900">1. Unmapped Courses Sweep</strong>
                        <p className="text-slate-500 text-[10px]">Verifies that no active course in database is left without at least 1 mapped Graduate Attribute.</p>
                      </div>
                      {unmappedCourses.length === 0 ? (
                        <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 border border-blue-200 rounded">
                          100% COVERED
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 border border-rose-200 rounded">
                          {unmappedCourses.length} COURSE ERROR(S)
                        </span>
                      )}
                    </div>

                    {/* Unmapped Courses Detail Lists */}
                    {unmappedCourses.length > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded space-y-1.5">
                        <strong className="text-amber-900 font-bold block text-[10px]">ATTENTION REQUIRED FOR THE FOLLOWING COURSES (No attributes allocated):</strong>
                        <div className="grid grid-cols-2 gap-1 font-mono text-[10.5px]">
                          {unmappedCourses.map(c => (
                            <span key={c.id} className="text-amber-800 block">
                              • <strong>{c.code}</strong> — {c.title.substring(0, 32)}...
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Checklist 2 */}
                    <div className="flex items-start justify-between p-3 border border-slate-200 rounded bg-white">
                      <div className="space-y-0.5 bg-white">
                        <strong className="block font-bold text-slate-900">2. Institutional Statements Completeness</strong>
                        <p className="text-slate-500 text-[10px]">Checks presence of registered Vision & Mission details in backend DB descriptors.</p>
                      </div>
                      {(activeDepartment?.vision && activeDepartment?.vision.length > 10) && (activeDepartment?.mission && activeDepartment?.mission.length > 10) ? (
                        <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 border border-blue-200 rounded">
                          FULLY DRAFTED
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 border border-amber-200 rounded">
                          MISSING TEXT
                        </span>
                      )}
                    </div>

                    {/* Checklist 3 */}
                    <div className="flex items-start justify-between p-3 border border-slate-200 rounded bg-white">
                      <div className="space-y-0.5 bg-white">
                        <strong className="block font-bold text-slate-900">3. Program Objectives Balance</strong>
                        <p className="text-slate-500 text-[10px]">Validates mapping coverage index across key Program Objectives PO1 - PO4.</p>
                      </div>
                      <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 border border-indigo-200 rounded">
                        ACTIVE INDEX COHERENT
                      </span>
                    </div>

                  </div>
                </div>
              )}

              {/* 6. HELP STUDY MANUAL MODAL */}
              {activeModal === 'help' && (
                <div className="space-y-4 text-slate-700">
                  <div className="bg-indigo-50 p-4 border border-indigo-100 rounded-lg">
                    <h4 className="font-bold text-slate-900 text-sm">Outcome-Based Education (OBE) Mapping Manual</h4>
                    <p className="text-[11px] text-slate-500 mt-1">Procedural code of criteria for curriculum alignment under professional commissions.</p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <strong className="text-slate-900 font-bold block">1. Core Philosophy of OBE Matrix</strong>
                      <p className="text-slate-500">OBE focuses on measuring student outcomes. Each Course Learning Outcome (CLO) must correspond to Graduate Attributes (GAs) which are defined collectively under standard accrediting criteria.</p>
                    </div>

                    <div className="space-y-1">
                      <strong className="text-slate-900 font-bold block">2. Allocating Checkboxes in Matrix Tab</strong>
                      <p className="text-slate-500">Use the checkboxes in the <strong>Course to GA Allocation Matrix</strong>. Simply double-click/toggle checkmarks. Checking a box denotes that the primary CLOs of that course align directly with that specific Graduate Attribute target.</p>
                    </div>

                    <div className="space-y-1">
                      <strong className="text-slate-900 font-bold block">3. Program PO Mapping Layer</strong>
                      <p className="text-slate-500">Graduate Attributes (GAs) map up directly into broad Program Objectives (POs). This vertical alignment creates a unified curriculum audit trail from lesson plan assessments up to institutional vision statements.</p>
                    </div>

                    <div className="space-y-1">
                      <strong className="text-slate-900 font-bold block">4. supervisor Lock & Save Safeguards</strong>
                      <p className="text-slate-500">Keep the configuration locked (view mode) except while making authorized updates. Make sure database changes are saved to persistent backend directories before exiting the window session.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 7. ADD PROGRAM MODAL */}
              {activeModal === 'add_program' && (
                <div className="space-y-4 font-sans text-xs">
                  <div className="bg-indigo-50 p-4 border border-indigo-100 rounded-lg">
                    <h4 className="font-bold text-slate-900 text-sm">Add New Academic Program</h4>
                    <p className="text-[11px] text-slate-500 mt-1">Specify new program code (e.g. SE, AI) and full program title details.</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Program Code / Abbreviation</label>
                      <input 
                        type="text"
                        value={newProgramCode}
                        onChange={(e) => setNewProgramCode(e.target.value)}
                        placeholder="e.g. SE, AI, DS"
                        className="w-full p-3 font-medium bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Full Program Name</label>
                      <input 
                        type="text"
                        value={newProgramName}
                        onChange={(e) => setNewProgramName(e.target.value)}
                        placeholder="e.g. Software Engineering, Artificial Intelligence"
                        className="w-full p-3 font-medium bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-xs text-slate-800"
                      />
                    </div>
                    
                    <div className="pt-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={seedGAsChecked}
                          onChange={(e) => setSeedGAsChecked(e.target.checked)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="text-[11px] font-bold text-slate-700">
                          Pre-seed standard Graduate Attributes (GAs)
                        </span>
                      </label>
                      <p className="text-[10px] text-slate-400 ml-5.5 mt-0.5 leading-normal">
                        Automatically populates 10 standard Washington Accord Graduate Attributes for this program. Leave unchecked if you prefer to register GAs manually in your database.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-3">
                    <button
                      onClick={handleAddProgram}
                      disabled={savingLoad}
                      className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition"
                    >
                      {savingLoad ? 'Adding new Program...' : '🛠️ Add Program Now'}
                    </button>
                  </div>
                </div>
              )}

              {/* 8. EDIT Program Vision & Mission Modal */}
              {activeModal === 'edit_program_vm' && (
                <div className="space-y-4 font-sans text-xs">
                  <div className="bg-slate-55 p-4 border border-slate-200 rounded-lg">
                    <h4 className="font-bold text-slate-900 text-sm">Modify Program Charter Shortcut</h4>
                    <p className="text-[11px] text-slate-500 mt-1">Direct shortcut updating the Mission and Vision statement specs for <strong>{activeProgram?.name}</strong>.</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Program Vision Statement</label>
                      <textarea 
                        value={editProgramVision}
                        onChange={(e) => setEditProgramVision(e.target.value)}
                        rows={3}
                        className="w-full p-3 font-medium bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-xs text-slate-800"
                        placeholder="Paste or type program vision..."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Program Mission Statement</label>
                      <textarea 
                        value={editProgramMission}
                        onChange={(e) => setEditProgramMission(e.target.value)}
                        rows={4}
                        className="w-full p-3 font-medium bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-xs text-slate-800"
                        placeholder="Paste or type program mission..."
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-3">
                    <button
                      onClick={handleSaveProgramVisionMission}
                      className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition"
                    >
                      💾 Save Program Charter Changes
                    </button>
                  </div>
                </div>
              )}

              {/* 9. ADD COURSE MODAL */}
              {activeModal === 'add_course' && (
                <div className="space-y-4 font-sans text-xs">
                  <div className="bg-indigo-50 p-4 border border-indigo-100 rounded-lg">
                    <h4 className="font-bold text-slate-900 text-sm">Add New Program Course</h4>
                    <p className="text-[11px] text-slate-500 mt-1">This registers a brand-new course specifically linked to your chosen program and department separately.</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Target Department</label>
                      <select 
                        value={newCourseDeptId}
                        onChange={(e) => {
                          setNewCourseDeptId(e.target.value);
                          const matchingProgs = data?.programs.filter(p => p.departmentId === e.target.value) || [];
                          if (matchingProgs.length > 0) {
                            setNewCourseProgramId(matchingProgs[0].id);
                          }
                        }}
                        className="w-full p-3 font-medium bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-xs text-slate-800"
                      >
                        {data?.departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Target Academic Program</label>
                      <select 
                        value={newCourseProgramId}
                        onChange={(e) => setNewCourseProgramId(e.target.value)}
                        className="w-full p-3 font-medium bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-xs text-slate-800"
                      >
                        {data?.programs.filter(p => p.departmentId === newCourseDeptId).map(p => (
                          <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Course Code</label>
                      <input 
                        type="text"
                        value={newCourseCode}
                        onChange={(e) => setNewCourseCode(e.target.value)}
                        placeholder="e.g. SE-313"
                        className="w-full p-3 font-medium bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Course Title</label>
                      <input 
                        type="text"
                        value={newCourseTitle}
                        onChange={(e) => setNewCourseTitle(e.target.value)}
                        placeholder="e.g. Software Quality Assurance"
                        className="w-full p-3 font-medium bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Course Type</label>
                      <select 
                        value={newCourseType}
                        onChange={(e) => setNewCourseType(e.target.value as any)}
                        className="w-full p-3 font-medium bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="core">Core Requirement</option>
                        <option value="elective">Professional Elective</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-3">
                    <button
                      onClick={handleAddCourse}
                      disabled={savingLoad}
                      className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition"
                    >
                      {savingLoad ? 'Saving Course...' : '📚 Register Course Now'}
                    </button>
                  </div>
                </div>
              )}

              {/* 10. EDIT COURSE MODAL */}
              {activeModal === 'edit_course' && (
                <div className="space-y-4 font-sans text-xs">
                  <div className="bg-indigo-50 p-4 border border-indigo-100 rounded-lg">
                    <h4 className="font-bold text-slate-900 text-sm">Edit Course Specifications</h4>
                    <p className="text-[11px] text-slate-500 mt-1">Re-allocate, edit code/title representation or transfer course department alignments.</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Aligning Department</label>
                      <select 
                        value={editCourseDeptId}
                        onChange={(e) => {
                          setEditCourseDeptId(e.target.value);
                          const matchingProgs = data?.programs.filter(p => p.departmentId === e.target.value) || [];
                          if (matchingProgs.length > 0) {
                            setEditCourseProgramId(matchingProgs[0].id);
                          }
                        }}
                        className="w-full p-3 font-medium bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-xs text-slate-800"
                      >
                        {data?.departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Aligning Academic Program</label>
                      <select 
                        value={editCourseProgramId}
                        onChange={(e) => setEditCourseProgramId(e.target.value)}
                        className="w-full p-3 font-medium bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-xs text-slate-800"
                      >
                        {data?.programs.filter(p => p.departmentId === editCourseDeptId).map(p => (
                          <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Course Code</label>
                      <input 
                        type="text"
                        value={editCourseCode}
                        onChange={(e) => setEditCourseCode(e.target.value)}
                        placeholder="e.g. SE-313"
                        className="w-full p-3 font-medium bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Course Title</label>
                      <input 
                        type="text"
                        value={editCourseTitle}
                        onChange={(e) => setEditCourseTitle(e.target.value)}
                        placeholder="e.g. Software Quality Assurance"
                        className="w-full p-3 font-medium bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Course Type</label>
                      <select 
                        value={editCourseType}
                        onChange={(e) => setEditCourseType(e.target.value as any)}
                        className="w-full p-3 font-medium bg-white border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="core">Core Requirement</option>
                        <option value="elective">Professional Elective</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-3">
                    <button
                      onClick={handleEditCourseSubmit}
                      disabled={savingLoad}
                      className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition"
                    >
                      {savingLoad ? 'Saving Specifications...' : '💾 Save Specifications Now'}
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-between gap-2 items-center">
              <div>
                {(activeModal === 'clos' || activeModal === 'plos' || activeModal === 'statistics' || activeModal === 'integrity') && (
                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-1.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-400" />
                    <span>Print Matrix Report</span>
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm active:scale-95 duration-100 cursor-pointer"
                >
                  OK
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
      
      {notification && (
        <div className="fixed bottom-5 right-5 z-[100] animate-in slide-in-from-bottom-5 duration-300 select-none">
          <div className={`flex items-center gap-2.5 px-5 py-3.5 rounded-2xl shadow-2xl border ${
            notification.type === 'success' 
              ? 'bg-blue-50 border-blue-200 text-blue-950 font-medium' 
              : 'bg-rose-50 border-rose-200 text-rose-950 font-medium'
          }`}>
            {notification.type === 'success' ? (
              <Check className="w-4 h-4 text-blue-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="text-xs">{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
