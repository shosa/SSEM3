import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'SSEM3',
  description: 'Sistema di Sorveglianza Energetica Monitorata',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen bg-[#f0f4f8]">
        <Navbar />
        <main className="w-full px-8 py-8">{children}</main>
      </body>
    </html>
  );
}
