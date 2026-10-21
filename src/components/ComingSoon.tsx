import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';

interface ComingSoonProps {
  userType: string;
  onLogout: () => void;
}

export default function ComingSoon({ userType, onLogout }: ComingSoonProps) {
  const getDisplayName = (type: string) => {
    if (type === 'dept_admin') return 'Department Administrator';
    if (type === 'student') return 'Student';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="min-h-screen frosted-bg flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/40 backdrop-blur-xl border border-white/50 p-8 rounded-[32px] shadow-xl max-w-md w-full text-center"
      >
        <img 
          src="/iqralogo.png" 
          alt="Iqra University Logo" 
          className="mx-auto w-56 h-20 object-contain mb-5 bg-white p-2.5 rounded-2xl shadow-sm border border-slate-100"
          referrerPolicy="no-referrer"
        />
        <h1 className="text-3xl font-display font-medium text-slate-800 mb-4">Coming Soon</h1>
        <p className="text-slate-600 mb-8 font-sans">
          The dashboard for <span className="font-semibold text-indigo-950">{getDisplayName(userType)}</span> is currently under development.
        </p>
        <button
          onClick={onLogout}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-sans font-medium hover:bg-indigo-700 transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Login</span>
        </button>
      </motion.div>
    </div>
  );
}
