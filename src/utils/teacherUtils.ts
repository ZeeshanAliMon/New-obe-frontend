export interface MinimalTeacher {
  id: string;
  employeeId?: string;
  employee_id?: string;
  name?: string;
  email?: string;
}

export const normalizeTeacherId = (id: string): string => {
  if (!id) return '';
  const clean = id.trim().toUpperCase();
  // Map INS-CS-003 or similar to CS3
  const insCsMatch = clean.match(/^INS-CS-0*(\d+)$/);
  if (insCsMatch) {
    return `CS${insCsMatch[1]}`;
  }
  // Map INS-EE-001 or similar to EE1
  const insEeMatch = clean.match(/^INS-EE-0*(\d+)$/);
  if (insEeMatch) {
    return `EE${insEeMatch[1]}`;
  }
  // Generic mapping INS-[DEPT]-[NUM] to [DEPT][NUM]
  const insGenericMatch = clean.match(/^INS-([A-Z]+)-0*(\d+)$/);
  if (insGenericMatch) {
    return `${insGenericMatch[1]}${insGenericMatch[2]}`;
  }
  return clean;
};

export const matchTeacher = (teacher: MinimalTeacher | null | undefined, targetId: string): boolean => {
  if (!teacher || !targetId) return false;
  
  const tidNormalized = normalizeTeacherId(targetId);
  const teacherIdNormalized = normalizeTeacherId(teacher.id);
  const teacherEmpIdNormalized = normalizeTeacherId(teacher.employeeId || '');
  const teacherEmpId2Normalized = normalizeTeacherId((teacher as any).employee_id || '');

  return (
    tidNormalized === teacherIdNormalized ||
    tidNormalized === teacherEmpIdNormalized ||
    tidNormalized === teacherEmpId2Normalized ||
    teacher.id?.trim().toUpperCase() === targetId.trim().toUpperCase() ||
    teacher.employeeId?.trim().toUpperCase() === targetId.trim().toUpperCase() ||
    (teacher as any).employee_id?.trim().toUpperCase() === targetId.trim().toUpperCase()
  );
};

export const getTeacherId = (teacher: MinimalTeacher): string => {
  return teacher.employeeId || (teacher as any).employee_id || teacher.id;
};
