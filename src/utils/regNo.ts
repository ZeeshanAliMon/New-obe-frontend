/**
 * Batch and current semester from a reg number and today's date: "22144-SP23" was
 * admitted in Spring 2023, so in Fall 2026 it is in its 8th semester. Same rule as
 * the backend's semester_from_reg_no, so the two must change together.
 */
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
  // Backend accepts 1st..8th only; older batches would otherwise be rejected.
  const semesterNum = diff > 0 ? Math.min(diff, 8) : 1;

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
