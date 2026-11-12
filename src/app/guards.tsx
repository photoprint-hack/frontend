import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth/auth-context';
import { can, type Capability } from '@/lib/auth/rbac';
import { ForbiddenState, LoadingState } from '@/components/feedback/States';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Восстанавливаем сессию…" />
      </div>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}

export function RequireCapability({ capability, children }: { capability: Capability; children: ReactNode }) {
  const { role } = useAuth();
  if (!can(role, capability)) return <ForbiddenState />;
  return <>{children}</>;
}
