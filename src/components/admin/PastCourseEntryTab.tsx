import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Eye, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { Course, EligiblePastStudent, PastEntryCourse, Program } from '../../types';
import { pastTerms } from '../../utils/regNo';
import { Overlay } from '../instructor/SubmitFinalMarks';

interface TeacherOption {
  employeeId: string;
  name: string;
}

const inputCls = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400';
const labelCls = 'block text-[11px] font-bold text-slate-600 mb-1';
const sameId = (a?: string, b?: string) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const showTerm = (term: string) => term.replace(/-/g, ' ');

/** Picks the course, term, teacher and students, then creates the course. */
function AddPastCourseDialog({ programs, courses, teachers, defaultProgramId, onClose, onCreated }: {
  programs: Program[];
  courses: Course[];
  teachers: TeacherOption[];
  defaultProgramId: string;
  onClose: () => void;
  onCreated: (course: { id: string; teacherName: string }) => void;
}) {
  const terms = useMemo(() => pastTerms(), []);
  const [programId, setProgramId] = useState(defaultProgramId || programs[0]?.id || '');
  const [term, setTerm] = useState(terms[0]);
  const [courseCode, setCourseCode] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [eligible, setEligible] = useState<EligiblePastStudent[] | null>(null);
  const [planSemester, setPlanSemester] = useState('');
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const program = programs.find(p => sameId(p.id, programId));
  const programCourses = useMemo(
    () => courses.filter(c => sameId(c.programId, programId)).sort((a, b) => a.code.localeCompare(b.code)),
    [courses, programId]
  );

  useEffect(() => {
    setEligible(null);
    setChosen(new Set());
    setError(null);
    if (!program || !courseCode) return;
    let live = true;
    apiService.getPastCourseEligibleStudents(program.code, courseCode, term)
      .then(res => {
        if (!live) return;
        setEligible(res.students);
        setPlanSemester(res.semester);
        setChosen(new Set(res.students.filter(s => s.suggested).map(s => s.regNo)));
      })
      .catch((e: any) => { if (live) setError(e?.message || 'Could not load the students.'); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, courseCode, term]);

  const shown = (eligible || []).filter(s =>
    `${s.regNo} ${s.name}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  const toggle = (regNo: string) => setChosen(prev => {
    const next = new Set(prev);
    if (next.has(regNo)) next.delete(regNo); else next.add(regNo);
    return next;
  });

  const create = async () => {
    if (!program) return;
    setBusy(true);
    setError(null);
    try {
      const students = (eligible || []).filter(s => chosen.has(s.regNo)).map(s => ({ regNo: s.regNo, name: s.name }));
      const { id } = await apiService.createPastCourse({ programId: program.code, courseCode, academicYear: term, teacherId, students });
      onCreated({ id, teacherName: teachers.find(t => t.employeeId === teacherId)?.name || '' });
    } catch (e: any) {
      setError(e?.message || 'Could not create this course.');
      setBusy(false);
    }
  };

  return (
    <Overlay title="Add Past Course" subtitle="A course students took before this system was in use." onClose={onClose}>
      <div className="overflow-y-auto px-5 py-4 space-y-4">
        {error && <p className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-3 py-2 text-xs">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="past-program" className={labelCls}>Programme</label>
            <select id="past-program" className={inputCls} value={programId} onChange={e => { setProgramId(e.target.value); setCourseCode(''); }}>
              {programs.map(p => <option key={p.id} value={p.id}>{p.code.toUpperCase()} — {p.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="past-term" className={labelCls}>Term</label>
            <select id="past-term" className={inputCls} value={term} onChange={e => setTerm(e.target.value)}>
              {terms.map(t => <option key={t} value={t}>{showTerm(t)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="past-course" className={labelCls}>Course</label>
            <select id="past-course" className={inputCls} value={courseCode} onChange={e => setCourseCode(e.target.value)}>
              <option value="">Choose a course</option>
              {programCourses.map(c => <option key={c.id} value={c.code}>{c.code} — {c.title}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="past-teacher" className={labelCls}>Teacher who taught it</label>
            <select id="past-teacher" className={inputCls} value={teacherId} onChange={e => setTeacherId(e.target.value)}>
              <option value="">Choose a teacher</option>
              {teachers.map(t => <option key={t.employeeId} value={t.employeeId}>{t.name}</option>)}
            </select>
          </div>
        </div>

        {courseCode && (
          <div>
            <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
              <div>
                <p className={labelCls + ' mb-0'}>Students ({chosen.size} chosen)</p>
                <p className="text-[11px] text-slate-500">
                  {eligible?.some(s => s.suggested)
                    ? `Students who were in the ${planSemester} semester in ${showTerm(term)} are already ticked. Tick anyone else who took or retook it.`
                    : `${planSemester ? `The plan puts this course in the ${planSemester} semester, and no student was in it in ${showTerm(term)}. ` : ''}Tick the students who took it.`}
                </p>
              </div>
              <div className="relative w-full sm:w-52">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input aria-label="Search students" placeholder="Search students" className={inputCls + ' pl-8'} value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="border border-slate-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
              {!eligible && !error && <p className="p-4 text-center text-xs text-slate-500">Loading students…</p>}
              {eligible && shown.length === 0 && (
                <p className="p-4 text-center text-xs text-slate-500">
                  {eligible.length === 0 ? `No student of this programme could have taken it in ${showTerm(term)}.` : 'No student matches your search.'}
                </p>
              )}
              {shown.map(s => (
                <label key={s.regNo} className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={chosen.has(s.regNo)} onChange={() => toggle(s.regNo)} />
                  <span className="font-semibold text-slate-900 min-w-0 truncate">{s.name}</span>
                  <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap">{s.regNo}</span>
                  {s.semesterInTerm && <span className="ml-auto text-[11px] text-slate-500 whitespace-nowrap">{s.semesterInTerm} semester</span>}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer">Cancel</button>
        <button
          onClick={create}
          disabled={busy || !courseCode || !teacherId || chosen.size === 0}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {busy ? 'Creating…' : 'Create and Open'}
        </button>
      </div>
    </Overlay>
  );
}

/**
 * The department's past courses. Opening one shows the teacher's course screen,
 * where CLOs, weightage, questions and marks are entered as for a current course.
 */
export default function PastCourseEntryTab({ programs, courses, teachers, defaultProgramId, onOpenCourse, onNotify }: {
  programs: Program[];
  courses: Course[];
  teachers: TeacherOption[];
  defaultProgramId: string;
  onOpenCourse: (course: { id: string; teacherName: string }) => void;
  onNotify: (message: string, isError?: boolean) => void;
}) {
  const [rows, setRows] = useState<PastEntryCourse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [termFilter, setTermFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'reopen'; row: PastEntryCourse } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => apiService.getPastEntryCourses()
    .then(data => { setRows(data); setError(null); })
    .catch((e: any) => setError(e?.message || 'Could not load past courses.'));

  useEffect(() => { load(); }, []);

  const terms = useMemo(() => Array.from(new Set((rows || []).map(r => r.academicYear))), [rows]);
  const shown = (rows || []).filter(r =>
    (!termFilter || r.academicYear === termFilter)
    && (!programFilter || sameId(r.programId, programFilter))
    && (!stateFilter || r.state === stateFilter)
  );
  const drafts = (rows || []).filter(r => r.state === 'draft').length;
  const finalized = (rows || []).length - drafts;

  const runConfirmed = async () => {
    if (!confirm) return;
    const { kind, row } = confirm;
    setBusy(true);
    try {
      if (kind === 'delete') {
        await apiService.deletePastCourse(row.id);
        onNotify(`${row.code}, ${showTerm(row.academicYear)} was deleted.`);
      } else {
        await apiService.reopenPastCourse(row.id);
        onNotify(`${row.code}, ${showTerm(row.academicYear)} is open for corrections. Finalize it again when you are done.`);
      }
      await load();
    } catch (e: any) {
      onNotify(e?.message || 'That did not work. Please try again.', true);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-display font-bold text-slate-900">Past Course Entry</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Enter courses that students took in earlier terms, so they count in GA and PO attainment. Once finalized, a
            course appears in its teacher's Past Courses, in the reports and on the student's dashboard.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Add Past Course
        </button>
      </div>

      {error && <p className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-3 py-2 text-xs">{error}</p>}
      {!rows && !error && <p className="py-10 text-center text-xs text-slate-500">Loading past courses…</p>}

      {rows && rows.length === 0 && (
        <div className="border border-dashed border-slate-300 rounded-2xl py-12 px-6 text-center">
          <ClipboardList className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No past courses yet</h3>
          <p className="text-xs text-slate-500 mt-1">Add a course to enter its CLOs, weightage and marks.</p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-40">
              <label htmlFor="filter-term" className={labelCls}>Term</label>
              <select id="filter-term" className={inputCls} value={termFilter} onChange={e => setTermFilter(e.target.value)}>
                <option value="">All terms</option>
                {terms.map(t => <option key={t} value={t}>{showTerm(t)}</option>)}
              </select>
            </div>
            <div className="w-full sm:w-40">
              <label htmlFor="filter-program" className={labelCls}>Programme</label>
              <select id="filter-program" className={inputCls} value={programFilter} onChange={e => setProgramFilter(e.target.value)}>
                <option value="">All programmes</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.code.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="w-full sm:w-40">
              <label htmlFor="filter-state" className={labelCls}>Status</label>
              <select id="filter-state" className={inputCls} value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
                <option value="">All</option>
                <option value="draft">In progress</option>
                <option value="finalized">Finalized</option>
              </select>
            </div>
            <p className="text-xs text-slate-500 sm:ml-auto pb-2">{finalized} finalized, {drafts} in progress</p>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs min-w-[760px]">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Course</th>
                  <th className="px-3 py-2.5 font-semibold">Programme</th>
                  <th className="px-3 py-2.5 font-semibold">Term</th>
                  <th className="px-3 py-2.5 font-semibold">Teacher</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Students</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5">
                      <span className="font-mono font-bold text-indigo-700">{r.code}</span>
                      <span className="block text-slate-700">{r.title}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{r.programCode}{r.semester ? `, ${r.semester}` : ''}</td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{showTerm(r.academicYear)}</td>
                    <td className="px-3 py-2.5 text-slate-600">{r.teacherName}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{r.studentCount}</td>
                    <td className="px-3 py-2.5">
                      {r.state === 'finalized'
                        ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Finalized</span>
                        : <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">In progress</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onOpenCourse({ id: r.id, teacherName: r.teacherName })}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1 cursor-pointer"
                        >
                          {r.state === 'finalized' ? <Eye className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                          {r.state === 'finalized' ? 'View' : 'Continue'}
                        </button>
                        {r.state === 'finalized' ? (
                          <button
                            onClick={() => setConfirm({ kind: 'reopen', row: r })}
                            title="Reopen to correct a mistake"
                            aria-label={`Reopen ${r.code}, ${showTerm(r.academicYear)}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirm({ kind: 'delete', row: r })}
                            title="Delete this course and its marks"
                            aria-label={`Delete ${r.code}, ${showTerm(r.academicYear)}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No course matches these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {adding && (
        <AddPastCourseDialog
          programs={programs}
          courses={courses}
          teachers={teachers}
          defaultProgramId={defaultProgramId}
          onClose={() => setAdding(false)}
          onCreated={course => { setAdding(false); onOpenCourse(course); }}
        />
      )}

      {confirm && (
        <Overlay
          title={confirm.kind === 'delete' ? 'Delete this course?' : 'Reopen this course?'}
          subtitle={`${confirm.row.code} — ${confirm.row.title}, ${showTerm(confirm.row.academicYear)}`}
          onClose={() => setConfirm(null)}
        >
          <p className="px-5 py-4 text-xs text-slate-700">
            {confirm.kind === 'delete'
              ? 'Its CLOs, questions and all the marks entered so far will be deleted. This cannot be undone.'
              : "Its grades will leave the students' transcripts, and it will leave the teacher's Past Courses, until you finalize it again."}
          </p>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
            <button onClick={() => setConfirm(null)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer">Cancel</button>
            <button
              onClick={runConfirmed}
              disabled={busy}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50 cursor-pointer ${confirm.kind === 'delete' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'}`}
            >
              {busy ? 'Working…' : confirm.kind === 'delete' ? 'Delete Course' : 'Reopen Course'}
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}
