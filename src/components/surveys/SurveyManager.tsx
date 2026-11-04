import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, FileUp, RefreshCw, Save, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiService } from '../../services/apiService';

/**
 * The four NCEAC surveys. The forms run in Microsoft Forms; QA uploads the
 * downloaded responses here and manages the question mappings. Department
 * admins see the same results, read-only.
 */

interface ProgramOption { id: string; code?: string; name: string }
interface FormQuestion { no: number; text: string; target: string }
interface SurveyForm { formType: string; title: string; usedFor: 'GA' | 'PO'; targets: { id: string; name: string }[]; questions: FormQuestion[] }

const FORM_TYPES = [
  { id: 'internship', title: 'Internship Feedback' },
  { id: 'exit', title: 'Graduating (Exit) Survey' },
  { id: 'alumni', title: 'Alumni Survey' },
  { id: 'employer', title: 'Employer Survey' },
];

// Details a form may ask for, and the words that identify their column in the file.
const DETAIL_FIELDS: { key: string; label: string; match: string[] }[] = [
  { key: 'program', label: 'Program', match: ['program', 'programme', 'degree'] },
  { key: 'regNo', label: 'Reg No', match: ['reg no', 'registration', 'roll no', 'reg number'] },
  { key: 'batch', label: 'Batch', match: ['batch'] },
  { key: 'section', label: 'Section', match: ['section'] },
  { key: 'graduationYear', label: 'Graduation Year', match: ['graduation year', 'graduating year', 'year of graduation'] },
  { key: 'respondentName', label: 'Respondent Name', match: ['name', 'your name', 'employer name', 'alumni name'] },
  { key: 'respondentEmail', label: 'Respondent Email', match: ['email', 'e-mail'] },
  { key: 'supervisorName', label: 'Supervisor Name', match: ['supervisor'] },
  { key: 'employeeName', label: 'Employee Name', match: ['employee name', 'employee'] },
  { key: 'designation', label: 'Designation', match: ['designation'] },
  { key: 'organization', label: 'Organization', match: ['organization', 'organisation', 'company'] },
  { key: 'organizationType', label: 'Organization Type', match: ['organization type', 'organisation type'] },
  { key: 'workingSince', label: 'Working Since', match: ['working since'] },
  { key: 'comment', label: 'Comments', match: ['comment', 'suggestion'] },
  { key: 'submittedAt', label: 'Submitted At', match: ['completion time', 'submitted', 'timestamp'] },
];

const words = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const wordSet = (s: string) => new Set(words(s).split(' ').filter(w => w.length > 2));

const similarity = (a: string, b: string) => {
  const A = wordSet(a), B = wordSet(b);
  if (!A.size || !B.size) return 0;
  const shared = [...A].filter(w => B.has(w)).length;
  return shared / new Set([...A, ...B]).size;
};

/** The file column of each question: its best match, used once, if it is clearly the same text. */
const matchQuestions = (questions: FormQuestion[], columns: string[]) => {
  const pairs = questions.flatMap(q => columns.map(c => ({ no: q.no, column: c, score: similarity(q.text, c) })))
    .filter(p => p.score >= 0.5).sort((a, b) => b.score - a.score);
  const out: Record<number, string> = {};
  const used = new Set<string>();
  pairs.forEach(p => {
    if (out[p.no] === undefined && !used.has(p.column)) { out[p.no] = p.column; used.add(p.column); }
  });
  return out;
};

const matchDetails = (columns: string[], questionColumns: Set<string>) => {
  const out: Record<string, string> = {};
  const free = columns.filter(c => !questionColumns.has(c));
  // Longest phrase first, so "Organization Type" is not taken by "Organization".
  const wanted = DETAIL_FIELDS.flatMap(f => f.match.map(m => ({ key: f.key, phrase: m }))).sort((a, b) => b.phrase.length - a.phrase.length);
  const used = new Set<string>();
  wanted.forEach(({ key, phrase }) => {
    if (out[key]) return;
    const hit = free.find(c => !used.has(c) && words(c) === phrase) || free.find(c => !used.has(c) && words(c).includes(phrase));
    if (hit) { out[key] = hit; used.add(hit); }
  });
  return out;
};

