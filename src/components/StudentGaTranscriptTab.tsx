import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Download, RefreshCw } from 'lucide-react';
import { apiService } from '../services/apiService';
import { GA_TRANSCRIPT_NOTE, GaTranscriptDoc, downloadGaTranscriptPdf } from '../utils/gaTranscriptPdf';
import { toTranscriptGas } from './StudentGaTranscript';

const gaLabel = (id: string) => {
  const m = String(id).match(/\d+/);
  return m ? `GA${m[0].padStart(2, '0')}` : String(id);
};

/** The student's GA transcript: every finalized course under each GA it assesses. */
function buildDoc(data: any): GaTranscriptDoc {
  const courses: any[] = Array.isArray(data?.courses) ? data.courses : [];
  const attempts: Record<string, number> = {};
  courses.forEach(c => { attempts[c.courseCode] = (attempts[c.courseCode] || 0) + 1; });
  return {
    university: 'Iqra University',
    name: data.name || '',
    department: data.departmentName || '',
    regNo: data.regNo || '',
    program: data.programName || data.programCode || '',
    kpi: Number(data.gaAttainmentThreshold) || 50,
    printedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
    gas: toTranscriptGas(data).map(g => ({
      label: gaLabel(g.gaId),
      title: g.gaTitle,
      status: g.status,
      courses: g.courses.map(c => ({
        code: c.code,
        // A retaken course is listed once per attempt; the term tells them apart.
        title: attempts[c.code] > 1 ? `${c.title} (${c.academicYear.replace('-', ' ')})` : c.title,
        credit: c.creditHours,
        grade: c.grade,
        status: c.status,
      })),
    })),
  };
}

export default function StudentGaTranscriptTab({ regNo }: { regNo: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError('');
    apiService.getStudentGaTranscript(regNo)
      .then(result => { if (!cancelled) setData(result); })
      .catch((e: any) => { if (!cancelled) setError(e?.message || 'Could not load your GA transcript.'); });
    return () => { cancelled = true; };
  }, [regNo, attempt]);

  const doc = useMemo(() => (data ? buildDoc(data) : null), [data]);

  const download = () => {
    if (!doc) return;
    try {
      downloadGaTranscriptPdf(doc, `GA_Transcript_${doc.regNo || 'Student'}.pdf`.replace(/[^\w.-]+/g, '_'));
    } catch (e) {
      console.error('GA transcript export failed:', e);
      setError('The PDF could not be created. Please try again.');
    }
  };

  const th = 'px-2 py-1.5 text-left font-bold border-b border-slate-800 whitespace-nowrap';
  const td = 'px-2 py-1';

  return (
    <motion.div key="ga-transcript-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">GA Transcript</h3>
          <p className="text-xs text-slate-500 mt-0.5">Your finalized courses under each Graduate Attribute, with the status for that GA.</p>
        </div>
        <button
          onClick={download}
          disabled={!doc || doc.gas.length === 0}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Download PDF</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-red-700">{error}</p>
          <button onClick={() => setAttempt(a => a + 1)} className="text-xs font-bold text-red-700 hover:underline cursor-pointer shrink-0">Try again</button>
        </div>
      )}

      {!doc && !error && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading your GA transcript...
        </div>
      )}

      {doc && doc.gas.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700">No GA results yet</h3>
          <p className="text-xs text-slate-500 mt-1">Your GA transcript fills in once a course you took has been finalized.</p>
        </div>
      )}

      {doc && doc.gas.length > 0 && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <div className="p-6 text-slate-900 min-w-[720px] space-y-4" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
              <div className="text-center">
                <h2 className="text-xl font-bold">{doc.university}</h2>
                <p className="text-base font-bold">Student GA Transcript</p>
              </div>

              <div className="grid grid-cols-2 gap-x-10 gap-y-0.5 text-xs">
                <div className="flex gap-3"><b className="w-28 shrink-0">STUDENT NAME:</b><span className="uppercase">{doc.name}</span></div>
                <div className="flex gap-3"><b className="w-28 shrink-0">REG NUMBER:</b><span>{doc.regNo}</span></div>
                <div className="flex gap-3"><b className="w-28 shrink-0">DEPARTMENT:</b><span>{doc.department || '-'}</span></div>
                <div className="flex gap-3"><b className="w-28 shrink-0">PROGRAM:</b><span>{doc.program || '-'}</span></div>
              </div>
              <p className="text-right text-xs"><b>GA KPI :</b> {doc.kpi.toFixed(1)}</p>

              <table className="w-full border-collapse border border-slate-800 text-xs">
                <thead>
                  <tr className="bg-slate-300">
                    <th className={`${th} w-24`}>Course Code</th>
                    <th className={th}>Course Title</th>
                    <th className={`${th} w-16 text-center`}>Credit</th>
                    <th className={`${th} w-16 text-center`}>Grade</th>
                    <th className={`${th} w-28 text-center`}>GA Status</th>
                  </tr>
                </thead>
                {doc.gas.map(g => (
                  <tbody key={g.label}>
                    <tr className="border-t border-slate-800 font-bold">
                      <td className={td}>{g.label}</td>
                      <td className={td} colSpan={4}>{g.title}</td>
                    </tr>
                    {g.courses.map((c, i) => (
                      <tr key={`${c.code}-${i}`}>
                        <td className={td}>{c.code}</td>
                        <td className={td}>{c.title}</td>
                        <td className={`${td} text-center`}>{Number(c.credit).toFixed(1)}</td>
                        <td className={`${td} text-center`}>{c.grade || '-'}</td>
                        <td className={`${td} text-center`}>{c.status}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>

              <div className="space-y-2 pt-2">
                <h3 className="text-base font-bold">Summary</h3>
                <table className="border-collapse border border-slate-800 text-xs w-72">
                  <thead>
                    <tr className="bg-slate-300">
                      <th className={th}>GA</th>
                      <th className={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.gas.map(g => (
                      <tr key={g.label} className="border-t border-slate-800">
                        <td className={td}>{g.label}</td>
                        <td className={td}>{g.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-[11px] pt-2 space-y-1">
                <p><b>Note:</b> {GA_TRANSCRIPT_NOTE}</p>
                <p>Printed Date: {doc.printedDate}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
