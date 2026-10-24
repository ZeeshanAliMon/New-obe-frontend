import { OBEData, Department, Program, GA, Course, ProgramObjective, InstructorCourse, Student } from '../types';
import { DEFAULT_TEMP_PASSWORD } from '../utils/config';

export const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'https://zeeshanbalti.pythonanywhere.com/api';

const EMPTY_OBE_DATA: OBEData = {
  departments: [],
  programs: [],
  gas: [],
  courses: []
};

// Client-side cached data accessor. Strictly NEVER injects hardcoded/mock entities.
const getLocalStorageData = (): OBEData => {
  const dataStr = localStorage.getItem('IQRA_OBE_FALLBACK_DB');
  if (dataStr) {
    try {
      const parsed = JSON.parse(dataStr);
      // Clean legacy mock dataset if previously cached in browser
      if (Array.isArray(parsed.departments) && parsed.departments.some((d: any) => d.id === 'computing' && d.name?.includes('Department of Computing and Technology'))) {
        localStorage.removeItem('IQRA_OBE_FALLBACK_DB');
        return { ...EMPTY_OBE_DATA };
      }
      return {
        departments: Array.isArray(parsed.departments) ? parsed.departments : [],
        programs: Array.isArray(parsed.programs) ? parsed.programs : [],
        gas: Array.isArray(parsed.gas) ? parsed.gas : [],
        courses: Array.isArray(parsed.courses) ? parsed.courses : []
      };
    } catch (e) {
      console.error('Failed to parse cached local data', e);
    }
  }
  return { ...EMPTY_OBE_DATA };
};

const saveLocalStorageData = (data: OBEData) => {
  localStorage.setItem('IQRA_OBE_FALLBACK_DB', JSON.stringify(data));
};

const getHeaders = () => {
  const token = localStorage.getItem('access');
  const hasValidToken = token && token !== 'undefined' && token !== 'null' && token.trim() !== '';
  return {
    'Content-Type': 'application/json',
    ...(hasValidToken ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
};

const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = localStorage.getItem('refresh');
  const hasValidRefresh = refreshToken && refreshToken !== 'undefined' && refreshToken !== 'null' && refreshToken.trim() !== '';
  if (!hasValidRefresh) return null;

  const url = `${BASE_URL}/auth/token/refresh/`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.access) {
        // SECURITY NOTE: Storing JWT tokens in localStorage is susceptible to XSS.
        // For production hardening, transition to using secure, httpOnly cookies set by the backend.
        localStorage.setItem('access', data.access);
        if (data.refresh) {
          localStorage.setItem('refresh', data.refresh);
        }
        return data.access;
      }
    }
  } catch (e) {
    console.warn(`Token refresh failed on endpoint ${url}:`, e);
  }
  return null;
};

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 90000): Promise<Response> => {
  // Ensure we don't abort prematurely due to cold starts or slow DB response in container/preview environment
  const finalTimeoutMs = Math.max(timeoutMs, 90000);

  // Security Interceptor: Block authenticated requests if the user must change their default password
  const savedUserStr = localStorage.getItem('IQRA_OBE_LOGGED_IN_USER');
  if (savedUserStr) {
    try {
      const user = JSON.parse(savedUserStr);
      if (user && user.mustChangePassword && !url.includes('/auth/change-password') && !url.includes('/auth/login') && !url.includes('/auth/token/refresh')) {
        window.dispatchEvent(new CustomEvent('session-expired'));
        throw new Error('You must change your default password before accessing any application features.');
      }
    } catch (e) {}
  }

  const makeRequest = async (tokenOverride?: string) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), finalTimeoutMs);
    try {
      let reqOptions = { ...options };
      if (tokenOverride) {
        reqOptions.headers = {
          ...reqOptions.headers,
          'Authorization': `Bearer ${tokenOverride}`
        };
      } else {
        // Always make sure headers are fresh when retrying or starting
        reqOptions.headers = {
          ...getHeaders(),
          ...options.headers
        };
      }
      const response = await fetch(url, {
        ...reqOptions,
        signal: controller.signal,
      });
      clearTimeout(id);

      return response;
    } catch (error: any) {
      clearTimeout(id);
      if (error && (error.name === 'AbortError' || error.message?.toLowerCase().includes('aborted') || error.message?.toLowerCase().includes('abort'))) {
        throw new Error(`Request timed out after ${finalTimeoutMs / 1000} seconds. The server might be waking up or experiencing high traffic. Please try again in a moment.`);
      }
      throw error;
    }
  };

  let response = await makeRequest();

  // If unauthorized (401), try token refresh once
  if (response.status === 401 && !url.includes('/auth/login') && !url.includes('/refresh')) {
    const refreshToken = localStorage.getItem('refresh');
    if (refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true;
        const newAccessToken = await refreshAccessToken();
        isRefreshing = false;
        onRefreshed(newAccessToken || '');
      }

      if (isRefreshing) {
        // Wait for refresh to complete
        const refreshedToken = await new Promise<string>((resolve) => {
          subscribeTokenRefresh((token) => resolve(token));
        });
        if (refreshedToken) {
          response = await makeRequest(refreshedToken);
        }
      } else {
        const storedToken = localStorage.getItem('access');
        if (storedToken) {
          response = await makeRequest(storedToken);
        }
      }
    }
  }

  // If Forbidden (403), check if it's due to required password change
  if (response.status === 403 && !url.includes('/auth/login')) {
    try {
      const clonedRes = response.clone();
      const body = await clonedRes.json();
      if (body && (body.detail?.toLowerCase().includes('password change') || body.detail?.toLowerCase().includes('must_change_password') || body.detail?.toLowerCase().includes('password_change'))) {
        const savedUserStr = localStorage.getItem('IQRA_OBE_LOGGED_IN_USER');
        if (savedUserStr) {
          try {
            const user = JSON.parse(savedUserStr);
            user.mustChangePassword = true;
            localStorage.setItem('IQRA_OBE_LOGGED_IN_USER', JSON.stringify(user));
          } catch (e) {}
        }
        window.dispatchEvent(new CustomEvent('session-expired', { detail: { isPasswordReset: true } }));
      }
    } catch (e) {}
  }

  // If STILL unauthorized (401), trigger session expiration to alert user and logout gracefully
  if (response.status === 401 && !url.includes('/auth/login') && !url.includes('/refresh')) {
    window.dispatchEvent(new CustomEvent('session-expired'));
  }

  return response;
};

const isBackendUser = (): boolean => {
  return !!localStorage.getItem('access');
};

