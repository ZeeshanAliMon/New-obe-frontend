import React, { useState, useMemo } from 'react';
import { UserPlus, Search, Trash2, X, Users } from 'lucide-react';
import { matchTeacher } from '../../utils/teacherUtils';

interface Teacher {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  designation?: string;
  departmentId: string;
  departmentName?: string;
}

interface Department {
  id: string;
  name: string;
  vision: string;
  mission: string;
}

interface TeacherCourseAssignment {
  teacherId: string;
  courseCode: string;
  programId?: string;
  section?: string;
  academicYear?: string;
  status?: 'active' | 'closed';
}

interface FacultyDirectoryTabProps {
  teachers: Teacher[];
  departments: Department[];
  teacherAssignments: TeacherCourseAssignment[];
  managedDeptId: string;
  onAddTeacher: (name: string, email: string, employeeId: string, designation: string) => void;
  onDeleteTeacher: (id: string) => void;
}

export default function FacultyDirectoryTab({
  teachers,
  departments,
  teacherAssignments,
  managedDeptId,
  onAddTeacher,
  onDeleteTeacher,
}: FacultyDirectoryTabProps) {
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherEmployeeId, setTeacherEmployeeId] = useState('');
  const [teacherDesignation, setTeacherDesignation] = useState('Lecturer');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const filteredTeachers = useMemo(() => {
    return teachers.filter(t => {
      if (t.departmentId !== managedDeptId) return false;
      const q = teacherSearch.toLowerCase().trim();
      return q === '' || t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q);
    });
  }, [teachers, teacherSearch, managedDeptId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName.trim() || !teacherEmail.trim() || !teacherEmployeeId.trim()) return;
    onAddTeacher(
      teacherName.trim(),
      teacherEmail.trim(),
      teacherEmployeeId.trim().toUpperCase(),
      teacherDesignation
    );
    setTeacherName('');
    setTeacherEmail('');
    setTeacherEmployeeId('');
    setTeacherDesignation('Lecturer');
    setShowAddForm(false);
  };

  const deptTeacherCount = teachers.filter(t => t.departmentId === managedDeptId).length;
  const initials = (name: string) =>
    name.replace(/^(dr|prof|mr|ms|mrs)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
  const inputCls = 'w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl text-sm outline-none transition-all';
  const labelCls = 'block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5';

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
      {/* Header: title, search and the add button on one row */}
      <div className="px-5 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Faculty Directory</h2>
          <p className="text-xs text-slate-500">{deptTeacherCount} member{deptTeacherCount === 1 ? '' : 's'} in this department</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search name or email..."
              value={teacherSearch}
              onChange={(e) => setTeacherSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl outline-none text-sm transition-all"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm(v => !v)}
            className={`flex items-center justify-center gap-2 font-semibold px-4 py-2.5 rounded-xl text-sm transition-all cursor-pointer shrink-0 ${
              showAddForm ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
            }`}
          >
            {showAddForm ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            <span>{showAddForm ? 'Cancel' : 'Add Faculty'}</span>
          </button>
        </div>
      </div>

      {/* Add form: hidden until needed, so the list starts right under the header */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="px-5 sm:px-6 py-4 bg-slate-50/60 border-b border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.2fr_1.4fr_1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className={labelCls}>Full Name</label>
            <input type="text" placeholder="e.g. Dr. Sana Mirza" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} className={inputCls} required autoFocus />
          </div>
          <div>
            <label className={labelCls}>Institutional Email</label>
            <input type="email" placeholder="e.g. sana.mirza@iqra.edu.pk" value={teacherEmail} onChange={(e) => setTeacherEmail(e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Employee ID</label>
            <input type="text" placeholder="e.g. INS-CS-005" value={teacherEmployeeId} onChange={(e) => setTeacherEmployeeId(e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Designation</label>
            <select value={teacherDesignation} onChange={(e) => setTeacherDesignation(e.target.value)} className={`${inputCls} font-medium text-slate-700`}>
              <option value="Lecturer">Lecturer</option>
              <option value="Assistant Professor">Assistant Professor</option>
              <option value="Associate Professor">Associate Professor</option>
              <option value="Professor">Professor</option>
            </select>
          </div>
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer">
            <UserPlus className="h-4 w-4" />
            <span>Onboard</span>
          </button>
        </form>
      )}

      {/* Registry table */}
      {filteredTeachers.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <Users className="h-9 w-9 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">{teacherSearch.trim() ? 'No faculty match your search' : 'No faculty added yet'}</p>
          <p className="text-xs text-slate-500 mt-1">{teacherSearch.trim() ? 'Try a different name or email.' : 'Use "Add Faculty" to onboard the first instructor.'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="text-left font-semibold px-5 sm:px-6 py-3">Faculty</th>
                <th className="text-left font-semibold px-3 py-3">Employee ID</th>
                <th className="hidden md:table-cell text-left font-semibold px-3 py-3">Designation</th>
                <th className="hidden xl:table-cell text-left font-semibold px-3 py-3">Department</th>
                <th className="text-center font-semibold px-3 py-3">Courses</th>
                <th className="text-right font-semibold px-5 sm:px-6 py-3 w-20">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTeachers.map(t => {
                const matchedDept = departments.find(d => d.id === t.departmentId);
                const courseCount = teacherAssignments.filter(a => matchTeacher(t, a.teacherId)).length;
                return (
                  <tr key={t.id || t.employeeId || t.email} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 sm:px-6 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center text-xs font-bold shrink-0">
                          {initials(t.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{t.name}</p>
                          <p className="text-xs text-slate-500 truncate">{t.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{t.employeeId || t.id}</td>
                    <td className="hidden md:table-cell px-3 py-3 text-slate-700 whitespace-nowrap">{t.designation || 'Lecturer'}</td>
                    <td className="hidden xl:table-cell px-3 py-3 text-slate-500">{matchedDept?.name || 'General Faculty'}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-block min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold ${courseCount > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                        {courseCount}
                      </span>
                    </td>
                    <td className="px-5 sm:px-6 py-3 text-right">
                      <button
                        onClick={() => onDeleteTeacher(t.employeeId || t.id)}
                        className="text-slate-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                        title="Remove teacher"
                        aria-label={`Remove ${t.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
