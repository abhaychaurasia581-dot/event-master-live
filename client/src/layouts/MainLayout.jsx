import React from 'react';
import Navbar from '../components/layout/Navbar';
import { Outlet, Link } from 'react-router-dom';
import FloatingLines from '../components/common/FloatingLines';

const MainLayout = () => {
  return (
    <div className="relative min-h-screen bg-gray-50 flex flex-col font-sans">
      <div className="fixed inset-0 z-0 pointer-events-auto">
        <FloatingLines 
          enabledWaves={["top", "middle", "bottom"]}
          lineCount={8}
          lineDistance={8}
          bendRadius={8}
          bendStrength={-2}
          interactive={true}
          parallax={true}
          animationSpeed={1}
          linesGradient={['#e945f5', '#6f6f6f', '#6a6a6a']}
          mixBlendMode="normal"
        />
      </div>
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow w-full h-full flex flex-col p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
        <footer className="bg-white/80 backdrop-blur-sm border-t border-gray-200 mt-auto">
          <div className="w-full px-4 sm:px-8 lg:px-12 py-6 flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500 gap-4">
            <p>&copy; {new Date().getFullYear()} EventMaster. All rights reserved.</p>
            <div className="flex gap-6">
              <Link to="/privacy" className="hover:text-indigo-600 transition-colors font-medium">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-indigo-600 transition-colors font-medium">Terms of Service</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default MainLayout;
