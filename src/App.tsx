import { useState } from 'react';
import { UserType } from './types';
import Login from './components/Login';
import QADashboard from './components/QADashboard';
import InstructorDashboard from './components/InstructorDashboard';
import ComingSoon from './components/ComingSoon';
import { AnimatePresence, motion } from 'motion/react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<{ type: UserType; name: string } | null>(null);

  const handleLogin = (type: UserType, name: string) => {
    setCurrentUser({ type, name });
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  return (
    <div className="min-h-screen font-sans text-gray-900 bg-white selection:bg-gray-900 selection:text-white">
      <AnimatePresence mode="wait">
        {!currentUser ? (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full"
          >
            <Login onLogin={handleLogin} />
          </motion.div>
        ) : (currentUser.type === 'QA' || currentUser.type === 'admin' || currentUser.type === 'qa') ? (
          <motion.div
            key="qa-dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full"
          >
            <QADashboard onLogout={handleLogout} />
          </motion.div>
        ) : (currentUser.type === 'instructor') ? (
          <motion.div
            key="instructor-dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full"
          >
            <InstructorDashboard onLogout={handleLogout} instructorName={currentUser.name || undefined} />
          </motion.div>
        ) : (
          <motion.div
            key="coming-soon"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full"
          >
            <ComingSoon userType={currentUser.type} onLogout={handleLogout} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
