import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Lottong Pinoy — Banner Creator Studio",
  description: "Generate social media banners for Filipino lotto data analysis. Weekly Blueprints and Draw Analysis cards.",
  keywords: ["Lottong Pinoy", "PCSO", "Lotto", "Banner Creator", "Social Media", "Philippines"],
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${montserrat.variable} antialiased bg-gray-950 text-white`}
        style={{ fontFamily: 'Montserrat, sans-serif' }}
        suppressHydrationWarning
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
