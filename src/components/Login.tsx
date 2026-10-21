import React, { useState } from 'react';
import { motion } from 'motion/react';
import { UserType } from '../types';
import { GraduationCap, BookOpen, ShieldCheck } from 'lucide-react';
import { BASE_URL } from '../services/apiService';
import { DEFAULT_TEMP_PASSWORD } from '../utils/config';

interface LoginProps {
  onLogin: (userType: UserType, name: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [userType, setUserType] = useState<UserType | ''>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Password update states
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [tempCredentials, setTempCredentials] = useState<{ email: string; currentPassword: string; userType: UserType; identifier: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!userType) {
      setError('Please select a user type first.');
      return;
    }

    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();
      const res = await fetch(`${BASE_URL}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
      });
      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid username or password');
        return;
      }

      const actualRole = (data.user?.user_type as string || '').toLowerCase();
      const selectedRole = userType.toLowerCase();

      let rolesMatch = false;
      if (selectedRole === 'qa') {
        rolesMatch = actualRole === 'qa' || actualRole === 'admin';
      } else {
        rolesMatch = actualRole === selectedRole;
      }

      if (!rolesMatch) {
        const roleLabels: Record<string, string> = {
          student: 'Student',
          instructor: 'Instructor',
          qa: 'Quality Assurance',
          admission: 'Admission / IT',
          dept_admin: 'Department Administration'
        };
        const selectedLabel = roleLabels[userType] || userType;
        setError(`Access denied: The selected user type "${selectedLabel}" does not match your account's role.`);
        setLoading(false);
        return;
      }

      // Save tokens
      // SECURITY NOTE: Storing JWT tokens in localStorage is susceptible to XSS.
      // For production hardening, transition to using secure, httpOnly cookies set by the backend.
      localStorage.setItem('access',  data.access);
      localStorage.setItem('refresh', data.refresh);

      if (data.user) {
        localStorage.setItem('IQRA_OBE_LOGGED_IN_USER', JSON.stringify(data.user));
        localStorage.setItem('IQRA_OBE_USER_DEPT_ID', data.user.departmentId || data.user.department_id || '');
        localStorage.setItem('IQRA_OBE_USER_DEPT_NAME', data.user.departmentName || data.user.department_name || '');
      }

      // Use registration number or employee ID if available, otherwise fall back to name or email
      const identifier = data.user.regNo || data.user.reg_no || data.user.employeeId || data.user.employee_id || data.user.name || data.user.email;

      if (data.user.mustChangePassword) {
        setTempCredentials({
          email,
          currentPassword: password,
          userType: data.user.user_type as UserType,
          identifier
        });
        setMustChangePassword(true);
        setLoading(false);
        return;
      }

      onLogin(data.user.user_type as UserType, identifier);

    } catch (err) {
      clearTimeout(timeoutId);
      setError('Connection to server failed. Unable to reach the backend service. Please check your network connection or try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setChangePasswordLoading(true);

    try {
      const token = localStorage.getItem('access');
      const res = await fetch(`${BASE_URL}/auth/change-password/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ 
          currentPassword: tempCredentials?.currentPassword || password, 
          newPassword 
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.message || 'Failed to update password. Please try again.');
        setChangePasswordLoading(false);
        return;
      }

      // Password changed successfully! Clear and log in
      setMustChangePassword(false);
      if (tempCredentials) {
        onLogin(tempCredentials.userType, tempCredentials.identifier);
      } else {
        setError('Password updated successfully. Please sign in now with your new password.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection to server failed. Please try again.');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const userTypes: { type: UserType; label: string; icon: any }[] = [
    { type: 'qa',         label: 'Quality Assurance', icon: ShieldCheck   },
    { type: 'instructor', label: 'Instructor',             icon: BookOpen      },
    { type: 'student',    label: 'Student',               icon: GraduationCap },
  ];

  return (
    <div className="min-h-screen frosted-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/40 backdrop-blur-xl border border-white/50 p-8 md:p-12 rounded-[32px] shadow-xl max-w-lg w-full"
      >
        <div className="mb-10 text-center">
          <img 
            src="/iqralogo.png" 
            alt="Iqra University Logo" 
            className="mx-auto w-64 h-24 object-contain mb-5"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-4xl font-display font-bold text-indigo-950 tracking-tight mb-2">Iqra University OBE</h1>
        </div>

        {mustChangePassword ? (
          <form onSubmit={handleChangePasswordSubmit} className="space-y-6">
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold text-indigo-950">Update Temporary Password</h2>
              <p className="text-xs text-indigo-900/60 mt-1">
                Your account was created with a temporary password. For your security, please update it to a permanent password.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-sans font-bold uppercase tracking-wider text-indigo-900/60 ml-1 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-5 py-4 bg-white/40 border border-white/40 rounded-2xl font-sans focus:bg-white/60 focus:ring-2 focus:ring-indigo-600/20 transition-all outline-none text-indigo-950 placeholder:text-indigo-800/40"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-sans font-bold uppercase tracking-wider text-indigo-900/60 ml-1 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="w-full px-5 py-4 bg-white/40 border border-white/40 rounded-2xl font-sans focus:bg-white/60 focus:ring-2 focus:ring-indigo-600/20 transition-all outline-none text-indigo-950 placeholder:text-indigo-800/40"
                  required
                />
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-sm font-sans text-center font-medium"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={changePasswordLoading}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-sans font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {changePasswordLoading ? 'Updating Password...' : 'Save and Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-sans font-bold uppercase tracking-wider text-indigo-900/60 ml-1 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full px-5 py-4 bg-white/40 border border-white/40 rounded-2xl font-sans focus:bg-white/60 focus:ring-2 focus:ring-indigo-600/20 transition-all outline-none text-indigo-950 placeholder:text-indigo-800/40"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-sans font-bold uppercase tracking-wider text-indigo-900/60 ml-1 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-5 py-4 bg-white/40 border border-white/40 rounded-2xl font-sans focus:bg-white/60 focus:ring-2 focus:ring-indigo-600/20 transition-all outline-none text-indigo-950 placeholder:text-indigo-800/40"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-sans font-bold uppercase tracking-wider text-indigo-900/60 ml-1 mb-2">
                  Select User Type
                </label>
                <div className="relative">
                  <select
                    value={userType}
                    onChange={(e) => setUserType(e.target.value as UserType | '')}
                    className="w-full px-5 py-4 bg-white/40 border border-white/40 rounded-2xl font-sans focus:bg-white/60 focus:ring-2 focus:ring-indigo-600/20 transition-all outline-none text-indigo-950 appearance-none cursor-pointer pr-10"
                    required
                  >
                    <option value="" disabled className="bg-slate-50 text-slate-400">Select User Type...</option>
                    <option value="admission" className="bg-slate-50 text-slate-900">Admission / IT</option>
                    <option value="dept_admin" className="bg-slate-50 text-slate-900">Department Administration</option>
                    <option value="qa" className="bg-slate-50 text-slate-900">Quality Assurance</option>
                    <option value="instructor" className="bg-slate-50 text-slate-900">Instructor</option>
                    <option value="student" className="bg-slate-50 text-slate-900">Student</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-indigo-900/60">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-sm font-sans text-center font-medium"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-sans font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Enter Dashboard'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
