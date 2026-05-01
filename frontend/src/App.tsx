import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';

const Landing = lazy(() => import('./pages/Landing'));
const WorldView = lazy(() => import('./pages/WorldView'));
const Chronicle = lazy(() => import('./pages/Chronicle'));
const Regen = lazy(() => import('./pages/Regen'));
const Demo = lazy(() => import('./pages/Demo'));
const Control = lazy(() => import('./pages/Control'));
const NotFound = lazy(() => import('./pages/NotFound'));
const About = lazy(() => import('./pages/About'));
const Contributors = lazy(() => import('./pages/Contributors'));
const Glossary = lazy(() => import('./pages/Glossary'));
const Watch = lazy(() => import('./pages/Watch'));
const Admin = lazy(() => import('./pages/Admin'));
const Judge = lazy(() => import('./pages/Judge'));

function PageLoader() {
  // Editorial skeleton — ghost-text shimmer, not a SaaS spinner. Approximates
  // a Masthead bar + display-headline + body lines so the layout shift on
  // mount is minimal.
  return (
    <div className="min-h-screen bg-page">
      <div className="border-b border-subtle">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-8">
          <div className="skeleton h-5 w-32" />
          <div className="skeleton h-3 w-44 hidden sm:block" />
          <div className="ml-auto skeleton h-3 w-24" />
        </div>
      </div>
      <main className="max-w-3xl mx-auto px-6 py-20 space-y-6">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-12 w-full" />
        <div className="skeleton h-12 w-3/4" />
        <div className="space-y-3 pt-6">
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-5/6" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-4/5" />
        </div>
      </main>
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
            <Route path="/demo" element={<Demo />} />
            <Route path="/try-it" element={<Demo />} />
            <Route path="/control" element={<Control />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/judge" element={<Judge />} />
            <Route path="/about" element={<About />} />
            <Route path="/contributors" element={<Contributors />} />
            <Route path="/glossary" element={<Glossary />} />
            <Route path="/watch" element={<Watch />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