const extractList = (data: any, key?: string): any[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') {
    if (key && Array.isArray(data[key])) return data[key];
    if (Array.isArray(data.departments)) return data.departments;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.programs)) return data.programs;
    if (Array.isArray(data.courses)) return data.courses;
    if (Array.isArray(data.gas)) return data.gas;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.items)) return data.items;
  }
  return [];
};

const extractId = (val: any): string => {
  if (val === undefined || val === null) return '';
  if (typeof val === 'object') {
    return String(val.id ?? val.pk ?? val.code ?? val.dept_id ?? val.dept_code ?? val.slug ?? '').trim();
  }
  return String(val).trim();
};

const normalizeDepartment = (d: any): Department => {
  if (!d) return {} as Department;
  if (typeof d === 'string') {
    return {
      id: d,
      name: d,
      vision: '',
      mission: ''
    };
  }
  const id = extractId(d.id ?? d.pk ?? d.code ?? d.dept_id ?? d.dept_code ?? d.department_id ?? d.slug);
  const name = String(d.name || d.department_name || d.dept_name || d.title || id).trim();
  return {
    id: id || name || `dept-${Date.now()}`,
    name: name,
    vision: d.vision || '',
    mission: d.mission || ''
  };
};

const normalizeProgram = (p: any): Program => {
  if (!p) return {} as Program;
  if (typeof p === 'string') {
    return {
      id: p,
      name: p,
      code: p.toUpperCase(),
      departmentId: '',
      pos: [],
      vision: '',
      mission: ''
    };
  }
  const id = extractId(p.id ?? p.pk ?? p.code ?? p.program_id ?? p.prog_id);
  const deptId = extractId(p.departmentId ?? p.department_id ?? p.department ?? p.dept_id ?? p.dept);
  return {
    id: id || `prog-${Date.now()}`,
    name: String(p.name || p.title || p.program_name || p.prog_name || id).trim(),
    code: String(p.code || p.program_code || p.prog_code || id).trim().toUpperCase(),
    departmentId: deptId,
    pos: Array.isArray(p.pos) ? p.pos : (Array.isArray(p.program_objectives) ? p.program_objectives : []),
    vision: p.vision || '',
    mission: p.mission || ''
  };
};

const normalizeGA = (g: any): GA => {
  if (!g) return {} as GA;
  return {
    id: extractId(g.id ?? g.pk ?? g.code),
    name: String(g.name || g.title || '').trim(),
    description: String(g.description || '').trim(),
    departmentId: extractId(g.departmentId ?? g.department_id ?? g.department),
    programId: extractId(g.programId ?? g.program_id ?? g.program)
  };
};

const normalizeCourse = (c: any): Course => {
  if (!c) return {} as any;
  const code = c.code ? String(c.code).toUpperCase().trim() : '';
  const programId = extractId(c.programId ?? c.program_id ?? c.program);
  const departmentId = extractId(c.departmentId ?? c.department_id ?? c.department);

  // The backend uses course_type or courseType to hold 'core' or 'elective'
  let frontendType: 'core' | 'elective' = 'core';
  if (c.type === 'elective' || c.course_type === 'elective' || c.courseType === 'elective') {
    frontendType = 'elective';
  }

  // The backend does not have a separate theory/lab subtype, or uses subtype/course_subtype
  let frontendSubtype: 'Theory' | 'Lab' = 'Theory';
  const titleLower = String(c.title || '').trim().toLowerCase();

  if (code.endsWith('L') || titleLower.includes('lab')) {
    frontendSubtype = 'Lab';
  } else {
    const rawSubtype = c.subtype || c.course_subtype || c.courseSubtype;
    if (rawSubtype) {
      frontendSubtype = String(rawSubtype).toLowerCase().includes('lab') ? 'Lab' : 'Theory';
    } else if (c.course_type && (String(c.course_type).toLowerCase() === 'theory' || String(c.course_type).toLowerCase() === 'lab')) {
      frontendSubtype = String(c.course_type).toLowerCase() === 'lab' ? 'Lab' : 'Theory';
    } else if (c.courseType && (String(c.courseType).toLowerCase() === 'theory' || String(c.courseType).toLowerCase() === 'lab')) {
      frontendSubtype = String(c.courseType).toLowerCase() === 'lab' ? 'Lab' : 'Theory';
    }
  }

  return {
    id: c.id ? String(c.id) : (c.pk ? String(c.pk) : `course-${code}-${programId || 'common'}`),
    code,
    title: c.title ? String(c.title).trim() : '',
    type: frontendType,
    mappedGAs: Array.isArray(c.mappedGAs) ? c.mappedGAs : (Array.isArray(c.mapped_gas) ? c.mapped_gas : []),
    departmentId,
    programId,
    creditHours: c.creditHours !== undefined ? Number(c.creditHours) : (c.credit_hours !== undefined ? Number(c.credit_hours) : (c.credits !== undefined ? Number(c.credits) : 3)),
    courseType: frontendSubtype
  };
};

const mapInstructorCourseToBackend = (c: InstructorCourse): any => {
  // Map obeQuestions to both camelCase and snake_case
  const mappedObeQuestions = (c.obeQuestions || []).map((q: any) => ({
    id: q.id,
    categoryName: q.categoryName,
    category_name: q.categoryName,
    unitNo: q.unitNo,
    unit_no: q.unitNo,
    questionName: q.questionName,
    question_name: q.questionName,
    name: q.questionName,
    maxMarks: q.maxMarks,
    max_marks: q.maxMarks,
    mappedCLOs: q.mappedCLOs || [],
    mapped_clos: q.mappedCLOs || []
  }));

  // Map unitsData to both camelCase and snake_case
  const mappedUnitsData: Record<string, any[]> = {};
  if (c.unitsData) {
    Object.keys(c.unitsData).forEach(key => {
      const unitsList = c.unitsData[key];
      if (Array.isArray(unitsList)) {
        mappedUnitsData[key] = unitsList.map((u: any) => {
          const mappedQuestions = (u.questions || []).map((q: any) => ({
            id: q.id,
            name: q.name,
            questionName: q.name,
            question_name: q.name,
            maxMarks: q.maxMarks,
            max_marks: q.maxMarks,
            mappedCLOs: q.mappedCLOs || [],
            mapped_clos: q.mappedCLOs || []
          }));

          return {
            unitNo: u.unitNo,
            unit_no: u.unitNo,
            passing: u.passing,
            passing_marks: u.passing,
            totalMarks: u.totalMarks,
            total_marks: u.totalMarks,
            weightage: u.weightage,
            mappedCLOs: u.mappedCLOs || [],
            mapped_clos: u.mappedCLOs || [],
            questions: mappedQuestions,
            unit_questions: mappedQuestions
          };
        });
      }
    });
  }

  // Map students to both camelCase and snake_case
  const mappedStudents = (c.students || []).map((s: any) => {
    const studentMarks = s.student_marks || s.marks || s.obtained_marks || s.studentMarks || {};
    return {
      regNo: s.regNo || s.reg_no,
      reg_no: s.regNo || s.reg_no,
      name: s.name,
      student_marks: studentMarks,
      studentMarks: studentMarks,
      marks: studentMarks,
      obtained_marks: studentMarks
    };
  });

  const obeMarks = c.obe_marks || c.obeMarks || {};

  return {
    ...c,
    academic_year: c.academicYear,
    academicYear: c.academicYear,
    department_id: c.departmentId,
    departmentId: c.departmentId,
    program_id: c.programId,
    programId: c.programId,
    clo_count: c.cloCount,
    cloCount: c.cloCount,
    selected_grading_system: c.selectedGradingSystem,
    selectedGradingSystem: c.selectedGradingSystem,
    custom_grading_system: c.customGradingSystem || [],
    customGradingSystem: c.customGradingSystem || [],
    obe_questions: mappedObeQuestions,
    obeQuestions: mappedObeQuestions,
    units_data: mappedUnitsData,
    unitsData: mappedUnitsData,
    obe_marks: obeMarks,
    obeMarks: obeMarks,
    students: mappedStudents
  };
};

