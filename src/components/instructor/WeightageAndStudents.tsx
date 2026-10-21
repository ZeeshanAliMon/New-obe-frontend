import { AlertTriangle, Check, Save, ClipboardList, Building, UserPlus, RefreshCw, Trash2, Users } from 'lucide-react';
import React, { useState } from 'react';

interface MarksCategory {
  name: string;
  percentage: number;
  units: number;
}

interface Student {
  regNo: string;
  name: string;
}

interface Course {
  id: string;
  code: string;
  title: string;
  courseType?: string;
  categories: MarksCategory[];
  students: Student[];
}

interface WeightageAndStudentsProps {
  activeTab: string;
  selectedCourse: Course;
  tempCategories: MarksCategory[];
  selectedWeightIndex: number;
  setSelectedWeightIndex: (idx: number) => void;
  currentTotalWeight: number;
  editWeightPercent: string;
  editWeightUnits: string;
  handleWeightPercentChange: (val: string) => void;
  handleWeightUnitsChange: (val: string) => void;
  handleUpdateCategorySingle: () => void;
  saveStatus: string;
  handleResetWeightage: () => void;
  handleSaveAllWeightage: () => void;
  handleOpenUnitEditor: (catName: string) => void;
  onSyncAllStudents?: () => void;
  onAddStudent?: (regNo: string, name: string) => void;
  onUnenrollStudent?: (regNo: string) => void;
}

