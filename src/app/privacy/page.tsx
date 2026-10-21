"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { Shield, ArrowLeft } from "lucide-react";

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.23, 1, 0.32, 1] } },
};

const sections = [
  {
    title: "1. Information We Collect",
    content: `We collect information you provide directly when you create an account, set up your profile, or interact with the platform. This includes:

• **Account Information:** Name, email address, and authentication credentials.
• **Profile Details:** Education level, field of interest, location, annual income bracket, skills, and interests — used solely to personalise opportunity recommendations.
• **Uploaded Documents:** Files you upload to the Opportunity Wallet (resume, certificates, ID documents, etc.) are stored securely and are accessible only to you.
• **Usage Data:** Anonymized interaction data such as which opportunities you viewed or bookmarked, to improve recommendation quality.`,
  },
  {
    title: "2. How We Use Your Information",
    content: `We use the information we collect to:

• Provide, operate, and improve the Bloom platform.
• Match and recommend relevant scholarships, fellowships, internships, and STEM programs to your profile.
• Send deadline reminders and dashboard notifications you explicitly opt into.
• Respond to your support requests and communicate updates.
• Ensure the security, integrity, and legal compliance of our platform.

We do not sell, rent, or share your personal data with third-party advertisers.`,
  },
  {
    title: "3. Data Storage & Security",
    content: `Your data is stored on Google Firebase (Firestore) and Cloudinary (document storage). We implement industry-standard measures including:

• **Firebase Authentication** for secure login with encrypted credentials.
• **Firestore Security Rules** that ensure each user can only access their own data.
• **Per-user isolated storage** on Cloudinary — your documents are stored in a private folder keyed to your unique user ID.
• HTTPS encryption for all data transmitted between your browser and our servers.

While we take every reasonable precaution, no method of internet transmission is 100% secure. We encourage you to use a strong, unique password.`,
  },
  {
    title: "4. Cookies & Analytics",
    content: `Bloom uses minimal browser storage (localStorage) only to persist your theme preference (light/dark mode). We do not use third-party advertising cookies or tracking pixels.

Anonymous usage analytics may be collected to understand aggregate platform usage and improve the user experience. This data cannot identify you personally.`,
  },
  {
    title: "5. Third-Party Services",
    content: `Bloom integrates with the following third-party services to provide core functionality:

• **Google Firebase** — Authentication and database (Google Privacy Policy applies).
• **Cloudinary** — Document/file storage (Cloudinary Privacy Policy applies).
• **Google Fonts** — Typography (loaded with privacy-preserving settings).

When you follow external "Apply" links to official program sites, those websites have their own privacy policies which we do not control.`,
  },
  {
    title: "6. Your Rights",
    content: `You have the right to:

• **Access** the personal data we hold about you.
• **Correct** inaccurate profile information at any time via the Profile Settings page.
• **Delete** your account and all associated data from your account settings.
• **Withdraw consent** to any optional data processing.

To exercise any of these rights, contact us using the details below.`,
  },
  {
    title: "7. Children's Privacy",
    content: `Bloom is intended for users who are at least 13 years of age. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with their information, please contact us immediately so we can delete it.`,
  },
  {
    title: "8. Changes to This Policy",
    content: `We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify registered users of significant changes via email or a prominent notice on the platform. The date at the top of this page reflects when the policy was last updated.`,
  },
  {
    title: "9. Contact Us",
    content: `If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data, please reach out to us through the Bloom Help Center.`,
  },
];

export default function PrivacyPolicyPage() {
  return (
    <>
      <Navbar />
      <main className="flex-grow bg-background min-h-screen transition-colors duration-300">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border py-20 px-4 sm:px-6 lg:px-8">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-success/5 blur-3xl pointer-events-none" />
          <motion.div
            className="max-w-3xl mx-auto relative z-10"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={itemVariants}>
              <Link
                href="/resources"
                className="inline-flex items-center gap-1 text-xs font-semibold text-foreground-muted hover:text-foreground mb-5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Resources
              </Link>
            </motion.div>
            <motion.span
              variants={itemVariants}
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-success bg-success-surface px-3 py-1.5 rounded-full mb-4"
            >
              <Shield className="w-3.5 h-3.5" /> Privacy Policy
            </motion.span>
            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-5xl font-extrabold text-foreground leading-tight"
            >
              Your Privacy Matters
            </motion.h1>
            <motion.p
              variants={itemVariants}
              className="mt-4 text-sm text-foreground-muted leading-relaxed"
            >
              Last updated: July 10, 2026 &nbsp;·&nbsp; Bloom Platform
            </motion.p>
            <motion.p
              variants={itemVariants}
              className="mt-3 text-base text-foreground-muted max-w-2xl leading-relaxed"
            >
              At Bloom, we are committed to protecting your privacy and handling your personal information with transparency and care. This policy explains what data we collect, how we use it, and how we keep it safe.
            </motion.p>
          </motion.div>
        </section>

        {/* Content */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div
            className="space-y-10"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {sections.map(({ title, content }) => (
              <motion.div key={title} variants={itemVariants}>
                <h2 className="text-base font-extrabold text-foreground mb-3 border-b border-border pb-2">
                  {title}
                </h2>
                <div className="text-sm text-foreground-muted leading-relaxed space-y-2 whitespace-pre-line">
                  {content.split("\n").map((line, i) =>
                    line.startsWith("•") ? (
                      <p key={i} className="pl-2 border-l-2 border-primary/30">
                        {line.replace("•", "").trim().replace(/\*\*(.*?)\*\*/g, "$1")}
                      </p>
                    ) : (
                      <p key={i}>{line.replace(/\*\*(.*?)\*\*/g, "$1")}</p>
                    )
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>
      </main>
      <Footer />
    </>
  );
}
