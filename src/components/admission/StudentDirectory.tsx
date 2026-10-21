import React, { useMemo } from 'react';
import { GraduationCap, Search, Building, BookOpen } from 'lucide-react';
import { Student, Department, Program } from '../../types';

interface StudentDirectoryProps {
  students: Student[];
  departments: Department[];
  programs: Program[];
  filterDeptId: string;
  setFilterDeptId: (id: string) => void;
  filterProgId: string;
  setFilterProgId: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onEditClick: (student: Student) => void;
  onDeleteClick: (student: Student) => void;
  getDeptName: (id: string) => string;
  getProgCode: (id: string) => string;
}

export default function StudentDirectory({
  students,
  departments,
  programs,
  filterDeptId,
  setFilterDeptId,
  filterProgId,
  setFilterProgId,
  searchQuery,
  setSearchQuery,
  onEditClick,
  onDeleteClick,
  getDeptName,
  getProgCode
}: StudentDirectoryProps) {
  
  // Dynamically filter programs based on department choice in Filter Panel
  const filterPrograms = useMemo(() => {
    if (filterDeptId === 'all') return programs;
    return programs.filter(p => p.departmentId === filterDeptId);
  }, [filterDeptId, programs]);

  // Filter and Search Logic for Directory
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchDept = filterDeptId === 'all' || student.departmentId === filterDeptId;
      const matchProg = filterProgId === 'all' || student.programId === filterProgId;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = q === '' || 
        student.name.toLowerCase().includes(q) || 
        student.regNo.toLowerCase().includes(q);
      
      return matchDept && matchProg && matchSearch;
    });
  }, [students, filterDeptId, filterProgId, searchQuery]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden">
      {/* Filter and Search Panel Header */}
      <div id="filter-header" className="p-5 border-b border-slate-100 bg-slate-50/40 flex flex-col gap-4 shrink-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
            <h2 className="font-display font-bold text-slate-800 text-base">Student Records Directory</h2>
          </div>
          
          <div className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
            Showing <span className="text-indigo-950 font-bold">{filteredStudents.length}</span> of {students.length} Records
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search bar */}
          <div className="relative">
            <input
              id="search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Name or Reg No..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl font-sans text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 font-medium"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
          </div>

          {/* Dept filter */}
          <div className="relative">
            <select
              id="filter-dept"
              value={filterDeptId}
              onChange={(e) => setFilterDeptId(e.target.value)}
              className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl font-sans text-xs text-slate-700 outline-none cursor-pointer transition-all appearance-none font-bold"
            >
              <option value="all">All Departments</option>
              {departments.length === 0 ? (
                <option value="" disabled>No departments found in database</option>
              ) : (
                departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))
              )}
            </select>
            <Building className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
          </div>

          {/* Program filter */}
          <div className="relative">
            <select
              id="filter-program"
              value={filterProgId}
              onChange={(e) => setFilterProgId(e.target.value)}
              className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 rounded-xl font-sans text-xs text-slate-700 outline-none cursor-pointer transition-all appearance-none font-bold"
            >
              <option value="all">All Programs</option>
              {filterPrograms.length === 0 ? (
                <option value="" disabled>No programs found in database</option>
              ) : (
                filterPrograms.map(p => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))
              )}
            </select>
            <BookOpen className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto min-h-0">
        {filteredStudents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/20">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4 border border-slate-200/50">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-display font-bold text-slate-700 text-sm mb-1">No Matching Records Found</h3>
            <p className="text-slate-400 text-xs max-w-sm font-medium mb-4">
              Try resetting filters, matching another Registration ID, or register a new student using the "Add Student" tab.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterDeptId('all');
                setFilterProgId('all');
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-md"
            >
              Clear Search Filters
            </button>
          </div>
        ) : (
          <div className="min-w-full inline-block align-middle">
            <table className="min-w-full divide-y divide-slate-200 border-collapse table-auto">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-xs border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Reg Number
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Department
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Program
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Batch
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Semester
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredStudents.map((student) => (
                  <tr
                    key={student.regNo}
                    className="hover:bg-indigo-50/20 group transition-all"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 text-[11px] font-bold font-mono rounded-lg border border-indigo-200 tracking-tight">
                        {student.regNo}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-950 transition-colors">
                        {student.name}
                      </p>
                      {student.email && (
                        <p className="text-[11px] text-slate-400 font-medium">
                          {student.email}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap animate-pulse:group-hover">
                      <p className="text-xs font-semibold text-slate-500 max-w-[200px] truncate" title={getDeptName(student.departmentId)}>
                        {getDeptName(student.departmentId)}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-extrabold rounded-md">
                        {getProgCode(student.programId)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const match = student.regNo.trim().match(/(FA|SP)(\d{2})/i);
                        const displayBatch = match ? `${match[1].toUpperCase()}${match[2]}` : student.batch;
                        const isSpring = displayBatch.toUpperCase().startsWith('SP') || student.batch === 'Spring';
                        return (
                          <span className={`px-2.5 py-1 text-[11px] font-black font-mono rounded-lg tracking-wider uppercase ${
                            isSpring
                              ? 'bg-blue-50 text-blue-700 border border-blue-200/60' 
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                          }`}>
                            {displayBatch}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-md shadow-2xs">
                        {student.semester || '1st'}
                      </span>
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
