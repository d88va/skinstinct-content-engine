import type { ReactNode } from 'react';

export const metadata = {
  title: 'Skinstinct Content Engine',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
