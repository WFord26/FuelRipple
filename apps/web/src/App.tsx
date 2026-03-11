import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

// ── Lazy-load all page bundles (code-splitting per route) ────────────────────
const Dashboard  = lazy(() => import('./pages/Dashboard'));
const Historical = lazy(() => import('./pages/Historical'));
const Comparison = lazy(() => import('./pages/Comparison'));
const Impact     = lazy(() => import('./pages/Impact'));
const Correlation = lazy(() => import('./pages/Correlation'));
const Supply     = lazy(() => import('./pages/Supply'));
const Downstream = lazy(() => import('./pages/Downstream'));

// ── Shared loading skeleton ──────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-slate-700 rounded-lg" />
      <div className="h-4 w-96 bg-slate-800 rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-32 bg-slate-800 rounded-xl border border-slate-700" />
        ))}
      </div>
      <div className="h-72 bg-slate-800 rounded-xl border border-slate-700" />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary section="Application">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={
            <ErrorBoundary section="Dashboard" inline={false}>
              <Suspense fallback={<PageSkeleton />}><Dashboard /></Suspense>
            </ErrorBoundary>
          } />
          <Route path="historical" element={
            <ErrorBoundary section="Historical" inline={false}>
              <Suspense fallback={<PageSkeleton />}><Historical /></Suspense>
            </ErrorBoundary>
          } />
          <Route path="comparison" element={
            <ErrorBoundary section="Regional Comparison" inline={false}>
              <Suspense fallback={<PageSkeleton />}><Comparison /></Suspense>
            </ErrorBoundary>
          } />
          <Route path="supply" element={
            <ErrorBoundary section="Supply Health" inline={false}>
              <Suspense fallback={<PageSkeleton />}><Supply /></Suspense>
            </ErrorBoundary>
          } />
          <Route path="impact" element={
            <ErrorBoundary section="Consumer Impact" inline={false}>
              <Suspense fallback={<PageSkeleton />}><Impact /></Suspense>
            </ErrorBoundary>
          } />
          <Route path="correlation" element={
            <ErrorBoundary section="Market Correlation" inline={false}>
              <Suspense fallback={<PageSkeleton />}><Correlation /></Suspense>
            </ErrorBoundary>
          } />
          <Route path="downstream" element={
            <ErrorBoundary section="Downstream Impact" inline={false}>
              <Suspense fallback={<PageSkeleton />}><Downstream /></Suspense>
            </ErrorBoundary>
          } />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default App;

