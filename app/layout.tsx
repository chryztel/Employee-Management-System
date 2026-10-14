import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'WorkSync — Employment Management System', description: 'WorkSync employee and department manager demonstration portals.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><a className="skip-link sr-only focus:not-sr-only" href="#main-content">Skip to content</a>{children}</body></html>; }
