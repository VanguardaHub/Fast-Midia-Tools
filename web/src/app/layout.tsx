import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { RegistrarServiceWorker } from "@/components/registrar-sw";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Fast Mídia Tools", template: "%s · Fast Mídia Tools" },
  description: "Plataforma interna de gestão de jobs de campo da Fast Mídia (Vanguarda Martech).",
  applicationName: "Fast Mídia Tools",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Fast Mídia" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#d03134",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
