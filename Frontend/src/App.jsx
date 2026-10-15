import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Employees from './pages/Employees';
import TeamBuilder from './pages/TeamBuilder';
import Workload from './pages/Workload';
import SkillGaps from './pages/SkillGaps';
import DeadlineRisk from './pages/DeadlineRisk';
import Settings from './pages/Settings';
import GitHubAnalytics from './pages/GitHubAnalytics';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/team-builder" element={<TeamBuilder />} />
          <Route path="/workload" element={<Workload />} />
          <Route path="/skill-gaps" element={<SkillGaps />} />
          <Route path="/risks" element={<DeadlineRisk />} />
          <Route path="/github-analytics" element={<GitHubAnalytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
