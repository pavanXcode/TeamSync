import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

/**
 * AppLayout provides the master dashboard shell for TeamSync.
 * Keeps the Sidebar and Topbar persistent across client-side route transitions
 * and manages responsive viewport transitions for mobile devices.
 */
export default function AppLayout() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 antialiased overflow-x-hidden">
      {/* Sidebar navigation */}
      <Sidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main viewport area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Topbar navigation */}
        <Topbar onOpenSidebar={() => setIsMobileSidebarOpen(true)} />

        {/* Dynamic page content wrapped in consistent container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Global persistent footer */}
        <footer className="border-t border-slate-200/80 bg-white/50 px-6 py-4 text-center sm:flex sm:items-center sm:justify-between text-xs text-slate-400">
          <p className="font-medium text-slate-500">
            TeamSync &mdash; Workforce Intelligence
          </p>
          <p className="mt-1 sm:mt-0 italic">
            Intelligent Workforce. Smarter Teams. Better Outcomes.
          </p>
        </footer>
      </div>
    </div>
  );
}
