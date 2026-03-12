import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import WorldView from './pages/WorldView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/world/:id" element={<WorldView />} />
      </Routes>
    </BrowserRouter>
  );
}
