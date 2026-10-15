import type { Metadata, Viewport } from "next";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const description = `${BRAND.description} ${BRAND.tagline}`;
export const metadata: Metadata = {
  title: BRAND.title,
  description,
  applicationName: BRAND.name,
  openGraph: { title: BRAND.title, description, siteName: BRAND.name, type: "website" },
  twitter: { card: "summary_large_image", title: BRAND.title, description },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

// Theme key is intentionally still "nexa-theme" so existing visitors keep their saved theme.
const themeScript = `try{var t=localStorage.getItem("nexa-theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