const mapCourseToBackend = (c: Course): any => {
  let finalTitle = c.title ? String(c.title).trim() : '';
  let finalCode = c.code ? String(c.code).toUpperCase().trim() : '';

  if (c.courseType === 'Lab') {
    // Ensure the title contains "Lab" (case-insensitive) or code ends with "L"
    if (!finalTitle.toLowerCase().includes('lab') && !finalCode.endsWith('L')) {
      finalTitle = `${finalTitle} Lab`;
    }
  } else if (c.courseType === 'Theory') {
    // Strip " Lab" / " (Lab)" / "(Lab)" / " lab" from title if present, and "L" from code
    if (finalTitle.toLowerCase().endsWith(' lab')) {
      finalTitle = finalTitle.substring(0, finalTitle.length - 4).trim();
    } else if (finalTitle.toLowerCase().endsWith(' (lab)')) {
      finalTitle = finalTitle.substring(0, finalTitle.length - 6).trim();
    } else if (finalTitle.toLowerCase().endsWith('(lab)')) {
      finalTitle = finalTitle.substring(0, finalTitle.length - 5).trim();
    } else if (finalTitle.toLowerCase().endsWith('lab')) {
      finalTitle = finalTitle.substring(0, finalTitle.length - 3).trim();
    }
    
    if (finalCode.endsWith('L') && finalCode.length > 3) {
      finalCode = finalCode.substring(0, finalCode.length - 1);
    }
  }

  return {
    id: c.id,
    code: finalCode,
    title: finalTitle,
    type: c.type === 'elective' ? 'elective' : 'core',
    mapped_gas: c.mappedGAs || [],
    mappedGAs: c.mappedGAs || [],
    mappedGAs_write: c.mappedGAs || [],
    department_id: c.departmentId,
    departmentId: c.departmentId,
    department: c.departmentId,
    program_id: c.programId || null,
    programId: c.programId || null,
    program: c.programId || null,
    credit_hours: c.creditHours !== undefined ? Number(c.creditHours) : 3,
    creditHours: c.creditHours !== undefined ? Number(c.creditHours) : 3,
    // Align with backend schema where course_type column represents core vs elective
    course_type: c.type === 'elective' ? 'elective' : 'core',
    courseType: c.type === 'elective' ? 'elective' : 'core',
    // Fallback/forward-compatibility in case backend supports subtype
    course_subtype: c.courseType || 'Theory',
    courseSubtype: c.courseType || 'Theory',
    subtype: c.courseType || 'Theory'
  };
};

