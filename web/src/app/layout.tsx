import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "deadcipher — cybersecurity intelligence, without the noise",
  description:
    "AI-synthesized cybersecurity reporting with paragraph-level citations. Every claim traceable to its source, refreshed automatically.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

const themeBootstrap = `(function(){try{var t=localStorage.getItem("dc-theme");var d=t?t==="dark":true;document.documentElement.classList.toggle("dark",d)}catch(e){document.documentElement.classList.add("dark")}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <Script id="dc-theme" strategy="beforeInteractive">
          {themeBootstrap}
        </Script>
      </head>
      <body className="flex min-h-full flex-col bg-background font-sans text-fg">
        {children}
      </body>
    </html>
  );
}
