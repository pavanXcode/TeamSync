import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Employees from './pages/Employees';
import TeamBuilder from './pages/TeamBuilder';
import Workload from './pages/Workload';
import SkillGaps from './pages/SkillGaps';
import DeadlineRisk from './pages/DeadlineRisk';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="employees" element={<Employees />} />
        <Route path="team-builder" element={<TeamBuilder />} />
        <Route path="workload" element={<Workload />} />
        <Route path="skill-gaps" element={<SkillGaps />} />
        <Route path="deadline-risk" element={<DeadlineRisk />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
