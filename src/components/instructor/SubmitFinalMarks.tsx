import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Lock, X } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { PastCourse, StudentResultStatus, SubmissionCheck } from '../../types';

export const Overlay = ({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-4 font-sans" role="dialog" aria-modal="true" aria-label={title}>
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

/**
 * Checks a course and hands in its final marks. A student with a missing mark
 * blocks submitting until the mark is entered or they are marked absent or
 * withdrawn; an assessment nobody has a mark in is a warning to accept.
 */
export function SubmitFinalMarksDialog({ courseId, courseLabel, onClose, onSubmitted, finalizes = false }: {
  courseId: string;
  courseLabel: string;
  onClose: () => void;
  onSubmitted: () => void;
  /** The department entering a past course: this finalizes it, with no one to hand it to. */
  finalizes?: boolean;
}) {
  const [check, setCheck] = useState<SubmissionCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setCheck(await apiService.getSubmissionCheck(courseId));
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not check this course.');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const setStatus = async (regNo: string, status: StudentResultStatus) => {
    setBusy(true);
    setAccepted(false);   // the warnings may be different now
    try {
      await apiService.setStudentResultStatus(courseId, regNo, status);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not update this student.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiService.submitFinalMarks(courseId, accepted);
      onSubmitted();
    } catch (e: any) {
      await load();
      setError(e?.message || 'Could not submit final marks.');
      setBusy(false);
    }
  };

  const missingByReg = new Map<string, string[]>((check?.missing || []).map(m => [m.regNo, m.items]));
  const blocked = !check || check.errors.length > 0 || check.missing.length > 0;
  const needsAccept = !!check && check.warnings.length > 0 && !accepted;
  const inputCls = 'bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 cursor-pointer disabled:opacity-60';

  return (
    <Overlay title={finalizes ? 'Finalize Course' : 'Submit Final Marks'} subtitle={courseLabel} onClose={onClose}>
      <div className="overflow-y-auto px-5 py-4 space-y-4 text-xs text-slate-700">
        {error && <p className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-3 py-2">{error}</p>}
        {!check && !error && <p className="text-slate-500">Checking marks…</p>}

        {check && check.errors.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-rose-800">
            <p className="font-bold mb-1">Fix the marking setup first</p>
            <ul className="list-disc pl-4 space-y-0.5">{check.errors.map(e => <li key={e}>{e}</li>)}</ul>
          </div>
        )}

        {check && check.missing.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-rose-800">
            <p className="font-bold">{check.missing.length} student{check.missing.length === 1 ? ' has' : 's have'} missing marks</p>
            <p className="mt-0.5">Close this and enter the marks, or mark the student absent or withdrawn below.</p>
          </div>
        )}

        {check && check.warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-amber-900">
            <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Did you forget an assessment?</p>
            <ul className="list-disc pl-4 space-y-0.5 mt-1">{check.warnings.map(w => <li key={w}>{w}</li>)}</ul>
            <label className="flex items-center gap-2 mt-2 font-semibold cursor-pointer">
              <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
              I checked this, and these assessments should count as 0
            </label>
          </div>
        )}

        {check && !blocked && check.warnings.length === 0 && (
          <p className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-3 py-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> All marks are entered.
          </p>
        )}

        {check && (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Student</th>
                  <th className="px-3 py-2 font-semibold">Missing</th>
                  <th className="px-3 py-2 font-semibold w-32">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {check.students.map(s => {
                  const items = missingByReg.get(s.regNo);
                  return (
                    <tr key={s.regNo} className={items ? 'bg-rose-50/50' : ''}>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-slate-900">{s.name || s.regNo}</p>
                        <p className="font-mono text-[11px] text-slate-500">{s.regNo}</p>
                      </td>
                      <td className="px-3 py-2 text-rose-700">{items ? items.join(', ') : ''}</td>
                      <td className="px-3 py-2">
                        <select
                          aria-label={`Status of ${s.name || s.regNo}`}
                          className={inputCls}
                          disabled={busy}
                          value={s.resultStatus}
                          onChange={e => setStatus(s.regNo, e.target.value as StudentResultStatus)}
                        >
                          <option value="">Regular</option>
                          <option value="absent">Absent</option>
                          <option value="withdrawn">Withdrawn</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {check && (
          <p className="text-slate-500">Absent: marks they don't have count as 0. Withdrawn: grade W, and the course doesn't count in their GPA.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
        <p className="text-xs text-slate-600 flex items-center gap-1.5 min-w-0">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          {finalizes
            ? "Grades go to the transcript, reports and the teacher's Past Courses. You can reopen it to correct a mistake."
            : "You can't change marks after submitting unless the department sends the course back."}
        </p>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer">Cancel</button>
          <button
            onClick={submit}
            disabled={busy || blocked || needsAccept}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {busy ? 'Working…' : finalizes ? 'Finalize Course' : 'Submit Final Marks'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/** Read-only list of the courses a teacher has submitted or had finalized. */
export function PastCoursesDialog({ onClose, onOpenCourse }: { onClose: () => void; onOpenCourse: (courseId: string) => void }) {
  const [courses, setCourses] = useState<PastCourse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    apiService.getPastCourses()
      .then(setCourses)
      .catch((e: any) => setError(e?.message || 'Could not load past courses.'));
  }, []);

  return (
    <Overlay title="Past Courses" subtitle="Open a course to see all of it. You can't change its marks." onClose={onClose}>
      <div className="overflow-y-auto px-5 py-4 space-y-2 text-xs text-slate-700">
        {error && <p className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-3 py-2">{error}</p>}
        {!courses && !error && <p className="text-slate-500">Loading…</p>}
        {courses && courses.length === 0 && <p className="text-slate-500 py-6 text-center">No past courses yet.</p>}
        {courses && courses.map(c => {
          const isOpen = openId === c.id;
          return (
            <div key={c.id} className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-stretch">
              <button
                onClick={() => setOpenId(isOpen ? null : c.id)}
                aria-expanded={isOpen}
                className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 cursor-pointer"
              >
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                <span className="font-mono font-bold text-indigo-700">{c.code}</span>
                <span className="font-semibold text-slate-900 truncate">{c.title}</span>
                <span className="text-slate-500 whitespace-nowrap ml-auto">{(c.academicYear || '').replace(/-/g, ' ')}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${c.state === 'finalized' ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-800'}`}>
                  {c.state === 'finalized' ? 'Finalized' : 'Waiting for department'}
                </span>
              </button>
              <button
                onClick={() => onOpenCourse(c.id)}
                aria-label={`Open ${c.code}, ${(c.academicYear || '').replace(/-/g, ' ')}`}
                className="px-3 border-l border-slate-200 text-xs font-bold text-indigo-700 hover:bg-indigo-50 cursor-pointer"
              >
                Open
              </button>
              </div>
              {isOpen && (
                <table className="w-full text-left border-t border-slate-200">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Student</th>
                      <th className="px-3 py-2 font-semibold text-right">Total</th>
                      <th className="px-3 py-2 font-semibold text-right">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {c.students.map(s => (
                      <tr key={s.regNo}>
                        <td className="px-3 py-1.5">
                          <span className="font-semibold text-slate-900">{s.name || s.regNo}</span>
                          <span className="font-mono text-[11px] text-slate-500 ml-2">{s.regNo}</span>
                          {s.resultStatus && <span className="ml-2 text-[11px] text-amber-800 capitalize">{s.resultStatus}</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono">{s.grade === 'W' ? '—' : `${s.percentage.toFixed(2)}%`}</td>
                        <td className="px-3 py-1.5 text-right font-bold">{s.grade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </Overlay>
  );
}
