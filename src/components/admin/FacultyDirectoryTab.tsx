import React, { useState, useMemo } from 'react';
import { UserPlus, Search, Trash2 } from 'lucide-react';
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
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 mb-1">Faculty Directory</h2>
        <p className="text-xs text-slate-500 mb-6 font-medium">Add, manage, and audit instructors assigned to departments.</p>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end bg-slate-50/40 p-4 rounded-2xl border border-slate-100 mb-8">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Teacher Full Name</label>
            <input 
              type="text" 
              placeholder="e.g. Dr. Sana Mirza"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl text-xs font-medium outline-none transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Institutional Email</label>
            <input 
              type="email" 
              placeholder="e.g. sana.mirza@iqra.edu.pk"
              value={teacherEmail}
              onChange={(e) => setTeacherEmail(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl text-xs font-medium outline-none transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Employee ID</label>
            <input 
              type="text" 
              placeholder="e.g. INS-CS-005"
              value={teacherEmployeeId}
              onChange={(e) => setTeacherEmployeeId(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl text-xs font-medium outline-none transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Designation</label>
            <select 
              value={teacherDesignation} 
              onChange={(e) => setTeacherDesignation(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none transition-all"
            >
              <option value="Lecturer">Lecturer</option>
              <option value="Assistant Professor">Assistant Professor</option>
              <option value="Associate Professor">Associate Professor</option>
              <option value="Professor">Professor</option>
            </select>
          </div>
          <div>
            <button 
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>Onboard Faculty</span>
            </button>
          </div>
        </form>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h3 className="text-sm font-bold text-slate-800">Faculty Registry ({teachers.filter(t => t.departmentId === managedDeptId).length} members)</h3>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search name or email..." 
              value={teacherSearch}
              onChange={(e) => setTeacherSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl outline-none text-xs font-medium transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeachers.map(t => {
            const matchedDept = departments.find(d => d.id === t.departmentId);
            const courseCount = teacherAssignments.filter(a => matchTeacher(t, a.teacherId)).length;
            return (
              <div key={t.id || t.employeeId || t.email} className="border border-slate-200 hover:border-indigo-200 bg-white p-4 rounded-2xl shadow-sm flex flex-col justify-between gap-4 group transition-all">
                <div className="space-y-1">
                  <div className="flex items-start justify-between">
                    <h4 className="text-xs font-bold text-slate-800">{t.name}</h4>
                    <span className="text-[9px] font-bold text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                      {t.employeeId || t.id}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">{t.email}</p>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                    <span>{t.designation || 'Lecturer'}</span>
                    <span>•</span>
                    <span>{matchedDept?.name || 'General Faculty'}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {courseCount} Active Courses
                  </span>
                  <button
                    onClick={() => onDeleteTeacher(t.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1.5 hover:bg-rose-50 rounded-lg transition-all"
                    title="Remove teacher"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
