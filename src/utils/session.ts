/**
 * Remove every piece of per-user data this app keeps in browser storage.
 *
 * Logout used to remove a hand-maintained list of keys, which had drifted:
 * seven keys holding courses, rosters, students, teachers, semester plans and
 * marks (IQRA_OBE_INSTRUCTOR_COURSES, _STUDENTS, _STUDENT_BINDINGS,
 * _STUDENT_COURSE_STATUSES, _TEACHERS, _TEACHER_ASSIGNMENTS, _SEMESTER_PLANS)
 * were never cleared. On a shared lab PC the next person to log in could be
 * shown the previous user's data.
 *
 * Sweeping the whole IQRA_OBE_ prefix means a key added later is covered
 * automatically. Every IQRA_OBE_ key is per-user session data — none of them
 * are device preferences that should survive a logout.
 */
export const APP_STORAGE_PREFIX = 'IQRA_OBE_';

export function clearSessionStorage(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(APP_STORAGE_PREFIX) || k === 'access' || k === 'refresh')) {
        keys.push(k);
      }
    }
    // Collect first, then remove: removing while iterating shifts indices.
    keys.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    // Storage can be unavailable (privacy mode, blocked site data). Nothing
    // was persisted in that case, so there is nothing to leak.
    console.error('Could not clear session storage:', e);
  }
}
