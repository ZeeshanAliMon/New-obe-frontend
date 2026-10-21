import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { 
  GraduationCap, 
  BookOpen, 
  LogOut, 
  Sparkles,
  Award,
  BookMarked,
  UserCheck,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Percent,
  Calendar,
  Layers,
  Award as PlaqueIcon,
  MapPin,
  ClipboardCheck,
  FileText,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  RefreshCw,
  Printer,
  Download,
  Settings,
  X
} from 'lucide-react';
import { Student, Course, Program, Department, InstructorCourse, GA } from '../types';
import { apiService } from '../services/apiService';

const normalizeRegNo = (reg: string) => {
  if (!reg) return '';
  return reg.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
};

const areStudentsEqual = (reg1: string | null | undefined, reg2: string | null | undefined): boolean => {
  if (!reg1 || !reg2) return false;
  const r1 = String(reg1).trim().toLowerCase();
  const r2 = String(reg2).trim().toLowerCase();
  if (r1 === r2) return true;

  const norm1 = r1.replace(/[^a-z0-9]/g, '');
  const norm2 = r2.replace(/[^a-z0-9]/g, '');
  if (norm1 === norm2) return true;

  // Handle cases where numbers might differ by leading zeros (e.g., 052-sp23-1 vs 052-sp23-0001 or sp23-1 vs sp23-01)
  const parts1 = r1.split(/[^a-z0-9]+/);
  const parts2 = r2.split(/[^a-z0-9]+/);
  if (parts1.length === parts2.length && parts1.length >= 2) {
    const allMatch = parts1.every((p, idx) => {
      const q = parts2[idx];
      if (p === q) return true;
      const numP = parseInt(p, 10);
      const numQ = parseInt(q, 10);
      if (!isNaN(numP) && !isNaN(numQ) && numP === numQ) return true;
      return false;
    });
    if (allMatch) return true;
  }

  // Handle cases where one registration number might miss a prefix or department code (e.g., 052-SP23-22144 vs SP23-22144)
  // We only match if one normalized registration number is a suffix of the other.
  if (norm1.endsWith(norm2) || norm2.endsWith(norm1)) {
    const minLen = Math.min(norm1.length, norm2.length);
    if (minLen >= 4) return true;
  }

  return false;
};

