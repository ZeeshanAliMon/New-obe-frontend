import React, { useState } from 'react';
import { motion } from 'motion/react';
import { UserType } from '../types';
import { GraduationCap, BookOpen, ShieldCheck } from 'lucide-react';
import { BASE_URL } from '../services/apiService';

interface LoginProps {
  onLogin: (userType: UserType, name: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [userType, setUserType] = useState<UserType | ''>('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!userType) {
      setError('Please select a user type first.');
      return;
    }

    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    try {
      const res = await fetch(`${BASE_URL}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ username, password }),
      });
      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid username or password');
        return;
      }

      // Save tokens
      localStorage.setItem('access',  data.access);
      localStorage.setItem('refresh', data.refresh);

      // Use role from Django instead of the UI selector
      onLogin(data.user.user_type as UserType, data.user.username);

    } catch (err) {
      clearTimeout(timeoutId);
      setError('Connection to backend failed. Logging you into offline corporate sandbox demo...');
      setTimeout(() => {
        // Fallback login
        onLogin(userType as UserType, username || 'QA Advisor');
      }, 1200);
    } finally {
      // delay state reset to make transition look native
      setTimeout(() => {
        setLoading(false);
      }, 1200);
    }
  };

  const userTypes: { type: UserType; label: string; icon: any }[] = [
    { type: 'qa',         label: 'QA / Quality Assurance', icon: ShieldCheck   },
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
          <div className="mx-auto w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg mb-4">IU</div>
          <h1 className="text-4xl font-display font-bold text-indigo-950 tracking-tight mb-2">Iqra University OBE</h1>
          <p className="text-indigo-800/80 font-sans text-sm font-medium">University Outcome Based Education Manager</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-sans font-bold uppercase tracking-wider text-indigo-900/60 ml-1 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
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
                  <option value="qa" className="bg-slate-50 text-slate-900">QA / Quality Assurance</option>
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
      </motion.div>
    </div>
  );
}
