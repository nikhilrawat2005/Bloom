"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { FileText, ArrowLeft } from "lucide-react";

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
    title: "1. Acceptance of Terms",
    content: `By accessing or using the Bloom platform, you agree to comply with and be bound by these Terms of Use. If you do not agree to these terms, please do not access or use the platform.`,
  },
  {
    title: "2. User Accounts and Security",
    content: `To use certain features of Bloom, such as the Opportunity Tracker, Wallet, and saved bookmarks, you must register for an account.

• You must provide accurate, current, and complete information during registration.
• You are responsible for keeping your credentials confidential.
• You must immediately notify Bloom support of any unauthorized use or security breach of your account.
• Bloom will not be liable for any loss or damage arising from your failure to protect your login information.`,
  },
  {
    title: "3. User Conduct and Responsibilities",
    content: `You agree to use Bloom solely for your personal, non-commercial professional/academic discovery. You agree NOT to:

• Upload, transmit, or distribute any documents or contents to the Wallet that violate intellectual property laws or contain malware.
• Use automated tools (bots, scrapers, crawlers) to extract listing databases from Bloom without authorization.
• Misrepresent your background information, qualifications, or family income brackets to qualify for recommendations.
• Disrupt or interfere with the security or performance of the platform's database and networks.`,
  },
  {
    title: "4. Wallet Document Policy",
    content: `Bloom provides the Opportunity Wallet so you can store resumes and certifications.

• You retain full ownership of all documents you upload.
• By uploading documents, you represent that you possess all necessary rights and clearances to store such files.
• Bloom does not review or audit uploaded documents for authenticity. It is your sole responsibility to ensure all files are authentic and correct before sharing with official organization sponsors.`,
  },
  {
    title: "5. Disclaimer of Opportunities",
    content: `Bloom aggregates academic, fellowship, and STEM programs from various organizations and automated feeds.

• Bloom does not guarantee the availability, accuracy, or legitimacy of any external opportunity.
• The official deadlines, criteria, and requirements are subject to change by the respective organizers.
• Application processes, decisions, and selections are completed entirely on official third-party portals, and Bloom has no influence or liability over program decisions.`,
  },
  {
    title: "6. Limitation of Liability",
    content: `To the maximum extent permitted by law, Bloom, its creators, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, data, or career/academic placement opportunities resulting from your use of or inability to use the platform.`,
  },
  {
    title: "7. Modifications to the Service",
    content: `We reserve the right to modify, suspend, or discontinue any part of the Bloom platform at any time, with or without notice. We are not liable to you or any third party for any service modification or suspension.`,
  },
  {
    title: "8. Governing Law",
    content: `These Terms of Use shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law principles. Any legal actions arising from these terms must be filed in the competent courts of New Delhi, India.`,
  },
  {
    title: "9. Contact Information",
    content: `For any questions, clarifications, or complaints regarding these Terms of Use, please reach out to us through the Bloom Help Center.`,
  },
];

export default function TermsOfUsePage() {
  return (
    <>
      <Navbar />
      <main className="flex-grow bg-background min-h-screen transition-colors duration-300">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border py-20 px-4 sm:px-6 lg:px-8">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-accent-gold-surface/10 blur-3xl pointer-events-none" />
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
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-accent-gold bg-accent-gold-surface px-3 py-1.5 rounded-full mb-4"
            >
              <FileText className="w-3.5 h-3.5" /> Terms of Use
            </motion.span>
            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-5xl font-extrabold text-foreground leading-tight"
            >
              Terms of Use
            </motion.h1>
            <motion.p
              variants={itemVariants}
              className="mt-4 text-sm text-foreground-muted leading-relaxed"
            >
              Last updated: July 10, 2026 &nbsp;·&nbsp; Bloom Platform
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
                        {line.replace("•", "").trim()}
                      </p>
                    ) : (
                      <p key={i}>{line}</p>
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
