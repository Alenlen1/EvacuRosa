import type { Metadata } from "next";
import "./admin.css";
import "./barangay-dashboard.css";

export const metadata: Metadata = {
  title: "EvacuRosa Administration",
  icons: {
    icon: [
      {
        url: "/icons/evacurosa-shelter-clean-32.png",
        sizes: "32x32",
        type: "image/png",
      },
    ],
    apple: "/icons/evacurosa-shelter-clean-180.png",
  },
  robots: { index: false, follow: false },
};
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
