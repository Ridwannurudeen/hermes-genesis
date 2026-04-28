import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';

const Landing = lazy(() => import('./pages/Landing'));
const WorldView = lazy(() => import('./pages/WorldView'));
const Chronicle = lazy(() => import('./pages/Chronicle'));
const Regen = lazy(() => import('./pages/Regen'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-page flex items-center justify-center">
      <div className="text-dim text-lg">Loading...</div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/world/:id" element={<WorldView />} />
            <Route path="/chronicle" element={<Chronicle />} />
            <Route path="/chronicle/:slug" element={<Chronicle />} />
            <Route path="/regen" element={<Regen />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
