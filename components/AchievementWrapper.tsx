'use client';

import { useAchievementCheck } from '@/hooks/useAchievementCheck';

export function AchievementWrapper({ children }: { children: React.ReactNode }) {
  useAchievementCheck();
  return <>{children}</>;
}

