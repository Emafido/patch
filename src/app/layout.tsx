import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Patch — Dependency Graph Security & Investigation',
  description: 'Trace dependency paths, discover shared risks across repositories, and prioritize upgrades using FalkorDB.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
        {children}
      </body>
    </html>
  );
}
