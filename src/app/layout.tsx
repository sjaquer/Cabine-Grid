import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from '@/firebase';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import SidebarWrapper from '@/components/layout/SidebarWrapper';
import { ThemeProvider } from '@/context/ThemeContext';

export const metadata: Metadata = {
  title: 'Cabine Grid',
  description: 'Gestor de cabinas de internet',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
    notranslate: true,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
      noimageindex: true,
      notranslate: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&family=Sora:wght@500;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased text-foreground">
        <ThemeProvider>
          <FirebaseClientProvider>
            <AuthProvider>
              <SidebarWrapper>{children}</SidebarWrapper>
            </AuthProvider>
          </FirebaseClientProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
