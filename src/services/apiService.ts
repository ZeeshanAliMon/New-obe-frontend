import { OBEData, Department, Program, GA, Course, ProgramObjective, InstructorCourse } from '../types';

export const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Detailed institutional mock data for Iqra University OBE fallback
const DEFAULT_FALLBACK_DATA: OBEData = {
  departments: [
    {
      id: 'computing',
      name: 'Department of Computing and Technology',
      vision: 'To emerge as a global leader in computer science research and education by driving technological innovation, solving real-world challenges, and empowering future leaders',
      mission: 'To foster academic excellence and cutting-edge research, positioning our department as a global leader in computer science innovation. By instilling ethical values, technical prowess, and interdisciplinary knowledge, we prepare students for impactful careers in the field. We strive to shape the technological landscape of tomorrow by equipping our students with professionalism, resilience, and a collaborative mindset'
    },
    {
      id: 'business',
      name: 'Department of Business Administration',
      vision: 'To be a leading business school recognized globally for nurturing entrepreneurial mindsets and ethical leadership in the corporate world.',
      mission: 'To empower students with innovative business education, pioneering research capabilities, and ethical principles designed to create future business leaders.'
    }
  ],
  programs: [
    {
      id: 'bscs',
      name: 'Bachelor of Science in Computer Science',
      code: 'BSCS',
      departmentId: 'computing',
      pos: [
        {
          id: 'PO1',
          text: 'Establishing in-depth understanding of theoretical concepts related to computer science.',
          mappedGAs: ['GA-1', 'GA-2']
        },
        {
          id: 'PO2',
          text: 'Applying core Computer Science knowledge and analytical skills to optimally solve real-world problems.',
          mappedGAs: ['GA-1', 'GA-2', 'GA-3', 'GA-4', 'GA-5']
        },
        {
          id: 'PO3',
          text: 'Imbuing quest for learning and engaging in continuous professional development in the field of computer science by carrying research and adopting professional practices.',
          mappedGAs: ['GA-3', 'GA-4', 'GA-6', 'GA-7', 'GA-8', 'GA-10']
        },
        {
          id: 'PO4',
          text: 'Developing the ability to work in a multi-disciplinary and multi cultural environment in teams incorporating soft skills and maintaining high ethical standards.',
          mappedGAs: ['GA-6', 'GA-7', 'GA-9']
        }
      ]
    },
    {
      id: 'bba',
      name: 'Bachelor of Business Administration',
      code: 'BBA',
      departmentId: 'business',
      pos: [
        {
          id: 'PO1',
          text: 'Mastering Core Business Management Skills and Analytical Tools.',
          mappedGAs: ['GA-1', 'GA-4']
        },
        {
          id: 'PO2',
          text: 'Strategic planning, operations synthesis, and ethical decision modeling.',
          mappedGAs: ['GA-2', 'GA-3', 'GA-5']
        },
        {
          id: 'PO3',
          text: 'Fostering innovative business development strategies and executive communication.',
          mappedGAs: ['GA-3', 'GA-6', 'GA-8']
        },
        {
          id: 'PO4',
          text: 'Developing adaptive management capabilities in multi-dimensional market climates.',
          mappedGAs: ['GA-2', 'GA-7']
        }
      ]
    }
  ],
  gas: [
    // Computing Department GAs
    { id: 'GA-1', name: 'Academic Education', description: 'Completion of an accredited program of study designed to prepare graduates as computing professionals.', departmentId: 'computing' },
    { id: 'GA-2', name: 'Knowledge for Solving Computing Problems', description: 'Apply knowledge of computing fundamentals, knowledge of a computing specialization, and mathematics, science, and domain knowledge appropriate for the computing specialization to the abstraction and conceptualization of computing models from defined problems and requirements.', departmentId: 'computing' },
    { id: 'GA-3', name: 'Problem Analysis', description: 'Identify and solve complex computing problems reaching substantiated conclusions using fundamental principles of mathematics, computing sciences, and relevant domain disciplines.', departmentId: 'computing' },
    { id: 'GA-4', name: 'Design/Development of Solutions', description: 'Design and evaluate solutions for complex computing problems, and design and evaluate systems, components, or processes that meet specified needs.', departmentId: 'computing' },
    { id: 'GA-5', name: 'Modern Tool Usage', description: 'Create, select, or adapt and then apply appropriate techniques, resources, and modern computing tools to complex computing activities, with an understanding of the limitations.', departmentId: 'computing' },
    { id: 'GA-6', name: 'Individual and Team Work', description: 'Function effectively as an individual and as a member or leader of a team in multidisciplinary settings.', departmentId: 'computing' },
    { id: 'GA-7', name: 'Communication', description: 'Communicate effectively with the computing community about complex computing activities by being able to comprehend and write effective reports, design documentation, make effective presentations, and give and understand clear instructions.', departmentId: 'computing' },
    { id: 'GA-8', name: 'Computing Professionalism and Society', description: 'Understand and assess societal, health, safety, legal, and cultural issues within local and global contexts, and the consequential responsibilities relevant to professional computing practice.', departmentId: 'computing' },
    { id: 'GA-9', name: 'Ethics', description: 'Understand and commit to professional ethics, responsibilities, and norms of professional computing practice.', departmentId: 'computing' },
    { id: 'GA-10', name: 'Life-long Learning', description: 'Recognize the need, and have the ability, to engage in independent learning for continual development as a computing professional.', departmentId: 'computing' },

    // Business Department GAs
    { id: 'GA-B1', name: 'Business Analytics & Decision Making', description: 'Execute comprehensive business analysis and apply quantitative tools for strategic decision support.', departmentId: 'business' },
    { id: 'GA-B2', name: 'Leadership & Teamwork', description: 'Foster strong collaborative performance, conflict resolution, and motivational team frameworks within workspaces.', departmentId: 'business' },
    { id: 'GA-B3', name: 'Strategic Thinking', description: 'Synthesize market trends, competitive intelligence, and internal structures to deploy agile business vision.', departmentId: 'business' },
    { id: 'GA-B4', name: 'Financial Literacy', description: 'Evaluate balance sheets, corporate portfolios, and financial statements to drive corporate value addition.', departmentId: 'business' },
    { id: 'GA-B5', name: 'Corporate Social Responsibility & Ethics', description: 'Demonstrate deep compliance, corporate transparency, and standard professional ethics in corporate systems.', departmentId: 'business' },
    { id: 'GA-B6', name: 'Communication & Presenting', description: 'Deliver highly structured business communications, elevator pitches, and expert corporate reporting values.', departmentId: 'business' },
    { id: 'GA-B7', name: 'Critical Advisory', description: 'Troubleshoot complex business cases and offer sustainable, optimized pathways to enterprise models.', departmentId: 'business' },
    { id: 'GA-B8', name: 'Business Enterprise', description: 'Exhibit high entrepreneurial alertness, business opportunity detection traits, and adaptive startup frameworks.', departmentId: 'business' }
  ],
  courses: [
    // 37 BSCS Core Courses + 7 Electives (Total 44 as shown exactly in photos!)
    { id: 'C1', code: 'CMC111', title: 'Programming Fundamentals', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-4'], departmentId: 'computing' },
    { id: 'C2', code: 'GER111', title: 'Application of Information & Communication Technologies', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-5'], departmentId: 'computing' },
    { id: 'C3', code: 'GER121', title: 'Functional English', type: 'core', mappedGAs: ['GA-1', 'GA-7'], departmentId: 'computing' },
    { id: 'C4', code: 'GER131', title: 'Calculus and Analytic Geometry', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-3'], departmentId: 'computing' },
    { id: 'C5', code: 'GER141', title: 'Islamic Studies', type: 'core', mappedGAs: ['GA-1', 'GA-6', 'GA-8', 'GA-9'], departmentId: 'computing' },
    { id: 'C6', code: 'GER151', title: 'Natural Science (Applied Physics)', type: 'core', mappedGAs: ['GA-1', 'GA-2'], departmentId: 'computing' },
    { id: 'C7', code: 'MTE111', title: 'Multivariable Calculus', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-3'], departmentId: 'computing' },
    { id: 'C8', code: 'CMC112', title: 'Object Oriented Programming', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-4'], departmentId: 'computing' },
    { id: 'C9', code: 'CMC121', title: 'Digital Logic Design', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-3'], departmentId: 'computing' },
    { id: 'C10', code: 'GER122', title: 'Expository Writing', type: 'core', mappedGAs: ['GA-1', 'GA-6', 'GA-7'], departmentId: 'computing' },
    { id: 'C11', code: 'GER132', title: 'Discrete Structures', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-3'], departmentId: 'computing' },
    { id: 'C12', code: 'GER142', title: 'Ideology and Constitution of Pakistan', type: 'core', mappedGAs: ['GA-1', 'GA-8', 'GA-9', 'GA-10'], departmentId: 'computing' },
    { id: 'C13', code: 'MTE212', title: 'Probability & Statistics', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-3'], departmentId: 'computing' },
    { id: 'C14', code: 'CMC222', title: 'Computer Organization & Assembly Language', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-3'], departmentId: 'computing' },
    { id: 'C15', code: 'CMC251', title: 'Data Structures', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-3', 'GA-5'], departmentId: 'computing' },
    { id: 'C16', code: 'CSC252', title: 'Theory of Automata', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-3', 'GA-4'], departmentId: 'computing' },
    { id: 'C17', code: 'CMC261', title: 'Computer Networks', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-3'], departmentId: 'computing' },
    { id: 'C18', code: 'MTE213', title: 'Linear Algebra', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-3'], departmentId: 'computing' },
    { id: 'C19', code: 'MTE221', title: 'Technical & Business Writing', type: 'core', mappedGAs: ['GA-1', 'GA-6', 'GA-8'], departmentId: 'computing' },
    { id: 'C20', code: 'CSC223', title: 'Computer Architecture', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-5'], departmentId: 'computing' },
    { id: 'C21', code: 'CMC241', title: 'Operating Systems', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-3'], departmentId: 'computing' },
    { id: 'C22', code: 'CMC253', title: 'Analysis of Algorithms', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-3', 'GA-4'], departmentId: 'computing' },
    { id: 'C23', code: 'GER261', title: 'Introduction to Management', type: 'core', mappedGAs: ['GA-1', 'GA-3', 'GA-6'], departmentId: 'computing' },
    { id: 'C24', code: 'CMC331', title: 'Database Systems', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-3', 'GA-5'], departmentId: 'computing' },
    { id: 'C25', code: 'CSC354', title: 'Compiler Construction', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-3', 'GA-4'], departmentId: 'computing' },
    { id: 'C26', code: 'CMC362', title: 'Information Security', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-3', 'GA-4'], departmentId: 'computing' },
    { id: 'C27', code: 'CMC371', title: 'Software Engineering', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-3'], departmentId: 'computing' },
    { id: 'C28', code: 'CSC332', title: 'Advance Database Management Systems', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-3', 'GA-5'], departmentId: 'computing' },
    { id: 'C29', code: 'CMC381', title: 'Artificial Intelligence', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-3', 'GA-4', 'GA-5'], departmentId: 'computing' },
    { id: 'C30', code: 'CSC382', title: 'HCI & Computer Graphics', type: 'core', mappedGAs: ['GA-1', 'GA-3', 'GA-4', 'GA-5'], departmentId: 'computing' },
    { id: 'C31', code: 'ESC311', title: 'Introduction to Marketing', type: 'core', mappedGAs: ['GA-1', 'GA-7', 'GA-8', 'GA-9'], departmentId: 'computing' },
    { id: 'C32', code: 'CSC442', title: 'Parallel & Distributed Computing', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-4', 'GA-5'], departmentId: 'computing' },
    { id: 'C33', code: 'GER462', title: 'Technopreneurship', type: 'core', mappedGAs: ['GA-1', 'GA-7', 'GA-9', 'GA-10'], departmentId: 'computing' },
    { id: 'C34', code: 'CMC491', title: 'Final Year Project - I', type: 'core', mappedGAs: ['GA-1'], departmentId: 'computing' },
    { id: 'C35', code: 'GER443', title: 'Civics and Community Engagement', type: 'core', mappedGAs: ['GA-1', 'GA-7', 'GA-8', 'GA-9'], departmentId: 'computing' },
    { id: 'C36', code: 'GER463', title: 'Professional Practices', type: 'core', mappedGAs: ['GA-1', 'GA-8', 'GA-9', 'GA-10'], departmentId: 'computing' },
    { id: 'C37', code: 'CMC492', title: 'Final Year Project - II', type: 'core', mappedGAs: ['GA-1', 'GA-2', 'GA-3', 'GA-4', 'GA-5', 'GA-6', 'GA-7', 'GA-8', 'GA-9', 'GA-10'], departmentId: 'computing' },
    
    // Electives
    { id: 'C38', code: 'CSC467', title: 'Internet of Things', type: 'elective', mappedGAs: ['GA-1', 'GA-2', 'GA-3', 'GA-4'], departmentId: 'computing' },
    { id: 'C39', code: 'CMC381-E', title: 'Artificial Intelligence (Elective)', type: 'elective', mappedGAs: ['GA-1', 'GA-2', 'GA-4', 'GA-5'], departmentId: 'computing' },
    { id: 'C40', code: 'CSC436', title: 'Data Warehousing & Data Mining', type: 'elective', mappedGAs: ['GA-1', 'GA-2', 'GA-3', 'GA-7', 'GA-10'], departmentId: 'computing' },
    { id: 'C41', code: 'CSC479', title: 'Machine Learning', type: 'elective', mappedGAs: ['GA-1', 'GA-2', 'GA-4', 'GA-5'], departmentId: 'computing' },
    { id: 'C42', code: 'CSC435', title: 'Mobile Application Development', type: 'elective', mappedGAs: ['GA-1', 'GA-2', 'GA-3'], departmentId: 'computing' },
    { id: 'C43', code: 'CSC321', title: 'Embedded Systems', type: 'elective', mappedGAs: ['GA-1', 'GA-2', 'GA-5'], departmentId: 'computing' },
    { id: 'C44', code: 'CSC478', title: 'Routing and Switching', type: 'elective', mappedGAs: ['GA-1', 'GA-2', 'GA-3', 'GA-4'], departmentId: 'computing' },

    // Business Department Courses (BBA)
    { id: 'CB1', code: 'BUS101', title: 'Principles of Management', type: 'core', mappedGAs: ['GA-B2', 'GA-B3', 'GA-B6'], departmentId: 'business' },
    { id: 'CB2', code: 'MKT111', title: 'Principles of Marketing', type: 'core', mappedGAs: ['GA-B3', 'GA-B6', 'GA-B8'], departmentId: 'business' },
    { id: 'CB3', code: 'ACC121', title: 'Financial Accounting', type: 'core', mappedGAs: ['GA-B1', 'GA-B4'], departmentId: 'business' },
    { id: 'CB4', code: 'HRM211', title: 'Human Resource Management', type: 'core', mappedGAs: ['GA-B2', 'GA-B5', 'GA-B6'], departmentId: 'business' },
    { id: 'CB5', code: 'ECO131', title: 'Microeconomics', type: 'core', mappedGAs: ['GA-B1', 'GA-B3'], departmentId: 'business' },
    { id: 'CB6', code: 'MGT222', title: 'Organizational Behavior', type: 'core', mappedGAs: ['GA-B2', 'GA-B5', 'GA-B6'], departmentId: 'business' },
    { id: 'CB7', code: 'FIN311', title: 'Business Finance', type: 'core', mappedGAs: ['GA-B1', 'GA-B4'], departmentId: 'business' },
    { id: 'CB8', code: 'MGT331', title: 'Strategic Management', type: 'core', mappedGAs: ['GA-B3', 'GA-B5', 'GA-B7', 'GA-B8'], departmentId: 'business' },
    { id: 'CB9', code: 'BUS491', title: 'BBA Capstone Project - I', type: 'core', mappedGAs: ['GA-B1', 'GA-B2', 'GA-B3', 'GA-B6'], departmentId: 'business' },
    { id: 'CB10', code: 'BUS492', title: 'BBA Capstone Project - II', type: 'core', mappedGAs: ['GA-B1', 'GA-B2', 'GA-B3', 'GA-B4', 'GA-B5', 'GA-B6', 'GA-B7', 'GA-B8'], departmentId: 'business' },
    { id: 'CB11', code: 'ENTR451', title: 'Social Entrepreneurship', type: 'elective', mappedGAs: ['GA-B5', 'GA-B8'], departmentId: 'business' },
    { id: 'CB12', code: 'FIN462', title: 'Investment Portfolio Analysis', type: 'elective', mappedGAs: ['GA-B1', 'GA-B4', 'GA-B7'], departmentId: 'business' }
  ]
};

// Lazy initialization helper for localStorage DB
const getLocalStorageData = (): OBEData => {
  const dataStr = localStorage.getItem('IQRA_OBE_FALLBACK_DB');
  if (dataStr) {
    try {
      const parsed = JSON.parse(dataStr);
      let migrated = false;
      if (Array.isArray(parsed.courses)) {
        parsed.courses = parsed.courses.map((c: any) => {
          if (c.departmentId === 'computing' && !c.programId) {
            migrated = true;
            return { ...c, programId: 'bscs' };
          }
          return c;
        });
      }
      if (Array.isArray(parsed.gas)) {
        parsed.gas = parsed.gas.map((g: any) => {
          if (g.departmentId === 'computing' && !g.programId) {
            migrated = true;
            return { ...g, programId: 'bscs' };
          }
          if (g.departmentId === 'business' && !g.programId) {
            migrated = true;
            return { ...g, programId: 'bba' };
          }
          return g;
        });
      } else {
        migrated = true;
        parsed.gas = DEFAULT_FALLBACK_DATA.gas.map(g => {
          if (g.departmentId === 'computing') return { ...g, programId: 'bscs' };
          if (g.departmentId === 'business') return { ...g, programId: 'bba' };
          return g;
        });
      }
      if (Array.isArray(parsed.programs)) {
        parsed.programs = parsed.programs.map((p: any) => {
          if (p.id === 'bscs') {
            if (!p.vision) {
              migrated = true;
              p.vision = 'To produce computer science graduates of international standards with state-of-the-art skills.';
            }
            if (!p.mission) {
              migrated = true;
              p.mission = 'To empower students with deep scientific computer knowledge, preparing them for leading-edge industry roles.';
            }
          }
          return p;
        });
      }
      if (migrated) {
        localStorage.setItem('IQRA_OBE_FALLBACK_DB', JSON.stringify(parsed));
      }
      return parsed;
    } catch (e) {
      console.error("Failed to parse local storage fallback, resetting to default.", e);
    }
  }

  const base = { ...DEFAULT_FALLBACK_DATA };
  base.courses = base.courses.map(c => {
    if (c.departmentId === 'computing' && !c.programId) {
      return { ...c, programId: 'bscs' };
    }
    return c;
  });
  base.gas = base.gas.map(g => {
    if (g.departmentId === 'computing') {
      return { ...g, programId: 'bscs' };
    }
    if (g.departmentId === 'business') {
      return { ...g, programId: 'bba' };
    }
    return g;
  });
  base.programs = base.programs.map(p => {
    if (p.id === 'bscs') {
      return {
        ...p,
        vision: 'To produce computer science graduates of international standards with state-of-the-art skills.',
        mission: 'To empower students with deep scientific computer knowledge, preparing them for leading-edge industry roles.'
      };
    }
    return p;
  });

  localStorage.setItem('IQRA_OBE_FALLBACK_DB', JSON.stringify(base));
  return base;
};

const saveLocalStorageData = (data: OBEData) => {
  localStorage.setItem('IQRA_OBE_FALLBACK_DB', JSON.stringify(data));
};

const getHeaders = () => {
  const token = localStorage.getItem('access');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 4000): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export const apiService = {
  async getAllData(): Promise<OBEData> {
    try {
      const [depts, programs, gas, courses] = await Promise.all([
        fetchWithTimeout(`${BASE_URL}/departments/`, { headers: getHeaders() }).then(res => res.json()),
        fetchWithTimeout(`${BASE_URL}/programs/`, { headers: getHeaders() }).then(res => res.json()),
        fetchWithTimeout(`${BASE_URL}/gas/`, { headers: getHeaders() }).then(res => res.json()),
        fetchWithTimeout(`${BASE_URL}/courses/`, { headers: getHeaders() }).then(res => res.json()).catch(() => [])
      ]);

      // If backend replies with malformed details or empty arrays, let's gracefully fall back to local storage
      if (!Array.isArray(depts) || depts.length === 0) {
        throw new Error('Malformed or empty departments returned from backend');
      }

      return {
        departments: depts,
        programs: programs,
        gas: gas,
        courses: Array.isArray(courses) && courses.length > 0 ? courses : getLocalStorageData().courses,
      };
    } catch (err) {
      console.warn("Backend servers offline or unreachable. Propagating error to UI loader.", err);
      throw err;
    }
  },

  async updateDepartment(id: string, data: Partial<Department>): Promise<Department> {
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/departments/${id}/`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(data),
      }, 8000);
      if (!response.ok) throw new Error('Failed to update department on server');
      return response.json();
    } catch (err) {
      console.warn("Saving department changes strictly in client-side storage (mock fallback active).");
      const localData = getLocalStorageData();
      const updatedDepts = localData.departments.map(d => {
        if (d.id === id) {
          return { ...d, ...data };
        }
        return d;
      });
      const updatedLocalData = { ...localData, departments: updatedDepts };
      saveLocalStorageData(updatedLocalData);
      return updatedDepts.find(d => d.id === id)!;
    }
  },

  async updateProgram(id: string, data: Partial<Program>): Promise<Program> {
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/programs/${id}/`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(data),
      }, 8000);
      if (!response.ok) throw new Error('Failed to update program on server');
      return response.json();
    } catch (err) {
      console.warn("Saving program changes strictly in client-side storage (mock fallback active).");
      const localData = getLocalStorageData();
      const updatedPrograms = localData.programs.map(p => {
        if (p.id === id) {
          return { ...p, ...data };
        }
        return p;
      });
      const updatedLocalData = { ...localData, programs: updatedPrograms };
      saveLocalStorageData(updatedLocalData);
      return updatedPrograms.find(p => p.id === id)!;
    }
  },

  // Save Course Mapping (allows updating course to GA tick marks in local storage / server mock fallback!)
  async updateCourse(id: string, data: Partial<Course>): Promise<Course> {
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/courses/${id}/`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(data),
      }, 8000);
      if (response.ok) return response.json();
    } catch (err) {
      // Squelch fetch error and update locally
    }
    const localData = getLocalStorageData();
    const updatedCourses = localData.courses.map(c => {
      if (c.id === id) {
        return { ...c, ...data };
      }
      return c;
    });
    const updatedLocalData = { ...localData, courses: updatedCourses };
    saveLocalStorageData(updatedLocalData);
    return updatedCourses.find(c => c.id === id)!;
  },

  async createProgram(data: Program, associatedGAs?: GA[]): Promise<Program> {
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/programs/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          ...data,
          slug: data.code.toLowerCase()
        }),
      }, 8000);
      if (!response.ok) throw new Error('Failed to create program on server');
      const responseData = await response.json();

      const localData = getLocalStorageData();
      const updatedPrograms = [...localData.programs, responseData];
      const updatedGAs = associatedGAs ? [...localData.gas, ...associatedGAs] : localData.gas;
      saveLocalStorageData({ ...localData, programs: updatedPrograms, gas: updatedGAs });

      return responseData;
    } catch (err) {
      console.warn("Creating program on backend failed or timed out. Falling back to local storage.", err);
      const localData = getLocalStorageData();
      const updatedPrograms = [...localData.programs, data];
      const updatedGAs = associatedGAs ? [...localData.gas, ...associatedGAs] : localData.gas;
      saveLocalStorageData({ ...localData, programs: updatedPrograms, gas: updatedGAs });
      return data;
    }
  },

  async createCourse(data: Course): Promise<Course> {
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/courses/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          ...data,
          slug: data.id
        }),
      }, 8000);
      if (!response.ok) throw new Error('Failed to create course on server');
      const responseData = await response.json();

      const localData = getLocalStorageData();
      const updatedCourses = [...localData.courses, responseData];
      saveLocalStorageData({ ...localData, courses: updatedCourses });

      return responseData;
    } catch (err) {
      console.warn("Creating course on backend failed or timed out. Falling back to local storage.", err);
      const localData = getLocalStorageData();
      const updatedCourses = [...localData.courses, data];
      saveLocalStorageData({ ...localData, courses: updatedCourses });
      return data;
    }
  },

  getLocalInstructorCourses(): InstructorCourse[] {
    return getLocalInstructorCourses();
  },

  getLocalStorageData(): OBEData {
    return getLocalStorageData();
  },

  async getInstructorCourses(): Promise<InstructorCourse[]> {
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/instructor/courses/`, {
        headers: getHeaders(),
      }, 4000);
      if (!response.ok) throw new Error('Failed to fetch instructor courses');
      const data = await response.json();
      if (Array.isArray(data)) return data;
      throw new Error('Malformed instructor courses data received');
    } catch (err) {
      console.warn("Backend API for instructor offline or failed. Propagating error to UI loader.", err);
      throw err;
    }
  },

  async saveInstructorCourses(courses: InstructorCourse[]): Promise<InstructorCourse[]> {
    // Save to local storage first for resilient fallback
    localStorage.setItem('IQRA_OBE_INSTRUCTOR_COURSES', JSON.stringify(courses));
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/instructor/courses/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ courses }),
      }, 8000);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.warn("Saving instructor courses to backend failed, synchronized offline instead.", err);
    }
    return courses;
  }
};

// Pre-populated high-fidelity dummy courses as placeholders if backend is down
const DUMMY_PLAYGROUND_COURSES: InstructorCourse[] = [
  {
    id: "course-demo-1",
    code: "SE-311",
    title: "Software Engineering",
    departmentId: "computing",
    departmentName: "Department of Computing and Technology",
    programId: "bscs",
    programName: "Bachelor of Science in Computer Science (BSCS)",
    creditHours: 3,
    categories: [
      { name: "Assignments", percentage: 15, units: 3 },
      { name: "Quizzes", percentage: 10, units: 3 },
      { name: "Class Participation", percentage: 5, units: 1 },
      { name: "Class Project", percentage: 15, units: 1 },
      { name: "Presentation", percentage: 5, units: 1 },
      { name: "Lab Project", percentage: 0, units: 0 },
      { name: "Problem Based Learning", percentage: 0, units: 0 },
      { name: "Complex Problem", percentage: 0, units: 0 },
      { name: "Other Activities", percentage: 0, units: 0 },
      { name: "Viva", percentage: 0, units: 0 },
      { name: "Lab Performance", percentage: 0, units: 0 },
      { name: "Lab Reports", percentage: 0, units: 0 },
      { name: "Mid Term", percentage: 20, units: 1 },
      { name: "Final", percentage: 30, units: 1 }
    ],
    unitsData: {
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
      "Class Participation": [
        { unitNo: 1, passing: 5, totalMarks: 10, weightage: 100 }
      ],
      "Class Project": [
        { unitNo: 1, passing: 15, totalMarks: 30, weightage: 100 }
      ],
      "Presentation": [
        { unitNo: 1, passing: 5, totalMarks: 10, weightage: 100 }
      ],
      "Mid Term": [
        { unitNo: 1, passing: 15, totalMarks: 30, weightage: 100 }
      ],
      "Final": [
        { unitNo: 1, passing: 20, totalMarks: 40, weightage: 100 }
      ]
    },
    students: [
      {
        regNo: "FA22-BSCS-0012",
        name: "Abdur Rehman Khalid",
        marks: {
          "Assignments-1": 8.5,
          "Assignments-2": 9.0,
          "Assignments-3": 7.5,
          "Quizzes-1": 7.0,
          "Quizzes-2": 8.5,
          "Quizzes-3": 9.0,
          "Class Participation-1": 9.0,
          "Class Project-1": 26.5,
          "Presentation-1": 8.0,
          "Mid Term-1": 24.5,
          "Final-1": 34.0
        }
      },
      {
        regNo: "FA22-BSCS-0045",
        name: "Syeda Fatima Alvi",
        marks: {
          "Assignments-1": 9.0,
          "Assignments-2": 8.0,
          "Assignments-3": 8.5,
          "Quizzes-1": 8.0,
          "Quizzes-2": 7.5,
          "Quizzes-3": 6.5,
          "Class Participation-1": 8.0,
          "Class Project-1": 25.0,
          "Presentation-1": 9.0,
          "Mid Term-1": 22.0,
          "Final-1": 32.5
        }
      },
      {
        regNo: "FA22-BSCS-0089",
        name: "Zayan Ahmed Khan",
        marks: {
          "Assignments-1": 7.5,
          "Assignments-2": 7.0,
          "Assignments-3": 8.0,
          "Quizzes-1": 6.0,
          "Quizzes-2": 5.0,
          "Quizzes-3": 7.0,
          "Class Participation-1": 7.0,
          "Class Project-1": 22.0,
          "Presentation-1": 7.5,
          "Mid Term-1": 19.5,
          "Final-1": 28.0
        }
      }
    ],
    obeQuestions: [],
    obeMarks: {}
  },
  {
    id: "course-demo-2",
    code: "AI-381",
    title: "Artificial Intelligence",
    departmentId: "computing",
    departmentName: "Department of Computing and Technology",
    programId: "bscs",
    programName: "Bachelor of Science in Computer Science (BSCS)",
    creditHours: 3,
    categories: [
      { name: "Assignments", percentage: 10, units: 2 },
      { name: "Quizzes", percentage: 10, units: 2 },
      { name: "Class Participation", percentage: 5, units: 1 },
      { name: "Class Project", percentage: 20, units: 1 },
      { name: "Presentation", percentage: 5, units: 1 },
      { name: "Lab Project", percentage: 0, units: 0 },
      { name: "Problem Based Learning", percentage: 0, units: 0 },
      { name: "Complex Problem", percentage: 0, units: 0 },
      { name: "Other Activities", percentage: 0, units: 0 },
      { name: "Viva", percentage: 0, units: 0 },
      { name: "Lab Performance", percentage: 0, units: 0 },
      { name: "Lab Reports", percentage: 0, units: 0 },
      { name: "Mid Term", percentage: 20, units: 1 },
      { name: "Final", percentage: 30, units: 1 }
    ],
    unitsData: {
      "Assignments": [
        { unitNo: 1, passing: 5, totalMarks: 10, weightage: 50 },
        { unitNo: 2, passing: 5, totalMarks: 10, weightage: 50 }
      ],
      "Quizzes": [
        { unitNo: 1, passing: 5, totalMarks: 10, weightage: 50 },
        { unitNo: 2, passing: 5, totalMarks: 10, weightage: 50 }
      ],
      "Class Participation": [
        { unitNo: 1, passing: 5, totalMarks: 10, weightage: 100 }
      ],
      "Class Project": [
        { unitNo: 1, passing: 15, totalMarks: 30, weightage: 100 }
      ],
      "Presentation": [
        { unitNo: 1, passing: 5, totalMarks: 10, weightage: 100 }
      ],
      "Mid Term": [
        { unitNo: 1, passing: 15, totalMarks: 30, weightage: 100 }
      ],
      "Final": [
        { unitNo: 1, passing: 20, totalMarks: 40, weightage: 100 }
      ]
    },
    students: [
      {
        regNo: "FA22-BSCS-0012",
        name: "Abdur Rehman Khalid",
        marks: {
          "Assignments-1": 9.0,
          "Assignments-2": 8.5,
          "Quizzes-1": 8.0,
          "Quizzes-2": 9.0,
          "Class Participation-1": 9.0,
          "Class Project-1": 27.0,
          "Presentation-1": 8.5,
          "Mid Term-1": 25.0,
          "Final-1": 35.0
        }
      },
      {
        regNo: "FA22-BSCS-0104",
        name: "Misha Farooq",
        marks: {
          "Assignments-1": 8.0,
          "Assignments-2": 8.0,
          "Quizzes-1": 7.0,
          "Quizzes-2": 7.5,
          "Class Participation-1": 8.0,
          "Class Project-1": 24.0,
          "Presentation-1": 8.0,
          "Mid Term-1": 21.0,
          "Final-1": 31.0
        }
      }
    ],
    obeQuestions: [],
    obeMarks: {}
  }
];

const getLocalInstructorCourses = (): InstructorCourse[] => {
  const saved = localStorage.getItem('IQRA_OBE_INSTRUCTOR_COURSES');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(c => c.id !== 'course-1' && c.id !== 'course-2');
      }
    } catch (e) {
      // ignore & use default fallback
    }
  }
  localStorage.setItem('IQRA_OBE_INSTRUCTOR_COURSES', JSON.stringify(DUMMY_PLAYGROUND_COURSES));
  return DUMMY_PLAYGROUND_COURSES;
};
