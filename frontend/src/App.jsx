import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Search from './pages/Search';
import VTuberDetail from './pages/VTuberDetail';
import TagList from './pages/TagList';
import TagDetail from './pages/TagDetail';
import Admin from './pages/Admin';
import JobMonitor from './pages/admin/JobMonitor';
import IngestionRequests from './pages/admin/IngestionRequests';
import TagEditor from './pages/admin/TagEditor';
import DataCollection from './pages/admin/DataCollection';
import Maintenance from './pages/admin/Maintenance';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="vtuber/:id" element={<VTuberDetail />} />
        <Route path="tags" element={<TagList />} />
        <Route path="tags/:id" element={<TagDetail />} />
        <Route path="admin" element={<Admin />} />
        <Route path="admin/jobs" element={<JobMonitor />} />
        <Route path="admin/ingestion-requests" element={<IngestionRequests />} />
        <Route path="admin/tags" element={<TagEditor />} />
        <Route path="admin/data-collection" element={<DataCollection />} />
        <Route path="admin/maintenance" element={<Maintenance />} />
      </Route>
    </Routes>
  );
}

export default App;