const labelOfTarget = (target: string) => {
  if (!target) return '—';
  if (/^PO/i.test(target)) return target;
  const m = target.match(/(\d+)(?!.*\d)/);
  return m ? `GA${m[1]}` : target;
};

const panel = 'bg-white border border-slate-200 rounded-2xl p-5 shadow-sm';
const input = 'bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500';
const label = 'text-[10px] text-slate-500 font-bold uppercase tracking-wider';
const primary = 'flex items-center gap-1.5 px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';
const th = 'px-3 py-2 font-semibold text-left';
const td = 'px-3 py-2';

const Notice = ({ error, children }: { error?: boolean; children: ReactNode }) => (
  <p className={`rounded-xl px-3 py-2 text-xs flex items-start gap-1.5 border ${error ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
    {error ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
    <span>{children}</span>
  </p>
);

function FormsAndMapping({ programs, canEdit }: { programs: ProgramOption[]; canEdit: boolean }) {
  const [programId, setProgramId] = useState(programs[0]?.id || '');
  const [forms, setForms] = useState<SurveyForm[]>([]);
  const [edits, setEdits] = useState<Record<string, Record<number, string>>>({});
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!programId) return;
    setEdits({});
    apiService.getSurveyForms(programId).then(d => setForms(d.forms)).catch((e: any) => setMessage({ text: e.message, error: true }));
  }, [programId]);

  const save = async (form: SurveyForm) => {
    setBusy(form.formType);
    setMessage(null);
    try {
      await apiService.saveSurveyMapping(programId, form.formType, edits[form.formType] || {});
      const fresh = await apiService.getSurveyForms(programId);
      setForms(fresh.forms);
      setEdits(prev => ({ ...prev, [form.formType]: {} }));
      setMessage({ text: `${form.title} mapping saved. Results already uploaded keep the mapping they were uploaded with.` });
    } catch (e: any) {
      setMessage({ text: e.message, error: true });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className={panel}>
        <div className="flex flex-col gap-1 w-64">
          <label className={label}>Programme</label>
          <select aria-label="Programme" className={input} value={programId} onChange={e => setProgramId(e.target.value)}>
            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <p className="text-xs text-slate-500 mt-3">Use these questions in Microsoft Forms, each with answers from 1 to 5 (5 Excellent, 4 Very Good, 3 Good, 2 Average, 1 Fail). Also ask for the Program, and the Batch or Graduation Year.</p>
      </div>
      {message && <Notice error={message.error}>{message.text}</Notice>}
      {forms.map(form => {
        const changed = Object.keys(edits[form.formType] || {}).length > 0;
        return (
          <div key={form.formType} className={panel}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{form.title}</h3>
                <p className="text-xs text-slate-500">{form.questions.length} questions · reviews {form.usedFor}</p>
              </div>
              {canEdit && (
                <button onClick={() => save(form)} disabled={!changed || busy === form.formType} className={primary}>
                  <Save className="w-3.5 h-3.5" /> Save Mapping
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
                  <tr><th className={`${th} w-12`}>No.</th><th className={th}>Question</th><th className={`${th} w-44`}>Maps to</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {form.questions.map(q => {
                    const value = edits[form.formType]?.[q.no] ?? q.target;
                    return (
                      <tr key={q.no}>
                        <td className={td}>{q.no}</td>
                        <td className={td}>{q.text}</td>
                        <td className={td}>
                          {canEdit ? (
                            <select aria-label={`${form.title} question ${q.no} maps to`} className={`${input} w-full`} value={value}
                              onChange={e => setEdits(prev => ({ ...prev, [form.formType]: { ...(prev[form.formType] || {}), [q.no]: e.target.value } }))}>
                              <option value="">Not mapped</option>
                              {form.targets.map(t => <option key={t.id} value={t.id}>{labelOfTarget(t.id)} — {t.name.slice(0, 40)}</option>)}
                            </select>
                          ) : <span className="font-semibold">{labelOfTarget(value)}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UploadResponses({ programs }: { programs: ProgramOption[] }) {
  const [formType, setFormType] = useState('internship');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [defaultProgram, setDefaultProgram] = useState('');
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [fileName, setFileName] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<Record<string, any>[]>([]);
  const [questionColumns, setQuestionColumns] = useState<Record<number, string>>({});
  const [detailColumns, setDetailColumns] = useState<Record<string, string>>({});
  const [check, setCheck] = useState<any>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<any[]>([]);

  const loadUploads = () => apiService.getSurveyUploads().then(setUploads).catch(() => setUploads([]));
  useEffect(() => { loadUploads(); }, []);

  useEffect(() => {
    if (!programs[0]) return;
    apiService.getSurveyForms(programs[0].id).then(d => {
      setQuestions((d.forms.find((f: SurveyForm) => f.formType === formType) || { questions: [] }).questions);
    }).catch(() => setQuestions([]));
  }, [formType, programs[0]?.id]);

  const applyColumns = (cols: string[]) => {
    const matched = matchQuestions(questions, cols);
    setQuestionColumns(matched);
    setDetailColumns(matchDetails(cols, new Set(Object.values(matched))));
  };

  // A different form has different questions, so match the file's columns again.
  useEffect(() => {
    setCheck(null);
    if (columns.length) applyColumns(columns);
  }, [questions]);

  const onFile = async (file?: File) => {
    setCheck(null);
    setMessage(null);
    if (!file) return;
    try {
      const book = XLSX.read(await file.arrayBuffer(), { cellDates: false });
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(book.Sheets[book.SheetNames[0]], { defval: '', raw: false });
      if (!rows.length) throw new Error('The file has no responses.');
      const cols = Object.keys(rows[0]);
      setFileName(file.name);
      setFileRows(rows);
      setColumns(cols);
      applyColumns(cols);
    } catch (e: any) {
      setFileRows([]);
      setColumns([]);
      setMessage({ text: e.message || 'That file could not be read. Download it again from Microsoft Forms as Excel.', error: true });
    }
  };

  const payloadRows = useMemo(() => fileRows.map(row => {
    const out: Record<string, any> = { ratings: {} };
    Object.keys(detailColumns).forEach(key => { if (detailColumns[key]) out[key] = row[detailColumns[key]]; });
    questions.forEach(q => { if (questionColumns[q.no]) out.ratings[q.no] = row[questionColumns[q.no]]; });
    return out;
  }), [fileRows, detailColumns, questionColumns, questions]);

  const matchedCount = questions.filter(q => questionColumns[q.no]).length;
  const programMissing = !detailColumns.program && !defaultProgram;

  const send = async (dryRun: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await apiService.uploadSurveyResponses({ formType, year, fileName, defaultProgramId: defaultProgram, rows: payloadRows, dryRun });
      if (dryRun) {
        setCheck(result);
      } else {
        setMessage({ text: `${result.accepted} responses saved${result.skipped ? `, ${result.skipped} left out` : ''}.` });
        setCheck(null);
        setFileRows([]);
        setColumns([]);
        setFileName('');
        loadUploads();
      }
    } catch (e: any) {
      setMessage({ text: e.message, error: true });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u: any) => {
    if (!window.confirm(`Delete ${u.formTitle} ${u.year} and its ${u.responses} responses?`)) return;
    try {
      await apiService.deleteSurveyUpload(u.id);
      loadUploads();
    } catch (e: any) {
      setMessage({ text: e.message, error: true });
    }
  };

  const columnSelect = (aria: string, value: string, onChange: (v: string) => void) => (
    <select aria-label={aria} className={`${input} w-full font-medium`} value={value || ''} onChange={e => { setCheck(null); onChange(e.target.value); }}>
      <option value="">Not in this file</option>
      {columns.map(c => <option key={c} value={c}>{c.slice(0, 70)}</option>)}
    </select>
  );

  return (
    <div className="space-y-4">
      <div className={panel}>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className={label}>Survey</label>
            <select aria-label="Survey" className={input} value={formType} onChange={e => setFormType(e.target.value)}>
              {FORM_TYPES.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Year Collected</label>
            <input aria-label="Year collected" className={`${input} w-24`} value={year} onChange={e => { setCheck(null); setYear(e.target.value); }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Response File</label>
            <input aria-label="Response file" type="file" accept=".xlsx,.xls,.csv" className="text-xs" onChange={e => onFile(e.target.files?.[0])} />
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">In Microsoft Forms, open Responses and choose Open results in Excel. A new file for the same survey and year replaces the old one, so nothing counts twice.</p>
      </div>

      {message && <Notice error={message.error}>{message.text}</Notice>}

      {fileRows.length > 0 && (
        <div className={`${panel} space-y-4`}>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{fileName}</h3>
            <p className="text-xs text-slate-500">{fileRows.length} responses · {matchedCount} of {questions.length} questions matched. Please check the columns below.</p>
          </div>
          {!detailColumns.program && (
            <div className="flex flex-col gap-1 w-72">
              <label className={label}>This file has no Program column. All its responses are for:</label>
              <select aria-label="Programme of all responses" className={input} value={defaultProgram} onChange={e => { setCheck(null); setDefaultProgram(e.target.value); }}>
                <option value="">Choose a programme</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <h4 className={label}>Questions</h4>
              {questions.map(q => (
                <div key={q.no} className="grid grid-cols-2 gap-2 items-center text-xs text-slate-700">
                  <span className={questionColumns[q.no] ? '' : 'text-rose-700 font-semibold'}>{q.no}. {q.text}</span>
                  {columnSelect(`Column for question ${q.no}`, questionColumns[q.no], v => setQuestionColumns(prev => ({ ...prev, [q.no]: v })))}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <h4 className={label}>Details</h4>
              {DETAIL_FIELDS.map(f => (
                <div key={f.key} className="grid grid-cols-2 gap-2 items-center text-xs text-slate-700">
                  <span>{f.label}</span>
                  {columnSelect(`Column for ${f.label}`, detailColumns[f.key], v => setDetailColumns(prev => ({ ...prev, [f.key]: v })))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button className={primary} disabled={busy || !matchedCount || programMissing} onClick={() => send(true)}>
              {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5" />} Check File
            </button>
            {check && check.accepted > 0 && (
              <button className={primary} disabled={busy} onClick={() => send(false)}>
                <FileUp className="w-3.5 h-3.5" /> Save {check.accepted} Responses
              </button>
            )}
          </div>

          {check && (
            <div className="space-y-2 text-xs">
              <Notice error={check.accepted === 0}>
                {check.accepted} of {fileRows.length} responses are ready ({Object.entries(check.programs).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none'}).
                {check.replaces != null && ` This replaces the ${check.replaces} responses already saved for this survey and year.`}
              </Notice>
              {check.skipped > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-amber-900">
                  <p className="font-bold">{check.skipped} response{check.skipped === 1 ? '' : 's'} will be left out</p>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    {check.errors.map((e: any) => <li key={e.row}>Row {e.row}: {e.error}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className={panel}>
        <h3 className="text-sm font-bold text-slate-900 mb-3">Uploaded Responses</h3>
        {uploads.length === 0 ? <p className="text-xs text-slate-500">Nothing has been uploaded yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
                <tr><th className={th}>Survey</th><th className={th}>Year</th><th className={th}>Responses</th><th className={th}>File</th><th className={th}>Uploaded</th><th className={th}></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {uploads.map(u => (
                  <tr key={u.id}>
                    <td className={`${td} font-semibold`}>{u.formTitle}</td>
                    <td className={td}>{u.year}</td>
                    <td className={td}>{u.responses}</td>
                    <td className={td}>{u.fileName || '—'}</td>
                    <td className={td}>{new Date(u.uploadedAt).toLocaleDateString('en-GB')}{u.uploadedBy ? ` · ${u.uploadedBy}` : ''}</td>
                    <td className={`${td} text-right`}>
                      <button aria-label={`Delete ${u.formTitle} ${u.year}`} onClick={() => remove(u)} className="p-1 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SurveyResults({ programs }: { programs: ProgramOption[] }) {
  const [programId, setProgramId] = useState(programs[0]?.id || '');
  const [formType, setFormType] = useState('internship');
  const [year, setYear] = useState('');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!programId) return;
    setError(null);
    apiService.getSurveyResults(programId, formType, year)
      .then(setData)
      .catch((e: any) => { setData(null); setError(e.message); });
  }, [programId, formType, year]);

  return (
    <div className="space-y-4">
      <div className={`${panel} flex flex-wrap gap-4 items-end`}>
        <div className="flex flex-col gap-1">
          <label className={label}>Programme</label>
          <select aria-label="Results programme" className={input} value={programId} onChange={e => { setProgramId(e.target.value); setYear(''); }}>
            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={label}>Survey</label>
          <select aria-label="Results survey" className={input} value={formType} onChange={e => { setFormType(e.target.value); setYear(''); }}>
            {FORM_TYPES.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={label}>Year Collected</label>
          <select aria-label="Results year" className={input} value={year} onChange={e => setYear(e.target.value)}>
            <option value="">All years</option>
            {(data?.years || []).map((y: number) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {error && <Notice error>{error}</Notice>}

      {data && (data.responseCount === 0 ? (
        <div className={panel}><p className="text-xs text-slate-500">No responses have been uploaded for this survey and programme.</p></div>
      ) : (
        <>
          <div className={panel}>
            <h3 className="text-sm font-bold text-slate-900">{data.formTitle}: {data.programName}</h3>
            <p className="text-xs text-slate-500 mb-3">{data.responseCount} response{data.responseCount === 1 ? '' : 's'}. KPI: at least {data.kpi}% of responses must score 3 or above on each question.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className={`${th} w-10`}>No.</th><th className={th}>Question</th><th className={th}>Maps to</th>
                    {[5, 4, 3, 2, 1].map(r => <th key={r} className={`${th} text-center`}>{r}</th>)}
                    <th className={`${th} text-center`}>Responses</th><th className={`${th} text-center`}>3 or above %</th><th className={`${th} text-center`}>KPI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.questions.map((q: any) => (
                    <tr key={`${q.questionNo}-${q.target}`}>
                      <td className={td}>{q.questionNo}</td>
                      <td className={td}>{q.text}</td>
                      <td className={`${td} font-semibold`}>{labelOfTarget(q.target)}</td>
                      {[5, 4, 3, 2, 1].map(r => <td key={r} className={`${td} text-center`}>{q.counts[r]}</td>)}
                      <td className={`${td} text-center`}>{q.responses}</td>
                      <td className={`${td} text-center font-semibold`}>{Number(q.percent).toFixed(1)}</td>
                      <td className={`${td} text-center font-semibold ${q.kpiMet ? 'text-green-700' : 'text-red-700'}`}>{q.kpiMet ? 'Met' : 'Not Met'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={panel}>
            <h3 className="text-sm font-bold text-slate-900 mb-2">Comments ({data.comments.length})</h3>
            {data.comments.length === 0 ? <p className="text-xs text-slate-500">No comments.</p> : (
              <ul className="list-disc pl-4 space-y-1 text-xs text-slate-700">{data.comments.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
            )}
          </div>

          <details className={panel}>
            <summary className="text-sm font-bold text-slate-900 cursor-pointer">Responses ({data.responses.length})</summary>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
                  <tr><th className={th}>Name</th><th className={th}>Reg No / Employee</th><th className={th}>Batch</th><th className={th}>Graduation</th><th className={th}>Organization</th><th className={th}>Year</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.responses.map((r: any, i: number) => (
                    <tr key={i}>
                      <td className={td}>{r.name || r.supervisor || '—'}</td>
                      <td className={td}>{r.regNo || r.employee || '—'}</td>
                      <td className={td}>{r.batch || '—'}</td>
                      <td className={td}>{r.graduationYear || '—'}</td>
                      <td className={td}>{r.organization || '—'}</td>
                      <td className={td}>{r.year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ))}
    </div>
  );
}

export default function SurveyManager({ programs, canEdit }: { programs: ProgramOption[]; canEdit: boolean }) {
  const tabs = [
    ...(canEdit ? [{ id: 'upload', label: 'Upload Responses' }] : []),
    { id: 'results', label: 'Survey Results' },
    { id: 'forms', label: canEdit ? 'Forms & Mapping' : 'Forms' },
  ];
  const [tab, setTab] = useState(tabs[0].id);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className={panel}>
        <h2 className="text-lg font-bold text-slate-900">Surveys</h2>
        <p className="text-xs text-slate-500">Internship and exit surveys review GA; alumni and employer surveys review PO. Only QA and department administrators can see this.</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${tab === t.id ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-indigo-50'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {programs.length === 0 ? <p className="text-xs text-slate-500">No programmes found.</p> : (
        <>
          {tab === 'upload' && <UploadResponses programs={programs} />}
          {tab === 'results' && <SurveyResults programs={programs} />}
          {tab === 'forms' && <FormsAndMapping programs={programs} canEdit={canEdit} />}
        </>
      )}
    </div>
  );
}
