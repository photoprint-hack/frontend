import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth/auth-context';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        const status = (error as { status?: number }).status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          closeButton
          toastOptions={{
            style: {
              background: '#0f131b',
              border: '1px solid #242c3d',
              color: '#eef2f9',
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