export const apiService = {
  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`${BASE_URL}/health/`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(id);
      return response.ok;
    } catch (e) {
      return false;
    }
  },

  isBackendUser(): boolean {
    return isBackendUser();
  },

  async getDepartments(): Promise<Department[]> {
    const res = await fetchWithTimeout(`${BASE_URL}/departments/`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch departments: Status ${res.status}`);
    const data = await res.json();
    const list = extractList(data, 'departments');
    return list.map(normalizeDepartment);
  },

  async getPrograms(departmentId?: string): Promise<Program[]> {
    const url = departmentId
      ? `${BASE_URL}/programs/?department=${encodeURIComponent(departmentId)}`
      : `${BASE_URL}/programs/`;
    const res = await fetchWithTimeout(url, { headers: getHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch programs: Status ${res.status}`);
    const data = await res.json();
    const list = extractList(data, 'programs');
    return list.map(normalizeProgram);
  },

  async getGAs(departmentId?: string, programId?: string): Promise<GA[]> {
    let url = `${BASE_URL}/gas/`;
    const params = new URLSearchParams();
    if (departmentId) params.append('department', departmentId);
    if (programId) params.append('program', programId);
    if (params.toString()) url += `?${params.toString()}`;
    const res = await fetchWithTimeout(url, { headers: getHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch Graduate Attributes (GAs): Status ${res.status}`);
    const data = await res.json();
    const list = extractList(data, 'gas');
    return list.map(normalizeGA);
  },

  async getCourses(programId?: string, departmentId?: string): Promise<Course[]> {
    let url = `${BASE_URL}/courses/`;
    const params = new URLSearchParams();
    if (programId) params.append('program', programId);
    if (departmentId) params.append('department', departmentId);
    if (params.toString()) url += `?${params.toString()}`;
    const res = await fetchWithTimeout(url, { headers: getHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch courses: Status ${res.status}`);
    const data = await res.json();
    const list = extractList(data, 'courses');
    return list.map(normalizeCourse);
  },

  async getAllData(): Promise<OBEData> {
    const [deptsResult, progsResult, gasResult, coursesResult] = await Promise.allSettled([
      this.getDepartments(),
      this.getPrograms(),
      this.getGAs(),
      this.getCourses()
    ]);

    const departments = deptsResult.status === 'fulfilled' ? deptsResult.value : [];
    const programs = progsResult.status === 'fulfilled' ? progsResult.value : [];
    const gas = gasResult.status === 'fulfilled' ? gasResult.value : [];
    const courses = coursesResult.status === 'fulfilled' ? coursesResult.value : [];

    if (coursesResult.status === 'rejected') {
      console.warn("Could not fetch courses in getAllData:", coursesResult.reason);
    }
    if (deptsResult.status === 'rejected') {
      console.warn("Could not fetch departments in getAllData:", deptsResult.reason);
    }
    if (progsResult.status === 'rejected') {
      console.warn("Could not fetch programs in getAllData:", progsResult.reason);
    }
    if (gasResult.status === 'rejected') {
      console.warn("Could not fetch GAs in getAllData:", gasResult.reason);
    }

    const resultData: OBEData = {
      departments,
      programs,
      gas,
      courses
    };

    try {
      localStorage.setItem('IQRA_OBE_FALLBACK_DB', JSON.stringify(resultData));
    } catch (e) {
      console.warn('Failed to update IQRA_OBE_FALLBACK_DB in localStorage', e);
    }

    return resultData;
  },

  async updateDepartment(id: string, data: Partial<Department>): Promise<Department> {
    const response = await fetchWithTimeout(`${BASE_URL}/departments/${id}/`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }, 8000);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || errData.error || errData.message || 'Failed to update department on server');
    }
    return response.json();
  },

  async updateProgram(id: string, data: Partial<Program>): Promise<Program> {
    const response = await fetchWithTimeout(`${BASE_URL}/programs/${id}/`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }, 8000);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || errData.error || errData.message || 'Failed to update program on server');
    }
    return response.json();
  },

  async updateCourse(id: string, data: Partial<Course>, programId?: string): Promise<Course> {
    const queryProg = programId || data.programId;

    // For a partial update (e.g. only mappedGAs), avoid running the full
    // mapCourseToBackend which would produce empty code/title fields from
    // undefined properties and potentially corrupt the record.
    // Instead, build a minimal payload with only the fields present in data.
    let mappedData: any;
    const isGAOnlyUpdate = Object.keys(data).every(k => ['mappedGAs', 'programId'].includes(k));
    if (isGAOnlyUpdate && data.mappedGAs !== undefined) {
      mappedData = {
        mappedGAs: data.mappedGAs,
        mappedGAs_write: data.mappedGAs,
      };
    } else {
      mappedData = mapCourseToBackend({ ...data, id } as Course);
    }

    let url = `${BASE_URL}/courses/${id}/`;
    if (queryProg) {
      const cleanProg = String(queryProg).trim();
      url += `?programId=${encodeURIComponent(cleanProg)}&program_id=${encodeURIComponent(cleanProg)}`;
    }
    const response = await fetchWithTimeout(url, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(mappedData),
    }, 12000);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg =
        errData.detail ||
        errData.error ||
        errData.message ||
        (errData.code ? (Array.isArray(errData.code) ? errData.code.join(', ') : errData.code) : null) ||
        (errData.non_field_errors ? (Array.isArray(errData.non_field_errors) ? errData.non_field_errors.join(', ') : errData.non_field_errors) : null) ||
        `Failed to update course "${id}" on server (Status ${response.status})`;
      throw new Error(errMsg);
    }
    const responseData = await response.json();
    return normalizeCourse(responseData);
  },

  async deleteCourse(id: string, programId?: string): Promise<boolean> {
    let url = `${BASE_URL}/courses/${id}/`;
    if (programId) {
      const cleanProg = String(programId).trim();
      url += `?programId=${encodeURIComponent(cleanProg)}&program_id=${encodeURIComponent(cleanProg)}`;
    }
    const response = await fetchWithTimeout(url, {
      method: 'DELETE',
      headers: getHeaders(),
    }, 8000);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || errData.error || errData.message || 'Failed to delete course on server');
    }
    return true;
  },

  async createProgram(data: Program, associatedGAs?: GA[]): Promise<Program> {
    // Program FIRST, then its GAs. This used to post the GAs before the
    // program existed, so the backend couldn't resolve their programId and
    // saved every seeded GA with no program — making them department-wide and
    // visible under every program in the department.
    let created: Program | null = null;
    const response = await fetchWithTimeout(`${BASE_URL}/programs/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }, 8000);
    if (response.ok) {
      created = await response.json();
    } else {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.detail || errData.error || errData.message || 'Failed to create program on server';
      // A retry after an earlier attempt created the program but failed on a
      // GA: carry on and finish the GAs instead of dead-ending on "exists".
      const alreadyExists = response.status === 400 && /already exists/i.test(String(msg));
      if (!alreadyExists) throw new Error(msg);
    }

    if (associatedGAs && associatedGAs.length > 0) {
      await Promise.all(associatedGAs.map(async (ga) => {
        const gaRes = await fetchWithTimeout(`${BASE_URL}/gas/`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(ga),
        }, 5000);
        if (!gaRes.ok) {
          const errData = await gaRes.json().catch(() => ({}));
          throw new Error(errData.detail || errData.error || errData.message || `Failed to save GA: ${ga.name}`);
        }
      }));
    }

    if (created) return created;
    const existingRes = await fetchWithTimeout(`${BASE_URL}/programs/${encodeURIComponent(data.id)}/`, {
      method: 'GET',
      headers: getHeaders(),
    }, 8000);
    if (!existingRes.ok) throw new Error('Program exists but could not be loaded from server');
    return existingRes.json();
  },

  async createCourse(data: Course): Promise<Course> {
    const response = await fetchWithTimeout(`${BASE_URL}/courses/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(mapCourseToBackend(data)),
    }, 12000);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errStr = JSON.stringify(errData).toLowerCase();
      const isAlreadyExists =
        response.status === 409 ||
        (response.status === 400 && (
          errStr.includes('already exist') ||
          errStr.includes('unique') ||
          errStr.includes('duplicate')
        ));

      if (isAlreadyExists) {
        try {
          const targetId = data.code || data.id;
          return await this.updateCourse(targetId, data, data.programId);
        } catch {
          // If fallback update fails, fall through to detailed error
        }
      }

      const errMsg =
        errData.detail ||
        errData.error ||
        errData.message ||
        (errData.code ? (Array.isArray(errData.code) ? errData.code.join(', ') : errData.code) : null) ||
        (errData.title ? (Array.isArray(errData.title) ? errData.title.join(', ') : errData.title) : null) ||
        (errData.program ? (Array.isArray(errData.program) ? errData.program.join(', ') : errData.program) : null) ||
        (errData.non_field_errors ? (Array.isArray(errData.non_field_errors) ? errData.non_field_errors.join(', ') : errData.non_field_errors) : null) ||
        `Failed to create course "${data.code || data.title}" on server (Status ${response.status})`;
      throw new Error(errMsg);
    }
    const responseData = await response.json();
    return normalizeCourse(responseData);
  },

  getLocalInstructorCourses(): InstructorCourse[] {
    return getLocalInstructorCourses();
  },

  /**
   * Instructor adds students to one of their own courses. Add-only: unlike
   * enrollStudents (the dept-admin full sync, which deletes anyone missing
   * from the list), this never removes anyone.
   */
  async addStudentsToInstructorCourse(courseId: string, students: { regNo: string; name: string }[]): Promise<void> {
    const res = await fetchWithTimeout(
      `${BASE_URL}/instructor/courses/${encodeURIComponent(courseId)}/students/`,
      { method: 'POST', headers: getHeaders(), body: JSON.stringify({ students }) },
      10000
    );
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || errData.detail || `Could not add student (Status ${res.status})`);
    }
  },

  async enrollStudents(courseId: string, students: { regNo: string; name: string }[]): Promise<void> {
    const res = await fetchWithTimeout(`${BASE_URL}/admin/enroll/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ courseId, students }),
    }, 8000);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.detail || errData.error || errData.message || 'Enrollment sync failed';
      throw new Error(errMsg);
    }
  },

  async deleteInstructorCourse(courseId: string): Promise<boolean> {
    const res = await fetchWithTimeout(`${BASE_URL}/instructor/courses/${courseId}/`, {
      method: 'DELETE',
      headers: getHeaders(),
    }, 8000);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || 'Failed to delete course');
    }
    return true;
  },

  getLocalStorageData(): OBEData {
    return getLocalStorageData();
  },

  async getInstructorCourses(): Promise<InstructorCourse[]> {
    const response = await fetchWithTimeout(`${BASE_URL}/instructor/courses/`, {
      headers: getHeaders(),
    }, 20000);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.detail || errData.error || errData.message || `Failed to fetch instructor courses (Status ${response.status})`;
      throw new Error(errMsg);
    }
    const data = await response.json();
    if (Array.isArray(data)) {
      // Normalize enrolled students and obe_marks from backend to standard frontend structure
      data.forEach((ic: any) => {
        const rawStuds = ic.students || ic.enrolled_students || ic.enrolledStudents || ic.student_list || ic.studentList || ic.enrolled_student_list || ic.enrolledStudentList || [];
        if (Array.isArray(rawStuds)) {
          ic.students = rawStuds.map((s: any) => {
            const regNo = s.regNo || s.reg_no || s.registration_no || s.registrationNo || '';
            const name = s.name || s.student_name || s.studentName || '';
            const marks = s.student_marks || s.marks || s.obtained_marks || s.obtainedMarks || s.studentMarks || {};
            return { regNo, reg_no: regNo, name, marks, student_marks: marks, studentMarks: marks };
          });
        } else {
          ic.students = [];
        }
        ic.obe_marks = ic.obe_marks || ic.obeMarks || {};
        ic.obeMarks = ic.obe_marks;
      });

      // Reconciliation removed — backend already returns correct code, title,
      // and courseType in the instructor courses response. The extra GET /api/courses/
      // call was causing 2 API calls on every instructor dashboard load for no benefit.

      const isBackend = isBackendUser();
      if (!isBackend) {
        const deletedKeysStr = localStorage.getItem('IQRA_OBE_DELETED_COURSES');
        if (deletedKeysStr) {
          try {
            const deletedKeys = JSON.parse(deletedKeysStr);
            return data.filter(ic => {
              const key1 = `${ic.code}-${ic.programId || ''}`.toLowerCase().trim();
              const key2 = String(ic.id).toLowerCase().trim();
              return !deletedKeys.includes(key1) && !deletedKeys.includes(key2);
            });
          } catch (e) {
            console.error(e);
          }
        }
      }
      return data;
    }
    throw new Error('Malformed instructor courses data received');
  },

  async saveInstructorCourses(courses: InstructorCourse[]): Promise<InstructorCourse[]> {
    // Save to local storage only if offline/sandbox mode is active
    if (!isBackendUser()) {
      localStorage.setItem('IQRA_OBE_INSTRUCTOR_COURSES', JSON.stringify(courses));
    }
    try {
      const mappedCourses = courses.map(mapInstructorCourseToBackend);
      console.log('[DEBUG apiService.saveInstructorCourses] Sending payload to Django backend:', {
        url: `${BASE_URL}/instructor/courses/`,
        payload: { courses: mappedCourses }
      });
      const response = await fetchWithTimeout(`${BASE_URL}/instructor/courses/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ courses: mappedCourses }),
      }, 8000);

      if (response.status === 207) {
        // Partial success — some courses saved, some failed.
        // Use what was saved instead of throwing and losing everything.
        const data = await response.json().catch(() => ({}));
        if (data.errors?.length) {
          console.warn('Some courses failed to sync:', data.errors);
        }
        return Array.isArray(data.courses) ? data.courses : courses;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || errData.message || 'Failed to save instructor courses on server');
      }

      const data = await response.json();
      console.log('[DEBUG apiService.saveInstructorCourses] Received response from server:', data);
      const resList = Array.isArray(data) ? data : (data.courses || courses);
      if (Array.isArray(resList)) {
        resList.forEach((ic: any) => {
          const rawStuds = ic.students || ic.enrolled_students || ic.enrolledStudents || ic.student_list || ic.studentList || ic.enrolled_student_list || ic.enrolledStudentList || [];
          if (Array.isArray(rawStuds)) {
            ic.students = rawStuds.map((s: any) => {
              const regNo = s.regNo || s.reg_no || s.registration_no || s.registrationNo || '';
              const name = s.name || s.student_name || s.studentName || '';
              const marks = s.student_marks || s.marks || s.obtained_marks || s.obtainedMarks || s.studentMarks || {};
              return { regNo, reg_no: regNo, name, marks, student_marks: marks, studentMarks: marks };
            });
          }
          ic.obe_marks = ic.obe_marks || ic.obeMarks || {};
          ic.obeMarks = ic.obe_marks;
        });
      }
      return resList;
    } catch (err) {
      throw err;
    }
  },

  async getStudents(): Promise<Student[]> {
    const normalizeStudent = (s: any): Student => {
      if (!s) return s;
      return {
        ...s,
        regNo: s.regNo || s.reg_no || '',
        name: s.name || '',
        email: s.email || '',
        departmentId: s.departmentId || s.department_id || s.department || '',
        programId: s.programId || s.program_id || s.program || '',
        batch: s.batch || 'Fall',
        semester: s.semester || '1st'
      };
    };

    const response = await fetchWithTimeout(`${BASE_URL}/students/`, {
      headers: getHeaders(),
    }, 5000);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.detail || errData.error || errData.message || `Failed to fetch students (Status ${response.status})`;
      throw new Error(errMsg);
    }
    const data = await response.json();
    if (Array.isArray(data)) {
      return data.map(normalizeStudent);
    }
    throw new Error('Malformed students data received from backend');
  },

  async createStudent(student: Student): Promise<Student> {
    const normalizeStudent = (s: any): Student => {
      if (!s) return s;
      return {
        ...s,
        regNo: s.regNo || s.reg_no || '',
        name: s.name || '',
        email: s.email || '',
        departmentId: s.departmentId || s.department_id || s.department || '',
        programId: s.programId || s.program_id || s.program || '',
        batch: s.batch || 'Fall',
        semester: s.semester || '1st'
      };
    };

    const mapToBackend = (s: any) => {
      return {
        reg_no: s.regNo,
        regNo: s.regNo,
        name: s.name,
        email: (s.email || "").trim().toLowerCase(),
        department_id: s.departmentId,
        departmentId: s.departmentId,
        department: s.departmentId,
        program_id: s.programId,
        programId: s.programId,
        program: s.programId,
        batch: s.batch,
        semester: s.semester,
        password: (s as any).password || DEFAULT_TEMP_PASSWORD
      };
    };

    try {
      const response = await fetchWithTimeout(`${BASE_URL}/students/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(mapToBackend(student)),
      }, 8000);
      if (response.ok) {
        const data = await response.json();
        const normalizedData = normalizeStudent(data);
        const current = await this.getStudents();
        const updated = [...current.filter(s => s.regNo !== normalizedData.regNo), normalizedData];
        localStorage.setItem('IQRA_OBE_STUDENTS', JSON.stringify(updated));
        return normalizedData;
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || errData.message || 'Failed to create student on server');
      }
    } catch (err) {
      throw err;
    }
  },

  async updateStudent(regNo: string, studentData: Partial<Student>): Promise<Student> {
    const normalizeStudent = (s: any): Student => {
      if (!s) return s;
      return {
        ...s,
        regNo: s.regNo || s.reg_no || '',
        name: s.name || '',
        email: s.email || '',
        departmentId: s.departmentId || s.department_id || s.department || '',
        programId: s.programId || s.program_id || s.program || '',
        batch: s.batch || 'Fall',
        semester: s.semester || '1st'
      };
    };

    const mapToBackend = (s: any) => {
      const mapped: any = {};
      if ('regNo' in s || 'reg_no' in s) {
        mapped.reg_no = s.regNo || s.reg_no;
        mapped.regNo = s.regNo || s.reg_no;
      }
      if ('name' in s) mapped.name = s.name;
      if ('email' in s) mapped.email = s.email;
      if ('departmentId' in s || 'department' in s || 'department_id' in s) {
        const val = s.departmentId || s.department_id || s.department;
        mapped.department_id = val;
        mapped.departmentId = val;
        mapped.department = val;
      }
      if ('programId' in s || 'program' in s || 'program_id' in s) {
        const val = s.programId || s.program_id || s.program;
        mapped.program_id = val;
        mapped.programId = val;
        mapped.program = val;
      }
      if ('batch' in s) mapped.batch = s.batch;
      if ('semester' in s) mapped.semester = s.semester;
      mapped.password = (s as any).password || DEFAULT_TEMP_PASSWORD;
      return mapped;
    };

    const currentStudents = await this.getStudents();
    const matchedStudent = currentStudents.find(s => s.regNo.toLowerCase() === regNo.toLowerCase());
    const backendId = matchedStudent ? (matchedStudent as any).id : null;
    const urlSuffix = backendId !== undefined && backendId !== null ? backendId : regNo;

    try {
      const response = await fetchWithTimeout(`${BASE_URL}/students/${urlSuffix}/`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(mapToBackend(studentData)),
      }, 8000);
      if (response.ok) {
        const data = await response.json();
        const normalizedData = normalizeStudent(data);
        const current = await this.getStudents();
        const updated = current.map(s => s.regNo.toLowerCase().trim() === regNo.toLowerCase().trim() ? { ...s, ...normalizedData } : s);
        localStorage.setItem('IQRA_OBE_STUDENTS', JSON.stringify(updated));
        return normalizedData;
      } else {
        const errorText = await response.text();
        let parsed;
        try { parsed = JSON.parse(errorText); } catch (e) {}
        throw new Error(parsed?.message || parsed?.error || `Server error (${response.status}): ${errorText}`);
      }
    } catch (err: any) {
      if (isBackendUser()) {
        throw err;
      }
      if (err.message && (err.message.includes('Server error') || err.message.includes('validation') || err.message.includes('not found') || err.message.includes('Conflict'))) {
        throw err;
      }
      console.warn("Backend API for students offline. Updating student in local storage.", err);
    }
    const current = await this.getStudents();
    const matched = current.find(s => s.regNo.toLowerCase().trim() === regNo.toLowerCase().trim());
    if (!matched) throw new Error("Student not found");
    const updatedStudent = { ...matched, ...studentData };
    const updated = current.map(s => s.regNo.toLowerCase().trim() === regNo.toLowerCase().trim() ? updatedStudent : s);
    localStorage.setItem('IQRA_OBE_STUDENTS', JSON.stringify(updated));
    return updatedStudent;
  },

  async deleteStudent(regNo: string): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/students/${regNo}/`, {
        method: 'DELETE',
        headers: getHeaders(),
      }, 8000);

      if (!response.ok) {
        const errorText = await response.text();
        let parsed;
        try { parsed = JSON.parse(errorText); } catch (e) {}
        throw new Error(parsed?.message || parsed?.error || `Server error (${response.status}): ${errorText}`);
      }

      // Always clear local storage student cache and related student-specific records
      const current = await this.getStudents();
      const updated = current.filter(s => s.regNo.toLowerCase() !== regNo.toLowerCase());
      localStorage.setItem('IQRA_OBE_STUDENTS', JSON.stringify(updated));

      const savedBindings = localStorage.getItem('IQRA_OBE_STUDENT_BINDINGS');
      if (savedBindings) {
        try {
          const parsed = JSON.parse(savedBindings);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((b: any) => b.studentRegNo.toLowerCase() !== regNo.toLowerCase());
            localStorage.setItem('IQRA_OBE_STUDENT_BINDINGS', JSON.stringify(filtered));
          }
        } catch (e) {}
      }

      const savedStatuses = localStorage.getItem('IQRA_OBE_STUDENT_COURSE_STATUSES');
      if (savedStatuses) {
        try {
          const parsed = JSON.parse(savedStatuses);
          delete parsed[regNo];
          localStorage.setItem('IQRA_OBE_STUDENT_COURSE_STATUSES', JSON.stringify(parsed));
        } catch (e) {}
      }

      return true;
    } catch (err: any) {
      console.warn("Backend API for students offline or deletion failed. Cleared locally for resilience.", err);
      const current = await this.getStudents();
      const updated = current.filter(s => s.regNo.toLowerCase() !== regNo.toLowerCase());
      localStorage.setItem('IQRA_OBE_STUDENTS', JSON.stringify(updated));

      const savedBindings = localStorage.getItem('IQRA_OBE_STUDENT_BINDINGS');
      if (savedBindings) {
        try {
          const parsed = JSON.parse(savedBindings);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((b: any) => b.studentRegNo.toLowerCase() !== regNo.toLowerCase());
            localStorage.setItem('IQRA_OBE_STUDENT_BINDINGS', JSON.stringify(filtered));
          }
        } catch (e) {}
      }
      return true;
    }
  },

  async getDeptAdminProfile() {
    const res = await fetchWithTimeout(`${BASE_URL}/admin/profile/`, {
      headers: getHeaders()
    }, 5000);
    if (!res.ok) throw new Error('Failed to fetch admin profile');
    return res.json();
    // Returns: { departmentId, departmentName, employeeId, username, user_type }
  },

  async getTeachers() {
    const res = await fetchWithTimeout(`${BASE_URL}/teachers/`, {
      headers: getHeaders()
    }, 5000);
    if (!res.ok) throw new Error('Failed to fetch teachers');
    return res.json();
    // Returns: [{ employeeId, name, email, designation, departmentId, departmentName }]
  },

  async createTeacher(teacherData: { name: string; email: string; employeeId: string; designation: string; departmentId: string }) {
    const res = await fetchWithTimeout(`${BASE_URL}/admin/teachers/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(teacherData),
    }, 8000);
    if (!res.ok) {
      const errText = await res.text();
      let parsed;
      try { parsed = JSON.parse(errText); } catch(e) {}
      throw new Error(parsed?.message || parsed?.error || errText || 'Failed to onboarding faculty');
    }
    return res.json();
  },

  async deleteTeacher(employeeId: string): Promise<boolean> {
    const res = await fetchWithTimeout(`${BASE_URL}/admin/teachers/${employeeId}/`, {
      method: 'DELETE',
      headers: getHeaders(),
    }, 8000);
    if (!res.ok) {
      if (res.status === 409) {
        throw new Error("Conflict: This teacher has active course assignments or classes with students and cannot be deleted.");
      }
      const errText = await res.text();
      let parsed;
      try { parsed = JSON.parse(errText); } catch(e) {}
      throw new Error(parsed?.message || parsed?.error || errText || 'Failed to delete teacher from server');
    }
    return true;
  },

  async getSemesterPlans(programId?: string) {
    const url = programId
      ? `${BASE_URL}/admin/semester-plans/?programId=${programId}`
      : `${BASE_URL}/admin/semester-plans/`;
    const res = await fetchWithTimeout(url, { headers: getHeaders() }, 20000);
    if (!res.ok) throw new Error('Failed to fetch semester plans');
    return res.json();
    // Returns: [{ programId, semester, courseCodes }]
  },

  async saveSemesterPlan(programId: string, semester: string, courseCodes: string[]) {
    const res = await fetchWithTimeout(`${BASE_URL}/admin/semester-plans/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ programId, semester, courseCodes }),
    }, 8000);
    if (!res.ok) throw new Error('Failed to save semester plan');
    return res.json();
  },

  async getStudentCourses() {
    // No ?regNo param — backend resolves reg_no from the JWT token securely.
    // Passing regNo as a query param was a security risk (any user could
    // request another student's courses) and the backend was ignoring it anyway.
    const res = await fetchWithTimeout(`${BASE_URL}/student/courses/`, {
      headers: getHeaders()
    }, 20000);
    if (!res.ok) throw new Error('Failed to fetch student courses');
    const data = await res.json();
    return extractList(data, 'courses');
  },

  async getCourseAssignments() {
    const res = await fetchWithTimeout(`${BASE_URL}/admin/course-assignments/`, {
      headers: getHeaders()
    }, 20000);
    if (!res.ok) throw new Error('Failed to fetch course assignments');
    return res.json();
    // Returns: [{ teacherId, courseCode, programId }]
  },

  async assignCourse(teacherId: string, courseCode: string, programId?: string, academicYear?: string) {
    const res = await fetchWithTimeout(`${BASE_URL}/admin/course-assignments/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ teacherId, courseCode, programId, academicYear }),
    }, 8000);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.detail || errData.error || errData.message || 'Failed to save course assignment';
      throw new Error(errMsg);
    }
    return res.json();
  },

  async finalizeCourse(courseId: string, academicYear: string): Promise<{ message: string }> {
    const res = await fetchWithTimeout(`${BASE_URL}/admin/finalize-course/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ courseId, academicYear }),
    }, 8000);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || errData.error || errData.message || 'Failed to finalize course');
    }
    return res.json();
  },

  async getFinalResults(params: { regNo?: string; courseCode?: string; academicYear?: string }): Promise<{ results: any[] }> {
    let url = `${BASE_URL}/reports/final-results/`;
    const queryParams: string[] = [];
    if (params.regNo) queryParams.push(`regNo=${params.regNo}`);
    if (params.courseCode) queryParams.push(`courseCode=${params.courseCode}`);
    if (params.academicYear) queryParams.push(`academicYear=${params.academicYear}`);
    if (queryParams.length > 0) {
      url += `?${queryParams.join('&')}`;
    }
    const res = await fetchWithTimeout(url, { headers: getHeaders() }, 20000);
    if (!res.ok) throw new Error('Failed to fetch final results');
    return res.json();
  },

  async removeCourseAssignment(teacherId: string, courseCode: string, programId?: string, academicYear?: string) {
    const res = await fetchWithTimeout(`${BASE_URL}/admin/course-assignments/`, {
      method: 'DELETE',
      headers: getHeaders(),
      body: JSON.stringify({ teacherId, courseCode, programId, academicYear }),
    }, 8000);
    if (!res.ok) throw new Error('Failed to remove course assignment');
    return;
  },

  async getProgramGAAttainment(programId: string) {
    const res = await fetchWithTimeout(`${BASE_URL}/reports/program-ga-attainment/?programId=${programId.toLowerCase()}`, {
      headers: getHeaders()
    }, 5000);
    if (!res.ok) throw new Error('Failed to fetch program GA attainment');
    return res.json();
  },

  async getStudentGAAttainment(regNo?: string) {
    const url = regNo ? `${BASE_URL}/reports/student-ga-attainment/?regNo=${regNo}` : `${BASE_URL}/reports/student-ga-attainment/`;
    const res = await fetchWithTimeout(url, {
      headers: getHeaders()
    }, 5000);
    if (!res.ok) throw new Error('Failed to fetch student GA attainment');
    return res.json();
  },

  async getCourseAttainment(courseCode: string, programId: string) {
    const res = await fetchWithTimeout(`${BASE_URL}/reports/course-attainment/?courseCode=${courseCode}&programId=${programId.toLowerCase()}`, {
      headers: getHeaders()
    }, 5000);
    if (!res.ok) throw new Error('Failed to fetch course attainment');
    return res.json();
  },

  async getStudentSummary(regNo?: string) {
    const url = regNo ? `${BASE_URL}/reports/student-summary/?regNo=${regNo}` : `${BASE_URL}/reports/student-summary/`;
    const res = await fetchWithTimeout(url, {
      headers: getHeaders()
    }, 5000);
    if (!res.ok) throw new Error('Failed to fetch student summary');
    return res.json();
  },

  async getCourseCLOs(courseId: string) {
    const res = await fetchWithTimeout(`${BASE_URL}/instructor/courses/${courseId}/clos/`, {
      headers: getHeaders()
    }, 5000);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.detail || errData.error || errData.message || `Failed to fetch course CLOs (Status ${res.status})`;
      throw new Error(errMsg);
    }
    const data = await res.json();
    if (Array.isArray(data)) return data;
    throw new Error('Malformed course CLOs data received');
  },

  async createCourseCLO(courseId: string, data: { code: string; description: string; mappedGA: string | null; order: number }) {
    const res = await fetchWithTimeout(`${BASE_URL}/instructor/courses/${courseId}/clos/`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }, 5000);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.detail || errData.error || errData.message || `Failed to create course CLO (Status ${res.status})`;
      throw new Error(errMsg);
    }
    return res.json();
  },

  async updateCourseCLO(courseId: string, id: string | number, data: { description?: string; mappedGA?: string | null; order?: number }) {
    const res = await fetchWithTimeout(`${BASE_URL}/instructor/courses/${courseId}/clos/${id}/`, {
      method: 'PATCH',
      headers: {
        ...getHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }, 5000);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.detail || errData.error || errData.message || `Failed to update course CLO (Status ${res.status})`;
      throw new Error(errMsg);
    }
    return res.json();
  },

  async deleteCourseCLO(courseId: string, id: string | number) {
    const res = await fetchWithTimeout(`${BASE_URL}/instructor/courses/${courseId}/clos/${id}/`, {
      method: 'DELETE',
      headers: getHeaders()
    }, 5000);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.detail || errData.error || errData.message || `Failed to delete course CLO (Status ${res.status})`;
      throw new Error(errMsg);
    }
    return true;
  },

  async getCOAttainmentSummary(programId: string, semester?: string, academicYear?: string) {
    let url = `${BASE_URL}/reports/co-attainment-summary/?programId=${programId}`;
    if (semester) url += `&semester=${semester}`;
    if (academicYear) url += `&academicYear=${academicYear}`;
    const res = await fetchWithTimeout(url, { headers: getHeaders() });
    return res.ok ? res.json() : null;
  },

  async getPOAttainment(programId: string) {
    const res = await fetchWithTimeout(
      `${BASE_URL}/reports/po-attainment/?programId=${programId}`,
      { headers: getHeaders() }
    );
    return res.ok ? res.json() : null;
  },

  async getGapAnalysis(programId: string) {
    const res = await fetchWithTimeout(
      `${BASE_URL}/reports/gap-analysis/?programId=${programId}`,
      { headers: getHeaders() }
    );
    return res.ok ? res.json() : null;
  },

  async getAtRiskStudents(programId: string, semester?: string) {
    let url = `${BASE_URL}/reports/at-risk-students/?programId=${programId}`;
    if (semester) url += `&semester=${semester}`;
    const res = await fetchWithTimeout(url, { headers: getHeaders() });
    return res.ok ? res.json() : null;
  },

  async getInstructorPerformance(departmentId: string) {
    const res = await fetchWithTimeout(
      `${BASE_URL}/reports/instructor-performance/?departmentId=${departmentId}`,
      { headers: getHeaders() }
    );
    return res.ok ? res.json() : null;
  },

  async getCohortComparison(programId: string, gaId?: string) {
    let url = `${BASE_URL}/reports/cohort-comparison/?programId=${programId}`;
    if (gaId) url += `&gaId=${gaId}`;
    const res = await fetchWithTimeout(url, { headers: getHeaders() });
    return res.ok ? res.json() : null;
  },

  async getProgramGAAttainmentBySemester(programId: string) {
    const res = await fetchWithTimeout(`${BASE_URL}/reports/program-ga-attainment-by-semester/?programId=${programId.toLowerCase()}`, {
      headers: getHeaders()
    }, 5000);
    if (!res.ok) {
      throw new Error(`Failed to fetch program GA attainment by semester: ${res.statusText || res.status}`);
    }
    return res.json();
  },

  async getProgramGAAttainmentBatch(batch: string, departmentId: string, programId?: string) {
    const params = new URLSearchParams({
      batch: batch.toLowerCase(),
      departmentId: departmentId,
    });
    if (programId) {
      params.append('programId', programId.toLowerCase());
    }
    
    const res = await fetchWithTimeout(
      `${BASE_URL}/reports/batch-ga-attainment/?${params.toString()}`,
      { headers: getHeaders() },
      5000
    );
    if (!res.ok) throw new Error('Failed to fetch batch GA attainment');
    return res.json();
  },

  saveLocalStorageData(data: OBEData): void {
    saveLocalStorageData(data);
  }
};

const getLocalInstructorCourses = (): InstructorCourse[] => {
  try {
    const data = localStorage.getItem('IQRA_OBE_INSTRUCTOR_COURSES');
    let result: InstructorCourse[] = data ? JSON.parse(data) : [];
    const deletedKeysStr = localStorage.getItem('IQRA_OBE_DELETED_COURSES');
    if (deletedKeysStr && result.length > 0) {
      try {
        const deletedKeys = JSON.parse(deletedKeysStr);
        result = result.filter(ic => {
          const key1 = `${ic.code}-${ic.programId || ''}`.toLowerCase().trim();
          const key2 = String(ic.id).toLowerCase().trim();
          return !deletedKeys.includes(key1) && !deletedKeys.includes(key2);
        });
      } catch (e) {
        console.error(e);
      }
    }
    return result;
  } catch (e) {
    return [];
  }
};