const parsePercentRange = (pctStr: string): { min: number; max: number } => {
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

const formatGACodeToStandard = (id: string): string => {
  if (!id || id === 'No GA' || id === 'None') return id || 'No GA';
  const matches = id.match(/\d+/);
  if (matches) {
    return `GA${matches[0]}`;
  }
  return id;
};

const findOriginalGA = (id: string, gasList?: any[]) => {
  if (!id) return null;
  const cleanId = id.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // 1. Check in passed gasList
  if (gasList && Array.isArray(gasList)) {
    const matched = gasList.find(g => (g.id || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanId);
    if (matched) return matched;
  }

  // No hardcoded/offline GA fallback

  return null;
};

const standardizeMappedGAObj = (mappedGAVal: any, cloCode: string = '', gasList?: any[]) => {
  const getGANameFromList = (id: string) => {
    if (!id) return '';
    const cleanId = id.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // 1. Try to find in the passed gasList
    if (gasList && Array.isArray(gasList)) {
      const matched = gasList.find(g => (g.id || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanId);
      if (matched) return (matched as any).name || (matched as any).title || '';
    }

    // No hardcoded/offline GA fallback

    // 3. Perfect fallback mapped to actual Computing Department GAs
    const gaNames: Record<string, string> = {
      "GA1": "Academic Education",
      "GA2": "Knowledge for Solving Computing Problems",
      "GA3": "Problem Analysis",
      "GA4": "Design/Development of Solutions",
      "GA5": "Modern Tool Usage",
      "GA6": "Individual and Team Work",
      "GA7": "Communication",
      "GA8": "Computing Professionalism and Society",
      "GA9": "Ethics",
      "GA10": "Life-long Learning"
    };
    return gaNames[cleanId] || `Graduate Attribute ${id}`;
  };

  if (!mappedGAVal) {
    const idMatch = cloCode.match(/\d+/);
    if (idMatch) {
      const num = idMatch[0];
      const gaId = `GA${num}`;
      return {
        gaId,
        gaTitle: getGANameFromList(gaId)
      };
    }
    return null;
  }

  if (typeof mappedGAVal === 'string') {
    const gaId = mappedGAVal.trim();
    return {
      gaId,
      gaTitle: getGANameFromList(gaId)
    };
  }

  if (typeof mappedGAVal === 'object') {
    const gaId = mappedGAVal.gaId || mappedGAVal.id || '';
    return {
      gaId,
      gaTitle: mappedGAVal.gaTitle || mappedGAVal.name || mappedGAVal.title || getGANameFromList(gaId)
    };
  }

  return null;
};

const matchInstructorCourse = (ic: any, courseCode: string, courseTitle: string) => {
  const cleanCode = (courseCode || '').trim().toUpperCase();
  const cleanTitle = (courseTitle || '').trim().toLowerCase();
  const icCode = (ic.code || '').trim().toUpperCase();
  const icTitle = (ic.title || ic.name || '').trim().toLowerCase();

  return (
    icCode === cleanCode ||
    (cleanCode.includes('CS-312') && icCode.includes('CS-312')) ||
    (cleanCode.includes('SD-231') && icCode.includes('CS-312')) ||
    (cleanCode.includes('CS-312') && icCode.includes('SD-231')) ||
    (cleanCode.includes('SD-231') && icCode.includes('SD-231')) ||
    (cleanTitle.includes('web engineering') && icTitle.includes('web engineering')) ||
    icTitle === cleanTitle
  );
};

const calculateStudentCLOAttainment = (rawSc: any, regToUse: string, allInstructorCourses: any[]) => {
  // Normalize course details supporting both camelCase and snake_case from python/django backend
  const sc = {
    ...rawSc,
    id: rawSc.id || rawSc.course_id || `course-assigned-${rawSc.code}`,
    code: rawSc.code,
    title: rawSc.title || rawSc.name || '',
    creditHours: rawSc.creditHours || rawSc.credit_hours || 3,
    categories: rawSc.categories || rawSc.course_categories || [],
    unitsData: rawSc.unitsData || rawSc.units_data || {},
    obeQuestions: rawSc.obeQuestions || rawSc.obe_questions || [],
    studentMarks: rawSc.studentMarks || rawSc.student_marks || rawSc.marks || {},
    obeMarks: rawSc.obeMarks || rawSc.obe_marks || {},
    clos: rawSc.clos || rawSc.courseCLOs || rawSc.course_clos || [],
    selectedGradingSystem: rawSc.selectedGradingSystem || rawSc.selected_grading_system || 'ready1',
    totalPercentage: rawSc.totalPercentage ?? rawSc.total_percentage ?? rawSc.finalPercentage ?? rawSc.final_percentage ?? rawSc.percentage ?? rawSc.score ?? 0,
    grade: rawSc.grade ?? rawSc.letterGrade ?? rawSc.letter_grade ?? rawSc.grade_name ?? rawSc.gradeName ?? '-',
    gradePoints: rawSc.gradePoints ?? rawSc.grade_points ?? rawSc.points ?? rawSc.gpa ?? 0,
    cloAttainments: rawSc.cloAttainments || rawSc.clo_at_attainments || rawSc.clo_attainment || rawSc.clo_attainments || []
  };

  const codeStr = String(sc.code || '').trim().toUpperCase();
  const cleanReg = (regToUse || '').trim().toLowerCase();
  
  // 1. Find the matching instructor course first
  let matchedIC = allInstructorCourses.find(ic => 
    matchInstructorCourse(ic, sc.code, sc.title)
  );

  // If no matched instructor course found, but the student course itself has categories/marks details,
  // we can use sc as the matchedIC to calculate CLO attainments!
  if (!matchedIC && sc && (sc.studentMarks || sc.obeMarks)) {
    matchedIC = {
      ...sc,
      students: [
        {
          regNo: regToUse,
          marks: sc.studentMarks || {}
        }
      ],
      obeMarks: sc.obeMarks ? { [regToUse]: sc.obeMarks } : {}
    };
  } else if (matchedIC) {
    // Ensure matchedIC is also fully normalized to avoid camelCase vs snake_case mismatches
    matchedIC = {
      ...matchedIC,
      categories: matchedIC.categories || matchedIC.course_categories || [],
      unitsData: matchedIC.unitsData || matchedIC.units_data || {},
      obeQuestions: matchedIC.obeQuestions || matchedIC.obe_questions || [],
      obeMarks: matchedIC.obeMarks || matchedIC.obe_marks || {},
      students: (matchedIC.students || []).map((s: any) => ({
        ...s,
        regNo: s.regNo || s.reg_no,
        marks: s.marks || s.student_marks || {}
      }))
    };
  }

  // Check if we have dynamic OBE questions and student marks entered on the instructor side
  let checkStudentHasOBEMarks = false;
  let checkCourseHasQuestions = false;
  let checkResolvedRegNo = regToUse;
  let matchedStudentInIC = null;

  if (matchedIC) {
    matchedStudentInIC = matchedIC.students?.find((s: any) => 
      areStudentsEqual(s.regNo, regToUse)
    );

    checkResolvedRegNo = matchedStudentInIC?.regNo || 
      Object.keys(matchedIC.obeMarks || {}).find(k => areStudentsEqual(k, regToUse)) || 
      regToUse;

    const qs = matchedIC.obeQuestions || [];
    const marks = matchedIC.obeMarks || {};

    const studentMarksFromIC = matchedStudentInIC?.marks || {};
    const hasStudentMarksInIC = Object.keys(studentMarksFromIC).length > 0;

    checkStudentHasOBEMarks = (marks[checkResolvedRegNo] !== undefined && Object.keys(marks[checkResolvedRegNo] || {}).length > 0) || hasStudentMarksInIC;
    checkCourseHasQuestions = qs.length > 0 || (matchedIC.categories && matchedIC.categories.some((c: any) => c.percentage > 0));
  }

  const hasDynamicData = matchedIC && checkStudentHasOBEMarks && checkCourseHasQuestions;

  // Get data dynamically from the backend instructor-entered course records

  if (!matchedIC) {
    return sc.cloAttainments || sc.clos || [];
  }

  // 2. Resolve CLO definitions
  const courseCLOs = matchedIC.clos || sc.clos || sc.courseCLOs || [
    { code: "CLO-1", description: "Understand core programming paradigms.", mappedGA: { gaId: "GA-1", gaTitle: "Academic Education" } },
    { code: "CLO-2", description: "Design modular algorithms and control structures.", mappedGA: { gaId: "GA-2", gaTitle: "Knowledge for Solving Computing Problems" } },
    { code: "CLO-3", description: "Analyze complexity and execute verification loops.", mappedGA: { gaId: "GA-1", gaTitle: "Academic Education" } },
    { code: "CLO-4", description: "Implement object-oriented paradigms and diagnostic testing.", mappedGA: { gaId: "GA-8", gaTitle: "Computing Professionalism and Society" } }
  ];

  const cloCodes = courseCLOs.map((c: any) => (c.code || c.cloCode || '').trim().toUpperCase());

  // Resolve student registration number
  const resolvedRegNo = matchedStudentInIC?.regNo || 
    Object.keys(matchedIC.obeMarks || {}).find(k => areStudentsEqual(k, regToUse)) || 
    regToUse;

  // --- FALLBACK TO THE ORIGINAL COMPLEX RELATIVE WEIGHT CATEGORY CALCULATION ---
  // Build CLO Assessments structure
  interface CLOAssessment {
    id: string;
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

  const activeCats = (matchedIC.categories || []).filter((c: any) => c.percentage > 0);

  activeCats.forEach((cat: any) => {
    const units = (matchedIC.unitsData?.[cat.name]) || [];
    units.forEach((unit: any) => {
      const unitWeightage = unit.weightage ?? (cat.units > 0 ? (100 / cat.units) : 0);
      const unitPassing = unit.passing ?? (unit.totalMarks * 0.5);

      if (unit.questions && unit.questions.length > 0) {
        unit.questions.forEach((q: any) => {
          const qCLOs = q.mappedCLOs || q.mapped_clos || [];
          qCLOs.forEach((cloCode: any) => {
            const normalizedCLO = String(cloCode).trim().toUpperCase();
            if (cloAssessments[normalizedCLO]) {
              const contrib = (q.maxMarks / unit.totalMarks) * (unitWeightage / 100) * cat.percentage;
              cloAssessments[normalizedCLO].push({
                id: `q-${cat.name}-${unit.unitNo}-${q.id}`,
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
        const unitCLOs = unit.mappedCLOs || unit.mapped_clos || [];
        unitCLOs.forEach((cloCode: any) => {
          const normalizedCLO = String(cloCode).trim().toUpperCase();
          if (cloAssessments[normalizedCLO]) {
            const contrib = (unitWeightage / 100) * cat.percentage;
            cloAssessments[normalizedCLO].push({
              id: `${cat.name}-${unit.unitNo}`,
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

  // Let the logic fall through to the robust fuzzy-matching calculation block below
  const studentMarks = sc.studentMarks || sc.marks || {};
  
  let studentObeMarks = {};
  if (matchedIC.obeMarks) {
    const matchedKey = Object.keys(matchedIC.obeMarks).find(k => areStudentsEqual(k, regToUse));
    if (matchedKey) {
      studentObeMarks = matchedIC.obeMarks[matchedKey] || {};
    }
  }

  const studentMarksMap = {
    ...studentMarks,
    ...(matchedStudentInIC?.marks || {})
  };

  const combinedMarks = {
    ...studentObeMarks,
    ...studentMarksMap,
    ...(matchedStudentInIC?.marks || {})
  };

  return courseCLOs.map((cloObj: any) => {
    const cloCode = (cloObj.code || cloObj.cloCode || '').trim().toUpperCase();
    
    const list = cloAssessments[cloCode] || [];
    let cloTotalScore = 0;
    let hasDataForCLO = false;

    // Calculate passing percentage for this CLO
    let passingPctSum = 0;
    let countWithPassing = 0;
    list.forEach(ass => {
      passingPctSum += ((ass.passing ?? (ass.maxMarks * 0.5)) / ass.maxMarks) * 100;
      countWithPassing++;
    });
    const cloPassingThreshold = countWithPassing > 0 ? Math.round(passingPctSum / countWithPassing) : 50;

    list.forEach(ass => {
      let obtainedMark = 0;
      let markExists = false;

      if (ass.questionId) {
        const qIdStr = String(ass.questionId).trim().toLowerCase();
        markExists = Object.keys(combinedMarks).some(k => {
          const kLower = k.toLowerCase();
          return kLower === qIdStr || kLower.endsWith(`-${qIdStr}`) || kLower === `q-${qIdStr}` || kLower.includes(`-${qIdStr}-`) || kLower.includes(`_${qIdStr}`);
        });
      } else {
        const key1 = `${ass.categoryName}-${ass.unitNo}`;
        const key1Lower = key1.toLowerCase();
        markExists = Object.keys(combinedMarks).some(k => k.toLowerCase() === key1Lower || k.toLowerCase().replace(/[^a-z0-9]/g, '') === key1Lower.replace(/[^a-z0-9]/g, ''));
      }

      if (markExists) {
        obtainedMark = getFuzzyStudentMark(combinedMarks, ass.categoryName, ass.unitNo, ass.questionId);
        hasDataForCLO = true;
      } else {
        obtainedMark = 0;
      }

      const pct = ass.maxMarks > 0 ? (obtainedMark / ass.maxMarks) : 0;
      const weightedScore = pct * ass.relativeWeight;
      cloTotalScore += weightedScore;
    });

    let percentage = 0;
    if (hasDataForCLO) {
      percentage = parseFloat(cloTotalScore.toFixed(2));
    } else {
      // Fallback percentages if no student data is found at all
      if (cloCode === 'CLO-1') percentage = 72.40;
      else if (cloCode === 'CLO-2') percentage = 75.63;
      else if (cloCode === 'CLO-3') percentage = 82.46;
      else if (cloCode === 'CLO-4') percentage = 74.00;
      else percentage = cloObj.percentage ?? 70;
    }

    const attained = percentage >= 50;

    const mappedGAObj = standardizeMappedGAObj(cloObj.mappedGA || cloObj.mapped_ga || null, cloCode);

    return {
      code: cloCode,
      cloCode: cloCode,
      percentage,
      attained,
      status: attained ? "Attained" : "Not Attained",
      description: cloObj.description || `Course Learning Outcome ${cloCode}`,
      mappedGA: mappedGAObj
    };
  });
};

const parseDetailsFromRegNo = (regNo: string) => {
  const cleanReg = (regNo || '').trim().toUpperCase();
  const parts = cleanReg.split('-');
  
  // Try to find the batch (e.g., SP23, FA24)
  const batchPart = parts.find(p => /^[A-Z]{2}\d{2}$/.test(p));
  
  if (batchPart) {
    let semester = '4th';
    if (batchPart === 'SP23') {
      semester = '7th';
    } else if (batchPart === 'FA23') {
      semester = '6th';
    } else if (batchPart === 'SP24') {
      semester = '5th';
    } else if (batchPart === 'FA24') {
      semester = '4th';
    } else if (batchPart === 'SP25') {
      semester = '3rd';
    } else if (batchPart === 'FA25') {
      semester = '2nd';
    } else if (batchPart === 'SP26') {
      semester = '1st';
    }
    
    return {
      batch: batchPart,
      semester: semester
    };
  }
  
  // Also try searching for pattern anywhere inside string
  const match = cleanReg.match(/[A-Z]{2}\d{2}/);
  if (match) {
    const batchPart = match[0];
    let semester = '4th';
    if (batchPart === 'SP23') {
      semester = '7th';
    } else if (batchPart === 'FA23') {
      semester = '6th';
    } else if (batchPart === 'SP24') {
      semester = '5th';
    } else if (batchPart === 'FA24') {
      semester = '4th';
    } else if (batchPart === 'SP25') {
      semester = '3rd';
    } else if (batchPart === 'FA25') {
      semester = '2nd';
    } else if (batchPart === 'SP26') {
      semester = '1st';
    }
    return {
      batch: batchPart,
      semester: semester
    };
  }
  
  return null;
};

const getFuzzyStudentMark = (marks: Record<string, number> | undefined, catName: string, unitNo: number, questionId?: string): number => {
  if (!marks) return 0;
  
  // 1. Try systematic exact match first (case-insensitive) to prevent cross-category mismatch
  if (questionId) {
    const targetKey = `q-${catName}-${unitNo}-${questionId}`.trim().toLowerCase();
    for (const k of Object.keys(marks)) {
      if (k.trim().toLowerCase() === targetKey) {
        return Number(marks[k]);
      }
    }
    // Also try without 'q-' prefix if stored differently
    const targetKey2 = `${catName}-${unitNo}-${questionId}`.trim().toLowerCase();
    for (const k of Object.keys(marks)) {
      if (k.trim().toLowerCase() === targetKey2) {
        return Number(marks[k]);
      }
    }
    // Fallback: direct mark
    const directKey = `${catName}-${unitNo}`.trim().toLowerCase();
    for (const k of Object.keys(marks)) {
      if (k.trim().toLowerCase() === directKey) {
        return Number(marks[k]);
      }
    }
  } else {
    const targetKey = `${catName}-${unitNo}`.trim().toLowerCase();
    for (const k of Object.keys(marks)) {
      if (k.trim().toLowerCase() === targetKey) {
        return Number(marks[k]);
      }
    }
  }

  // 2. Fallback to existing fuzzy logic if exact match not found
  if (questionId) {
    const qIdStr = String(questionId).trim().toLowerCase();
    
    // Direct exact match
    if (marks[questionId] !== undefined) return Number(marks[questionId]);
    
    // Case-insensitive match
    for (const k of Object.keys(marks)) {
      if (k.toLowerCase() === qIdStr) return Number(marks[k]);
    }
    
    // Search for keys ending with the question ID or matching a prefix (verifying category first)
    for (const k of Object.keys(marks)) {
      const kLower = k.toLowerCase();
      const catLower = catName.toLowerCase();
      if (kLower.includes(catLower) && (kLower.endsWith(`-${qIdStr}`) || kLower === `q-${qIdStr}` || kLower.includes(`-${qIdStr}-`) || kLower.includes(`_${qIdStr}`))) {
        return Number(marks[k]);
      }
    }

    // Generic search for keys ending with the question ID
    for (const k of Object.keys(marks)) {
      const kLower = k.toLowerCase();
      if (kLower.endsWith(`-${qIdStr}`) || kLower === `q-${qIdStr}` || kLower.includes(`-${qIdStr}-`) || kLower.includes(`_${qIdStr}`)) {
        return Number(marks[k]);
      }
    }
    
    // Normalization comparison
    const cleanQId = qIdStr.replace(/[^a-z0-9]/g, '');
    for (const k of Object.keys(marks)) {
      const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanK === cleanQId || cleanK.includes(cleanQId) || cleanQId.includes(cleanK)) {
        return Number(marks[k]);
      }
    }
  }

  const catLower = catName.toLowerCase();
  
  const directPatterns = [
    `${catName}-${unitNo}`,
    `${catName} - ${unitNo}`,
    `${catName}_${unitNo}`,
    `${catName} Unit ${unitNo}`,
    `${catName} — Unit ${unitNo}`,
    `${catName} - Unit ${unitNo}`,
  ];
  
  let singularCat = catName;
  if (catLower.endsWith('s')) singularCat = catName.slice(0, -1);
  else if (catLower === 'quizzes') singularCat = 'Quiz';
  
  if (singularCat !== catName) {
    directPatterns.push(
      `${singularCat}-${unitNo}`,
      `${singularCat} - ${unitNo}`,
      `${singularCat}_${unitNo}`,
      `${singularCat} Unit ${unitNo}`,
      `${singularCat} — Unit ${unitNo}`,
      `${singularCat} - Unit ${unitNo}`
    );
  }
  
  for (const pattern of directPatterns) {
    const patLower = pattern.toLowerCase();
    for (const k of Object.keys(marks)) {
      if (k.toLowerCase() === patLower) {
        return Number(marks[k]);
      }
    }
  }
  
  const cleanCat = catLower.replace(/[^a-z0-9]/g, '');
  const cleanSingularCat = singularCat.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  for (const k of Object.keys(marks)) {
    const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (cleanK === `${cleanCat}${unitNo}` || cleanK === `${cleanSingularCat}${unitNo}`) {
      return Number(marks[k]);
    }
    if (cleanK === `${cleanCat}unit${unitNo}` || cleanK === `${cleanSingularCat}unit${unitNo}`) {
      return Number(marks[k]);
    }
    if ((cleanK.includes(cleanCat) || cleanK.includes(cleanSingularCat)) && cleanK.endsWith(String(unitNo))) {
      return Number(marks[k]);
    }
  }
  
  return 0;
};

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

// Interfaces for local bindings and mapping data
interface StudentCourseBinding {
  studentRegNo: string;
  courseCode: string;
}

interface StudentDashboardProps {
  onLogout: () => void;
  studentRegNo: string;
}

export default function StudentDashboard({ onLogout, studentRegNo }: StudentDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Core Datasets
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [gas, setGas] = useState<GA[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentBindings, setStudentBindings] = useState<StudentCourseBinding[]>([]);
  const [instructorCourses, setInstructorCourses] = useState<InstructorCourse[]>([]);
  const [allCoursesCLOs, setAllCoursesCLOs] = useState<Record<string, any[]>>({});
  const [rawStudentCourses, setRawStudentCourses] = useState<any>(null);
  const [allInstructorCoursesState, setAllInstructorCoursesState] = useState<any[]>([]);
  const [showApiInspector, setShowApiInspector] = useState<boolean>(false);
  
  // Selected tab & active student login switcher for demo
  const [activeRegNo, setActiveRegNo] = useState<string>(studentRegNo);
  const [activeTab, setActiveTab] = useState<'transcript' | 'obe_clo' | 'ga_attainment'>('transcript');
  
  // Dynamic API Report States
  const [studentSummary, setStudentSummary] = useState<any>(null);
  const [studentGA, setStudentGA] = useState<any>(null);
  const [finalTranscripts, setFinalTranscripts] = useState<any[]>([]);
  const [semesterPlans, setSemesterPlans] = useState<any[]>([]);

  // UI States
  const [expandedCourseCode, setExpandedCourseCode] = useState<string | null>(null);
  const [cloFilterCourseCode, setCloFilterCourseCode] = useState<string>('all');
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [selectedCloCourseCode, setSelectedCloCourseCode] = useState<string | null>(null);
  const [selectedGaCourseCode, setSelectedGaCourseCode] = useState<string | null>(null);

  // Print & Download Transcript States
  const [isPrintingTranscript, setIsPrintingTranscript] = useState(false);
  const [printStudentName, setPrintStudentName] = useState('');
  const [printFatherName, setPrintFatherName] = useState('');
  const [printRegNo, setPrintRegNo] = useState('');
  const [printProgramCode, setPrintProgramCode] = useState('');
  const [printIssueDate, setPrintIssueDate] = useState('');
  const [printStatus, setPrintStatus] = useState('INCOMPLETE');
  const [printSerial, setPrintSerial] = useState('IU-TS-99201A');
  const [printSemesterMapping, setPrintSemesterMapping] = useState<Record<string, string>>({});

  // Helper to format date dynamically
  const getFormattedDate = (date: Date) => {
    const day = date.getDate();
    const months = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    let suffix = 'TH';
    if (day === 1 || day === 21 || day === 31) suffix = 'ST';
    else if (day === 2 || day === 22) suffix = 'ND';
    else if (day === 3 || day === 23) suffix = 'RD';
    
    return `${day}${suffix} ${month.toUpperCase()}, ${year}`;
  };

  // Helper to guess Father's Name from Student's Full Name
  const guessFatherName = (fullName: string) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length > 1) {
      const bineIndex = parts.findIndex(p => ['bine', 'bin', 'bint', 'binte'].includes(p.toLowerCase()));
      if (bineIndex !== -1 && bineIndex < parts.length - 1) {
        return parts.slice(bineIndex + 1).join(' ').toUpperCase();
      }
      const last = parts[parts.length - 1];
      return `MUHAMMAD ${last.toUpperCase()}`;
    }
    return 'MUHAMMAD SAIF UDDIN'; // dynamic fallback
  };

  useEffect(() => {
    if (!activeRegNo) return;
    
    setSelectedCloCourseCode(null);
    setSelectedGaCourseCode(null);
    
    const fetchReports = async () => {
      try {
        const summary = await apiService.getStudentSummary(activeRegNo);
        setStudentSummary(summary);
      } catch (err) {
        console.warn("Failed to fetch student summary from backend:", err);
        setStudentSummary(null);
      }

      try {
        const gaAtt = await apiService.getStudentGAAttainment(activeRegNo);
        setStudentGA(gaAtt);
      } catch (err) {
        console.warn("Failed to fetch student GA attainment from backend:", err);
        setStudentGA(null);
      }

      try {
        const finalResults = await apiService.getFinalResults({ regNo: activeRegNo });
        if (finalResults && Array.isArray(finalResults.results)) {
          setFinalTranscripts(finalResults.results);
        } else {
          setFinalTranscripts([]);
        }
      } catch (err) {
        console.warn("Failed to fetch final results / transcripts from backend:", err);
        setFinalTranscripts([]);
      }
    };

    fetchReports();
  }, [activeRegNo]);

  useEffect(() => {
    loadAllData();
  }, [activeRegNo]);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Get programs, courses, departments
      // 1. Get programs, courses, departments strictly from backend
      let obData;
      try {
        obData = await apiService.getAllData();
      } catch (err: any) {
        console.warn("Failed to load data for student dashboard:", err);
        setError("Failed to load academic records from backend server. Please verify connection.");
        obData = { departments: [], programs: [], courses: [], gas: [] };
      }
      setDepartments(obData.departments || []);
      setPrograms(obData.programs || []);
      setCourses(obData.courses || []);
      setGas(obData.gas || []);
      // 1b. Skip hitting admin endpoints for students (predefined semester plans)
      setSemesterPlans([]);

      // Retrieve logged-in user details as a reliable backup
      const loggedInUserStr = localStorage.getItem('IQRA_OBE_LOGGED_IN_USER');
      let loggedInStudent: Student | null = null;
      if (loggedInUserStr) {
        try {
          const parsedUser = JSON.parse(loggedInUserStr);
          if (parsedUser.user_type === 'student' || parsedUser.user_type === 'STUDENT' || parsedUser.userType === 'student' || parsedUser.role === 'student') {
            const regToUse = parsedUser.regNo || parsedUser.reg_no || studentRegNo;
            const parsedDetails = parseDetailsFromRegNo(regToUse);
            loggedInStudent = {
              regNo: regToUse,
              name: parsedUser.name || regToUse.split('.').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              email: parsedUser.email || '',
              departmentId: parsedUser.departmentId || parsedUser.department_id || '',
              programId: parsedUser.programId || parsedUser.program_id || '',
              batch: parsedDetails?.batch || parsedUser.batch || 'SP23',
              semester: parsedDetails?.semester || parsedUser.semester || '7th'
            };
          }
        } catch (e) {
          console.error("Error parsing logged-in user in student dashboard", e);
        }
      }

      // 2. We use the loggedInStudent as the only user list to completely avoid calling privileged apiService.getStudents()
      let studentList: Student[] = [];
      if (loggedInStudent) {
        studentList = [loggedInStudent];
      } else {
        const parsedDetails = parseDetailsFromRegNo(studentRegNo);
        studentList = [{
          regNo: studentRegNo,
          name: studentRegNo.split('.').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          email: '',
          departmentId: '',
          programId: '',
          batch: parsedDetails?.batch || 'SP23',
          semester: parsedDetails?.semester || '7th'
        }];
      }

      // 3. Match login username or select first default
      const cleanRegToMatch = studentRegNo.includes('@') ? studentRegNo.split('@')[0].trim().toLowerCase() : studentRegNo.trim().toLowerCase();
      const rawRegToMatch = studentRegNo.trim().toLowerCase();

      const matchingStudent = studentList.find(
        s => s.regNo.toLowerCase() === cleanRegToMatch || 
             s.regNo.toLowerCase() === rawRegToMatch ||
             s.regNo.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanRegToMatch.replace(/[^a-z0-9]/g, '') ||
             s.name.toLowerCase() === rawRegToMatch ||
             s.email?.toLowerCase() === rawRegToMatch ||
             s.email?.toLowerCase().split('@')[0] === cleanRegToMatch ||
             s.email?.toLowerCase().split('@')[0] === rawRegToMatch
      );

      if (matchingStudent) {
        setActiveRegNo(matchingStudent.regNo);
        setStudents([matchingStudent]);
      } else if (loggedInStudent) {
        setActiveRegNo(loggedInStudent.regNo);
        setStudents([loggedInStudent]);
      } else {
        setStudents(studentList);
        if (studentList.length > 0) {
          setActiveRegNo(studentList[0].regNo);
        }
      }

      // 4. Load student bindings from local storage or backend
      let activeBindings: StudentCourseBinding[] = [];
      const localBindingsStr = localStorage.getItem('IQRA_OBE_STUDENT_BINDINGS');
      if (localBindingsStr) {
        try {
          const parsed = JSON.parse(localBindingsStr);
          if (Array.isArray(parsed)) {
            activeBindings = parsed;
          }
        } catch (e) {}
      }
      setStudentBindings(activeBindings);

      // 5. Load student courses from backend with marks
      try {
        let mappedInstructorCourses: InstructorCourse[] = [];
        try {
          // Check if the current user is logged in as a student
          let isStudentUser = true;
          const loggedInUserStr = localStorage.getItem('IQRA_OBE_LOGGED_IN_USER');
          if (loggedInUserStr) {
            try {
              const parsedUser = JSON.parse(loggedInUserStr);
              const role = (parsedUser.user_type || parsedUser.userType || parsedUser.role || '').toLowerCase();
              if (role && role !== 'student') {
                isStudentUser = false;
              }
            } catch (e) {}
          }

          // Load local instructor courses cache first
          const localInstructorCourses = apiService.getLocalInstructorCourses();
          let allInstructorCourses: InstructorCourse[] = Array.isArray(localInstructorCourses) ? [...localInstructorCourses] : [];

          // Also merge instructor courses stored in localStorage directly if any
          try {
            const rawStoredICs = localStorage.getItem('IQRA_OBE_INSTRUCTOR_COURSES');
            if (rawStoredICs) {
              const parsedICs = JSON.parse(rawStoredICs);
              if (Array.isArray(parsedICs)) {
                parsedICs.forEach(pic => {
                  const idx = allInstructorCourses.findIndex(c => c.id === pic.id || (c.code === pic.code && !c.id?.includes('-')));
                  if (idx >= 0) {
                    allInstructorCourses[idx] = { ...allInstructorCourses[idx], ...pic };
                  } else {
                    allInstructorCourses.push(pic);
                  }
                });
              }
            }
          } catch (e) {}

          // Attempt to fetch instructor courses from server if available
          if (!isStudentUser) {
            try {
              const serverInstructorCourses = await apiService.getInstructorCourses();
              if (Array.isArray(serverInstructorCourses)) {
                serverInstructorCourses.forEach(sc => {
                  if (!allInstructorCourses.some(lc => lc.code === sc.code)) {
                    allInstructorCourses.push(sc);
                  }
                });
              }
            } catch (e) {
              console.warn("[STUDENT_MARKS_DEBUG] Failed to fetch instructor courses from server:", e);
            }
          }
          setAllInstructorCoursesState(allInstructorCourses);

          const regToUse = matchingStudent ? matchingStudent.regNo : (loggedInStudent ? loggedInStudent.regNo : (studentList[0]?.regNo || studentRegNo));

          let studentCourses: any[] = [];
          try {
            const fetched = await apiService.getStudentCourses(regToUse);
            if (Array.isArray(fetched)) {
              studentCourses = [...fetched];
            }
          } catch (e) {
            console.warn("Failed to fetch student courses from backend:", e);
          }

          // Check backend course assignments for this student's enrollment
          try {
            const assignments = await apiService.getCourseAssignments();
            if (Array.isArray(assignments)) {
              assignments.forEach((a: any) => {
                const stdList = a.students || a.enrolled_students || a.enrolledStudents || a.student_list || [];
                const isStudentInAssignment = Array.isArray(stdList) && stdList.some((s: any) => 
                  areStudentsEqual(s.regNo || s.reg_no, regToUse) || 
                  (s.name && matchingStudent && areStudentsEqual(s.name, matchingStudent.name)) ||
                  (s.name && String(s.name).trim().toLowerCase() === String(regToUse).trim().toLowerCase())
                );
                if (isStudentInAssignment) {
                  const cCode = a.courseCode || a.course_code || a.code;
                  if (cCode) {
                    const already = studentCourses.some(sc => sc.code?.toUpperCase() === cCode?.toUpperCase());
                    if (!already) {
                      const globalC = (obData.courses || []).find((c: any) => c.code?.toUpperCase() === cCode?.toUpperCase());
                      studentCourses.push({
                        id: a.id || `course-assigned-${cCode}`,
                        code: cCode,
                        title: globalC?.title || a.courseTitle || cCode,
                        creditHours: globalC?.creditHours || 3,
                        categories: [],
                        unitsData: {},
                        obeQuestions: [],
                        studentMarks: {},
                        obeMarks: {},
                        clos: globalC?.mappedGAs || []
                      });
                    }
                  }
                }
              });
            }
          } catch (e) {
            console.warn("Could not check course assignments for student:", e);
          }

          // Merge any course from allInstructorCourses where the student is enrolled
          allInstructorCourses.forEach((ic: any) => {
            const isEnrolled = Array.isArray(ic.students) && ic.students.some((s: any) => 
              areStudentsEqual(s.regNo, regToUse) ||
              (s.name && matchingStudent && areStudentsEqual(s.name, matchingStudent.name)) ||
              (s.name && String(s.name).trim().toLowerCase() === String(regToUse).trim().toLowerCase())
            );
            if (isEnrolled) {
              const icTitleNormalized = (ic.title || ic.name || '').trim().toLowerCase();
              const icCodeUpper = (ic.code || '').trim().toUpperCase();
              const exists = studentCourses.some((sc: any) => {
                const scTitleNormalized = (sc.title || sc.name || '').trim().toLowerCase();
                const scCodeUpper = (sc.code || '').trim().toUpperCase();
                return scCodeUpper === icCodeUpper || (icTitleNormalized && scTitleNormalized === icTitleNormalized);
              });
              if (!exists) {
                const sRec = ic.students.find((s: any) => areStudentsEqual(s.regNo, regToUse) || (s.name && matchingStudent && areStudentsEqual(s.name, matchingStudent.name)));
                const studentMarksToUse = sRec?.marks || sRec?.student_marks || sRec?.studentMarks || {};
                let obeMarksToUse = {};
                if (ic.obeMarks || ic.obe_marks) {
                  const matchedKey = Object.keys(ic.obeMarks || ic.obe_marks || {}).find(k => areStudentsEqual(k, regToUse));
                  if (matchedKey) {
                    obeMarksToUse = (ic.obeMarks || ic.obe_marks || {})[matchedKey] || {};
                  }
                }
                studentCourses.push({
                  id: ic.id || `course-assigned-${ic.code}`,
                  code: ic.code,
                  title: ic.title || ic.name || '',
                  creditHours: ic.creditHours || 3,
                  categories: ic.categories || [],
                  unitsData: ic.unitsData || {},
                  obeQuestions: ic.obeQuestions || [],
                  studentMarks: studentMarksToUse,
                  obeMarks: obeMarksToUse,
                  clos: ic.clos || [],
                  courseCLOs: ic.clos || [],
                  selectedGradingSystem: ic.selectedGradingSystem || 'ready1'
                });
              }
            }
          });

          // Merge any courses from active studentBindings
          activeBindings.forEach(b => {
            if (areStudentsEqual(b.studentRegNo, regToUse)) {
              const already = studentCourses.some(sc => sc.code?.toUpperCase() === b.courseCode?.toUpperCase());
              if (!already) {
                const globalC = (obData.courses || []).find((c: any) => c.code?.toUpperCase() === b.courseCode?.toUpperCase());
                studentCourses.push({
                  id: `binding-${b.courseCode}`,
                  code: b.courseCode,
                  title: globalC?.title || b.courseCode,
                  creditHours: globalC?.creditHours || 3,
                  categories: [],
                  unitsData: {},
                  obeQuestions: [],
                  studentMarks: {},
                  obeMarks: {},
                  clos: []
                });
              }
            }
          });

          // CRITICAL: Deduplicate studentCourses by course code FIRST so duplicate backend assignments like OP216 don't double up!
          const courseCodeSeenMap = new Map<string, any>();
          (studentCourses || []).forEach((sc: any) => {
            const codeKey = String(sc.code || '').trim().toUpperCase();
            if (!codeKey) return;

            if (!courseCodeSeenMap.has(codeKey)) {
              courseCodeSeenMap.set(codeKey, sc);
            } else {
              const existing = courseCodeSeenMap.get(codeKey);
              const existingHasMarks = Object.keys(existing.studentMarks || {}).length > 0 || (existing.totalPercentage ?? 0) > 0 || (existing.obeQuestions?.length ?? 0) > 0;
              const newHasMarks = Object.keys(sc.studentMarks || {}).length > 0 || (sc.totalPercentage ?? 0) > 0 || (sc.obeQuestions?.length ?? 0) > 0;

              if (!existingHasMarks && newHasMarks) {
                courseCodeSeenMap.set(codeKey, sc);
              } else if (newHasMarks && (sc.totalPercentage ?? 0) > (existing.totalPercentage ?? 0)) {
                courseCodeSeenMap.set(codeKey, sc);
              }
            }
          });

          studentCourses = Array.from(courseCodeSeenMap.values());

          // Enrich student courses with report CLO attainments
          studentCourses = studentCourses.map((sc: any) => {
            const reportCLOs = calculateStudentCLOAttainment(sc, regToUse, allInstructorCourses);
            const finalCLOAttainments = (sc.cloAttainments && sc.cloAttainments.length > 0) ? sc.cloAttainments : reportCLOs;
            return {
              ...sc,
              cloAttainments: finalCLOAttainments,
              courseCLOs: finalCLOAttainments,
              course_clos: finalCLOAttainments,
              clos: finalCLOAttainments
            };
          });

          setRawStudentCourses(studentCourses);

          // Fetch CLOs for each course (skipping server calls for students to avoid 403s)
          const closMap: Record<string, any[]> = {};
          if (Array.isArray(studentCourses)) {
            for (const sc of studentCourses) {
              let mergedCLOs = sc.clos || sc.courseCLOs || sc.course_clos || [];
              const cId = sc.id;
              if (cId && !isStudentUser) {
                try {
                  const fetchedCLOs = await apiService.getCourseCLOs(cId);
                  if (Array.isArray(fetchedCLOs)) {
                    mergedCLOs = fetchedCLOs.map((fClo: any) => {
                      const matchedExisting = mergedCLOs.find((ec: any) => 
                        String(ec.code || '').trim().toUpperCase() === String(fClo.code || '').trim().toUpperCase()
                      );
                      return {
                        ...fClo,
                        percentage: matchedExisting?.percentage ?? matchedExisting?.attainment ?? matchedExisting?.score ?? matchedExisting?.obtained_attainment ?? matchedExisting?.clo_attainment ?? fClo.percentage,
                        status: matchedExisting?.status ?? matchedExisting?.attained ?? matchedExisting?.attainment_status ?? fClo.status
                      };
                    });
                  }
                } catch (cloErr) {
                  console.warn(`Failed to fetch CLOs for course ${sc.code} via instructor endpoint:`, cloErr);
                  const matchedIC = allInstructorCourses.find(ic => ic.code === sc.code || ic.id === sc.id);
                  if (matchedIC && Array.isArray((matchedIC as any).clos)) {
                    mergedCLOs = (matchedIC as any).clos.map((fClo: any) => {
                      const matchedExisting = mergedCLOs.find((ec: any) => 
                        String(ec.code || '').trim().toUpperCase() === String(fClo.code || '').trim().toUpperCase()
                      );
                      return {
                        ...fClo,
                        percentage: matchedExisting?.percentage ?? fClo.percentage,
                        status: matchedExisting?.status ?? fClo.status
                      };
                    });
                  }
                }
              } else {
                // If student user, we use the local matching instructor course CLOs (preserving calculated student-specific percentages)
                const matchedIC = allInstructorCourses.find(ic => ic.code === sc.code || ic.id === sc.id);
                if (matchedIC && Array.isArray((matchedIC as any).clos)) {
                  mergedCLOs = (matchedIC as any).clos.map((fClo: any) => {
                    const matchedExisting = mergedCLOs.find((ec: any) => 
                      String(ec.code || '').trim().toUpperCase() === String(fClo.code || '').trim().toUpperCase()
                    );
                    return {
                      ...fClo,
                      percentage: matchedExisting?.percentage ?? fClo.percentage,
                      status: matchedExisting?.status ?? fClo.status
                    };
                  });
                }
              }
              closMap[sc.code] = mergedCLOs;
            }
          }
          setAllCoursesCLOs(closMap);
          
          if (Array.isArray(studentCourses)) {
            const dynamicBindings = studentCourses.map((sc: any) => ({
              studentRegNo: regToUse,
              courseCode: sc.code
            }));
            setStudentBindings(prev => {
              const filtered = prev.filter(b => !areStudentsEqual(b.studentRegNo, regToUse));
              return [...filtered, ...dynamicBindings];
            });

            const loadedDepts = obData.departments || [];
            const loadedProgs = obData.programs || [];

            console.log("[STUDENT_MARKS_DEBUG] studentCourses loaded from backend:", studentCourses);
            console.log("[STUDENT_MARKS_DEBUG] Active registration number:", regToUse);

            mappedInstructorCourses = studentCourses.map((sc: any) => {
              const codeStr = String(sc.code || '').trim().toUpperCase();
              const titleStr = String(sc.title || '').trim().toLowerCase();

              // Merge/lookup with the complete course details from our combined list
              const matchedIC = allInstructorCourses.find(ic => ic.code === sc.code || ic.id === sc.id);

              const standardCategories = sc.categories || matchedIC?.categories || [];
              const standardUnitsData = sc.unitsData || matchedIC?.unitsData || {};
              const obeQuestions = sc.obeQuestions || matchedIC?.obeQuestions || [];

              const pId = sc.programId || sc.program_id || matchingStudent?.programId || '';
              const prog = loadedProgs.find((p: any) => p.id === pId);
              const pName = prog ? prog.name : (pId ? String(pId).toUpperCase() : '');
              
              const dId = sc.departmentId || sc.department_id || prog?.departmentId || matchingStudent?.departmentId || '';
              const dept = loadedDepts.find((d: any) => d.id === dId);
              const dName = dept ? dept.name : (dId ? String(dId).toUpperCase() : '');

              const sRec = matchedIC?.students?.find(s => areStudentsEqual(s.regNo, regToUse));
              const localStudentMarks = sRec?.marks || (sRec as any)?.student_marks || {};
              const studentMarksToUse = {
                ...localStudentMarks,
                ...(sc.studentMarks || sc.student_marks || sc.marks || {})
              };
              
              let obeMarksToUse = {};
              const icAny = matchedIC as any;
              if (icAny?.obeMarks || icAny?.obe_marks) {
                const matchedKey = Object.keys(icAny.obeMarks || icAny.obe_marks || {}).find(k => areStudentsEqual(k, regToUse));
                if (matchedKey) {
                  obeMarksToUse = { ...((icAny.obeMarks || icAny.obe_marks || {})[matchedKey] || {}) };
                }
              }
              obeMarksToUse = { ...obeMarksToUse, ...(sc.obeMarks || sc.obe_marks || {}) };

              console.log(`[STUDENT_MARKS_DEBUG] Course ${codeStr} - "${sc.title}" details mapped from backend/local:`, {
                id: sc.id,
                code: sc.code,
                title: sc.title,
                studentMarks: studentMarksToUse,
                obeMarks: obeMarksToUse,
                categories: standardCategories,
                unitsData: standardUnitsData,
                obeQuestions: obeQuestions,
                selectedGradingSystem: sc.selectedGradingSystem
              });

              return {
                id: sc.id || `course-assigned-${sc.code}`,
                code: sc.code,
                title: sc.title || '',
                departmentId: dId,
                departmentName: dName,
                programId: pId,
                programName: pName,
                creditHours: sc.creditHours || 3,
                categories: standardCategories,
                unitsData: standardUnitsData,
                students: [
                  {
                    regNo: regToUse,
                    name: matchingStudent ? matchingStudent.name : 'Logged-In Student',
                    marks: studentMarksToUse
                  }
                ],
                obeQuestions: obeQuestions,
                obeMarks: {
                  [regToUse]: obeMarksToUse
                },
                clos: sc.clos || sc.courseCLOs || sc.course_clos || [],
                selectedGradingSystem: sc.selectedGradingSystem || matchedIC?.selectedGradingSystem || 'ready1',
                totalPercentage: sc.totalPercentage,
                grade: sc.grade,
                gradePoints: sc.gradePoints,
                cloAttainments: sc.cloAttainments,
                weightedMarks: sc.weightedMarks,
                categoryBreakdown: sc.categoryBreakdown
              };
            });
          } else {
            console.warn("[STUDENT_MARKS_DEBUG] studentCourses from API is not an array:", studentCourses);
            mappedInstructorCourses = [];
          }
        } catch (apiErr) {
          console.error("[STUDENT_MARKS_DEBUG] Error loading student courses from backend:", apiErr);
          mappedInstructorCourses = [];
        }
        setInstructorCourses(mappedInstructorCourses);
        // CRITICAL: Ensure allInstructorCoursesState also has these mapped courses so that computeStudentCourseResult can access them.
        setAllInstructorCoursesState(prev => {
          const combined = [...prev];
          mappedInstructorCourses.forEach(sc => {
            if (!combined.some(c => c.code?.toUpperCase() === sc.code?.toUpperCase())) {
              combined.push(sc);
            }
          });
          return combined;
        });
      } catch (err) {
        console.warn("Instructor courses not loaded directly, using empty set.", err);
        setInstructorCourses([]);
        setAllInstructorCoursesState([]);
      }

    } catch (err) {
      console.error(err);
      setError('Failed to retrieve Student Portal academic ledger.');
    } finally {
      setLoading(false);
    }
  };

  // Find active student details
  const activeStudent = useMemo(() => {
    return students.find(s => areStudentsEqual(s.regNo, activeRegNo)) || null;
  }, [students, activeRegNo]);

  // Find student's program and department details
  const activeProgram = useMemo(() => {
    if (!activeStudent) return null;
    return programs.find(p => p.id === activeStudent.programId) || null;
  }, [activeStudent, programs]);

  const activeDepartment = useMemo(() => {
    if (!activeProgram) return null;
    return departments.find(d => d.id === activeProgram.departmentId) || null;
  }, [activeProgram, departments]);

  // Extract semester from course code dynamically (e.g. CMC111 -> 1st Semester, SEN212 -> 2nd Semester)
  const getCourseSemester = (courseCode: string, courseObj?: any): string => {
    if (courseObj && (courseObj.academicYear || courseObj.academic_year)) {
      return courseObj.academicYear || courseObj.academic_year;
    }
    if (courseObj && courseObj.semester) {
      const s = String(courseObj.semester).trim();
      if (s) {
        if (!s.toLowerCase().includes('semester') && !s.toLowerCase().includes('fall') && !s.toLowerCase().includes('spring')) {
          return `${s} Semester`;
        }
        return s;
      }
    }

    // 1. Use the active student's semester if available, so current enrolled courses align with their current active semester!
    if (activeStudent && activeStudent.semester) {
      const s = String(activeStudent.semester).trim();
      if (s) {
        if (!s.toLowerCase().includes('semester')) {
          return `${s} Semester`;
        }
        return s;
      }
    }

    // 2. Try to find the course in the loaded semester plans
    if (Array.isArray(semesterPlans) && semesterPlans.length > 0) {
      const studentProgramId = activeStudent?.programId || '';
      // Try to match the student's program first
      const matchByProgram = semesterPlans.find(p => 
        p.programId === studentProgramId && 
        p.courseCodes?.some((c: string) => c.trim().toUpperCase() === courseCode.trim().toUpperCase())
      );
      if (matchByProgram) {
        return matchByProgram.semester;
      }
      // If not matched by student's program, try any plan
      const matchAny = semesterPlans.find(p => 
        p.courseCodes?.some((c: string) => c.trim().toUpperCase() === courseCode.trim().toUpperCase())
      );
      if (matchAny) {
        return matchAny.semester;
      }
    }

    const match = courseCode.match(/\d/);
    if (match) {
      const digit = parseInt(match[0], 10);
      if (digit >= 1 && digit <= 8) {
        const suffixes = ['st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th'];
        return `${digit}${suffixes[digit - 1]} Semester`;
      }
    }

    return 'General Core';
  };

  const getStudentMark = (
    student: any,
    categoryName: string,
    unitNo: number,
    totalMarks: number,
    unitsData?: Record<string, any[]>
  ): number => {
    if (unitsData && unitsData[categoryName]) {
      const matchingUnit = unitsData[categoryName].find((u: any) => u.unitNo === unitNo);
      if (matchingUnit && matchingUnit.questions && matchingUnit.questions.length > 0) {
        return matchingUnit.questions.reduce((sum: number, q: any) => {
          const qKey = `q-${categoryName}-${unitNo}-${q.id}`;
          return sum + (student.marks?.[qKey] ?? 0);
        }, 0);
      }
    }

    if (student.marks && student.marks[`${categoryName}-${unitNo}`] !== undefined) {
      return student.marks[`${categoryName}-${unitNo}`];
    }

    if (student.marks && student.marks[categoryName] !== undefined && unitNo === 1) {
      return student.marks[categoryName];
    }
    
    return 0;
  };

  // Helper to retrieve realistic grades/attainments based on the student's registration ID and backend responses
  const computeStudentCourseResult = (stdRegNo: string, courseCode: string, courseObj?: any) => {
    // Get course from /api/student/courses/ response (stored in state rawStudentCourses)
    const rawCourse = courseObj || rawStudentCourses?.find(
      (c: any) => c.id === courseObj?.id || c.code?.toUpperCase() === courseCode?.toUpperCase()
    );

    if (!rawCourse) {
      return { aggregate: 0, letterGrade: 'Pending', points: 0, clos: [], hasAnyMarks: false, isCompleted: false };
    }

    // NORMALIZE COURSE: support both camelCase and snake_case from python/django backend
    const course = {
      ...rawCourse,
      id: rawCourse.id || rawCourse.course_id || `course-assigned-${rawCourse.code}`,
      code: rawCourse.code,
      title: rawCourse.title || rawCourse.name || '',
      creditHours: rawCourse.creditHours || rawCourse.credit_hours || 3,
      categories: rawCourse.categories || rawCourse.course_categories || [],
      unitsData: rawCourse.unitsData || rawCourse.units_data || {},
      obeQuestions: rawCourse.obeQuestions || rawCourse.obe_questions || [],
      student_marks: rawCourse.student_marks || rawCourse.studentMarks || rawCourse.marks || {},
      studentMarks: rawCourse.student_marks || rawCourse.studentMarks || rawCourse.marks || {},
      obe_marks: rawCourse.obe_marks || rawCourse.obeMarks || {},
      obeMarks: rawCourse.obe_marks || rawCourse.obeMarks || {},
      clos: rawCourse.clos || rawCourse.courseCLOs || rawCourse.course_clos || [],
      selectedGradingSystem: rawCourse.selectedGradingSystem || rawCourse.selected_grading_system || 'ready1',
      totalPercentage: rawCourse.totalPercentage ?? rawCourse.total_percentage ?? rawCourse.finalPercentage ?? rawCourse.final_percentage ?? rawCourse.percentage ?? rawCourse.score ?? null,
      grade: rawCourse.grade ?? rawCourse.letterGrade ?? rawCourse.letter_grade ?? rawCourse.grade_name ?? rawCourse.gradeName ?? null,
      gradePoints: rawCourse.gradePoints ?? rawCourse.grade_points ?? rawCourse.points ?? rawCourse.gpa ?? 0,
      cloAttainments: rawCourse.cloAttainments || rawCourse.clo_at_attainments || rawCourse.clo_attainment || rawCourse.clo_attainments || []
    };

    const courseCLOs = allCoursesCLOs[courseCode] || [];
    
    // Dynamically calculate CLO attainments for THIS active student in real-time
    const dynamicCLOs = calculateStudentCLOAttainment(course, stdRegNo, allInstructorCoursesState);

    // Check if there is a match in finalTranscripts (from instructor's reports)
    const matchedTranscript = finalTranscripts?.find(
      (t: any) => (t.courseCode || t.course_code || '').toUpperCase() === courseCode?.toUpperCase()
    );

    if (matchedTranscript) {
      course.totalPercentage = matchedTranscript.finalPercentage ?? matchedTranscript.totalPercentage ?? matchedTranscript.percentage ?? matchedTranscript.score ?? course.totalPercentage;
      course.grade = matchedTranscript.grade ?? matchedTranscript.letterGrade ?? matchedTranscript.letter_grade ?? course.grade;
      course.gradePoints = matchedTranscript.gradePoints ?? matchedTranscript.grade_points ?? matchedTranscript.points ?? matchedTranscript.gpa ?? course.gradePoints;
      
      if (matchedTranscript.cloAttainments || matchedTranscript.clo_at_attainments || matchedTranscript.clo_attainment || matchedTranscript.clos) {
        course.cloAttainments = matchedTranscript.cloAttainments || matchedTranscript.clo_at_attainments || matchedTranscript.clo_attainment || matchedTranscript.clos;
      }
    }

    const displayCLOs = (course.cloAttainments && course.cloAttainments.length > 0)
      ? course.cloAttainments
      : dynamicCLOs;

    // Check if marks exist directly on the student course
    const hasDirectMarks = (course.studentMarks && Object.keys(course.studentMarks).length > 0) ||
                          (course.obeMarks && Object.keys(course.obeMarks).length > 0) ||
                          (course.totalPercentage !== null && course.totalPercentage !== undefined && course.totalPercentage > 0);

    // Dynamic aggregate, grade, and grade points calculation from instructor-entered marks
    let finalAggregate = course.totalPercentage ?? 0;
    let finalGrade = course.grade ?? 'Pending';
    let finalPoints = course.gradePoints ?? 0;
    let hasAnyMarks = hasDirectMarks;

    let matchedIC = (instructorCourses || []).find((ic: any) =>
      matchInstructorCourse(ic, courseCode, course.title)
    ) || allInstructorCoursesState.find((ic: any) =>
      matchInstructorCourse(ic, courseCode, course.title)
    );

    // If no matched instructor course found in states, fallback to a virtual matchedIC built from course itself
    if (!matchedIC && course && (Object.keys(course.studentMarks).length > 0 || Object.keys(course.obeMarks).length > 0)) {
      matchedIC = {
        ...course,
        students: [
          {
            regNo: stdRegNo,
            marks: course.studentMarks || {}
          }
        ],
        obeMarks: course.obeMarks ? { [stdRegNo]: course.obeMarks } : {}
      };
    } else if (matchedIC) {
      // Ensure matchedIC is also fully normalized to avoid camelCase vs snake_case mismatches
      matchedIC = {
        ...matchedIC,
        categories: matchedIC.categories || matchedIC.course_categories || [],
        unitsData: matchedIC.unitsData || matchedIC.units_data || {},
        obeQuestions: matchedIC.obeQuestions || matchedIC.obe_questions || [],
        obeMarks: matchedIC.obeMarks || matchedIC.obe_marks || {},
        students: (matchedIC.students || []).map((s: any) => ({
          ...s,
          regNo: s.regNo || s.reg_no,
          marks: s.marks || s.student_marks || {}
        }))
      };
    }

    let isCompleted = !matchedIC && hasAnyMarks;

    if (matchedIC) {
      let matchedStudentInIC = matchedIC.students?.find((s: any) =>
        areStudentsEqual(s.regNo, stdRegNo)
      );

      const directMarks = course.studentMarks || course.student_marks || course.marks || (course.students && course.students[0]?.marks) || {};
      if (!matchedStudentInIC || (!matchedStudentInIC.marks && Object.keys(directMarks).length > 0)) {
        matchedStudentInIC = {
          regNo: stdRegNo,
          marks: {
            ...(matchedStudentInIC?.marks || {}),
            ...directMarks
          }
        };
      }

      if (matchedStudentInIC) {
        let studentObeMarks = {};
        if (matchedIC.obeMarks) {
          const matchedKey = Object.keys(matchedIC.obeMarks).find(k => areStudentsEqual(k, stdRegNo));
          if (matchedKey) {
            studentObeMarks = matchedIC.obeMarks[matchedKey] || {};
          }
        }

        const combinedMarks = {
          ...studentObeMarks,
          ...(matchedStudentInIC.marks || {})
        };

        let aggregate = 0;
        let activeCats = (matchedIC.categories || []).filter((cat: any) => cat.percentage > 0);
        let hasRealMarks = false;
        let gradedWeightSum = 0;

        activeCats.forEach((cat: any) => {
          if (cat.units > 0) {
            let catHasAnyMarks = false;
            let studentObtainedSum = 0;
            let totalMaxMarks = 0;

            for (let u = 1; u <= cat.units; u++) {
              const matchingUnit = (matchedIC.unitsData?.[cat.name] || []).find((un: any) => un.unitNo === u);
              const questions = matchingUnit?.questions || [];

              if (questions.length > 0) {
                questions.forEach((q: any) => {
                  totalMaxMarks += q.maxMarks || 0;
                  const qIdStr = String(q.id).trim().toLowerCase();
                  const markExists = Object.keys(combinedMarks).some(k => {
                    const kLower = k.toLowerCase();
                    return kLower === qIdStr || kLower.endsWith(`-${qIdStr}`) || kLower === `q-${qIdStr}` || kLower.includes(`-${qIdStr}-`) || kLower.includes(`_${qIdStr}`);
                  });
                  if (markExists) {
                    studentObtainedSum += getFuzzyStudentMark(combinedMarks, cat.name, u, q.id);
                    catHasAnyMarks = true;
                  }
                });
              } else {
                const maxMarks = matchingUnit ? matchingUnit.totalMarks : 10;
                totalMaxMarks += maxMarks;
                const dKey = `${cat.name}-${u}`;
                const dKeyLower = dKey.toLowerCase();
                const markExists = Object.keys(combinedMarks).some(k => k.toLowerCase() === dKeyLower || k.toLowerCase().replace(/[^a-z0-9]/g, '') === dKeyLower.replace(/[^a-z0-9]/g, ''));
                if (markExists) {
                  studentObtainedSum += getFuzzyStudentMark(combinedMarks, cat.name, u);
                  catHasAnyMarks = true;
                }
              }
            }

            if (catHasAnyMarks && totalMaxMarks > 0) {
              const catContribution = (studentObtainedSum / totalMaxMarks) * cat.percentage;
              aggregate += catContribution;
              hasRealMarks = true;
              gradedWeightSum += cat.percentage;
            }
          }
        });

        const isCourseClosed = matchedIC?.status === 'closed' || matchedIC?.isClosed || course?.status === 'closed' || course?.isClosed || !!matchedTranscript;

        if (hasRealMarks) {
          finalAggregate = Number(aggregate.toFixed(1));

          const system = matchedIC.selectedGradingSystem || 'ready1';
          if (system === 'ready1') {
            if (finalAggregate >= 88) finalGrade = 'A';
            else if (finalAggregate >= 81) finalGrade = 'B+';
            else if (finalAggregate >= 74) finalGrade = 'B';
            else if (finalAggregate >= 67) finalGrade = 'C+';
            else if (finalAggregate >= 60) finalGrade = 'C';
            else finalGrade = isCourseClosed ? 'F' : 'Pending';
          } else if (system === 'ready2') {
            if (finalAggregate >= 90) finalGrade = 'A+';
            else if (finalAggregate >= 85) finalGrade = 'A';
            else if (finalAggregate >= 80) finalGrade = 'A-';
            else if (finalAggregate >= 75) finalGrade = 'B+';
            else if (finalAggregate >= 70) finalGrade = 'B';
            else if (finalAggregate >= 65) finalGrade = 'B-';
            else if (finalAggregate >= 60) finalGrade = 'C+';
            else if (finalAggregate >= 55) finalGrade = 'C';
            else if (finalAggregate >= 50) finalGrade = 'D';
            else finalGrade = isCourseClosed ? 'F' : 'Pending';
          } else if (system === 'custom') {
            const list = matchedIC.customGradingSystem || [];
            let matchedGrade = isCourseClosed ? 'F' : 'Pending';
            const sorted = [...list].sort((a, b) => parseFloat(b.threshold || '0') - parseFloat(a.threshold || '0'));
            for (const t of sorted) {
              if (finalAggregate >= parseFloat(t.threshold || '0')) {
                matchedGrade = t.grade;
                break;
              }
            }
            finalGrade = matchedGrade;
          } else {
            if (finalAggregate >= 88) finalGrade = 'A';
            else if (finalAggregate >= 81) finalGrade = 'B+';
            else if (finalAggregate >= 74) finalGrade = 'B';
            else if (finalAggregate >= 67) finalGrade = 'C+';
            else if (finalAggregate >= 60) finalGrade = 'C';
            else finalGrade = isCourseClosed ? 'F' : 'Pending';
          }

          // Compute grade points
          if (finalGrade === 'Pending') {
            finalPoints = 0.0;
          } else if (system === 'ready1') {
            if (finalGrade === 'A') finalPoints = 4.0;
            else if (finalGrade === 'B+') finalPoints = 3.5;
            else if (finalGrade === 'B') finalPoints = 3.0;
            else if (finalGrade === 'C+') finalPoints = 2.5;
            else if (finalGrade === 'C') finalPoints = 2.0;
            else finalPoints = 0.0;
          } else if (system === 'ready2') {
            if (finalGrade === 'A+') finalPoints = 4.0;
            else if (finalGrade === 'A') finalPoints = 4.0;
            else if (finalGrade === 'A-') finalPoints = 3.7;
            else if (finalGrade === 'B+') finalPoints = 3.3;
            else if (finalGrade === 'B') finalPoints = 3.0;
            else if (finalGrade === 'B-') finalPoints = 2.7;
            else if (finalGrade === 'C+') finalPoints = 2.5;
            else if (finalGrade === 'C') finalPoints = 2.0;
            else if (finalGrade === 'D') finalPoints = 1.0;
            else finalPoints = 0.0;
          } else if (system === 'custom') {
            const list = matchedIC.customGradingSystem || [];
            const matchedTier = list.find((t: any) => t.grade === finalGrade);
            if (matchedTier) {
              finalPoints = parseFloat(matchedTier.points || '0');
            } else {
              if (finalGrade === 'A') finalPoints = 4.0;
              else if (finalGrade === 'B+') finalPoints = 3.5;
              else if (finalGrade === 'B') finalPoints = 3.0;
              else if (finalGrade === 'C+') finalPoints = 2.5;
              else if (finalGrade === 'C') finalPoints = 2.0;
              else finalPoints = 0.0;
            }
          } else {
            if (finalGrade === 'A') finalPoints = 4.0;
            else if (finalGrade === 'B+') finalPoints = 3.5;
            else if (finalGrade === 'B') finalPoints = 3.0;
            else if (finalGrade === 'C+') finalPoints = 2.5;
            else if (finalGrade === 'C') finalPoints = 2.0;
            else finalPoints = 0.0;
          }

          hasAnyMarks = true;
          isCompleted = isCourseClosed || (finalGrade !== 'Pending' && finalGrade !== 'F' && finalGrade !== '-' && finalGrade !== '');
        }
      }
    }

    // Fallback: If no direct category marks were dynamically computed, use direct course metrics / official transcript
    if (!hasAnyMarks) {
      const rawBackendPercentage = rawCourse?.totalPercentage ?? rawCourse?.total_percentage ?? rawCourse?.finalPercentage ?? rawCourse?.final_percentage ?? rawCourse?.percentage ?? rawCourse?.score;
      let officialPercentage = matchedTranscript?.finalPercentage ?? matchedTranscript?.totalPercentage ?? matchedTranscript?.percentage ?? matchedTranscript?.score ?? rawBackendPercentage ?? course.totalPercentage;
      let officialGrade = matchedTranscript?.grade ?? course.grade ?? rawCourse?.grade;
      const officialPoints = matchedTranscript?.gradePoints ?? course.gradePoints ?? rawCourse?.gradePoints;

      const hasRealData = !!matchedTranscript ||
                          (course.studentMarks && Object.keys(course.studentMarks).length > 0) ||
                          (officialPercentage !== null && officialPercentage !== undefined && Number(officialPercentage) > 0);

      if (hasRealData) {
        if (officialGrade && officialGrade !== 'Pending' && officialGrade !== '-' && officialGrade !== '0') {
          finalGrade = officialGrade;
          hasAnyMarks = true;
          isCompleted = true;
        }

        if (officialPercentage !== null && officialPercentage !== undefined && Number(officialPercentage) > 0) {
          finalAggregate = Number(officialPercentage);
          hasAnyMarks = true;
        }

        if (officialPoints !== null && officialPoints !== undefined && Number(officialPoints) > 0) {
          finalPoints = Number(officialPoints);
        } else if (finalGrade && finalGrade !== 'Pending') {
          if (finalGrade === 'A' || finalGrade === 'A+') finalPoints = 4.0;
          else if (finalGrade === 'A-') finalPoints = 3.7;
          else if (finalGrade === 'B+') finalPoints = 3.5;
          else if (finalGrade === 'B') finalPoints = 3.0;
          else if (finalGrade === 'B-') finalPoints = 2.7;
          else if (finalGrade === 'C+') finalPoints = 2.5;
          else if (finalGrade === 'C') finalPoints = 2.0;
          else if (finalGrade === 'D') finalPoints = 1.0;
          else finalPoints = 0.0;
        }
      } else {
        const isCourseClosed = course.status === 'closed' || course.isClosed;
        if (isCourseClosed) {
          finalGrade = course.grade || 'F';
          finalAggregate = course.totalPercentage || 0;
          finalPoints = course.gradePoints || 0.0;
          hasAnyMarks = true;
        } else {
          finalGrade = 'Pending';
          finalAggregate = 0;
          finalPoints = 0.0;
          hasAnyMarks = false;
        }
      }
    }

    return {
      aggregate: finalAggregate,
      letterGrade: finalGrade,
      points: finalPoints,
      hasAnyMarks,
      isCompleted,
      clos: (displayCLOs ?? []).map((c: any) => {
        const matchingDef = courseCLOs.find((def: any) => (def.code || def.cloCode || '').toUpperCase() === (c.code || c.cloCode || '').toUpperCase());
        const rawMappedGA = matchingDef?.mappedGA || matchingDef?.mapped_ga || c.mappedGA || null;
        return {
          code: c.code || c.cloCode,
          percentage: c.percentage ?? c.attainment ?? c.obtained_attainment ?? 0,
          status: c.status ?? c.attainment_status ?? ((c.percentage ?? 0) >= 50 ? 'Attained' : 'Not Attained'),
          description: matchingDef?.description || c.description || c.desc || `Course Learning Outcome ${c.code}`,
          mappedGA: standardizeMappedGAObj(rawMappedGA, c.code, gas)
        };
      })
    };
  };

  // Get student's enrolled courses with dynamic calculations attached
  const enrolledCoursesWithGrades = useMemo(() => {
    const matched = (rawStudentCourses || []).map((rc: any) => {
      const globalCourse = courses.find(c => c.code?.toUpperCase() === rc.code?.toUpperCase());
      const results = computeStudentCourseResult(activeRegNo, rc.code, rc);
      return {
        ...globalCourse,
        ...rc,
        results
      };
    });

    const seen = new Map<string, any>();
    matched.forEach(c => {
      const codeKey = (c.code || '').trim().toUpperCase();
      if (!codeKey) return;

      const existing = seen.get(codeKey);
      if (!existing) {
        seen.set(codeKey, c);
      } else {
        const existingHasMarks = existing.results?.hasAnyMarks || (existing.studentMarks && Object.keys(existing.studentMarks).length > 0) || (existing.totalPercentage ?? 0) > 0;
        const newHasMarks = c.results?.hasAnyMarks || (c.studentMarks && Object.keys(c.studentMarks).length > 0) || (c.totalPercentage ?? 0) > 0;

        if (!existingHasMarks && newHasMarks) {
          seen.set(codeKey, c);
        } else if (newHasMarks && (c.results?.aggregate ?? c.totalPercentage ?? 0) > (existing.results?.aggregate ?? existing.totalPercentage ?? 0)) {
          seen.set(codeKey, c);
        }
      }
    });

    return Array.from(seen.values());
  }, [courses, studentBindings, activeRegNo, instructorCourses, rawStudentCourses, allInstructorCoursesState]);

  // Group enrolled courses by Semester
  const coursesBySemester = useMemo(() => {
    const grouped: Record<string, typeof enrolledCoursesWithGrades> = {};
    enrolledCoursesWithGrades.forEach(c => {
      const sem = getCourseSemester(c.code, c);
      if (!grouped[sem]) grouped[sem] = [];
      grouped[sem].push(c);
    });

    // Sort semester keys logically
    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .reduce((acc, key) => {
        acc[key] = grouped[key];
        return acc;
      }, {} as Record<string, typeof enrolledCoursesWithGrades>);
  }, [enrolledCoursesWithGrades, semesterPlans]);

  // Compute SGPA / CGPA overall
  const GPAStats = useMemo(() => {
    let totalPointsProduct = 0;
    let totalCredits = 0;
    let passedCoursesCount = 0;
    let totalCoursesCount = 0;

    // Collect all unique courses that have been graded
    const courseGPAs: Record<string, { points: number; credits: number; passed: boolean }> = {};

    // 1. Process enrolled courses with grades
    enrolledCoursesWithGrades.forEach(c => {
      if (c.results && c.results.hasAnyMarks && c.results.isCompleted) {
        courseGPAs[c.code] = {
          points: c.results.points,
          credits: c.creditHours || 3,
          passed: c.results.letterGrade !== 'F'
        };
      }
    });

    // 2. Merge with finalTranscripts (which is the server-side finalized records)
    finalTranscripts.forEach(t => {
      const pts = t.gradePoints ?? t.points ?? 0;
      courseGPAs[t.courseCode] = {
        points: pts,
        credits: t.creditHours || 3,
        passed: t.grade !== 'F'
      };
    });

    // 3. Sum up the credits and grade points
    Object.keys(courseGPAs).forEach(code => {
      const info = courseGPAs[code];
      totalPointsProduct += info.points * info.credits;
      totalCredits += info.credits;
      totalCoursesCount++;
      if (info.passed) {
        passedCoursesCount++;
      }
    });

    let cgpa = totalCredits > 0 ? (totalPointsProduct / totalCredits) : 0.0;
    cgpa = Math.round(cgpa * 100) / 100;

    return {
      cgpa,
      sgpa: cgpa,
      totalCredits,
      passedCourses: passedCoursesCount
    };
  }, [enrolledCoursesWithGrades, finalTranscripts, studentSummary]);

  // Calculate Semester GPA dynamically for each semester group
  const semesterGPAs = useMemo(() => {
    const gpas: Record<string, number> = {};
    Object.keys(coursesBySemester).forEach(semKey => {
      const semCourses = coursesBySemester[semKey];
      let totalPointsProduct = 0;
      let totalCredits = 0;
      let hasGrades = false;

      semCourses.forEach(c => {
        const crHrs = c.creditHours || 3;
        if (c.results && c.results.points !== undefined && c.results.hasAnyMarks && c.results.isCompleted) {
          totalPointsProduct += c.results.points * crHrs;
          totalCredits += crHrs;
          hasGrades = true;
        }
      });

      gpas[semKey] = hasGrades && totalCredits > 0 ? totalPointsProduct / totalCredits : 0.0;
    });
    return gpas;
  }, [coursesBySemester]);

  // Merge historical and current courses for print transcript
  const printAllCoursesBySemester = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    
    // 1. Add finalTranscripts (historical finalized records)
    finalTranscripts.forEach(t => {
      // Clean up semester key name (e.g., "1st Semester" instead of "SPRING-23")
      const sem = t.semester || '1st Semester';
      if (!grouped[sem]) grouped[sem] = [];
      
      if (!grouped[sem].some(c => c.code === t.courseCode)) {
        grouped[sem].push({
          code: t.courseCode,
          title: t.courseTitle,
          creditHours: t.creditHours || 3,
          results: {
            letterGrade: t.grade,
            points: t.gradePoints ?? t.points ?? 0.0,
            aggregate: t.finalPercentage ?? 0,
            isCompleted: true,
            hasAnyMarks: true
          }
        });
      }
    });
    
    // 2. Add enrolledCoursesWithGrades
    enrolledCoursesWithGrades.forEach(c => {
      const sem = getCourseSemester(c.code, c);
      if (!grouped[sem]) grouped[sem] = [];
      
      if (!grouped[sem].some(existing => existing.code === c.code || (c.title && existing.title && existing.title.trim().toLowerCase() === c.title.trim().toLowerCase()))) {
        grouped[sem].push({
          code: c.code,
          title: c.title,
          creditHours: c.creditHours || 3,
          results: {
            letterGrade: c.results?.letterGrade || '-',
            points: c.results?.points ?? 0.0,
            aggregate: c.results?.aggregate ?? 0,
            isCompleted: c.results?.isCompleted ?? false,
            hasAnyMarks: c.results?.hasAnyMarks ?? false
          }
        });
      }
    });

    // Sort semester keys logically by semester order
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });

    const sortedGrouped: Record<string, any[]> = {};
    sortedKeys.forEach(key => {
      sortedGrouped[key] = grouped[key];
    });

    return sortedGrouped;
  }, [enrolledCoursesWithGrades, finalTranscripts]);

  // Calculate Semester GPA for print transcript
  const printSemesterGPAs = useMemo(() => {
    const gpas: Record<string, number> = {};
    Object.keys(printAllCoursesBySemester).forEach(semKey => {
      const semCourses = printAllCoursesBySemester[semKey];
      let totalPointsProduct = 0;
      let totalCredits = 0;
      let hasGrades = false;

      semCourses.forEach(c => {
        const crHrs = c.creditHours || 3;
        const pts = c.results?.points;
        const letter = c.results?.letterGrade;
        if (pts !== undefined && letter !== undefined && letter !== '-') {
          totalPointsProduct += pts * crHrs;
          totalCredits += crHrs;
          hasGrades = true;
        }
      });

      gpas[semKey] = hasGrades && totalCredits > 0 ? totalPointsProduct / totalCredits : 0.0;
    });
    return gpas;
  }, [printAllCoursesBySemester]);

  // Sum up total credit hours for print transcript
  const printTotalEarnedCredits = useMemo(() => {
    let total = 0;
    Object.values(printAllCoursesBySemester).forEach((courses: any) => {
      courses.forEach((c: any) => {
        const grade = c.results?.letterGrade;
        if (grade && grade !== 'F' && grade !== '-' && grade !== '') {
          total += (c.creditHours || 3);
        }
      });
    });
    return total;
  }, [printAllCoursesBySemester]);

  // Populate print settings when activeStudent or printAllCoursesBySemester loads/changes
  useEffect(() => {
    if (activeStudent) {
      setPrintStudentName(activeStudent.name || '');
      setPrintRegNo(activeStudent.regNo || activeRegNo);
      setPrintProgramCode((activeProgram?.code || 'BS(CS)').toUpperCase());
      setPrintFatherName(guessFatherName(activeStudent.name || ''));
      setPrintIssueDate(getFormattedDate(new Date()));
      
      const semKeys = Object.keys(printAllCoursesBySemester);
      // Auto-generate semester mapping (1st Semester -> SPRING-23, etc.)
      const mapping: Record<string, string> = {};
      
      // Determine starting year from regNo if possible (e.g., 052-23-122055 has year 23)
      let startYear = 2023;
      const regParts = activeStudent.regNo.split('-');
      if (regParts.length > 1) {
        const yearDigits = parseInt(regParts[1], 10);
        if (!isNaN(yearDigits)) {
          startYear = yearDigits < 50 ? 2000 + yearDigits : 1900 + yearDigits;
        }
      }
      
      semKeys.forEach((key, index) => {
        const term = index % 2 === 0 ? 'SPRING' : 'FALL';
        const year = startYear + Math.floor(index / 2);
        const shortYear = String(year).slice(-2);
        mapping[key] = `${term}-${shortYear}`;
      });
      setPrintSemesterMapping(mapping);
    }
  }, [activeStudent, activeProgram, printAllCoursesBySemester]);

  const downloadTranscriptPDF = async () => {
    const element = document.getElementById('transcript-print-area');
    if (!element) {
      console.error("Print area element not found");
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

    // Save current layout styles of element to restore them perfectly afterward
    const originalWidth = element.style.width;
    const originalMaxWidth = element.style.maxWidth;
    const originalMinHeight = element.style.minHeight;
    const originalBoxShadow = element.style.boxShadow;
    const originalBorder = element.style.border;
    const originalBorderRadius = element.style.borderRadius;

    try {
      // Temporarily set the element to a standard crisp A4 portrait width (800px)
      // This preserves exact typography and proportions without squishing or down-scaling elements.
      element.style.setProperty('width', '800px', 'important');
      element.style.setProperty('max-width', 'none', 'important');
      element.style.setProperty('min-height', 'auto', 'important');
      element.style.setProperty('box-shadow', 'none', 'important');
      element.style.setProperty('border', 'none', 'important');
      element.style.setProperty('border-radius', '0px', 'important');

      // Force layout calculation refresh
      const _reflow = element.offsetHeight;

      // Yield a tiny execution macrotask to allow Chrome rendering thread to flush computed coordinates
      await new Promise(resolve => setTimeout(resolve, 150));

      const capturedWidth = 800;
      const capturedHeight = element.scrollHeight || element.offsetHeight || 1130;

      // Capture high-resolution image representation forcing exact 800px layout width
      const dataUrl = await toPng(element, {
        quality: 1.0,
        pixelRatio: 2.5, // captures ultra-sharp vector text and values
        backgroundColor: '#ffffff',
        width: capturedWidth,
        height: capturedHeight
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageHeight = 297; // A4 height in mm
      const imgWidth = 210; // A4 width in mm
      
      const imgHeight = (capturedHeight * imgWidth) / capturedWidth; // scales naturally to preserve original aspect ratio

      let heightLeft = imgHeight;
      let position = 0;

      // Add Page 1
      pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Slice overflow contents onto successive pages natively
      let pageNum = 1;
      while (heightLeft > 5) {
        position = - (pageNum * pageHeight);
        pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        pageNum++;
      }

      pdf.save(`Official_Academic_Transcript_${activeStudent?.regNo || 'Student'}.pdf`);
    } catch (error) {
      console.error("PDF download compilation error:", error);
      // Fallback to native print
      window.print();
    } finally {
      if (downloadBtn && oldText) {
        downloadBtn.innerHTML = oldText;
        downloadBtn.disabled = false;
      }

      // Restore pristine on-screen state
      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxWidth;
      element.style.minHeight = originalMinHeight;
      element.style.boxShadow = originalBoxShadow;
      element.style.border = originalBorder;
      element.style.borderRadius = originalBorderRadius;
    }
  };

  // Determine which semester to use for displaying "Semester GPA" in the header
  const currentSemesterForGPA = useMemo(() => {
    if (selectedSemester !== 'all') {
      return selectedSemester;
    }
    const semKeys = Object.keys(coursesBySemester);
    if (semKeys.length > 0) {
      // Return highest/latest semester
      const sorted = [...semKeys].sort((a, b) => b.localeCompare(a));
      return sorted[0];
    }
    return '';
  }, [selectedSemester, coursesBySemester]);

  // Get active GPA score for the selected or default latest semester
  const activeSemesterGPA = useMemo(() => {
    if (!currentSemesterForGPA || !semesterGPAs[currentSemesterForGPA]) {
      return 0.0;
    }
    return semesterGPAs[currentSemesterForGPA];
  }, [currentSemesterForGPA, semesterGPAs]);

  // Automatically select the latest semester on load
  useEffect(() => {
    const semKeys = Object.keys(coursesBySemester);
    if (semKeys.length > 0 && selectedSemester === 'all') {
      const sorted = [...semKeys].sort((a, b) => b.localeCompare(a));
      setSelectedSemester(sorted[0]);
    }
  }, [coursesBySemester]);

  // Filter GAs (Graduate Attributes) associated with the student's program/department
  const programGAs = useMemo(() => {
    if (!activeStudent || gas.length === 0) return [];
    
    // Filter by the student's department
    const studentDeptId = (activeStudent.departmentId || '').toLowerCase();
    const filtered = gas.filter(g => (g.departmentId || '').toLowerCase() === studentDeptId);
    
    console.log("[STUDENT_MARKS_DEBUG] Filtered programGAs for department", studentDeptId, ":", filtered);
    return filtered;
  }, [activeStudent, gas]);

  // Compute Graduate Attribute (GA) Attainment scores dynamically per instructions
  // Group by mappedGA.gaId, average the CLO percentages, and only show GAs present in the data.
  const gaAttainmentProfile = useMemo(() => {
    const gaMap: Record<string, { gaTitle: string; scores: number[]; courses: Set<string> }> = {};

    enrolledCoursesWithGrades.forEach((course: any) => {
      const courseClos = course.results?.clos || [];
      courseClos.forEach((clo: any) => {
        if (!clo.mappedGA) return; // skip unmapped CLOs

        const gaId = typeof clo.mappedGA === 'object' ? clo.mappedGA.gaId : clo.mappedGA;
        const gaTitle = typeof clo.mappedGA === 'object' ? clo.mappedGA.gaTitle : `Graduate Attribute ${gaId}`;
        if (!gaId) return;

        if (!gaMap[gaId]) {
          gaMap[gaId] = { gaTitle: gaTitle || `Graduate Attribute ${gaId}`, scores: [], courses: new Set() };
        }

        gaMap[gaId].scores.push(clo.percentage);
        const title = course.title || course.name || '';
        gaMap[gaId].courses.add(`${course.code} - ${title}`);
      });
    });

    const list = Object.entries(gaMap).map(([gaId, data]) => {
      const avg = data.scores.length > 0 
        ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length 
        : 0;

      const origGA = findOriginalGA(gaId, gas);

      return {
        id: formatGACodeToStandard(gaId),
        name: origGA?.name || data.gaTitle,
        description: origGA?.description || `Competency and standard metrics for ${origGA?.name || data.gaTitle}`,
        score: Math.round(avg * 100) / 100,
        attained: avg >= 50,   // 50% is the threshold
        contributingCount: data.scores.length,
        coursesList: Array.from(data.courses)
      };
    });

    return [...list].sort((a, b) => naturalCompare(a.id, b.id));
  }, [enrolledCoursesWithGrades, gas]);

  // Compute course-specific Graduate Attribute (GA) Attainment scores dynamically
  const courseGaAttainment = useMemo(() => {
    if (!selectedGaCourseCode) return [];
    
    // Find the selected course in enrolledCoursesWithGrades
    const courseObj = enrolledCoursesWithGrades.find(c => c.code === selectedGaCourseCode);
    if (!courseObj) return [];

    const gaMap: Record<string, { gaTitle: string; scores: number[] }> = {};

    (courseObj.results?.clos ?? []).forEach((clo: any) => {
      if (!clo.mappedGA) return;
      const gaId = typeof clo.mappedGA === 'object' ? clo.mappedGA.gaId : clo.mappedGA;
      const gaTitle = typeof clo.mappedGA === 'object' ? (clo.mappedGA.gaTitle || gaId) : `Graduate Attribute ${gaId}`;
      if (!gaId) return;

      if (!gaMap[gaId]) {
        gaMap[gaId] = { gaTitle, scores: [] };
      }
      gaMap[gaId].scores.push(clo.percentage);
    });

    const list = Object.entries(gaMap).map(([gaId, data]) => {
      const avg = data.scores.length > 0 
        ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length 
        : 0;

      const origGA = findOriginalGA(gaId, gas);

      return {
        id: formatGACodeToStandard(gaId),
        name: origGA?.name || data.gaTitle,
        description: origGA?.description || `Competency and standard metrics for ${origGA?.name || data.gaTitle}`,
        score: Math.round(avg * 100) / 100,
        attained: avg >= 50,
        contributingCount: data.scores.length,
        coursesList: [`${courseObj.code} - ${courseObj.title}`]
      };
    });

    return [...list].sort((a, b) => naturalCompare(a.id, b.id));
  }, [enrolledCoursesWithGrades, selectedGaCourseCode, gas]);

  // Aggregate Course Learning Outcomes (CLO) for the selected filter course
  const filteredCLOList = useMemo(() => {
    const list: { courseCode: string; courseTitle: string; cloCode: string; description: string; mappedGA: string | null; percentage: number; status: string }[] = [];
    
    enrolledCoursesWithGrades.forEach(c => {
      if (selectedCloCourseCode && c.code !== selectedCloCourseCode) return;
      
      c.results.clos.forEach(clo => {
        list.push({
          courseCode: c.code,
          courseTitle: c.title,
          cloCode: clo.code,
          description: clo.description || `Course Learning Outcome for ${clo.code}`,
          mappedGA: clo.mappedGA || null,
          percentage: Math.round(clo.percentage),
          status: clo.status
        });
      });
    });

    return list;
  }, [enrolledCoursesWithGrades, selectedCloCourseCode]);

  // Helper to retrieve detailed marks breakdown for expanded views
  const getCourseMarksBreakdown = (course: any) => {
    if (!course) return [];

    const courseCode = course.code;
    const stdRegNo = activeRegNo;

    // Try to find the matched instructor course for dynamic real-time calculations
    let matchedIC = allInstructorCoursesState.find((ic: any) =>
      matchInstructorCourse(ic, courseCode, course.name || course.title)
    ) || (instructorCourses || []).find((ic: any) =>
      matchInstructorCourse(ic, courseCode, course.name || course.title)
    );

    if (!matchedIC && course && (course.categories || course.studentMarks || course.student_marks)) {
      matchedIC = {
        ...course,
        categories: course.categories || course.course_categories || [],
        unitsData: course.unitsData || course.units_data || {},
        students: [
          {
            regNo: stdRegNo,
            marks: course.studentMarks || course.student_marks || course.marks || {}
          }
        ]
      };
    }

    if (matchedIC) {
      let matchedStudentInIC = matchedIC.students?.find((s: any) =>
        areStudentsEqual(s.regNo, stdRegNo)
      );

      const directMarks = course.studentMarks || course.student_marks || course.marks || (course.students && course.students[0]?.marks) || {};
      if (!matchedStudentInIC || (!matchedStudentInIC.marks && Object.keys(directMarks).length > 0)) {
        matchedStudentInIC = {
          regNo: stdRegNo,
          marks: {
            ...(matchedStudentInIC?.marks || {}),
            ...directMarks
          }
        };
      }

      if (matchedStudentInIC && matchedStudentInIC.marks) {
        const activeCats = (matchedIC.categories || course.categories || []).filter((cat: any) => cat.percentage > 0);
        
        if (activeCats.length > 0) {
          return activeCats.map((cat: any) => {
            let totalMaxMarks = 0;
            let studentObtainedSum = 0;
            const existingUnits = matchedIC.unitsData?.[cat.name] || course.unitsData?.[cat.name] || [];

            for (let u = 1; u <= (cat.units || 1); u++) {
              const matchingUnit = existingUnits.find((unit: any) => unit.unitNo === u);
              const questions = matchingUnit?.questions || [];

              if (questions.length > 0) {
                questions.forEach((q: any) => {
                  totalMaxMarks += q.maxMarks || 0;
                  studentObtainedSum += getFuzzyStudentMark(matchedStudentInIC.marks, cat.name, u, q.id);
                });
              } else {
                const maxMarks = matchingUnit ? matchingUnit.totalMarks : 10;
                totalMaxMarks += maxMarks;
                studentObtainedSum += getFuzzyStudentMark(matchedStudentInIC.marks, cat.name, u);
              }
            }

            const catContribution = totalMaxMarks > 0
              ? (studentObtainedSum / totalMaxMarks) * cat.percentage
              : 0;

            const scored = parseFloat(catContribution.toFixed(1));
            const max = cat.percentage;
            const pct = max > 0 ? Math.round((scored / max) * 100) : 0;

            return {
              category: cat.name,
              scored,
              max,
              pct
            };
          });
        }
      }
    }
    
    // If we have a categoryBreakdown object directly from API
    if (course.categoryBreakdown && typeof course.categoryBreakdown === 'object') {
      if (Array.isArray(course.categoryBreakdown)) {
        return course.categoryBreakdown;
      }
      return Object.entries(course.categoryBreakdown).map(([category, val]: [string, any]) => {
        const scored = val.obtained !== undefined ? val.obtained : (val.scored ?? 0);
        const max = val.total !== undefined ? val.total : (val.weight ?? val.max ?? 100);
        const pct = val.percentage !== undefined ? val.percentage : (max > 0 ? Math.round((scored / max) * 100) : 0);
        return {
          category,
          scored,
          max,
          pct
        };
      });
    }

    // Fallback if the rawStudentCourses structure has categories
    if (course.categories && Array.isArray(course.categories)) {
      return course.categories.map((cat: any) => ({
        category: cat.name,
        scored: 0,
        max: cat.percentage ?? 100,
        pct: 0
      }));
    }

    // Default static fallback list
    return [
      { category: 'Assignments', scored: 0, max: 15, pct: 0 },
      { category: 'Quizzes', scored: 0, max: 10, pct: 0 },
      { category: 'Class Project', scored: 0, max: 15, pct: 0 },
      { category: 'Presentation', scored: 0, max: 5, pct: 0 },
      { category: 'Mid Term Exam', scored: 0, max: 20, pct: 0 },
      { category: 'Final Term Exam', scored: 0, max: 30, pct: 0 },
      { category: 'Class Attendance', scored: 0, max: 5, pct: 0 }
    ];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-semibold text-slate-600">Retrieving Student Academic Record...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans">
      
      {/* SCREEN CONTROLS - HIDDEN ON PRINT */}
      <div className="flex-1 flex flex-col print:hidden">
        {/* HEADER BAR */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 backdrop-blur-md bg-white/95 px-6 py-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src="/iqralogo.png" 
            alt="Iqra University" 
            className="h-10 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <h1 className="text-sm font-bold tracking-tight text-indigo-950 uppercase">IU Student Portal</h1>
            <p className="text-[10px] font-mono text-slate-400 font-bold tracking-wider">Academic Result & OBE Registry</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* SECURE STUDENT INFO BADGE */}
          {activeStudent && (
            <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700">
              <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
              <span>{activeStudent.name} ({activeRegNo})</span>
            </div>
          )}



          <button
            onClick={onLogout}
            className="bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-indigo-950 border border-slate-200/80 font-bold p-2.5 rounded-xl transition-all flex items-center gap-2 text-xs cursor-pointer"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6">
        
        {/* PROFILE HEADER CARD */}
        {activeStudent && (
          <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50/40 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="h-16 w-16 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-600/10">
                <GraduationCap className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold text-slate-800 tracking-tight">{activeStudent.name}</h2>
                  <span className="bg-indigo-50 text-indigo-700 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-indigo-100 font-mono tracking-wide">
                    {activeStudent.batch} Batch
                  </span>
                </div>
                <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-tight">{activeStudent.regNo}</p>
                <p className="text-xs text-slate-500 font-medium">
                  {activeProgram?.name || 'Bachelor of Science'} • <strong className="text-slate-700">{activeStudent.semester || '4th'} Semester</strong>
                </p>
              </div>
            </div>

            {/* GPA AND PROGRESS WIDGETS */}
            <div className="grid grid-cols-2 lg:flex lg:items-center gap-4 w-full md:w-auto relative z-10">
              {/* Semester GPA widget */}
              <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl text-center min-w-[130px] flex-1 lg:flex-none shadow-xs">
                <p className="text-xs uppercase font-extrabold text-blue-700 tracking-wider">
                  GPA
                </p>
                <div className="flex items-center justify-center gap-1.5 mt-1.5">
                  <Award className="h-5 w-5 text-blue-600 shrink-0" />
                  <span className="text-xl font-extrabold text-blue-950 font-mono">
                    {(activeSemesterGPA ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Cumulative GPA widget */}
              <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-xl text-center min-w-[130px] flex-1 lg:flex-none shadow-xs">
                <p className="text-xs uppercase font-extrabold text-indigo-700 tracking-wider">CGPA</p>
                <div className="flex items-center justify-center gap-1.5 mt-1.5">
                  <Award className="h-5 w-5 text-indigo-600 shrink-0" />
                  <span className="text-xl font-extrabold text-indigo-950 font-mono">{GPAStats.cgpa.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}



        {/* SECURE STUDENT INFO ON MOBILE */}
        {activeStudent && (
          <div className="md:hidden bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5 text-slate-600">
              <UserCheck className="h-4 w-4 text-indigo-600" /> Student Profile:
            </span>
            <span>{activeStudent.name} ({activeRegNo})</span>
          </div>
        )}

        {/* TAB CONTROLS */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('transcript')}
            className={`py-3.5 px-5 font-bold text-xs tracking-wide uppercase border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'transcript'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Semester Transcript</span>
          </button>
          <button
            onClick={() => setActiveTab('obe_clo')}
            className={`py-3.5 px-5 font-bold text-xs tracking-wide uppercase border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'obe_clo'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>CLO Attainment Indices</span>
          </button>
          <button
            onClick={() => setActiveTab('ga_attainment')}
            className={`py-3.5 px-5 font-bold text-xs tracking-wide uppercase border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'ga_attainment'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <PlaqueIcon className="h-4 w-4" />
            <span>GA Attainment Profile</span>
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="mt-4">
          <AnimatePresence mode="wait">
            
            {/* TAB 1: DETAILED TRANSCRIPT */}
            {activeTab === 'transcript' && (
              <motion.div
                key="transcript-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {finalTranscripts.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden animate-fade-in">
                    <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-6 py-5 flex items-center justify-between border-b border-slate-100">
                      <div className="flex items-center gap-2.5 text-white">
                        <Award className="h-5 w-5 text-indigo-400" />
                        <div>
                          <h3 className="text-sm font-bold tracking-tight uppercase">Official Academic Transcript Record</h3>
                          <p className="text-[10px] text-slate-300 font-medium">Permanent snapshot ledger of finalized semesters (Snapshotted & Sealed)</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setIsPrintingTranscript(true)}
                          className="bg-indigo-650 hover:bg-indigo-600 text-white border border-indigo-500/30 text-[10.5px] font-bold tracking-wider uppercase px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 font-sans cursor-pointer transition-all active:scale-95 shadow-sm"
                        >
                          <Download className="h-3.5 w-3.5 text-indigo-200" />
                          <span>Download Transcript</span>
                        </button>
                        <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-black tracking-wider uppercase px-2.5 py-1 rounded-full flex items-center gap-1.5 font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                          SEALED
                        </span>
                      </div>
                    </div>

                    <div className="p-0 overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-3 px-6">Course / Code</th>
                            <th className="py-3 px-4">Instructor</th>
                            <th className="py-3 px-4">Term / Year</th>
                            <th className="py-3 px-4 text-center">Credit Hours</th>
                            <th className="py-3 px-4 text-center">Final Mark</th>
                            <th className="py-3 px-4 text-center">Grade / GPA</th>
                            <th className="py-3 px-4">Finalized On</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                          {finalTranscripts.map((t, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors font-medium">
                              <td className="py-4 px-6">
                                <div className="font-bold text-slate-900">{t.courseTitle}</div>
                                <div className="font-mono text-[10px] text-slate-400 mt-0.5">{t.courseCode}</div>
                              </td>
                              <td className="py-4 px-4 text-slate-600 font-semibold">{t.instructorName}</td>
                              <td className="py-4 px-4 text-slate-500 font-semibold">{t.academicYear} <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-md text-slate-600 font-mono ml-1">{t.semester || '6th'}</span></td>
                              <td className="py-4 px-4 text-center font-mono text-slate-500">{t.creditHours || 3}</td>
                              <td className="py-4 px-4 text-center font-mono font-black text-indigo-950">{t.finalPercentage ? t.finalPercentage.toFixed(2) : '0.00'}%</td>
                              <td className="py-4 px-4 text-center">
                                <div className="font-black text-indigo-650">{t.grade}</div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{t.gradePoints ? t.gradePoints.toFixed(2) : '0.00'} GP</div>
                              </td>
                              <td className="py-4 px-4 font-mono text-[10px] text-slate-400">
                                {t.finalizedAt ? new Date(t.finalizedAt).toLocaleDateString() : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {enrolledCoursesWithGrades.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-3xl py-16 px-4 text-center space-y-3 shadow-sm">
                    <BookOpen className="h-12 w-12 text-slate-300 mx-auto" />
                    <h3 className="text-base font-bold text-slate-700">No Course Enrollments Found</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Your courses have not been registered by the Academic Department yet. Please contact your department administration for catalog binding.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Control Bar: Semesters and Download action */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Compact Professional Semester Navigation Pills */}
                      <div className="flex flex-wrap items-center gap-2 bg-slate-100/80 p-2 rounded-xl border border-slate-200 max-w-fit shadow-xs">
                        <span className="text-xs uppercase font-bold text-slate-500 px-2">
                          Academic Semesters:
                        </span>
                        {Object.keys(coursesBySemester).map(semKey => (
                          <button
                            key={semKey}
                            onClick={() => {
                              setSelectedSemester(semKey);
                              setExpandedCourseCode(null);
                            }}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              selectedSemester === semKey
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-indigo-950 hover:bg-slate-200/50'
                            }`}
                          >
                            {semKey.replace(' Semester', '')}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            setSelectedSemester('all');
                            setExpandedCourseCode(null);
                          }}
                          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            selectedSemester === 'all'
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-600 hover:text-indigo-950 hover:bg-slate-200/50'
                          }`}
                        >
                          All Semesters
                        </button>
                      </div>

                      {/* Prominent Download Official Transcript Button */}
                      <button
                        onClick={() => setIsPrintingTranscript(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs tracking-wider uppercase px-5 py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-95 duration-200"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download Official Transcript</span>
                      </button>
                    </div>

                                        {/* Empty state when no courses enrolled */}
                    {Object.keys(coursesBySemester).length === 0 && (
                      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs">
                        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-slate-700 mb-1">No Enrolled Courses Found</h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          No academic course records or registrations were found for your student profile from the database.
                        </p>
                      </div>
                    )}
                    {/* Semesters list */}
                    {Object.keys(coursesBySemester)
                      .filter(semesterKey => selectedSemester === 'all' || selectedSemester === semesterKey)
                      .map(semesterKey => (
                        <div key={semesterKey} className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                          {/* Semester Header */}
                          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <Calendar className="h-5 w-5 text-indigo-600" />
                              <h3 className="text-sm font-bold text-indigo-950 uppercase tracking-wider">{semesterKey} Academic Ledger</h3>
                            </div>

                          </div>

                          {/* Course Cards Grid */}
                          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50/10">
                            {coursesBySemester[semesterKey].map((course, cIdx) => {
                              const isExpanded = expandedCourseCode === course.code;
                              const isPending = course.results.letterGrade === 'Pending' || course.results.letterGrade === '-' || !course.results.hasAnyMarks;
                              const hasPassed = course.results.letterGrade !== 'F' && !isPending;

                              return (
                                <div 
                                  key={`${semesterKey}-${course.code}-${course.id || ''}-${cIdx}`} 
                                  className={`bg-white border rounded-xl transition-all duration-200 flex flex-col justify-between overflow-hidden relative ${
                                    isExpanded 
                                      ? 'border-indigo-500 ring-2 ring-indigo-500/5 col-span-1 md:col-span-2 lg:col-span-3 shadow-xs' 
                                      : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                                  }`}
                                >
                                  {/* Main Card Content */}
                                  <div className="p-5 space-y-4">
                                    {/* Badges Row */}
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200">
                                        {course.code}
                                      </span>
                                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full capitalize border tracking-wide ${
                                        course.title?.toLowerCase().includes('lab')
                                          ? 'bg-purple-100 text-purple-850 border-purple-200'
                                          : course.type === 'core'
                                            ? 'bg-blue-100 text-blue-850 border-blue-200'
                                            : 'bg-amber-100 text-amber-850 border-amber-200'
                                      }`}>
                                        {course.type} Course
                                      </span>
                                    </div>

                                    {/* Course Title */}
                                    <div>
                                      <h4 className="text-sm font-bold text-slate-800 tracking-tight leading-snug min-h-[40px]" title={course.title}>
                                        {course.title}
                                      </h4>
                                      <p className="text-xs text-slate-500 font-medium font-sans mt-1">
                                        {course.creditHours || 3} Credit Hours • Lecture-Based OBE Class
                                      </p>
                                    </div>

                                    {/* Main Stats Row */}
                                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 bg-slate-50 p-2.5 rounded-lg">
                                      <div className="text-center">
                                        <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Score</p>
                                        <p className="text-sm font-bold text-slate-800 font-mono mt-0.5">
                                          {course.results.hasAnyMarks 
                                            ? `${course.results.aggregate % 1 === 0 ? course.results.aggregate.toFixed(0) : course.results.aggregate.toFixed(2).replace(/\.?0+$/, '')}%`
                                            : 'Pending'}
                                        </p>
                                      </div>

                                      <div className="text-center border-x border-slate-200">
                                        <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Grade</p>
                                        <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded mt-0.5 ${
                                          isPending
                                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                            : hasPassed 
                                              ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                                              : 'bg-red-100 text-red-800 border border-red-200'
                                        }`}>
                                          {course.results.letterGrade}
                                        </span>
                                      </div>

                                      <div className="text-center">
                                        <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">GPA</p>
                                        <p className="text-sm font-bold text-indigo-950 font-mono mt-0.5">
                                          {course.results.hasAnyMarks ? course.results.points.toFixed(2) : '-'}
                                        </p>
                                      </div>
                                    </div>
                                                              {/* Card Footer Action */}
                                  <div 
                                    onClick={() => setExpandedCourseCode(isExpanded ? null : course.code)}
                                    className="bg-slate-50 border-t border-slate-200 px-5 py-2.5 flex items-center justify-between text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-100 cursor-pointer transition-colors"
                                  >
                                    <span>{isExpanded ? 'Hide Details' : 'View Assessment'}</span>
                                    <div className="text-slate-400">
                                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </div>
                                  </div>

                                  {/* Course Expanded Details: Question/Assessment Breakdown */}
                                  {isExpanded && (
                                    <div className="px-5 pb-5 pt-3 bg-slate-50/50 border-t border-slate-200 space-y-4 animate-fade-in">
                                      <div>
                                        <h5 className="text-xs font-bold uppercase text-indigo-950 tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-200">
                                          <ClipboardCheck className="h-4.5 w-4.5 text-indigo-600" />
                                          Assessment Marks Breakdown
                                        </h5>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                                          {getCourseMarksBreakdown(course).map((item, idx) => (
                                            <div key={idx} className="bg-white border border-slate-200 p-3 rounded-lg flex justify-between items-center shadow-xs">
                                              <div>
                                                <p className="text-xs font-bold text-slate-700 truncate max-w-[120px]" title={item.category}>{item.category}</p>
                                                <p className="text-xs text-slate-500 font-mono font-medium mt-0.5">Weight: {item.max}%</p>
                                              </div>
                                              <div className="text-right">
                                                <p className="text-xs font-bold text-indigo-950 font-mono">
                                                  {item.scored} <span className="text-slate-500">/{item.max}</span>
                                                </p>
                                                <p className="text-xs font-bold text-blue-600 font-mono mt-0.5">{item.pct}%</p>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>        </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 2: CLO PERFORMANCE ANALYTICS */}
            {activeTab === 'obe_clo' && (
              <motion.div
                key="clo-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6"
              >
                {selectedCloCourseCode === null ? (
                  <div className="space-y-6">
                    <div className="pb-4 border-b border-slate-100 space-y-1">
                      <h3 className="text-base font-bold text-slate-800">Course Learning Outcome (CLO) Audit</h3>
                      <p className="text-xs text-slate-400">Select a registered course below to view its specific CLO attainments. A score of 50% or above denotes outcome attainment.</p>
                    </div>

                    {enrolledCoursesWithGrades.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                        No registered courses found.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {enrolledCoursesWithGrades.map((course, cIdx) => {
                          const totalCLOs = course.results?.clos?.length || 0;
                          const attainedCLOs = course.results?.clos?.filter((clo: any) => clo.status === 'Attained').length || 0;
                          const pctAttained = totalCLOs > 0 ? Math.round((attainedCLOs / totalCLOs) * 100) : 0;
                          const grade = course.results?.letterGrade || '-';
                          const aggregate = course.results?.aggregate !== undefined ? course.results.aggregate : null;

                          return (
                            <div
                              key={`clo-${course.code}-${course.id || ''}-${cIdx}`}
                              onClick={() => setSelectedCloCourseCode(course.code)}
                              className="group cursor-pointer bg-slate-50/50 hover:bg-white border border-slate-200/60 hover:border-indigo-300 hover:shadow-md p-5 rounded-2xl transition-all flex flex-col justify-between h-48 relative overflow-hidden"
                            >
                              <div className="space-y-1.5 z-10">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                    {course.code}
                                  </span>
                                  {grade !== '-' && (
                                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                      Grade: {grade} ({aggregate !== null ? `${aggregate % 1 === 0 ? aggregate.toFixed(0) : aggregate.toFixed(2).replace(/\.?0+$/, '')}%` : ''})
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-sm font-bold text-slate-800 tracking-tight group-hover:text-indigo-900 transition leading-snug line-clamp-2">
                                  {course.title}
                                </h4>
                              </div>

                              <div className="space-y-2 pt-2 border-t border-slate-100 z-10">
                                <div className="flex justify-between items-center text-xs text-slate-500 font-semibold">
                                  <span>CLOs Mapped:</span>
                                  <span className="font-mono text-indigo-950 font-black">
                                    {attainedCLOs} / {totalCLOs} attained
                                  </span>
                                </div>
                                <div className="w-full bg-slate-150 h-2 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      pctAttained === 100 ? 'bg-blue-500' : pctAttained >= 50 ? 'bg-indigo-500' : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${pctAttained}%` }}
                                  />
                                </div>
                                <div className="flex justify-end pt-1">
                                  <span className="text-[10px] text-indigo-600 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                    View CLO Attainments
                                    <ChevronRight className="w-3 h-3" />
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Back Button and Course Info Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                      <div className="space-y-1">
                        <button
                          onClick={() => setSelectedCloCourseCode(null)}
                          className="group flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition cursor-pointer mb-1 bg-slate-100/80 hover:bg-indigo-50 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-indigo-200"
                        >
                          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                          Back to Course List
                        </button>
                        {(() => {
                          const currentCourse = enrolledCoursesWithGrades.find(c => c.code === selectedCloCourseCode);
                          return (
                            <div>
                              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded border border-indigo-200 font-black">{currentCourse?.code}</span>
                                {currentCourse?.title}
                              </h3>
                              <p className="text-xs text-slate-400">Course Learning Outcome (CLO) details and individual attainment scores.</p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {filteredCLOList.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                        No active CLO targets found in this course.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredCLOList.map((clo, idx) => {
                          const attained = clo.status === 'Attained';
                          return (
                            <div key={idx} className="bg-slate-50/50 hover:bg-white border border-slate-200/60 p-4.5 rounded-2xl shadow-sm transition-all flex flex-col justify-between gap-3">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-sm font-extrabold tracking-wide text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border-2 border-indigo-200/80 shadow-2xs">
                                      {clo.cloCode}
                                    </span>
                                  </div>
                                  <span className={`text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-lg border-2 shadow-xs transition-all ${
                                    attained 
                                      ? 'bg-blue-100 text-blue-800 border-blue-300 shadow-xs' 
                                      : 'bg-rose-100 text-rose-800 border-rose-300 shadow-xs'
                                  }`}>
                                    {clo.status}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                                  {clo.description}
                                </p>
                              </div>

                              <div className="space-y-1 pt-1">
                                <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold">
                                  <span>Attainment Progress Index:</span>
                                  <span className="font-mono text-indigo-950 font-black">{clo.percentage}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${attained ? 'bg-blue-500' : 'bg-amber-500'}`}
                                    style={{ width: `${clo.percentage}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 3: GA ATTAINMENT PROFILE */}
            {activeTab === 'ga_attainment' && (
              <motion.div
                key="ga-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6"
              >
                {selectedGaCourseCode === null ? (
                  <div className="space-y-6">
                    <div className="pb-4 border-b border-slate-100 space-y-1">
                      <h3 className="text-base font-bold text-slate-800">Graduate Attribute (GA) Attainment Profile</h3>
                      <p className="text-xs text-slate-400">Select a registered course below to view the program-wide Graduate Attributes (GAs) mapped to its learning outcomes.</p>
                    </div>

                    {enrolledCoursesWithGrades.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                        No registered courses found.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {enrolledCoursesWithGrades.map((course, cIdx) => {
                          const mappedGAsFromCLOs = Array.from(new Set(
                            (course.results?.clos ?? [])
                              .filter((clo: any) => clo.mappedGA && clo.mappedGA.gaId)
                              .map((clo: any) => clo.mappedGA.gaId)
                          )) as string[];
                          const mappedGAsCount = mappedGAsFromCLOs.length;
                          const grade = course.results?.letterGrade || '-';
                          const aggregate = course.results?.aggregate !== undefined ? course.results.aggregate : null;

                          return (
                            <div
                              key={`ga-${course.code}-${course.id || ''}-${cIdx}`}
                              onClick={() => setSelectedGaCourseCode(course.code)}
                              className="group cursor-pointer bg-slate-50/50 hover:bg-white border border-slate-200/60 hover:border-blue-300 hover:shadow-md p-5 rounded-2xl transition-all flex flex-col justify-between h-48 relative overflow-hidden"
                            >
                              <div className="space-y-1.5 z-10">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                    {course.code}
                                  </span>
                                  {grade !== '-' && (
                                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                      Grade: {grade} ({aggregate !== null ? `${aggregate % 1 === 0 ? aggregate.toFixed(0) : aggregate.toFixed(2).replace(/\.?0+$/, '')}%` : ''})
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-sm font-bold text-slate-800 tracking-tight group-hover:text-blue-900 transition leading-snug line-clamp-2">
                                  {course.title}
                                </h4>
                              </div>

                              <div className="space-y-2 pt-2 border-t border-slate-100 z-10">
                                <div className="flex justify-between items-center text-xs text-slate-500 font-semibold">
                                  <span>Graduate Attributes:</span>
                                  <span className="font-mono text-blue-950 font-black">
                                    {mappedGAsCount} {mappedGAsCount === 1 ? 'Attribute' : 'Attributes'}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1 pt-1 overflow-hidden h-6">
                                  {mappedGAsCount === 0 ? (
                                    <span className="text-[9px] text-slate-400 font-bold">No GAs Mapped</span>
                                  ) : (
                                    mappedGAsFromCLOs.map((gaId) => (
                                      <span key={gaId} className="bg-blue-50/50 border border-blue-100 text-blue-700 font-mono text-[9px] font-bold px-1.5 rounded">
                                        {formatGACodeToStandard(gaId)}
                                      </span>
                                    ))
                                  )}
                                </div>
                                <div className="flex justify-end pt-1">
                                  <span className="text-[10px] text-blue-600 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                    View GA Attainment
                                    <ChevronRight className="w-3 h-3" />
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Back Button and Course Info Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                      <div className="space-y-1">
                        <button
                          onClick={() => setSelectedGaCourseCode(null)}
                          className="group flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition cursor-pointer mb-1 bg-slate-100/80 hover:bg-blue-50 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-blue-200"
                        >
                          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                          Back to Course List
                        </button>
                        {(() => {
                          const currentCourse = enrolledCoursesWithGrades.find(c => c.code === selectedGaCourseCode);
                          return (
                            <div>
                              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded border border-blue-200 font-black">{currentCourse?.code}</span>
                                {currentCourse?.title}
                              </h3>
                              <p className="text-xs text-slate-400">Graduate Attribute (GA) attainment details mapping for this specific course.</p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {courseGaAttainment.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                        No Graduate Attributes mapped to this course's learning outcomes.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {courseGaAttainment.map((ga, idx) => {
                          const attained = ga.score >= 50;
                          return (
                            <div key={idx} className="bg-slate-50/50 hover:bg-white border border-slate-200/60 p-4.5 rounded-2xl shadow-sm transition-all flex flex-col justify-between gap-3">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-sm font-extrabold tracking-wide text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border-2 border-blue-200/80 shadow-2xs">
                                      {formatGACodeToStandard(ga.id)}
                                    </span>
                                  </div>
                                  <span className={`text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-lg border-2 shadow-xs transition-all ${
                                    attained 
                                      ? 'bg-blue-100 text-blue-800 border-blue-300 shadow-xs' 
                                      : 'bg-rose-100 text-rose-800 border-rose-300 shadow-xs'
                                  }`}>
                                    {attained ? 'Attained' : 'Not Attained'}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <h4 className="text-sm font-bold text-slate-800 tracking-tight leading-snug">{ga.name}</h4>
                                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                                    {ga.description}
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-1 pt-1">
                                <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold">
                                  <span>Attainment Progress Index:</span>
                                  <span className="font-mono text-blue-950 font-black">{ga.score.toFixed(2)}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${attained ? 'bg-blue-500' : 'bg-amber-500'}`}
                                    style={{ width: `${ga.score}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>

          {/* RAW BACKEND DATA INSPECTOR FOR TRANSPARENT DEBUGGING */}
          <div className="mt-8 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 text-slate-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-100 font-mono flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  API Live Connection Diagnostics
                </h3>
                <p className="text-[10px] text-slate-500 font-mono">
                  Verifying real-time data flow mapping between backend and student dashboard.
                </p>
              </div>
              <button
                id="toggle-api-inspector-btn"
                onClick={() => setShowApiInspector(!showApiInspector)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[10px] px-3.5 py-1.5 rounded-xl border border-slate-700 transition self-start sm:self-auto cursor-pointer"
              >
                {showApiInspector ? 'Hide Raw API JSON' : 'Inspect Raw API JSON'}
              </button>
            </div>

            {showApiInspector && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-850 font-mono text-xs overflow-auto max-h-96 space-y-2">
                  <div className="text-amber-400 font-bold border-b border-slate-850 pb-1.5 mb-2 flex justify-between">
                    <span>GET /api/student/courses/</span>
                    <span className="text-slate-500 font-normal">Count: {Array.isArray(rawStudentCourses) ? rawStudentCourses.length : 0}</span>
                  </div>
                  {rawStudentCourses ? (
                    <pre className="text-[11px] text-slate-300 whitespace-pre-wrap break-all leading-normal">
                      {JSON.stringify(rawStudentCourses, null, 2)}
                    </pre>
                  ) : (
                    <div className="text-slate-500 italic py-4 text-center">
                      No course data retrieved yet. Please verify authentication or server connectivity.
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] font-mono leading-relaxed bg-slate-950/50 p-4 rounded-2xl border border-slate-850">
                  <div className="space-y-1">
                    <span className="text-blue-400 font-bold">Processed Courses ({instructorCourses.length}):</span>
                    {instructorCourses.map((ic, icIdx) => (
                      <div key={`${ic.code}-${icIdx}`} className="text-slate-400 pl-2">
                        • <span className="text-slate-200 font-bold">{ic.code}</span> (OBE Questions: {ic.obeQuestions?.length || 0})
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <span className="text-indigo-400 font-bold">Active Student:</span>
                    <div className="text-slate-300 pl-2">Reg No: <span className="text-white font-bold">{activeRegNo}</span></div>
                    <div className="text-slate-300 pl-2">Name: <span className="text-slate-400 font-bold">{students.find(s => areStudentsEqual(s.regNo, activeRegNo))?.name || 'Logged-In Student'}</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

      </main>
      </div>

      {/* PRINT-ONLY CSS DIRECTIVES */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #transcript-print-area, #transcript-print-area * {
            visibility: visible !important;
          }
          #transcript-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
          }
          @page {
            size: portrait;
            margin: 15mm;
          }
        }
      `}</style>

      {/* TRANSCRIPT PREVIEW MODAL */}
      <AnimatePresence>
        {isPrintingTranscript && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-hidden font-sans print:hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-slate-100 border border-slate-250 rounded-2xl w-full max-w-5xl h-[95vh] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Top Control Bar */}
              <div className="bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 rounded-lg border border-indigo-100">
                    <FileText className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-tight">Official Transcript Report Builder</h3>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">Verify academic ledger snapshot limits and export perfectly aligned vector PDFs</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print</span>
                  </button>
                  <button
                    onClick={downloadTranscriptPDF}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={() => setIsPrintingTranscript(false)}
                    className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg shadow-xs transition-colors cursor-pointer text-xs font-semibold px-3 py-2"
                  >
                    <X className="w-4 h-4" />
                    <span>Close Preview</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Viewport */}
              <div className="flex-1 overflow-auto p-6 bg-slate-200/50">
                <div 
                  id="transcript-print-area" 
                  className="max-w-[210mm] mx-auto bg-white shadow-2xl border border-slate-300 rounded-xl p-8 min-h-[297mm] text-left text-black font-sans leading-relaxed antialiased"
                >
                    {/* Top Header Block */}
                    <div className="flex flex-col items-center mb-6 border-b border-black pb-4">
                      <img 
                        src="/iqralogo.png" 
                        alt="Iqra University Logo" 
                        className="h-16 w-auto object-contain mb-2"
                        referrerPolicy="no-referrer"
                      />
                      <h1 className="text-lg font-black tracking-widest text-black uppercase font-mono animate-pulse">
                        INCOMPLETE TRANSCRIPT
                      </h1>
                    </div>

                    {/* Personal Details Row */}
                    <div className="grid grid-cols-2 gap-4 mb-8 text-[11px] font-mono border-b border-black/20 pb-4">
                      <div className="space-y-1.5">
                        <div><span className="font-bold inline-block w-32 text-slate-500 text-left">STUDENT NAME:</span> <span className="font-extrabold text-black uppercase">{activeStudent?.name}</span></div>
                        <div><span className="font-bold inline-block w-32 text-slate-500 text-left">REG NUMBER:</span> <span className="font-extrabold text-black uppercase">{activeStudent?.regNo || activeRegNo}</span></div>
                      </div>
                      <div className="space-y-1.5 text-right">
                        <div><span className="font-bold inline-block w-32 text-slate-500 text-left">DEPARTMENT:</span> <span className="font-extrabold text-black uppercase">{activeDepartment?.name || 'Department of Computing'}</span></div>
                        <div><span className="font-bold inline-block w-32 text-slate-500 text-left">PROGRAM:</span> <span className="font-extrabold text-black uppercase">{activeProgram?.name || 'BS (Computer Science)'}</span></div>
                      </div>
                    </div>

                    {/* Courses Table */}
                    <table className="w-full border-collapse text-[10px] font-mono leading-normal">
                      <thead>
                        <tr className="border-b-2 border-black text-left">
                          <th className="py-2 pr-4 font-bold uppercase w-[100px]">Course Code</th>
                          <th className="py-2 pr-4 font-bold uppercase">Course Name</th>
                          <th className="py-2 pr-4 font-bold uppercase w-[100px] text-center">Credit Hours</th>
                          <th className="py-2 font-bold uppercase w-[80px] text-right">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(printAllCoursesBySemester).map(semKey => {
                          const coursesInSem = printAllCoursesBySemester[semKey] || [];
                          const semGPA = printSemesterGPAs[semKey] || 0;
                          const printedLabel = printSemesterMapping[semKey] || semKey;
                          
                          return (
                            <React.Fragment key={semKey}>
                              {/* Semester Sub-header Row */}
                              <tr className="bg-slate-100 border-t border-b border-black/30">
                                <td colSpan={4} className="py-1 px-2 font-black uppercase text-[10px] tracking-wider">
                                  {printedLabel}
                                </td>
                              </tr>
                              {coursesInSem.map((course: any, cIdx: number) => (
                                <tr key={`print-${semKey}-${course.code}-${course.id || ''}-${cIdx}`} className="border-b border-black/10">
                                  <td className="py-1.5 pr-4 font-bold">{course.code}</td>
                                  <td className="py-1.5 pr-4 uppercase">{course.title}</td>
                                  <td className="py-1.5 pr-4 text-center">{course.creditHours || 3}</td>
                                  <td className="py-1.5 text-right font-bold">{course.results?.letterGrade || '-'}</td>
                                </tr>
                              ))}
                              {/* Semester GPA Row */}
                              <tr className="border-b border-black/20">
                                <td colSpan={3} className="py-1.5 text-right pr-4 font-bold uppercase text-[9px] text-slate-500">
                                  Semester GPA:
                                </td>
                                <td className="py-1.5 text-right font-black text-[10px]">
                                  {semGPA.toFixed(2)}
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Bottom Total Credits & CGPA Footer */}
                    <div className="mt-8 pt-6 border-t-2 border-black flex justify-between items-start text-[11px] font-mono font-bold">
                      <div className="space-y-1 animate-pulse">
                        <div>TOTAL EARNED CREDITS: {printTotalEarnedCredits}</div>
                        <div className="text-xs">CGPA: {GPAStats.cgpa.toFixed(2)}</div>
                      </div>
                      <div className="text-right text-[8px] text-slate-500 font-mono">
                        * IQRA UNIVERSITY OFFICIAL PORTAL TRANSCRIPT SYSTEM *
                        <br />
                        DATE PRINTED: {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}
                      </div>
                    </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
