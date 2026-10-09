import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './app/layout/AppShell';
import { ToastProvider } from './app/components/Toast';
import { Alerts } from './app/pages/Alerts';
import { Classes } from './app/pages/Classes';
import { Collections } from './app/pages/Collections';
import { Dashboard } from './app/pages/Dashboard';
import { Import } from './app/pages/Import';
import { Login } from './app/pages/Login';
import { Reports } from './app/pages/Reports';
import { Settings } from './app/pages/Settings';
import { StudentProfile } from './app/pages/StudentProfile';
import { Students } from './app/pages/Students';
import { Landing } from './landing/Landing';
import { AuthProvider, RequireAuth } from './store/auth';
import { StoreProvider } from './store/store';

/** Routes without a router, so tests can mount them inside a MemoryRouter. */
export function AppRoutes() {
  return (
    <StoreProvider>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/app"
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="students" element={<Students />} />
              <Route path="students/:admissionNo" element={<StudentProfile />} />
              <Route path="import" element={<Import />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="classes" element={<Classes />} />
              <Route path="collections" element={<Collections />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </StoreProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
