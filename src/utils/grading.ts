/**
 * The ONE place a student's course total and letter grade are computed.
 *
 * Instructor mark sheets and the Student Dashboard used to compute these
 * separately — three different implementations — and gave different answers
 * for the same marks. A student shown "B" on the official sheet could see
 * "C+" on their own dashboard (or an inflated A). The causes:
 *
 *  - The backend returns marks keyed by UNIT ("Assignments-1") plus per-
 *    question marks in obeMarks keyed by bare question id. The instructor
 *    turns obeMarks into "q-{cat}-{unit}-{id}" keys and reads those, falling
 *    back to the unit key for single-question units. The student dashboard
 *    instead gated each question on a fuzzy "does a key mention this id"
 *    check — so unit-level marks were skipped (total too LOW) — and its
 *    lookup tried the unit key before the question id, so when both existed
 *    every question returned the whole unit total (total too HIGH).
 *  - The student graded on a total rounded to 1 decimal (73.96 -> 74.0 = B)
 *    while the sheet graded the exact total (73.96 = C+).
 *  - The student's "custom" grading read a `threshold` field that custom
 *    grade tables don't have, so every student got the same grade.
 *
 * Everything below is the instructor mark sheet's logic, moved here verbatim,
 * because that is the document of record. Both dashboards now call it.
 */

export const DEFAULT_CUSTOM_GRADES = [
  { grade: 'A', percentage: '88% - 100%', points: '4' },
  { grade: 'B+', percentage: '81% - 87%', points: '3.5' },
  { grade: 'B', percentage: '74% - 80%', points: '3' },
  { grade: 'C+', percentage: '67% - 73%', points: '2.5' },
  { grade: 'C', percentage: '60% - 66%', points: '2' },
  { grade: 'F', percentage: 'Below 60%', points: '0' },
];

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

  const system = course.selectedGradingSystem || course.selected_grading_system || 'ready1';

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
    const list = course.customGradingSystem || course.custom_grading_system || DEFAULT_CUSTOM_GRADES;
    // Look through defined ranges
    for (const tier of list) {
      const range = parsePercentRange(tier.percentage);
      if (marks >= range.min && marks <= range.max) {
        return tier.grade;
      }
    }
    // Simple fallback using sorted list
    const sorted = [...list].sort((a: any, b: any) => {
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

/**
 * Build the mark map the calculation reads, from what the backend returns:
 * unit-level marks ("Assignments-1") plus per-question OBE marks keyed by
 * bare question id. Question marks become "q-{category}-{unit}-{id}".
 * Same conversion the instructor dashboard performs when it loads a course.
 */
export const buildStudentMarkKeys = (
  unitMarks: Record<string, any> | undefined,
  studentObeMarks: Record<string, any> | undefined,
  course: any
): Record<string, number> => {
  const marks: Record<string, number> = {};
  Object.entries(unitMarks || {}).forEach(([k, v]) => { marks[k] = Number(v); });

  // question id -> (category, unit), from obeQuestions and from unitsData
  const where: Record<string, { cat: string; unit: number }> = {};
  (course?.obeQuestions || course?.obe_questions || []).forEach((q: any) => {
    const cat = q.categoryName ?? q.category_name;
    const unit = q.unitNo ?? q.unit_no;
    if (q.id != null && cat != null && unit != null) where[String(q.id)] = { cat, unit: Number(unit) };
  });
  const unitsData = course?.unitsData || course?.units_data || {};
  Object.entries(unitsData).forEach(([cat, units]: [string, any]) => {
    (units || []).forEach((u: any) => {
      (u.questions || []).forEach((q: any) => {
        if (q.id != null && !where[String(q.id)]) where[String(q.id)] = { cat, unit: Number(u.unitNo ?? u.unit_no) };
      });
    });
  });

  Object.entries(studentObeMarks || {}).forEach(([qId, score]) => {
    const loc = where[String(qId)];
    if (loc) marks[`q-${loc.cat}-${loc.unit}-${qId}`] = Number(score);
  });
  return marks;
};

export interface CourseAggregate {
  aggregate: number;
  categoryContributions: Record<string, number>;
}

/**
 * A student's weighted course total (0-100) from a normalised mark map.
 * Moved verbatim from the instructor mark sheet's studentTotalGrades loop.
 */
export const computeCourseAggregate = (course: any, marks: Record<string, any> | undefined): CourseAggregate => {
  let aggregate = 0;
  const categoryContributions: Record<string, number> = {};
  const activeCats = (course?.categories || []).filter((c: any) => c.percentage > 0);
  const unitsData = course?.unitsData || course?.units_data || {};

  activeCats.forEach((cat: any) => {
    let totalMaxMarks = 0;
    let studentObtainedSum = 0;
    const existingUnits = unitsData[cat.name] || [];

    if (cat.units > 0) {
      for (let u = 1; u <= cat.units; u++) {
        const matchingUnit = existingUnits.find((unit: any) => unit.unitNo === u);
        const questions = matchingUnit?.questions || [];

        if (questions.length > 0) {
          questions.forEach((q: any) => {
            totalMaxMarks += q.maxMarks || 0;
            const qKey = `q-${cat.name}-${u}-${q.id}`;
            const dKey = `${cat.name}-${u}`;
            const val = marks?.[qKey];
            if (val !== undefined && Number(val) > 0) {
              studentObtainedSum += Number(val);
            } else if (questions.length === 1) {
              studentObtainedSum += Number(marks?.[dKey] || 0);
            } else {
              studentObtainedSum += Number(val || 0);
            }
          });
        } else {
          const maxMarks = matchingUnit ? matchingUnit.totalMarks : 10;
          totalMaxMarks += maxMarks;
          const dKey = `${cat.name}-${u}`;
          studentObtainedSum += Number(marks?.[dKey] || 0);
        }
      }
    }

    const catContribution = totalMaxMarks > 0
      ? (studentObtainedSum / totalMaxMarks) * cat.percentage
      : 0;

    categoryContributions[cat.name] = catContribution;
    aggregate += catContribution;
  });

  return { aggregate, categoryContributions };
};
