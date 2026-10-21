import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter, 
  LogOut, 
  GraduationCap, 
  Building, 
  BookOpen, 
  Check, 
  X, 
  UserPlus, 
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Calendar,
  Upload,
  FileSpreadsheet
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { Student, Department, Program } from '../types';
import { DEFAULT_TEMP_PASSWORD } from '../utils/config';
import * as XLSX from 'xlsx';
import StudentDirectory from './admission/StudentDirectory';
import StudentDelete from './admission/StudentDelete';

export const getRegNoPreview = (regNo: string) => {
  const match = regNo.trim().match(/(FA|SP|SU|SM|WI)(\d{2,4})/i);
  if (!match) {
    return null;
  }
  const prefix = match[1].toUpperCase();
  let yearDigits = parseInt(match[2], 10);
  if (yearDigits >= 1000) {
    yearDigits = yearDigits % 100;
  }
  const startYear = 2000 + yearDigits;
  const startSemesterName: 'Spring' | 'Summer' | 'Fall' =
    prefix === 'SP' ? 'Spring' : (prefix === 'SU' || prefix === 'SM') ? 'Summer' : 'Fall';
  const batchCode = `${prefix}${yearDigits.toString().padStart(2, '0')}`;

  // Calculate Semester
  // Spring starts in February (Month 1), Fall starts in September (Month 8)
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0 = January, 1 = February, ..., 11 = December
  
  let currentSemesterTerm: 'Spring' | 'Fall' = 'Spring';
  let adjustedCurrentYear = currentYear;

  if (currentMonth >= 1 && currentMonth <= 7) {
    // Feb to Aug is Spring semester of currentYear
    currentSemesterTerm = 'Spring';
    adjustedCurrentYear = currentYear;
  } else {
    // Sep to Dec or Jan is Fall semester
    currentSemesterTerm = 'Fall';
    if (currentMonth === 0) {
      // January belongs to the Fall semester of the previous calendar year
      adjustedCurrentYear = currentYear - 1;
    } else {
      adjustedCurrentYear = currentYear;
    }
  }

  const startIndex = startSemesterName === 'Spring' ? (2 * startYear) : (2 * startYear + 1);
  const currentIndex = currentSemesterTerm === 'Spring' ? (2 * adjustedCurrentYear) : (2 * adjustedCurrentYear + 1);

  const diff = currentIndex - startIndex + 1;
  const semesterNum = diff > 0 ? diff : 1;

  const getOrdinalSuffix = (num: number): string => {
    if (num <= 0) return '1st';
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) {
      return num + "st";
    }
    if (j === 2 && k !== 12) {
      return num + "nd";
    }
    if (j === 3 && k !== 13) {
      return num + "rd";
    }
    return num + "th";
  };

  return {
    batchCode,
    startSemesterName,
    startYear,
    currentSemesterVal: getOrdinalSuffix(semesterNum)
  };
};

interface AdmissionDashboardProps {
  onLogout: () => void;
  admissionName?: string;
}

