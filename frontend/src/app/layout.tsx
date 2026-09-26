import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { DEVELOPMENT_WORKER_RESET } from "@/lib/developmentWorkerReset";

export const metadata: Metadata = {
  title: "EvacuRosa",
  description:
    "Multi-hazard safe route recommendation system for Santa Rosa City, Laguna.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/favicon-32.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4d84b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {process.env.NODE_ENV !== "production" && <Script id="development-worker-reset" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: DEVELOPMENT_WORKER_RESET }} />}
      </head>
      {/* Grammarly can inject body attributes before hydration. Suppress only
          this element's mismatch; descendant hydration warnings remain active. */}
      <body className="antialiased bg-white text-slate-900" suppressHydrationWarning>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
