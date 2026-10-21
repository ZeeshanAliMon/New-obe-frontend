import React, { useMemo } from 'react';
import { Trash2, Search, AlertCircle } from 'lucide-react';
import { Student } from '../../types';

interface StudentDeleteProps {
  students: Student[];
  deleteSearchQuery: string;
  setDeleteSearchQuery: (q: string) => void;
  onDeleteClick: (student: Student) => void;
  getDeptName: (id: string) => string;
  getProgCode: (id: string) => string;
}

export default function StudentDelete({
  students,
  deleteSearchQuery,
  setDeleteSearchQuery,
  onDeleteClick,
  getDeptName,
  getProgCode
}: StudentDeleteProps) {

  // Filter logic specifically for fast deletion
  const deleteFilteredStudents = useMemo(() => {
    return students.filter(student => {
      const q = deleteSearchQuery.toLowerCase().trim();
      return q === '' || 
        student.name.toLowerCase().includes(q) || 
        student.regNo.toLowerCase().includes(q);
    });
  }, [students, deleteSearchQuery]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-red-50/20 shrink-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-slate-800 text-lg">Registry Deletion Console</h2>
              <p className="text-xs text-slate-500">Permanently terminate and purge records from Iqra University database.</p>
            </div>
          </div>
          
          {/* Quick find */}
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={deleteSearchQuery}
              onChange={(e) => setDeleteSearchQuery(e.target.value)}
              placeholder="Quick find student to delete..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 focus:ring-2 focus:ring-red-600/10 focus:border-red-600 rounded-xl font-sans text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 font-semibold"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
        </div>

        <div className="mt-4 bg-red-50 text-red-800 text-xs p-3.5 rounded-xl border border-red-100/60 font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>Warning: Record deletion is permanent and cannot be undone. Associated coursework, transcripts, and OBE links will be unlinked.</span>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto min-h-0">
        {deleteFilteredStudents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/10">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4 border border-slate-200/50">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-display font-bold text-slate-700 text-sm mb-1">No Matching Records Found</h3>
            <p className="text-slate-400 text-xs max-w-sm font-medium">
              No student matching "{deleteSearchQuery}" was found. Try searching with other parameters or reset search query.
            </p>
          </div>
        ) : (
          <div className="min-w-full inline-block align-middle">
            <table className="min-w-full divide-y divide-slate-200 border-collapse table-auto">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-xs border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Registration ID
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Academic Program
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400 pr-8">
                    Danger Zone
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {deleteFilteredStudents.map((student) => (
                  <tr
                    key={student.regNo}
                    className="hover:bg-red-50/10 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-[11px] font-bold font-mono rounded-lg border border-slate-200">
                        {student.regNo}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-bold text-slate-800">
                        {student.name}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-xs font-semibold text-slate-500">
                        {getProgCode(student.programId)} &mdash; {getDeptName(student.departmentId)}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right pr-8">
                      <button
                        onClick={() => onDeleteClick(student)}
                        className="px-4 py-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white text-xs font-bold rounded-xl border border-red-200 hover:border-red-600 transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Student</span>
                      </button>
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
