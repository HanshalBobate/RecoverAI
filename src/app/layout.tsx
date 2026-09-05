import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RecoverAI — AI Revenue Recovery Controller',
  description: 'AI Revenue Recovery Controller for merchants. Detects revenue at risk, monitors checkout failures, and automates intervention.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#08090d] text-slate-100 antialiased selection:bg-rose-500/30 selection:text-rose-200">
        {children}
      </body>
    </html>
  );
}
