import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";
import React from "react";
import { Providers } from "@/app/providers";
import { AuthProvider } from "@/context/AuthContext";
import RealtimeProvider from "@/components/RealtimeProvider";
import AuthGuard from "@/components/auth/AuthGuard";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CliniQ",
  description: "Clear, accessible care coordination for every CliniQ team.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className={`${dmSans.className} min-h-full`}>
        <Providers>
          <RealtimeProvider>
            <AuthProvider>
              <AuthGuard>{children}</AuthGuard>
            </AuthProvider>
          </RealtimeProvider>
        </Providers>
      </body>
    </html>
  );
}
