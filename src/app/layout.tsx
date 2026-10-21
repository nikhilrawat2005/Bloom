import type { Metadata } from "next";
import { Fraunces, Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeProvider";
import PageTransition from "@/components/PageTransition";

/* next/font owns the actual family names; these variables are what
   globals.css maps its --font-display / --font-mono tokens onto. Keeping the
   two sets separate avoids the self-referential token that used to leave
   `font-display` silently falling back to Georgia. */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-workhorse",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "NEXORA — Editorial Intelligence for Ambitious Students",
  description:
    "A curated, AI-augmented atlas of scholarships, fellowships, internships and hackathons. Parchment calm, ink precision.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${sora.variable} ${mono.variable} h-full antialiased`}
    >
      {/* bg-background/text-background live in globals.css so the theme toggle
          animates a single property rather than swapping a Tailwind class. */}
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            <PageTransition>{children}</PageTransition>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}