export default function WeightageAndStudents({
  activeTab,
  selectedCourse,
  tempCategories,
  selectedWeightIndex,
  setSelectedWeightIndex,
  currentTotalWeight,
  editWeightPercent,
  editWeightUnits,
  handleWeightPercentChange,
  handleWeightUnitsChange,
  handleUpdateCategorySingle,
  saveStatus,
  handleResetWeightage,
  handleSaveAllWeightage,
  handleOpenUnitEditor,
  onSyncAllStudents,
  onAddStudent,
  onUnenrollStudent,
}: WeightageAndStudentsProps) {
  const [newRegNo, setNewRegNo] = useState('');
  const [newName, setNewName] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleInlineAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegNo.trim()) return;
    if (onAddStudent) {
      onAddStudent(newRegNo.trim(), newName.trim());
      setNewRegNo('');
      setNewName('');
    }
  };

  const handleSyncClick = async () => {
    if (!onSyncAllStudents) return;
    setIsSyncing(true);
    await onSyncAllStudents();
    setTimeout(() => setIsSyncing(false), 500);
  };
  return (
    <>
      {/* TAB 1: SET WEIGHTAGE */}
      {activeTab === 'weightage' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Weightage Data Grid left column */}
            <div className="lg:col-span-7 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="py-2.5 px-4 w-12 text-center">Sel</th>
                      <th className="py-2.5 px-4">Marks Title</th>
                      <th className="py-2.5 px-4 text-center border-l border-slate-200/60 bg-indigo-50/10">Percentage</th>
                      <th className="py-2.5 px-4 text-center border-l border-slate-200/60">No of Units</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-slate-755">
                    {tempCategories.map((item, idx) => (
                      <tr
                        key={item.name}
                        onClick={() => setSelectedWeightIndex(idx)}
                        className={`cursor-pointer transition-colors ${
                          selectedWeightIndex === idx
                            ? 'bg-indigo-50/50 text-indigo-950 font-bold border-l-4 border-l-indigo-600'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-4 text-center">
                          <div className="flex items-center justify-center">
                            {selectedWeightIndex === idx ? (
                              <span className="text-indigo-600 text-[10px]">▶</span>
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-sans text-slate-800">
                          {item.name}
                        </td>
                        <td className="py-2.5 px-4 text-center font-bold text-indigo-600 border-l border-slate-200/60 bg-indigo-50/10">
                          {item.percentage}%
                        </td>
                        <td className="py-2.5 px-4 text-center text-slate-650 border-l border-slate-200/60">
                          {item.units}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200 text-xs font-semibold text-slate-800">
                      <td colSpan={2} className="py-2.5 px-4 text-right pr-4 font-sans text-slate-550 border-r border-slate-150">
                        Total Weightage:
                      </td>
                      <td className="py-2.5 px-4 text-center bg-white border-r border-slate-150">
                        <span className={`px-2 py-0.5 rounded font-mono text-xs font-extrabold ${
                          currentTotalWeight === 100
                            ? 'bg-blue-50 text-blue-700 border border-blue-300'
                            : 'bg-rose-50 text-rose-700 border border-rose-300 animate-pulse'
                        }`}>
                          {currentTotalWeight.toFixed(2)}%
                        </span>
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Row Editor Card right column */}
            <div className="lg:col-span-5">
              {tempCategories[selectedWeightIndex] ? (
                <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-[10px] font-mono text-indigo-600 uppercase tracking-widest font-extrabold">
                      Active Component Editor
                    </span>
                    <span className="text-xs font-bold text-indigo-950 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-lg">
                      {tempCategories[selectedWeightIndex].name}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-600 mb-1 font-bold font-mono">
                        Category Percentage (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editWeightPercent}
                        onChange={(e) => handleWeightPercentChange(e.target.value)}
                        className="bg-white text-slate-950 text-xs px-3 py-1.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none w-full font-mono font-bold"
                      />
                      <p className="text-[10px] text-slate-500 mt-1 font-sans">
                        Percentage weight of student's aggregate.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-600 mb-1 font-bold font-mono">
                        Number of Units
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={editWeightUnits}
                        onChange={(e) => handleWeightUnitsChange(e.target.value)}
                        className="bg-white text-slate-950 text-xs px-3 py-1.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none w-full font-mono font-bold"
                      />
                      <p className="text-[10px] text-slate-500 mt-1 font-sans">
                        Number of assessment units (e.g. 3 quizzes).
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#f8fafc] border border-dashed border-slate-300 rounded-xl p-6 text-center text-slate-450 text-xs">
                  Select a row to adjust values
                </div>
              )}
            </div>
          </div>

          {/* Submission and reset actions */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            {saveStatus === 'error-over' && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs font-sans shadow-2xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <div>
                  <span className="font-bold">Error:</span> Total weightage must be exactly 100%. Currently it is <strong className="font-mono">{currentTotalWeight.toFixed(2)}%</strong> (which is greater than 100%). Please set the total weightage to 100%.
                </div>
              </div>
            )}
            {saveStatus === 'error-under' && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs font-sans shadow-2xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <div>
                  <span className="font-bold">Error:</span> Total weightage must be exactly 100%. Currently it is <strong className="font-mono">{currentTotalWeight.toFixed(2)}%</strong> (which is less than 100%). Please set the total weightage to 100%.
                </div>
              </div>
            )}
            {saveStatus === 'success' && (
              <div className="bg-blue-50 border border-blue-300 border-l-4 border-l-blue-600 p-3.5 rounded-xl flex items-start gap-3 shadow-2xs animate-fade-in text-xs font-sans">
                <Check className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-extrabold text-blue-950 uppercase tracking-wider">Saved Successfully</h4>
                  <p className="text-[11px] text-blue-850 mt-1 font-sans font-medium">
                    Weightage configuration updated successfully!
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <p className="text-[11px] text-slate-500 font-sans">
                Changes above require selecting <strong className="font-bold">Ok</strong> to finalize.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetWeightage}
                  className="px-4 py-1.5 hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAllWeightage}
                  className={`px-5 py-1.5 text-white text-xs font-bold rounded-lg shadow-md flex items-center gap-1.5 transition-all ${
                    saveStatus === 'success'
                      ? 'bg-blue-600 hover:bg-blue-700 font-extrabold px-6 scale-105'
                      : saveStatus === 'error-over'
                      ? 'bg-rose-600 hover:bg-rose-700 scale-105'
                      : saveStatus === 'error-under'
                      ? 'bg-rose-600 hover:bg-rose-700 scale-105'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  Ok
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EDIT ITEMS */}
      {activeTab === 'edit-items' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-indigo-600" />
              Configure Category Unit Marks Details
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Choose an assessment item below to adjust each individual unit's total marks and relative weights. Items set to 0% cannot have unit configs.
            </p>
          </div>

          {/* Categories Selector list representing the dropdown items visually */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectedCourse.categories.map(cat => {
              const hasWeight = cat.percentage > 0;
              return (
                <div
                  key={cat.name}
                  onClick={() => handleOpenUnitEditor(cat.name)}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                    hasWeight
                      ? 'bg-white border-slate-200 hover:border-indigo-600/80 hover:bg-slate-50/50 hover:shadow-sm relative overflow-hidden group'
                      : 'bg-slate-100/40 border-dashed border-slate-300 opacity-60 hover:opacity-100 hover:border-slate-400'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-xs font-bold text-slate-800 select-none whitespace-nowrap">
                      {cat.name}
                    </h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold ${
                      hasWeight ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {cat.percentage}% Weight
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 font-mono">
                    <span>Units: {cat.units}</span>
                    <span className="text-indigo-650 opacity-0 group-hover:opacity-100 font-bold transition-opacity font-sans">
                      Edit Units &rarr;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: REGISTER STUDENTS */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          {/* SYNC & QUICK ADD HEADER BAR */}
          <div className="bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 border border-indigo-100 rounded-2xl p-5 shadow-xs font-sans space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-100/80 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-indigo-600 shrink-0" />
                  <h4 className="font-sans font-extrabold text-slate-900 text-sm tracking-wide">
                    Course Student Enrollment Roster ({selectedCourse.students.length} Enrolled)
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  {selectedCourse.students.length === 1 
                    ? "Currently 1 student is assigned to this course section from the server database." 
                    : `Currently ${selectedCourse.students.length} students are enrolled in this course section.`}
                  Click below to sync all enrolled department students into this course section automatically.
                </p>
              </div>

              {onSyncAllStudents && (
                <button
                  type="button"
                  onClick={handleSyncClick}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync All Enrolled Department Students</span>
                </button>
              )}
            </div>

            {/* INLINE ADD STUDENT FORM */}
            {onAddStudent && (
              <form onSubmit={handleInlineAddStudent} className="pt-1">
                <span className="block text-[10px] uppercase font-mono font-extrabold text-slate-500 mb-2">
                  Quick Enroll Student
                </span>
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch">
                  <input
                    type="text"
                    placeholder="Reg No (e.g. 052-FA23-20002)"
                    value={newRegNo}
                    onChange={(e) => setNewRegNo(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none font-mono font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Student Name (e.g. SYED SAMI)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none font-sans font-medium"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-indigo-300" />
                    <span>Enroll Student</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ENROLLED STUDENTS MATRIX */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <h5 className="font-bold text-xs text-slate-800 font-sans uppercase tracking-wider">
                  Enrolled Students List
                </h5>
              </div>
              <span className="text-[10px] font-mono font-extrabold px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full">
                {selectedCourse.students.length} Student{selectedCourse.students.length !== 1 ? 's' : ''} Total
              </span>
            </div>

            <div className="overflow-auto max-h-[420px]">
              <table className="w-full text-left text-xs font-sans relative">
                <thead className="sticky top-0 bg-slate-100/90 z-20 shadow-2xs border-b border-slate-200">
                  <tr className="text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4 w-12 text-center">S.#</th>
                    <th className="py-2.5 px-4">Registration No.</th>
                    <th className="py-2.5 px-4">Student Name</th>
                    {onUnenrollStudent && <th className="py-2.5 px-4 text-center w-20">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-slate-700">
                  {selectedCourse.students.map((student, index) => (
                    <tr key={student.regNo} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono">
                        {index + 1}
                      </td>
                      <td className="py-3 px-4 text-indigo-650 font-bold font-mono text-[11px]">
                        {student.regNo}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-800 font-medium">
                        {student.name}
                      </td>
                      {onUnenrollStudent && (
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => onUnenrollStudent(student.regNo)}
                            title="Unenroll student"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {selectedCourse.students.length === 0 && (
                    <tr>
                      <td colSpan={onUnenrollStudent ? 4 : 3} className="py-8 text-center text-slate-500 font-sans">
                        No students enrolled yet. Click "Sync All Enrolled Department Students" above to load class roster.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
