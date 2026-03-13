import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const Landing = lazy(() => import('./pages/Landing'));
const WorldView = lazy(() => import('./pages/WorldView'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-gray-500 text-lg">Loading...</div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/world/:id" element={<WorldView />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
