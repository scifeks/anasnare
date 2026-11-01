import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { Dashboard } from './pages/Dashboard.js';
import { SiteDetail } from './pages/SiteDetail.js';
import { DetectionDetail } from './pages/DetectionDetail.js';
import { Settings } from './pages/Settings.js';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="sites/:id" element={<SiteDetail />} />
          <Route path="detections/:id" element={<DetectionDetail />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
