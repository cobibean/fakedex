'use client';

import '../styles/globals.css';
import { ThirdwebProvider } from "thirdweb/react";
import { Shell } from '@/components/layout/Shell';

import { AchievementWrapper } from '@/components/AchievementWrapper';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <ThirdwebProvider>
          <AchievementWrapper>
            <Shell>
              {children}
            </Shell>
          </AchievementWrapper>
        </ThirdwebProvider>
      </body>
    </html>
  );
}
