import { useState, useEffect, useMemo } from 'react';
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
  Activity,
  Info,
  Download,
  Printer,
  TrendingUp,
  BarChart2,
  Edit,
  Trash2
} from 'lucide-react';

interface QADashboardProps {
  onLogout: () => void;
}

type ActiveViewModule = 'allocation' | 'po_mapping' | 'vision_mission' | 'po_configure';

export default function QADashboard({ onLogout }: QADashboardProps) {
  const [data, setData] = useState<OBEData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Core navigation selectors directly in header
  const [activeDeptId, setActiveDeptId] = useState<string>('computing');
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

  // Dropdown states for Desktop-Style Menu Bar
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'about' | 'clos' | 'plos' | 'statistics' | 'integrity' | 'help' | 'add_program' | 'edit_program_vm' | 'add_course' | 'edit_course' | null>(null);

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

  // Form states for creating custom program
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramCode, setNewProgramCode] = useState('');

  // Form states for adding course
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseType, setNewCourseType] = useState<'core' | 'elective'>('core');
  const [newCourseDeptId, setNewCourseDeptId] = useState<string>('computing');
  const [newCourseProgramId, setNewCourseProgramId] = useState<string>('bscs');

  // Course Editing states
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editCourseCode, setEditCourseCode] = useState('');
  const [editCourseTitle, setEditCourseTitle] = useState('');
  const [editCourseType, setEditCourseType] = useState<'core' | 'elective'>('core');
  const [editCourseDeptId, setEditCourseDeptId] = useState('computing');
  const [editCourseProgramId, setEditCourseProgramId] = useState('bscs');

  // Load backend or fallback mockups
  useEffect(() => {
    fetchData();
  }, []);

  // Close the desktop menu when the user clicks anywhere else
  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const fetchData = async () => {
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
    } catch (err) {
      console.warn("Backend server offline, loading local storage sandbox database...", err);
      setError('Connection to backend offline. Running in offline sandbox mode.');
      const localData = apiService.getLocalStorageData();
      setData({
        departments: localData.departments || [],
        programs: localData.programs || [],
        courses: localData.courses || [],
        gas: localData.gas || []
      });
    } finally {
      setLoading(false);
    }
  };

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
    if (data) {
      if (!activeDeptId) {
        setActiveProgramId('');
      } else {
        const activeProgObj = data.programs.find(p => p.id === activeProgramId);
        if (activeProgObj && activeProgObj.departmentId !== activeDeptId) {
          setActiveProgramId('');
        }
      }
    }
  }, [activeDeptId, data]);

  // Reset page when selectors change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeDeptId, activeProgramId, selectedCourseId, searchPhrase]);

  // Filtered definitions of GAs matching selected program securely
  const filteredGAs = useMemo(() => {
    if (!data) return [];
    // Only yield GAs matching the currently active program code specifically
    return data.gas.filter(g => 
      g.programId === activeProgramId || 
      (!g.programId && g.departmentId === activeDeptId && activeProgramId === 'bscs')
    );
  }, [data, activeDeptId, activeProgramId]);

  // Filtered courses matching selected department and selectors
  const filteredCourses = useMemo(() => {
    if (!data || !activeDeptId) return [];
    let list = data.courses.filter(c => 
      c.departmentId === activeDeptId && 
      (c.programId === activeProgramId || (!c.programId && activeProgramId === 'bscs'))
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
      (c.programId === activeProgramId || (!c.programId && activeProgramId === 'bscs'))
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
      (c.programId === activeProgramId || (!c.programId && activeProgramId === 'bscs')) && 
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
      await apiService.updateCourse(course.id, { mappedGAs: updatedMapped });
    } catch (e) {
      console.warn("Local storage fallback mapped.");
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
    } catch (e) {
      console.warn("Fallback DB save");
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
      alert("Department Mission & Vision saved successfully.");
    } catch (e) {
      alert("Failed to sync vision data");
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
      alert("Program Mission & Vision saved successfully.");
    } catch (e) {
      alert("Failed to sync program vision data");
    } finally {
      setSavingLoad(false);
    }
  };

  // Handle adding custom program
  const handleAddProgram = async () => {
    if (!newProgramName.trim() || !newProgramCode.trim() || !data) {
      alert("Please provide name and code details for the program.");
      return;
    }

    const newId = newProgramCode.trim().toLowerCase();
    
    // Check if program exists
    if (data.programs.some(p => p.id === newId)) {
      alert("A program with this code already exists.");
      return;
    }

    const codeUpper = newProgramCode.trim().toUpperCase();
    const seededGAs: GA[] = [];

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

    const defaultPOs: ProgramObjective[] = [
      { id: 'PO1', text: 'Theoretical comprehension and fundamental engineering/science grounding in ' + codeUpper + '.', mappedGAs: [`GA-${codeUpper}-1`, `GA-${codeUpper}-2`] },
      { id: 'PO2', text: 'Problem analysis, research validation and algorithmic optimization synthesis in ' + codeUpper + '.', mappedGAs: [`GA-${codeUpper}-1`, `GA-${codeUpper}-2`, `GA-${codeUpper}-3`, `GA-${codeUpper}-4`, `GA-${codeUpper}-5`] },
      { id: 'PO3', text: 'Critical tool utilization, design deployment, and modern software/AI systems mastery.', mappedGAs: [`GA-${codeUpper}-3`, `GA-${codeUpper}-4`, `GA-${codeUpper}-6`, `GA-${codeUpper}-7`, `GA-${codeUpper}-8`, `GA-${codeUpper}-10`] },
      { id: 'PO4', text: 'Professional ethics, societal safety considerations, and collaborative team communication.', mappedGAs: [`GA-${codeUpper}-6`, `GA-${codeUpper}-7`, `GA-${codeUpper}-9`] }
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
      setActiveModal(null);
      alert(`Program ${newProg.code} successfully registered! Separate Graduate Attributes (GA-${codeUpper}-1 to GA-${codeUpper}-10) have been generated uniquely for this program.`);
    } catch (e) {
      alert("Error saving new program.");
    } finally {
      setSavingLoad(false);
    }
  };

  // Handle adding custom course
  const handleAddCourse = async () => {
    if (!newCourseCode.trim() || !newCourseTitle.trim() || !data) {
      alert("Please provide course registration info containing valid code and title.");
      return;
    }

    const newId = 'C_' + Math.random().toString(36).substr(2, 9);
    
    // Check if code matches existing course in the department
    if (data.courses.some(c => c.code.trim().toUpperCase() === newCourseCode.trim().toUpperCase() && c.departmentId === newCourseDeptId && c.programId === newCourseProgramId)) {
      alert("A course with this exact code is already registered under this program.");
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
      alert(`Course "${newC.code} — ${newC.title}" successfully added! You can now map GAs to this course in the Active Allocation Matrix.`);
    } catch (err) {
      alert("Error adding custom course.");
    } finally {
      setSavingLoad(false);
    }
  };

  // Handle editing custom course
  const handleEditCourseSubmit = async () => {
    if (!editingCourse || !editCourseCode.trim() || !editCourseTitle.trim() || !data) {
      alert("Please provide valid course code and title.");
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
      alert("Course specifications updated successfully!");
    } catch (err) {
      alert("Error saving course changes.");
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
      alert("Program Objectives updated and synchronized successfully.");
    } catch (e) {
      alert("Failed to sync objectives");
    } finally {
      setSavingLoad(false);
    }
  };

  // Export active department matrix to downloadable CSV file
  const handleExportCSV = () => {
    if (!data || !activeDepartment) {
      alert("No active data to export.");
      return;
    }
    const coursesInDept = data.courses.filter(c => c.departmentId === activeDeptId);
    const gasInDept = data.gas.filter(g => g.departmentId === activeDeptId);
    
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
      alert("No active database loaded.");
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
      

      {/* Classic Desktop-styled horizontal Menu Bar */}
      <header className="bg-[#f1f5f9] border-b border-slate-300 z-40 shrink-0 select-none relative">
        <div className="mx-auto flex flex-wrap items-center justify-between px-3 py-1.5 max-w-[1700px]">
          
          {/* Menu triggers */}
          <div className="flex flex-wrap items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            {/* BACK TO LOGIN */}
            <button
              onClick={onLogout}
              className="px-3.5 py-1.5 text-xs font-sans font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 hover:scale-[1.02] text-white border border-slate-800 shadow-xs mr-3"
              title="Back to login selection"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-white shrink-0" />
              <span>Back</span>
            </button>
            


            {/* VIEW MENU */}
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === 'view' ? null : 'view')}
                onMouseEnter={() => openMenu && setOpenMenu('view')}
                className={`px-3 py-1 text-xs font-sans font-semibold text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded cursor-pointer transition-all ${openMenu === 'view' ? 'bg-slate-200 text-slate-900 shadow-sm' : ''}`}
              >
                View
              </button>
              {openMenu === 'view' && (
                <div className="absolute left-0 mt-1 w-72 bg-white border border-slate-300 rounded-lg shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                  <button
                    onClick={() => { setActiveModule('allocation'); setOpenMenu(null); }}
                    className={`w-full text-left px-3.5 py-1.5 text-xs flex items-center justify-between rounded ${activeModule === 'allocation' ? 'bg-indigo-50 text-indigo-950 font-bold' : 'text-slate-700 hover:bg-indigo-50'}`}
                  >
                    <span className="flex items-center gap-2">
                       <Layout className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                       Course to GA Allocation Matrix
                    </span>
                    {activeModule === 'allocation' && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                  </button>
                  <button
                    onClick={() => { setActiveModule('po_mapping'); setOpenMenu(null); }}
                    className={`w-full text-left px-3.5 py-1.5 text-xs flex items-center justify-between rounded ${activeModule === 'po_mapping' ? 'bg-indigo-50 text-indigo-950 font-bold' : 'text-slate-700 hover:bg-indigo-50'}`}
                  >
                    <span className="flex items-center gap-2">
                       <Activity className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                       PO to GA Mapping Matrix
                    </span>
                    {activeModule === 'po_mapping' && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                  </button>
                  <button
                    onClick={() => { setActiveModule('vision_mission'); setOpenMenu(null); }}
                    className={`w-full text-left px-3.5 py-1.5 text-xs flex items-center justify-between rounded ${activeModule === 'vision_mission' ? 'bg-indigo-50 text-indigo-950 font-bold' : 'text-slate-700 hover:bg-indigo-50'}`}
                  >
                    <span className="flex items-center gap-2">
                       <Compass className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                       Vision & Mission Master Drafts
                     </span>
                    {activeModule === 'vision_mission' && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                  </button>

                  <div className="border-t border-slate-100 my-1"></div>
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                     Isolate Highlight Filters
                  </div>
                  <button
                    onClick={() => { setSelectedCourseId('all'); setOpenMenu(null); }}
                    className={`w-full text-left px-3.5 py-1.5 text-xs flex items-center justify-between rounded ${selectedCourseId === 'all' ? 'bg-indigo-50 text-indigo-950 font-bold' : 'text-slate-700 hover:bg-indigo-50'}`}
                  >
                    <span>Show All Courses in Department</span>
                    {selectedCourseId === 'all' && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                  </button>
                </div>
              )}
            </div>

            {/* CONFIGURE MENU */}
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === 'configure' ? null : 'configure')}
                onMouseEnter={() => openMenu && setOpenMenu('configure')}
                className={`px-3 py-1 text-xs font-sans font-semibold text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded cursor-pointer transition-all ${openMenu === 'configure' ? 'bg-slate-200 text-slate-900 shadow-sm' : ''}`}
              >
                Configure
              </button>
              {openMenu === 'configure' && (
                <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                  <button
                    onClick={() => { setActiveModule('vision_mission'); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded focus:outline-none"
                  >
                    <Sliders className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Department Attributes Settings</span>
                  </button>
                  <button
                    onClick={() => { setActiveModule('po_configure'); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded focus:outline-none"
                  >
                    <Settings className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Program PO Objectives (PO1-PO4)</span>
                  </button>
                  
                  <div className="border-t border-slate-100 my-1"></div>
                  <div className="px-3.5 py-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider font-sans">
                    Program & Course Setup Welder
                  </div>
                  <button
                    onClick={() => { setActiveModal('add_program'); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-705 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded focus:outline-none font-medium"
                  >
                    <Award className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Add New Program (SE, AI, etc.)</span>
                  </button>
                  <button
                    onClick={() => { setActiveModal('edit_program_vm'); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-705 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded focus:outline-none font-medium"
                  >
                    <Compass className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Edit Program Vision & Mission</span>
                  </button>
                  <button
                    onClick={() => { setActiveModal('add_course'); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-705 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded focus:outline-none font-medium"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Add Program Course & Map GAs</span>
                  </button>
                </div>
              )}
            </div>

            {/* REPORTS MENU */}
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === 'reports' ? null : 'reports')}
                onMouseEnter={() => openMenu && setOpenMenu('reports')}
                className={`px-3 py-1 text-xs font-sans font-semibold text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded cursor-pointer transition-all ${openMenu === 'reports' ? 'bg-slate-200 text-slate-900 shadow-sm' : ''}`}
              >
                Reports
              </button>
              {openMenu === 'reports' && (
                <div className="absolute left-0 mt-1 w-72 bg-white border border-slate-300 rounded-lg shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                  <button
                    onClick={() => { handleExportCSV(); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded font-medium border-b border-slate-50 text-left"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Export Alignment Sheet (CSV)</span>
                  </button>
                  <button
                    onClick={() => { setActiveModal('clos'); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded text-left"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>CLO Courses Integration Summary</span>
                  </button>
                  <button
                    onClick={() => { setActiveModal('plos'); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded text-left"
                  >
                    <Award className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>PLO Program Educational Outcomes Sheet</span>
                  </button>
                  <button
                    onClick={() => { window.print(); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded text-left"
                  >
                    <Printer className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Print/Save Matrix Report...</span>
                  </button>
                  <div className="border-t border-slate-100 my-1"></div>
                  <div className="px-3.5 py-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans">
                    Statistical Diagrams
                  </div>
                  <button
                    onClick={() => { setActiveModal('statistics'); setOpenMenu(null); }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-950 flex items-center gap-2 rounded text-left"
                  >
                    <BarChart2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Distribution Histogram Diagram</span>
                  </button>
                </div>
              )}
            </div>

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
            
            {/* Quick Dept Selector */}
            <div className="flex items-center gap-2 bg-white px-2.5 py-1 border border-slate-300 rounded-lg shadow-xs animate-fade-in">
              <span className="text-[9px] text-indigo-950 font-bold tracking-wide uppercase">DEPARTMENT:</span>
              <select
                value={activeDeptId}
                onChange={(e) => {
                  const dept = e.target.value;
                  setActiveDeptId(dept);
                  const firstProg = data?.programs?.find(p => p.departmentId === dept)?.id || '';
                  setActiveProgramId(firstProg);
                  setSelectedCourseId('all');
                  setActiveModule('vision_mission');
                }}
                className="bg-transparent border-none text-slate-800 text-xs font-bold font-sans focus:outline-none cursor-pointer"
              >
                {data?.departments?.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Quick Program Selector */}
            <div className="flex items-center gap-2 bg-white px-2.5 py-1 border border-slate-300 rounded-lg shadow-xs">
              <span className="text-[9px] text-indigo-950 font-bold tracking-wide uppercase">PROGRAM:</span>
              <select
                value={activeProgramId}
                onChange={(e) => {
                  const val = e.target.value;
                  setActiveProgramId(val);
                  if (val) {
                    const matched = data?.programs.find(p => p.id === val);
                    if (matched) {
                      setActiveDeptId(matched.departmentId);
                    }
                  }
                  setSelectedCourseId('all');
                  setActiveModule('vision_mission');
                }}
                className="bg-transparent border-none text-slate-800 text-xs font-bold font-sans focus:outline-none cursor-pointer"
              >
                <option value="">-- Choose Program --</option>
                {data?.programs
                  .filter(p => !activeDeptId || p.departmentId === activeDeptId)
                  .map(p => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
              </select>
            </div>

            {/* Quick view switcher buttons */}
            {activeProgramId !== '' && (
              <div className="flex items-center gap-1 bg-slate-200/50 p-1 rounded-lg border border-slate-200">
                <button 
                  onClick={() => setActiveModule('vision_mission')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeModule === 'vision_mission' ? 'bg-white text-indigo-950 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Vision &amp; Mission
                </button>
                <button 
                  onClick={() => setActiveModule('allocation')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeModule === 'allocation' ? 'bg-white text-indigo-950 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Allocation Matrix
                </button>
                <button 
                  onClick={() => setActiveModule('po_mapping')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeModule === 'po_mapping' ? 'bg-white text-indigo-950 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  PO Mapping
                </button>
                <button 
                  onClick={() => setActiveModule('po_configure')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeModule === 'po_configure' ? 'bg-white text-indigo-950 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Configure PO's
                </button>
              </div>
            )}

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
                  {data?.courses.filter(c => c.departmentId === activeDeptId && (c.programId === activeProgramId || (!c.programId && activeProgramId === 'bscs'))).map(c => (
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
            
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors shadow-xs hover:border-slate-400 shrink-0"
            >
              <LogOut className="w-3 h-3 text-slate-500" />
              Logout
            </button>
          </div>

        </div>
      </header>

      {/* Main Sandbox Panel Area */}
      <main className="flex-1 overflow-auto p-4 md:p-6 pb-16">

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

            {activeProgramId === '' ? (
              <div className="max-w-4xl mx-auto space-y-8 py-4 animate-in fade-in duration-350">
                <div className="text-center space-y-2 select-none">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    University Institutional Frameworks
                  </div>
                  <h1 className="text-3xl font-serif font-bold text-slate-900 tracking-tight">
                    Departmental Vision &amp; Mission Charters
                  </h1>
                  <p className="text-xs text-slate-500 max-w-xl mx-auto font-sans leading-relaxed">
                    Verify, revise, and configure the core educational visions and missions driving the Outcome-Based Education (OBE) curriculum mappings.
                  </p>
                </div>

                {/* Professional Academic-style Text blocks */}
                <div className="space-y-6">
                  {data.departments.map((dept) => {
                    const isEditing = editingDeptId === dept.id;
                    return (
                      <div key={dept.id} className="bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-sm relative overflow-hidden transition-all duration-200 text-left">
                        {/* Minimal left side accent stripe */}
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-slate-800"></div>
                        
                        <div className="flex items-center justify-between border-b border-slate-200 pb-5 mb-6 pl-2">
                          <div>
                            <span className="text-xs font-sans font-extrabold tracking-wider text-indigo-650 uppercase">ACADEMIC DEPARTMENT SPECIFICATIONS</span>
                            <h3 className="text-2xl font-extrabold font-sans text-slate-950 tracking-tight mt-1">
                              {dept.name}
                            </h3>
                          </div>
                          
                          {!isEditing ? (
                            <button
                              onClick={() => {
                                setEditingDeptId(dept.id);
                                setTempVision(dept.vision);
                                setTempMission(dept.mission);
                              }}
                              className="px-4 py-2 text-xs font-extrabold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition cursor-pointer border border-slate-300"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              Edit Charter Draft
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={async () => {
                                  try {
                                    setSavingLoad(true);
                                    const updated = await apiService.updateDepartment(dept.id, {
                                      vision: tempVision,
                                      mission: tempMission
                                    });
                                    setData(prev => {
                                      if (!prev) return prev;
                                      return {
                                        ...prev,
                                        departments: prev.departments.map(d => d.id === dept.id ? updated : d)
                                      };
                                    });
                                    setEditingDeptId(null);
                                    alert("Departmental vision & mission draft saved successfully.");
                                  } catch (err) {
                                    alert("Error updating department.");
                                  } finally {
                                    setSavingLoad(false);
                                  }
                                }}
                                disabled={savingLoad}
                                className="px-4 py-2 text-xs font-extrabold text-white bg-indigo-650 hover:bg-indigo-700 disabled:opacity-50 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                              >
                                {savingLoad ? 'Saving...' : '✓ Save Changes'}
                              </button>
                              <button
                                onClick={() => setEditingDeptId(null)}
                                className="px-3.5 py-2 text-xs font-extrabold text-slate-750 hover:bg-slate-100 rounded-xl transition cursor-pointer border border-slate-300"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="space-y-6 pl-2 text-left">
                          {/* Vision section */}
                          <div className="space-y-2">
                            <h4 className="text-base font-sans font-extrabold tracking-wide text-slate-950 uppercase border-l-4 border-indigo-600 pl-2.5">DEPARTMENT VISION</h4>
                            {!isEditing ? (
                              <p className="text-slate-900 text-[16px] font-sans leading-relaxed italic pr-4 font-normal">
                                "{dept.vision}"
                              </p>
                            ) : (
                              <textarea
                                value={tempVision}
                                onChange={(e) => setTempVision(e.target.value)}
                                rows={2}
                                className="w-full text-base p-4 font-sans bg-slate-50 border border-slate-300 rounded-xl focus:border-indigo-500 outline-none text-slate-900 leading-relaxed font-normal"
                                placeholder="Enter department vision statement..."
                              />
                            )}
                          </div>

                          {/* Mission section */}
                          <div className="space-y-2">
                            <h4 className="text-base font-sans font-extrabold tracking-wide text-slate-950 uppercase border-l-4 border-indigo-600 pl-2.5">DEPARTMENT MISSION</h4>
                            {!isEditing ? (
                              <p className="text-slate-900 text-[16px] font-sans leading-relaxed pr-4 font-normal">
                                {dept.mission}
                              </p>
                            ) : (
                              <textarea
                                value={tempMission}
                                onChange={(e) => setTempMission(e.target.value)}
                                rows={4}
                                className="w-full text-base p-4 font-sans bg-slate-50 border border-slate-300 rounded-xl focus:border-indigo-500 outline-none text-slate-900 leading-relaxed font-normal"
                                placeholder="Enter department mission statement..."
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                                  {isConfiguring && (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingCourse(course);
                                          setEditCourseCode(course.code);
                                          setEditCourseTitle(course.title);
                                          setEditCourseType(course.type);
                                          setEditCourseDeptId(course.departmentId);
                                          setEditCourseProgramId(course.programId || 'bscs');
                                          setActiveModal('edit_course');
                                        }}
                                        className="p-1 text-indigo-600 hover:text-indigo-950 hover:bg-indigo-50 rounded transition-all cursor-pointer"
                                        title="Edit specifications"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (confirm(`Are you sure you want to delete the course "${course.code} - ${course.title}"?`)) {
                                            try {
                                              setSavingLoad(true);
                                              const updatedCourses = data.courses.filter(c => c.id !== course.id);
                                              setData({ ...data, courses: updatedCourses });
                                              
                                              const localData = { ...data, courses: updatedCourses };
                                              localStorage.setItem('IQRA_OBE_FALLBACK_DB', JSON.stringify(localData));
                                              alert("Course deletion committed successfully.");
                                            } catch (evt) {
                                              alert("Error deleting course.");
                                            } finally {
                                              setSavingLoad(false);
                                            }
                                          }
                                        }}
                                        className="p-1 text-rose-500 hover:text-rose-800 hover:bg-rose-50 rounded transition-all cursor-pointer"
                                        title="Delete Course row"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
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
                                  } ${doesMap ? 'bg-emerald-500/10' : ''}`}
                                >
                                  {doesMap ? (
                                    <div className="flex items-center justify-center">
                                      <span className="w-5 h-5 rounded-md bg-emerald-600 flex items-center justify-center text-white font-black text-[10px] shadow-sm">
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
            {activeModule === 'vision_mission' && activeDepartment && activeProgram && (
              <div className="max-w-4xl mx-auto space-y-6 animate-in duration-200 fade-in-25">
                
                {/* Program Specific Brand Identity Sheets */}
                <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
                  
                  <div className="bg-indigo-950/90 text-white p-6 select-none flex items-center justify-between border-b border-indigo-900">
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-300 font-bold">PROGRAM SPECIFIC CHARTER</span>
                      <h3 className="font-serif font-bold text-lg">{activeProgram.name} ({activeProgram.code}) Vision &amp; Mission</h3>
                    </div>
                    <Compass className="w-8 h-8 opacity-40 text-white" />
                  </div>

                  <div className="p-6 md:p-8 space-y-8">
                    
                    {/* Program Vision Block */}
                    <div className="space-y-4 bg-slate-50 border border-slate-200 p-8 rounded-3xl shadow-xs text-left relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-600"></div>
                      <div className="flex items-center gap-2 pl-2">
                        <Award className="w-5 h-5 text-indigo-650 shrink-0" />
                        <h4 className="font-sans font-extrabold text-slate-950 text-base tracking-wide uppercase">PROGRAM VISION STATEMENT</h4>
                      </div>
                      
                      {isConfiguring ? (
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
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-600"></div>
                      <div className="flex items-center gap-2 pl-2">
                        <Compass className="w-5 h-5 text-indigo-650 shrink-0" />
                        <h4 className="font-sans font-extrabold text-slate-950 text-base tracking-wide uppercase">PROGRAM MISSION STATEMENT</h4>
                      </div>

                      {isConfiguring ? (
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
                    {isConfiguring && (
                       <div className="flex justify-end border-t border-indigo-100 pt-5">
                        <button
                          onClick={handleSaveProgramVisionMission}
                          disabled={savingLoad}
                          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 duration-100"
                        >
                          {savingLoad ? <Loader2 className="w-4 h-4 animate-spin" /> : '💾 SAVE PROGRAM CHARTER CHANGES'}
                        </button>
                      </div>
                    )}

                  </div>

                </div>

              </div>
            )}

            {/* ----------------- MODULE VIEW 4: CONFIGURE PROGRAM OBJECTIVES ----------------- */}
            {activeModule === 'po_configure' && activeProgram && (
              <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden max-w-4xl mx-auto">
                
                {/* Section Header */}
                <div className="bg-slate-50 border-b border-slate-200 p-5 px-6">
                  <h3 className="font-serif font-bold text-lg text-indigo-950">
                    Configure Program Objectives (PO-1 to PO-4 Definitions)
                  </h3>
                  <p className="text-xs text-slate-700 font-sans mt-0.5">
                    Modifies the primary program educational outcomes (PEO/POs) text. You must toggle "ACTIVATE CORE CONFIGURATION" at the top to unlock inputs.
                  </p>
                </div>

                <div className="p-6 space-y-6">
                  {editPOs.map((po, idx) => (
                    <div key={po.id} className="p-5 border border-slate-200 rounded-2xl bg-slate-50 flex flex-col md:flex-row gap-4 items-start shadow-xs">
                      
                      {/* PO label */}
                      <div className="flex items-center gap-2 shrink-0 md:w-[130px]">
                        <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 font-serif shadow-sm">
                          {idx + 1}
                        </span>
                        <div>
                          <strong className="text-indigo-950 font-serif block text-xs">OBJECTIVE {idx + 1}</strong>
                          <span className="text-[9px] text-indigo-900/60 font-mono tracking-wider font-extrabold uppercase">{po.id}</span>
                        </div>
                      </div>

                      {/* PO Editor */}
                      <div className="flex-1 w-full">
                        {isConfiguring ? (
                          <textarea
                            value={po.text}
                            onChange={(e) => handlePOTextChange(idx, e.target.value)}
                            rows={2}
                            placeholder={`Define program objective PO${idx + 1}...`}
                            className="w-full text-xs p-3 font-medium bg-white border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                          />
                        ) : (
                          <div className="p-3.5 bg-white/55 border border-[#e2e8f0]/40 rounded-xl font-medium text-xs leading-relaxed text-slate-800 italic select-all shadow-xs border border-indigo-100/20">
                            "{po.text || 'Objective statement is not configured yet. Unlock Configuration to define.'}"
                          </div>
                        )}
                        
                        {/* Dynamic list of GAs associated with this PO */}
                        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9.5px] font-mono text-indigo-950/60 font-bold uppercase tracking-wider">Associated Attributes:</span>
                          {po.mappedGAs.map(gid => (
                            <span key={gid} className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200/50 font-mono font-bold text-[9px] text-indigo-950">
                              {gid}
                            </span>
                          ))}
                          {po.mappedGAs.length === 0 && (
                            <span className="text-[10px] text-indigo-400 italic">No associated GAs mapped. Go to PO to GA Mapping sheet.</span>
                          )}
                        </div>
                      </div>

                    </div>
                  ))}

                  {/* Program Configuration Action Button */}
                  {isConfiguring && (
                    <div className="flex justify-end border-t border-indigo-100 pt-5">
                      <button
                        onClick={handleSavePOTexts}
                        disabled={savingLoad}
                        className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 duration-100"
                      >
                        {savingLoad ? <Loader2 className="w-4 h-4 animate-spin" /> : '💾 REGISTER OBJECTIVES IN UNIVERSITY DB'}
                      </button>
                    </div>
                  )}

                </div>

              </div>
            )}

              </>
            )}
          </div>
        )}

      </main>

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
                          <td className="border border-slate-200 px-3 py-1.5 text-emerald-700 font-bold">OBE Curricular Database Synced</td>
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
                                      className={`h-full rounded-full ${mappedCount === 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}
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
                              className="w-full bg-indigo-600 rounded-t-sm hover:bg-emerald-500 cursor-pointer transition-all duration-300"
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
                      <Check className="w-8 h-8 text-emerald-600 font-black shrink-0" />
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
                        <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 border border-emerald-200 rounded">
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
                        <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 border border-emerald-200 rounded">
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
    </div>
  );
}
