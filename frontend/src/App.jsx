import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Search from './pages/Search';
import VTuberDetail from './pages/VTuberDetail';
import TagList from './pages/TagList';
import TagDetail from './pages/TagDetail';
import Admin from './pages/Admin';

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
      </Route>
    </Routes>
  );
}

export default App;
