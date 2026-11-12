import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/auth-context';

/** Стартовая страница: employee → /tasks, остальные → /dashboard (ТЗ 3.2). */
export function HomeRedirect() {
  const { home } = useAuth();
  return <Navigate to={home} replace />;
}
