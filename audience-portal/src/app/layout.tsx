import type { Metadata } from "next";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { AcadsphereProvider } from "@/context/AcadsphereContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acadsphere | Your Academic Command Center",
  description: "Acadsphere is a highly elegant, minimalist, and futuristic academic operating system for students to track schedules, attendance margins, CGPA courses, and grade projections.",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="font-sans h-full antialiased"
    >
      <head>
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4592704100751931" crossOrigin="anonymous"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col">
        <GoogleAnalytics />
        <AcadsphereProvider>
          {children}
        </AcadsphereProvider>
      </body>
    </html>
  );
}