export default function AdmissionDashboard({ onLogout, admissionName = "Admission Advisor" }: AdmissionDashboardProps) {
  // Global Data States
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Input States
  const [isEditing, setIsEditing] = useState(false);
  const [editRegNo, setEditRegNo] = useState<string | null>(null);
  
  const [regNo, setRegNo] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedProgId, setSelectedProgId] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string>('Fall');
  const [selectedSemester, setSelectedSemester] = useState<string>('1st');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Directory Filter States
  const [filterDeptId, setFilterDeptId] = useState<string>('all');
  const [filterProgId, setFilterProgId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Tab State
  const [activeTab, setActiveTab] = useState<'directory' | 'add' | 'edit' | 'delete' | 'import'>('directory');

  // Edit Tab Search States
  const [editSearchQuery, setEditSearchQuery] = useState('');
  const [editSearchError, setEditSearchError] = useState<string | null>(null);

  // Delete Tab Search States
  const [deleteSearchQuery, setDeleteSearchQuery] = useState('');
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Excel/CSV Import States
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importStatus, setImportStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
  const [importProgress, setImportProgress] = useState<{ current: number, total: number } | null>(null);
  const [skippedRows, setSkippedRows] = useState<Array<{ rowNum: number, regNo: string, name: string, reason: string }>>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Filter and Search Logic for Delete Tab Directory
  const deleteFilteredStudents = useMemo(() => {
    return students.filter(student => {
      const q = deleteSearchQuery.toLowerCase().trim();
      return q === '' || 
        student.name.toLowerCase().includes(q) || 
        student.regNo.toLowerCase().includes(q);
    });
  }, [students, deleteSearchQuery]);

  // Fetch data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch departments & programs strictly from backend
      const [fetchedDepts, fetchedPrograms] = await Promise.all([
        apiService.getDepartments(),
        apiService.getPrograms()
      ]);
      setDepartments(fetchedDepts || []);
      setPrograms(fetchedPrograms || []);
      
      // Fetch students strictly from backend
      const studentList = await apiService.getStudents();
      setStudents(studentList || []);
    } catch (err: any) {
      console.error("Error loading admission dashboard data", err);
      setError(err?.message || "Failed to load data from backend server. Please verify backend connection.");
      setDepartments([]);
      setPrograms([]);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  // Dynamically filter programs based on department choice in Form
  const formPrograms = useMemo(() => {
    if (!selectedDeptId) return [];
    return programs.filter(p => p.departmentId === selectedDeptId);
  }, [selectedDeptId, programs]);

  // Dynamically filter programs based on department choice in Filter Panel
  const filterPrograms = useMemo(() => {
    if (filterDeptId === 'all') return programs;
    return programs.filter(p => p.departmentId === filterDeptId);
  }, [filterDeptId, programs]);

  // Reset selected program in Form if department changes
  useEffect(() => {
    if (selectedDeptId && !isEditing) {
      const available = programs.filter(p => p.departmentId === selectedDeptId);
      if (available.length > 0) {
        setSelectedProgId(available[0].id);
      } else {
        setSelectedProgId('');
      }
    }
  }, [selectedDeptId, programs, isEditing]);

  // Reset selected program in Filters if department filter changes
  useEffect(() => {
    setFilterProgId('all');
  }, [filterDeptId]);

  // Filter and Search Logic for Directory
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // Filter by Department
      const matchDept = filterDeptId === 'all' || student.departmentId === filterDeptId;
      // Filter by Program
      const matchProg = filterProgId === 'all' || student.programId === filterProgId;
      // Filter by Search Query (Name or RegNo)
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = q === '' || 
        student.name.toLowerCase().includes(q) || 
        student.regNo.toLowerCase().includes(q);
      
      return matchDept && matchProg && matchSearch;
    });
  }, [students, filterDeptId, filterProgId, searchQuery]);

  // Statistics Computations
  const stats = useMemo(() => {
    const total = students.length;
    const spring = students.filter(s => s.batch === 'Spring').length;
    const summer = students.filter(s => s.batch === 'Summer').length;
    const fall = students.filter(s => s.batch === 'Fall').length;
    return { total, spring, summer, fall };
  }, [students]);

  // Form Reset
  const resetForm = () => {
    setRegNo('');
    setName('');
    setEmail('');
    setSelectedDeptId(departments[0]?.id || '');
    setSelectedProgId('');
    setSelectedBatch('Fall');
    setSelectedSemester('1st');
    setFormError(null);
    setIsEditing(false);
    setEditRegNo(null);
    setEditSearchQuery('');
    setEditSearchError(null);
  };

  // Add / Edit Student Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);

    // Validate inputs
    const cleanRegNo = regNo.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanRegNo) {
      setFormError("Registration number is required");
      return;
    }
    if (!cleanName) {
      setFormError("Student name is required");
      return;
    }
    if (!cleanEmail) {
      setFormError("Student email is required so they can log in");
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(cleanEmail)) {
      setFormError("Invalid email format (e.g. student@example.com)");
      return;
    }
    if (!selectedDeptId) {
      setFormError("Please select a department");
      return;
    }
    if (!selectedProgId) {
      setFormError("Please select a program");
      return;
    }

    // Check pattern for registration number (flexible: allows any campus/dept prefix, any semester/year, and any number of roll digits e.g. 052-SP23-1 or 052-FA24-22055)
    const regPattern = /^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)+$/i;
    if (!regPattern.test(cleanRegNo)) {
      setFormError("Invalid registration number format.");
      return;
    }

    const preview = getRegNoPreview(cleanRegNo);
    const derivedBatch = preview ? (preview.startSemesterName as 'Spring' | 'Summer' | 'Fall') : 'Fall';
    const derivedSemester = preview ? preview.currentSemesterVal : '1st';

    const newStudent: Student = {
      regNo: cleanRegNo,
      name: cleanName,
      email: cleanEmail,
      departmentId: selectedDeptId,
      programId: selectedProgId,
      batch: derivedBatch,
      semester: derivedSemester
    };

    try {
      if (isEditing && editRegNo) {
        // Edit student
        const updated = await apiService.updateStudent(editRegNo, newStudent);
        setStudents(prev => prev.map(s => s.regNo === editRegNo ? { ...s, ...updated } : s));
        setSuccessMsg(`Student record for "${cleanName}" has been updated successfully!`);
        resetForm();
      } else {
        // Add student - Check if registration number already exists
        const exists = students.some(s => s.regNo.toUpperCase() === cleanRegNo);
        if (exists) {
          setFormError(`Registration Number "${cleanRegNo}" is already registered in the system.`);
          return;
        }

        const created = await apiService.createStudent(newStudent);
        setStudents(prev => [...prev, created]);
        setSuccessMsg(`Student "${cleanName}" has been successfully registered. Default password is ${DEFAULT_TEMP_PASSWORD}.`);
        resetForm();
      }

      // Clear success message after 4 seconds
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err.message || "An error occurred while saving the student record.");
    }
  };

  // Populate form with student data for Editing
  const handleEditClick = (student: Student) => {
    setIsEditing(true);
    setEditRegNo(student.regNo);
    setRegNo(student.regNo);
    setName(student.name);
    setEmail(student.email || '');
    setSelectedDeptId(student.departmentId);
    setSelectedProgId(student.programId);
    setSelectedBatch(student.batch);
    setSelectedSemester(student.semester || '1st');
    setFormError(null);
    setSuccessMsg(null);
    setActiveTab('edit'); // Switch to Edit Tab in the Navbar
  };

  // Look up student by registration number directly inside Edit tab
  const handleEditSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setEditSearchError(null);
    const cleanQuery = editSearchQuery.trim().toUpperCase();
    if (!cleanQuery) {
      setEditSearchError("Please enter a registration number");
      return;
    }
    const matches = students.filter(s => 
      s.regNo.toUpperCase().includes(cleanQuery) || 
      s.name.toUpperCase().includes(cleanQuery)
    );
    if (matches.length === 1) {
      handleEditClick(matches[0]);
    } else if (matches.length > 1) {
      // Multiple matches exist, let user choose from the live list
      setEditSearchError(null);
    } else {
      setEditSearchError(`No student found matching "${cleanQuery}"`);
    }
  };

  // Delete student record
  const handleDeleteClick = (student: Student) => {
    setStudentToDelete(student);
  };

  const confirmDeleteStudent = async () => {
    if (!studentToDelete) return;

    try {
      setLoading(true);
      await apiService.deleteStudent(studentToDelete.regNo);
      setStudents(prev => prev.filter(s => s.regNo !== studentToDelete.regNo));
      setSuccessMsg(`Student record for "${studentToDelete.name}" deleted successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      
      // If we are currently editing the deleted student, reset the form
      if (editRegNo === studentToDelete.regNo) {
        resetForm();
      }
    } catch (err: any) {
      setFormError("Error deleting student record. Please try again.");
    } finally {
      setLoading(false);
      setStudentToDelete(null);
    }
  };

  // Excel/CSV Importer handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportStatus({ type: 'idle', message: '' });
    setImportProgress(null);
    setSkippedRows([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bstr = event.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const parsedStudents = data.map((row: any, index) => {
          const getVal = (keys: string[]) => {
            for (const k of keys) {
              const matchedKey = Object.keys(row).find(rk => rk.toLowerCase().trim().replace(/[\s_-]+/g, '') === k.toLowerCase());
              if (matchedKey) return String(row[matchedKey]).trim();
            }
            return '';
          };

          const regNoVal = getVal(['regno', 'registrationnumber', 'rollno', 'registrationid', 'id']);
          const nameVal = getVal(['name', 'studentname', 'fullname']);
          const emailVal = getVal(['email', 'studentemail', 'emailaddress', 'emailid', 'mail']);
          const deptVal = getVal(['departmentid', 'deptid', 'department', 'dept']);
          const progVal = getVal(['programid', 'progid', 'program', 'progcode', 'code']);
          const batchVal = getVal(['batch', 'admissionbatch']);
          const semesterVal = getVal(['semester', 'currentsemester', 'sem']);

          let finalEmail = emailVal.trim().toLowerCase();
          if (!finalEmail && regNoVal) {
            finalEmail = `${regNoVal.toLowerCase().trim()}@iqra.edu.pk`;
          }

          let cleanedBatch: 'Spring' | 'Summer' | 'Fall' = 'Fall';
          let cleanedSemester = '1st';

          const preview = regNoVal ? getRegNoPreview(regNoVal) : null;
          if (preview) {
            cleanedBatch = preview.startSemesterName as 'Spring' | 'Summer' | 'Fall';
            cleanedSemester = preview.currentSemesterVal;
          } else {
            const bLower = batchVal.toLowerCase();
            if (bLower.includes('spring')) cleanedBatch = 'Spring';
            else if (bLower.includes('summer')) cleanedBatch = 'Summer';

            cleanedSemester = semesterVal || '1st';
            if (/^\d+$/.test(cleanedSemester)) {
              const num = parseInt(cleanedSemester);
              const suffixes = ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th", "th"];
              cleanedSemester = num + (suffixes[num] || "th");
            }
          }

          const errors: string[] = [];
          if (!regNoVal) {
            errors.push("Missing Registration No.");
          } else if (!/^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)+$/i.test(regNoVal)) {
            errors.push("Invalid registration format.");
          }
          if (!nameVal) errors.push("Missing Student Name.");
          if (!deptVal) errors.push("Missing Department ID.");
          if (!progVal) errors.push("Missing Program ID.");

          const validDept = departments.some(d => d.id.toLowerCase() === deptVal.toLowerCase());
          const matchedDeptId = departments.find(d => d.id.toLowerCase() === deptVal.toLowerCase())?.id || deptVal;
          if (!validDept && deptVal) {
            errors.push(`Invalid Dept ID "${deptVal}". Expected one of: ${departments.map(d => d.id).join(', ')}`);
          }

          const validProg = programs.some(p => p.id.toLowerCase() === progVal.toLowerCase());
          const matchedProgId = programs.find(p => p.id.toLowerCase() === progVal.toLowerCase())?.id || progVal;
          if (!validProg && progVal) {
            errors.push(`Invalid Program ID "${progVal}". Expected one of: ${programs.map(p => p.id).join(', ')}`);
          }

          const isDupInSystem = students.some(s => s.regNo.toUpperCase() === regNoVal.toUpperCase());
          if (isDupInSystem) {
            errors.push(`Reg No. "${regNoVal}" already exists in system.`);
          }

          return {
            rowNum: index + 2,
            regNo: regNoVal.toUpperCase(),
            name: nameVal,
            email: finalEmail,
            departmentId: matchedDeptId,
            programId: matchedProgId,
            batch: cleanedBatch,
            semester: cleanedSemester,
            errors,
            isValid: errors.length === 0
          };
        });

        setPreviewData(parsedStudents);
      } catch (err: any) {
        console.error(err);
        setImportStatus({ type: 'error', message: 'Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls sheet.' });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadTemplate = () => {
    const sampleDept = departments[0]?.id || "DEPT_ID";
    const sampleProg = programs[0]?.id || "PROG_ID";
    const headers = [
      ["Registration Number", "Student Name", "Email Address", "Department ID", "Program ID"],
      ["045-fa22-22045", "Wajahat Bine Saif", "045-fa22-22045@iqra.edu.pk", sampleDept, sampleProg]
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "StudentsTemplate");
    XLSX.writeFile(wb, "Student_Registration_Template.xlsx");
  };

  const handleImportSubmit = async () => {
    if (previewData.length === 0) {
      setImportStatus({ type: 'error', message: 'No records found to import.' });
      return;
    }

    try {
      setIsImporting(true);
      setImportProgress({ current: 0, total: previewData.length });
      setSkippedRows([]);
      setImportStatus({ type: 'idle', message: '' });

      const results: Student[] = [];
      const skipped: Array<{ rowNum: number; regNo: string; name: string; reason: string }> = [];

      for (let i = 0; i < previewData.length; i++) {
        const ps = previewData[i];
        
        // Update progress counter dynamically (e.g. 1/100, 2/100, etc.)
        setImportProgress({ current: i + 1, total: previewData.length });

        if (!ps.isValid) {
          skipped.push({
            rowNum: ps.rowNum,
            regNo: ps.regNo || '—',
            name: ps.name || '—',
            reason: ps.errors.join(', ') || 'Validation failed'
          });
          continue;
        }

        try {
          const payload: Student = {
            regNo: ps.regNo,
            name: ps.name,
            email: ps.email,
            departmentId: ps.departmentId,
            programId: ps.programId,
            batch: ps.batch,
            semester: ps.semester
          };
          const created = await apiService.createStudent(payload);
          results.push(created);
        } catch (err: any) {
          skipped.push({
            rowNum: ps.rowNum,
            regNo: ps.regNo || '—',
            name: ps.name || '—',
            reason: err.message || 'Database registration failed'
          });
        }
      }

      setStudents(prev => {
        const filterRegs = results.map(r => r.regNo);
        return [...prev.filter(s => !filterRegs.includes(s.regNo)), ...results];
      });

      setSkippedRows(skipped);

      if (results.length > 0) {
        setImportStatus({
          type: 'success',
          message: `Successfully registered ${results.length} new student(s) with default password '${DEFAULT_TEMP_PASSWORD}'! ${skipped.length} record(s) were skipped or failed.`
        });
        setPreviewData([]);
        setImportFile(null);
      } else {
        setImportStatus({
          type: 'error',
          message: `Failed to import student profiles. All ${skipped.length} record(s) were skipped or failed. See details below.`
        });
      }
    } catch (err: any) {
      setImportStatus({ type: 'error', message: err.message || 'An error occurred while importing records.' });
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  // Helper to get Department name from ID
  const getDeptName = (deptId: string) => {
    const dept = departments.find(d => d.id === deptId);
    return dept ? dept.name : deptId;
  };

  // Helper to get Program code/name from ID
  const getProgCode = (progId: string) => {
    const prog = programs.find(p => p.id === progId);
    return prog ? prog.code : progId;
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 text-slate-800 font-sans">
      {/* Premium Corporate Top Header */}
      <header id="admission-header" className="bg-[#1e1b4b] text-white border-b border-indigo-950 px-6 py-2.5 shrink-0 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold font-display tracking-tight flex items-center gap-2">
            <span>Iqra University OBE</span>
            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-indigo-500/30">
              ADMISSION CONTROL
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-logout"
            onClick={onLogout}
            className="px-3.5 py-1.5 bg-transparent hover:bg-white/10 text-white hover:text-white rounded-lg transition-all border border-white/20 hover:border-white/40 flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
            title="Sign out of Admission Module"
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
            id="tab-directory"
            onClick={() => {
              setActiveTab('directory');
              setFormError(null);
              setSuccessMsg(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Student Directory</span>
          </button>

          <button
            id="tab-add"
            onClick={() => {
              setIsEditing(false);
              setEditRegNo(null);
              resetForm();
              setActiveTab('add');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'add'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Student</span>
          </button>

          <button
            id="tab-edit"
            onClick={() => {
              setActiveTab('edit');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'edit'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Edit className="w-4 h-4" />
            <span>Edit Student {editRegNo ? `(${editRegNo})` : ''}</span>
          </button>

          <button
            id="tab-delete"
            onClick={() => {
              setActiveTab('delete');
              setDeleteSearchQuery('');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'delete'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Student</span>
          </button>

          <button
            id="tab-import"
            onClick={() => {
              setActiveTab('import');
              setFormError(null);
              setSuccessMsg(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'import'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Import Excel/CSV</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden p-6 max-w-[1700px] mx-auto w-full flex flex-col gap-6">

        {/* Loading and Error Overlays */}
        {loading ? (
          <div className="flex-1 bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-100 border-t-indigo-600 mb-4"></div>
            <p className="text-slate-500 font-sans text-sm font-medium">Synchronizing databases, loading academic directory...</p>
          </div>
        ) : error ? (
          <div className="flex-1 bg-red-50 text-red-800 border border-red-200 rounded-[24px] p-8 flex flex-col items-center justify-center max-w-xl mx-auto my-12 shadow-sm text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4 animate-bounce" />
            <h2 className="text-lg font-bold mb-2">Registry Load Alert</h2>
            <p className="text-sm mb-6 text-red-700">{error}</p>
            <button
              onClick={loadAllData}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-sans text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Registry Load</span>
            </button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <AnimatePresence mode="wait">
              {activeTab === 'directory' && (
                <motion.div
                  key="directory-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.15 }}
                  className="flex-1 flex flex-col min-h-0"
                >
                  <StudentDirectory
                    students={students}
                    departments={departments}
                    programs={programs}
                    filterDeptId={filterDeptId}
                    setFilterDeptId={setFilterDeptId}
                    filterProgId={filterProgId}
                    setFilterProgId={setFilterProgId}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    onEditClick={handleEditClick}
                    onDeleteClick={handleDeleteClick}
                    getDeptName={getDeptName}
                    getProgCode={getProgCode}
                  />
                </motion.div>
              )}

              {activeTab === 'add' && (
                <motion.div
                  key="add-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.15 }}
                  className="flex-1 overflow-y-auto"
                >
                  <div className="max-w-2xl mx-auto w-full bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden mb-6">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/70">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                          <UserPlus className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="font-display font-bold text-slate-800 text-lg">Enroll New Student</h2>
                          <p className="text-xs text-slate-500">Create a new academic identity and assign initial departmental parameters.</p>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                      {formError && (
                        <div className="bg-red-50 text-red-700 text-sm p-4 rounded-xl border border-red-100 flex items-start gap-2.5 font-medium">
                          <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                          <span>{formError}</span>
                        </div>
                      )}

                      {successMsg && (
                        <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-xl border border-blue-100 flex flex-col gap-2 font-medium">
                          <div className="flex items-start gap-2.5">
                            <Check className="w-5 h-5 shrink-0 text-blue-600 mt-0.5" />
                            <span>{successMsg}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSuccessMsg(null);
                              setActiveTab('directory');
                            }}
                            className="mt-2 self-start text-xs font-bold text-blue-700 hover:text-blue-950 underline transition-colors cursor-pointer"
                          >
                            &rarr; Go to Directory to view student
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Reg Number */}
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 ml-0.5">
                            Registration Number <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="input-regno"
                            type="text"
                            value={regNo}
                            onChange={(e) => setRegNo(e.target.value)}
                            placeholder="e.g. 052-sp23-22055"
                            className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl font-sans text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all font-medium uppercase"
                            required
                          />
                        </div>

                         {/* Student Name */}
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 ml-0.5">
                            Student Full Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="input-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Wajahat Bine Saif"
                            className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl font-sans text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all font-medium"
                            required
                          />
                        </div>

                        {/* Student Email */}
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 ml-0.5">
                            Student Email Address <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="input-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="e.g. student@iqra.edu.pk"
                            className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl font-sans text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all font-medium"
                            required
                          />
                        </div>

                        {/* Department */}
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 ml-0.5">
                            Academic Department <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <select
                              id="select-dept"
                              value={selectedDeptId}
                              onChange={(e) => {
                                setSelectedDeptId(e.target.value);
                              }}
                              className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl font-sans text-sm text-slate-800 outline-none cursor-pointer transition-all appearance-none font-medium pr-10"
                              required
                            >
                              <option value="" disabled>Choose Department...</option>
                              {departments.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                              <Building className="w-4 h-4" />
                            </div>
                          </div>
                        </div>

                        {/* Program */}
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 ml-0.5">
                            Degree Program <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <select
                              id="select-program"
                              value={selectedProgId}
                              onChange={(e) => setSelectedProgId(e.target.value)}
                              disabled={!selectedDeptId}
                              className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl font-sans text-sm text-slate-800 outline-none cursor-pointer transition-all appearance-none font-medium pr-10 disabled:opacity-50 disabled:cursor-not-allowed"
                              required
                            >
                              <option value="" disabled>Choose Degree Program...</option>
                              {formPrograms.map(p => (
                                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                              <BookOpen className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      </div>



                      {/* Form Actions */}
                      <div className="pt-4 border-t border-slate-100 flex gap-4">
                        <button
                          type="button"
                          onClick={resetForm}
                          className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
                        >
                          Reset Form
                        </button>
                        <button
                          id="btn-submit"
                          type="submit"
                          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer text-center"
                        >
                          Enroll Student Profile
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}

              {activeTab === 'edit' && (
                <motion.div
                  key="edit-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.15 }}
                  className="flex-1 overflow-y-auto"
                >
                  <div className="max-w-2xl mx-auto w-full bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden mb-6">
                    {isEditing && editRegNo ? (
                      <>
                        <div className="p-6 border-b border-slate-100 bg-amber-50/30">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                              <Edit className="w-5 h-5" />
                            </div>
                            <div>
                              <h2 className="font-display font-bold text-slate-800 text-lg flex items-center gap-2">
                                <span>Edit Student Profile</span>
                                <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                                  {editRegNo}
                                </span>
                              </h2>
                              <p className="text-xs text-slate-500">Modify information for registered student {name}.</p>
                            </div>
                          </div>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                          <div className="bg-amber-50 text-amber-800 text-xs p-3.5 rounded-xl border border-amber-100 font-medium">
                            You are editing the profile of <span className="font-bold">{name}</span>. The registration number cannot be changed to prevent academic transcript linking conflicts.
                          </div>

                          {formError && (
                            <div className="bg-red-50 text-red-700 text-sm p-4 rounded-xl border border-red-100 flex items-start gap-2.5 font-medium">
                              <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                              <span>{formError}</span>
                            </div>
                          )}

                          {successMsg && (
                            <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-xl border border-blue-100 flex flex-col gap-2 font-medium">
                              <div className="flex items-start gap-2.5">
                                <Check className="w-5 h-5 shrink-0 text-blue-600 mt-0.5" />
                                <span>{successMsg}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSuccessMsg(null);
                                  setActiveTab('directory');
                                }}
                                className="mt-2 self-start text-xs font-bold text-blue-700 hover:text-blue-950 underline transition-colors cursor-pointer"
                              >
                                &rarr; Back to Student Directory
                              </button>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Reg Number (Disabled) */}
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 ml-0.5">
                                Registration Number
                              </label>
                              <input
                                type="text"
                                value={regNo}
                                disabled
                                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl font-mono text-sm text-slate-500 outline-none cursor-not-allowed font-bold"
                              />
                            </div>

                            {/* Student Name */}
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 ml-0.5">
                                Student Full Name <span className="text-red-500">*</span>
                              </label>
                              <input
                                id="input-name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Wajahat Bine Saif"
                                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl font-sans text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all font-medium"
                                required
                              />
                            </div>

                            {/* Student Email */}
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 ml-0.5">
                                Student Email Address <span className="text-red-500">*</span>
                              </label>
                              <input
                                id="input-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="e.g. student@iqra.edu.pk"
                                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl font-sans text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all font-medium"
                                required
                              />
                            </div>

                            {/* Department */}
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 ml-0.5">
                                Academic Department <span className="text-red-500">*</span>
                              </label>
                              <div className="relative">
                                <select
                                  id="select-dept"
                                  value={selectedDeptId}
                                  onChange={(e) => setSelectedDeptId(e.target.value)}
                                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl font-sans text-sm text-slate-800 outline-none cursor-pointer transition-all appearance-none font-medium pr-10"
                                  required
                                >
                                  <option value="" disabled>Choose Department...</option>
                                  {departments.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                  ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                                  <Building className="w-4 h-4" />
                                </div>
                              </div>
                            </div>

                            {/* Program */}
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 ml-0.5">
                                Degree Program <span className="text-red-500">*</span>
                              </label>
                              <div className="relative">
                                <select
                                  id="select-program"
                                  value={selectedProgId}
                                  onChange={(e) => setSelectedProgId(e.target.value)}
                                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl font-sans text-sm text-slate-800 outline-none cursor-pointer transition-all appearance-none font-medium pr-10"
                                  required
                                >
                                  <option value="" disabled>Choose Degree Program...</option>
                                  {formPrograms.map(p => (
                                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                                  ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                                  <BookOpen className="w-4 h-4" />
                                </div>
                              </div>
                            </div>
                          </div>



                          {/* Form Actions */}
                          <div className="pt-4 border-t border-slate-100 flex gap-4">
                            <button
                              type="button"
                              onClick={resetForm}
                              className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
                            >
                              Cancel Edit
                            </button>
                            <button
                              id="btn-submit"
                              type="submit"
                              className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-600/10 cursor-pointer text-center"
                            >
                              Save Profile Changes
                            </button>
                          </div>
                        </form>
                      </>
                    ) : (
                      <div className="p-8 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4 border border-slate-200/50">
                          <Edit className="w-6 h-6 text-indigo-600" />
                        </div>
                        <h3 className="font-display font-bold text-slate-800 text-lg mb-2">No Student Selected for Editing</h3>
                        <p className="text-slate-500 text-sm max-w-md mb-8">
                          To edit a student's profile, select "Edit" in the Student Directory tab, or look them up directly below using their unique Registration Number.
                        </p>

                        {/* Lookup form */}
                        <form onSubmit={handleEditSearch} className="w-full max-w-md bg-slate-50 p-6 rounded-2xl border border-slate-200/70 space-y-4 mb-4">
                          <div className="text-left">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-0.5">
                              Search Registration Number / Name
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="e.g. 22 or student name"
                                value={editSearchQuery}
                                onChange={(e) => setEditSearchQuery(e.target.value)}
                                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl font-mono text-xs text-slate-800 outline-none transition-all uppercase font-semibold"
                              />
                              <button
                                type="submit"
                                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                              >
                                Search
                              </button>
                            </div>
                            {editSearchError && (
                              <p className="text-red-600 text-xs font-semibold mt-1.5 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{editSearchError}</span>
                              </p>
                            )}
                          </div>
                        </form>

                        {/* Live Matching Students List */}
                        {(() => {
                          const query = editSearchQuery.trim().toUpperCase();
                          if (!query) return null;
                          const matches = students.filter(s => 
                            s.regNo.toUpperCase().includes(query) || 
                            s.name.toUpperCase().includes(query)
                          );
                          return (
                            <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 mb-4 text-left">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                  Matching Students ({matches.length})
                                </span>
                                {matches.length > 0 && (
                                  <span className="text-[10px] text-indigo-600 font-semibold">
                                    Click on any student to edit
                                  </span>
                                )}
                              </div>
                              
                              {matches.length === 0 ? (
                                <div className="py-4 text-center text-slate-400 text-xs italic">
                                  No students match "{editSearchQuery}"
                                </div>
                              ) : (
                                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                  {matches.map((student) => {
                                    const deptName = getDeptName(student.departmentId);
                                    const progCode = getProgCode(student.programId);
                                    return (
                                      <button
                                        key={student.regNo}
                                        type="button"
                                        onClick={() => handleEditClick(student)}
                                        className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 text-left transition-all group cursor-pointer"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2 mb-0.5">
                                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-mono text-[10px] font-bold rounded group-hover:bg-indigo-100 transition-colors">
                                              {student.regNo}
                                            </span>
                                            <span className="text-xs font-bold text-slate-700 truncate">
                                              {student.name}
                                            </span>
                                          </div>
                                          <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
                                            <span className="truncate">{deptName}</span>
                                            <span className="text-slate-300">•</span>
                                            <span className="font-mono text-indigo-600/80 uppercase">{progCode}</span>
                                          </div>
                                        </div>
                                        <div className="ml-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <span className="text-[10px] font-bold text-indigo-600 flex items-center gap-0.5">
                                            Edit
                                          </span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Select dropdown */}
                        <div className="w-full max-w-md text-left">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-0.5">
                            Or Select from Enrolled Directory
                          </label>
                          <select
                            onChange={(e) => {
                              const matched = students.find(s => s.regNo === e.target.value);
                              if (matched) handleEditClick(matched);
                            }}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-sans text-xs text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600"
                          >
                            <option value="">-- Select student from list --</option>
                            {students.map(s => (
                              <option key={s.regNo} value={s.regNo}>{s.regNo} — {s.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'delete' && (
                <motion.div
                  key="delete-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.15 }}
                  className="flex-1 flex flex-col min-h-0"
                >
                  <StudentDelete
                    students={students}
                    deleteSearchQuery={deleteSearchQuery}
                    setDeleteSearchQuery={setDeleteSearchQuery}
                    onDeleteClick={handleDeleteClick}
                    getDeptName={getDeptName}
                    getProgCode={getProgCode}
                  />
                </motion.div>
              )}

              {activeTab === 'import' && (
                <motion.div
                  key="import-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.15 }}
                  className="flex-1 overflow-y-auto"
                >
                  <div className="max-w-4xl mx-auto w-full space-y-6 mb-6">
                    {/* Importer Section */}
                    <div className="bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                            <Upload className="w-5 h-5" />
                          </div>
                          <div>
                            <h2 className="font-display font-bold text-slate-800 text-lg">Excel / CSV Batch Registration</h2>
                            <p className="text-xs text-slate-500">Register bulk student profiles instantly via Excel spreadsheet uploads.</p>
                          </div>
                        </div>

                        <button
                          onClick={handleDownloadTemplate}
                          className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                        >
                          <FileSpreadsheet className="w-4.5 h-4.5 text-indigo-600" />
                          <span>Get Excel Template</span>
                        </button>
                      </div>

                      <div className="p-8 space-y-8">
                        {isImporting && importProgress ? (
                          <div className="p-12 flex flex-col items-center justify-center text-center space-y-6 bg-slate-50 border border-slate-200 rounded-[20px] animate-in fade-in duration-200">
                            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-650 shadow-inner">
                              <RefreshCw className="w-8 h-8 animate-spin" />
                            </div>
                            <div className="space-y-1">
                              <h3 className="font-display font-bold text-slate-800 text-base">Bulk Registration in Progress</h3>
                              <p className="text-xs text-slate-500 font-semibold max-w-sm">
                                Please keep this page open. Registering, formatting, and synchronizing directory records with the academic registry...
                              </p>
                            </div>
                            
                            {/* Progress bar */}
                            <div className="w-full max-w-md space-y-2">
                              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden border border-slate-300 shadow-inner">
                                <div 
                                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                                />
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">
                                <span>Processing...</span>
                                <span className="font-mono">{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
                              </div>
                            </div>
                            
                            <span className="text-xs font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-4 py-1.5 rounded-full shadow-2xs">
                              {importProgress.current} / {importProgress.total} Records Processed
                            </span>
                          </div>
                        ) : (
                          <>
                            {/* Status Message */}
                            {importStatus.type !== 'idle' && (
                              <div className={`p-4 rounded-xl border flex items-start gap-2.5 font-semibold text-sm ${
                                importStatus.type === 'success' 
                                  ? 'bg-blue-50 text-blue-800 border-blue-100' 
                                  : 'bg-red-50 text-red-700 border-red-100'
                              }`}>
                                {importStatus.type === 'success' ? (
                                  <Check className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                ) : (
                                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                )}
                                <div className="space-y-1">
                                  <span>{importStatus.message}</span>
                                  {importStatus.type === 'success' && (
                                    <button
                                      onClick={() => setActiveTab('directory')}
                                      className="block text-xs text-blue-700 hover:text-blue-950 underline transition-colors cursor-pointer mt-1"
                                    >
                                      Go to Student Directory &rarr;
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Detailed Skipped / Failed Rows Report */}
                            {skippedRows.length > 0 && (
                              <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl space-y-3.5 shadow-3xs animate-in slide-in-from-top-4 duration-200">
                                <div className="flex items-center gap-2.5 text-amber-800 font-bold text-xs uppercase tracking-wider">
                                  <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                                  <span>Import Skipped / Failed Record Report ({skippedRows.length})</span>
                                </div>
                                <p className="text-xs text-slate-500 font-semibold leading-normal">
                                  The following rows were not imported due to syntax errors, invalid program/department references, or pre-existing duplicate registration numbers:
                                </p>
                                <div className="max-h-[220px] overflow-y-auto border border-amber-100 rounded-xl bg-white shadow-2xs overflow-hidden">
                                  <table className="min-w-full divide-y divide-slate-150 text-[11px] text-slate-700 font-medium">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[9px] tracking-wider sticky top-0 border-b border-slate-200">
                                      <tr>
                                        <th className="px-4 py-2.5 text-left w-16">Row #</th>
                                        <th className="px-4 py-2.5 text-left w-36">Reg No</th>
                                        <th className="px-4 py-2.5 text-left w-48">Student Name</th>
                                        <th className="px-4 py-2.5 text-left">Failure Reason</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {skippedRows.map((r, i) => (
                                        <tr key={i} className="hover:bg-amber-50/10 font-semibold">
                                          <td className="px-4 py-2.5 font-mono text-slate-400 text-center">{r.rowNum}</td>
                                          <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{r.regNo}</td>
                                          <td className="px-4 py-2.5 text-slate-800">{r.name}</td>
                                          <td className="px-4 py-2.5">
                                            <span className="text-rose-600 font-bold bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md text-[10px]">
                                              {r.reason}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Dropzone Area */}
                            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-[20px] bg-slate-50/50 hover:bg-indigo-50/10 p-8 transition-all relative group flex flex-col items-center justify-center text-center">
                              <input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              />
                              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-200">
                                <Upload className="w-6 h-6" />
                              </div>
                              <p className="text-sm font-bold text-slate-700 mb-1">
                                {importFile ? importFile.name : 'Drag and drop your spreadsheet here'}
                              </p>
                              <p className="text-xs text-slate-400 font-medium">
                                {importFile ? `${(importFile.size / 1024).toFixed(1)} KB` : 'Supports Microsoft Excel (.xlsx, .xls) or comma-separated CSV'}
                              </p>
                            </div>



                        {/* Import Preview Area */}
                        {previewData.length > 0 && (
                          <div className="space-y-4 pt-4 border-t border-slate-100">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-display font-bold text-slate-800 text-sm">Spreadsheet Records Preview</h3>
                                <p className="text-xs text-slate-500">Review data compatibility before importing to the database.</p>
                              </div>
                              <div className="text-right text-xs font-semibold flex items-center gap-2">
                                <span className="text-blue-600">{previewData.filter(r => r.isValid).length} Valid Records</span>
                                <span className="text-slate-300">|</span>
                                <span className="text-red-500">{previewData.filter(r => !r.isValid).length} Warnings</span>
                              </div>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                              <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                                  <tr>
                                    <th className="px-4 py-2.5 text-left">Row</th>
                                    <th className="px-4 py-2.5 text-left">Reg Number</th>
                                    <th className="px-4 py-2.5 text-left">Student Name</th>
                                    <th className="px-4 py-2.5 text-left">Dept ID</th>
                                    <th className="px-4 py-2.5 text-left">Program ID</th>
                                    <th className="px-4 py-2.5 text-left">Batch (Auto)</th>
                                    <th className="px-4 py-2.5 text-left">Semester (Auto)</th>
                                    <th className="px-4 py-2.5 text-left">Status / Errors</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs font-semibold bg-white text-slate-700">
                                  {previewData.map((row, idx) => (
                                    <tr key={idx} className={row.isValid ? 'hover:bg-slate-50' : 'bg-red-50/20'}>
                                      <td className="px-4 py-3 font-mono text-slate-400">{row.rowNum}</td>
                                      <td className="px-4 py-3 font-bold font-mono text-indigo-600">{row.regNo || '—'}</td>
                                      <td className="px-4 py-3 text-slate-900">{row.name || '—'}</td>
                                      <td className="px-4 py-3 font-mono text-[10px] uppercase">{row.departmentId || '—'}</td>
                                      <td className="px-4 py-3 font-mono text-[10px] uppercase">{row.programId || '—'}</td>
                                      <td className="px-4 py-3">{row.batch}</td>
                                      <td className="px-4 py-3 text-slate-500">{row.semester}</td>
                                      <td className="px-4 py-3">
                                        {row.isValid ? (
                                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md border border-blue-100 flex items-center gap-1 w-max">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                            <span>Ready</span>
                                          </span>
                                        ) : (
                                          <div className="flex flex-col gap-0.5 max-w-xs">
                                            {row.errors.map((e: string, i: number) => (
                                              <span key={i} className="text-[10px] font-bold text-red-600 flex items-center gap-1">
                                                <span className="w-1 h-1 rounded-full bg-red-500 shrink-0"></span>
                                                <span>{e}</span>
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3">
                              <button
                                onClick={() => {
                                  setPreviewData([]);
                                  setImportFile(null);
                                }}
                                className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                              >
                                Clear uploaded file
                              </button>
                              <button
                                onClick={handleImportSubmit}
                                className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                                disabled={previewData.length === 0}
                              >
                                <Check className="w-4 h-4" />
                                <span>Register All {previewData.length} Students</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <AnimatePresence>
          {studentToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setStudentToDelete(null)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
              />
              
              {/* Modal Dialog Content */}
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                transition={{ type: "spring", duration: 0.3 }}
                className="relative w-full max-w-md bg-white border border-slate-200 rounded-[28px] shadow-2xl p-6 overflow-hidden z-10"
              >
                <div className="flex flex-col items-center text-center">
                  {/* Warning Icon Container */}
                  <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center border border-red-100 mb-4 animate-pulse">
                    <Trash2 className="w-7 h-7" />
                  </div>

                  <h3 className="font-display font-bold text-slate-800 text-lg mb-2">
                    Confirm Student Deletion
                  </h3>

                  <p className="text-xs text-slate-500 mb-6 leading-relaxed max-w-xs font-semibold">
                    Are you sure you want to permanently delete <span className="text-slate-800 font-bold">"{studentToDelete.name}"</span> with registration ID <span className="text-indigo-600 font-bold font-mono text-[11px] bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">{studentToDelete.regNo}</span>?
                    <br /><br />
                    <span className="text-red-600 font-bold flex items-center gap-1 justify-center bg-red-50/50 p-2.5 rounded-xl border border-red-100">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      This operation is irreversible!
                    </span>
                  </p>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-3 w-full">
                    <button
                      id="btn-cancel-delete"
                      type="button"
                      onClick={() => setStudentToDelete(null)}
                      className="py-3 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs font-sans"
                    >
                      No, Cancel
                    </button>
                    <button
                      id="btn-confirm-delete"
                      type="button"
                      onClick={confirmDeleteStudent}
                      className="py-3 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 hover:shadow-red-200 font-sans"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Yes, Delete</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
