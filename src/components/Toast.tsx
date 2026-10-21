import { useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'success', onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  // Premium design styling based on notification type
  const styling = {
    success: {
      border: 'border-blue-500/20',
      bg: 'bg-white/95 text-slate-900 shadow-blue-500/5',
      iconBg: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
      icon: CheckCircle2,
      accent: 'bg-blue-500',
    },
    error: {
      border: 'border-rose-500/20',
      bg: 'bg-white/95 text-slate-900 shadow-rose-500/5',
      iconBg: 'bg-rose-500/10 text-rose-600 border border-rose-500/20',
      icon: AlertCircle,
      accent: 'bg-rose-500',
    },
    info: {
      border: 'border-indigo-500/20',
      bg: 'bg-white/95 text-slate-900 shadow-indigo-500/5',
      iconBg: 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20',
      icon: Info,
      accent: 'bg-indigo-500',
    }
  }[type];

  const Icon = styling.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.95, x: 20 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      exit={{ opacity: 0, y: -10, scale: 0.95, x: 10 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className={`fixed bottom-6 right-6 z-[99999] pointer-events-auto flex items-center gap-3.5 px-4 py-4 border rounded-2xl shadow-xl backdrop-blur-md max-w-md ${styling.bg} ${styling.border}`}
    >
      {/* Visual Accent bar on the left */}
      <div className={`absolute left-0 top-3.5 bottom-3.5 w-1.2 rounded-r-md ${styling.accent}`} />
      
      {/* Icon Badge */}
      <div className={`flex items-center justify-center p-2 rounded-xl shrink-0 ${styling.iconBg}`}>
        <Icon className="w-5 h-5" />
      </div>

      {/* Message Text */}
      <div className="flex flex-col pr-6 pl-1">
        <span className="text-sm font-semibold tracking-tight">{message}</span>
      </div>

      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-2.5 right-2.5 p-1 rounded-lg hover:bg-black/5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
