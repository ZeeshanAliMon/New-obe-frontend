export type UserType = 'student' | 'instructor' | 'QA' | 'admin' | 'qa' | 'admission' | 'dept_admin';

export interface Student {
  regNo: string;
  name: string;
  departmentId: string;
  programId: string;
  batch: string;
  semester?: string;
  email?: string;
}

export interface GA {
  id: string;
  name: string;
  description: string;
  departmentId?: string; // Optional department association so each department has different GAs
  programId?: string; // Optional program association so each program has separate GAs
}

export interface ProgramObjective {
  id: string;
  text: string;
  mappedGAs: string[]; // array of GA ids
}

export interface Program {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  pos: ProgramObjective[]; // exactly 4 POs
  vision?: string;
  mission?: string;
}

export interface Department {
  id: string;
  name: string;
  vision: string;
  mission: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  type: 'core' | 'elective';
  mappedGAs: string[]; // array of GA ids
  departmentId: string;
  programId?: string; // separate courses for each program
  creditHours?: number;
  courseType?: 'Theory' | 'Lab';
}

export interface OBEData {
  departments: Department[];
  programs: Program[];
  gas: GA[];
  courses: Course[];
}

export interface MarksCategory {
  name: string;
  percentage: number;
  units: number;
}

export interface UnitQuestion {
  id: string;
  name: string;
  maxMarks: number;
  mappedCLOs: string[];
}

export interface UnitItem {
  unitNo: number;
  passing: number;
  totalMarks: number;
  weightage: number;
  mappedCLOs?: string[];
  questions?: UnitQuestion[];
}

export interface CourseStudent {
  regNo: string;
  name: string;
  marks?: Record<string, number>;
  student_marks?: Record<string, number>;
}

export interface OBEQuestion {
  id: string;
  categoryName: string;
  unitNo: number;
  questionName: string;
  maxMarks: number;
  mappedCLOs: string[]; // e.g. ["CLO-1", "CLO-2", "CLO-3", "CLO-4"]
}

export interface InstructorCourse {
  id: string;
  code: string;
  title: string;
  courseType?: 'Theory' | 'Lab';
  departmentId: string;
  departmentName: string;
  programId?: string;
  programName?: string;
  creditHours: number;
  categories: MarksCategory[];
  unitsData: Record<string, UnitItem[]>;
  students: CourseStudent[];
  obeQuestions?: OBEQuestion[];
  obeMarks?: Record<string, Record<string, number>>; // studentRegNo -> { questionId: marks }
  obe_marks?: Record<string, Record<string, number>>;
  studentMarks?: Record<string, number>;
  student_marks?: Record<string, number>;
  cloCount?: number;
  selectedGradingSystem?: string;
  customGradingSystem?: { grade: string; percentage: string; points: string }[];
  academicYear?: string;
  status?: 'active' | 'closed';
}
