'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';
import { startSessionSync } from '@/entities/session';
import { createQueryClient } from '@/shared/api';
import { Toaster } from '@/shared/ui';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  useEffect(() => startSessionSync(), []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
