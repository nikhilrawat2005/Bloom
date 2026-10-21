"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { HelpCircle, ChevronDown, ArrowLeft } from "lucide-react";
import { useState } from "react";

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.23, 1, 0.32, 1] } },
};

const faqs = [
  {
    q: "How do I create a NEXORA account?",
    a: "Click 'Get Started' or 'Sign Up' on the homepage. You can register using your email address. Once registered, complete your profile so NEXORA can match you with relevant opportunities.",
  },
  {
    q: "How does NEXORA match opportunities to my profile?",
    a: "NEXORA uses the details you provide in your profile — education level, field of interest, location, income bracket, and skills — to surface the most relevant scholarships, fellowships, internships, and programs from our live database.",
  },
  {
    q: "How do I bookmark an opportunity?",
    a: "On any opportunity card in Explore or on the opportunity detail page, click the bookmark icon. You must be logged in. All bookmarks are saved to your dashboard under the Saved Opportunities section.",
  },
  {
    q: "What is the Opportunity Tracker?",
    a: "The tracker is a Kanban-style board where you can monitor the status of your applications. Each opportunity Type (Job, Internship, Hackathon, Scholarship, Research, Other) has its own pipeline of stages — e.g. Jobs go 'Applied → Shortlisted → Interview → Offer Received → Joined', while Hackathons go 'Registered → Submitted → Shortlisted → Finalist → Winner'. You can add applications manually or import from your bookmarks, and filter the board by type.",
  },
  {
    q: "What is the Opportunity Wallet?",
    a: "The Wallet is a secure document vault where you can upload and organize career documents like your resume, certificates, awards, and ID documents. You can also use the AI Audit feature to get instant feedback on your documents.",
  },
  {
    q: "How do I set a deadline reminder?",
    a: "On any opportunity detail page, click 'Set Reminder' in the Deadline Alert panel on the right sidebar. You must be logged in. The reminder will appear on your dashboard so you never miss an application window.",
  },
  {
    q: "Can organizations post opportunities on NEXORA?",
    a: "Yes! Organizations can register and submit opportunities through the Organization Portal. Submitted opportunities go through an approval process before being visible to users.",
  },
  {
    q: "Is my data safe on NEXORA?",
    a: "Absolutely. NEXORA uses Firebase Authentication and Firestore with strict security rules. Documents uploaded to the Wallet are stored in a private Cloudinary folder isolated per user. We never sell your data. See our Privacy Policy for full details.",
  },
  {
    q: "How do I contact NEXORA support?",
    a: "Our support team is available through the NEXORA Help Center and we aim to respond within 24 hours.",
  },
];

function FAQItem({ q, a }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      variants={itemVariants}
      className="border border-border rounded-2xl overflow-hidden bg-surface"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-surface-raised transition-colors"
      >
        <span className="font-semibold text-foreground text-sm leading-snug">{q}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="flex-shrink-0 text-foreground-muted"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.span>
      </button>

      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="overflow-hidden"
      >
        <p className="px-5 pb-5 text-sm text-foreground-muted leading-relaxed">{a}</p>
      </motion.div>
    </motion.div>
  );
}

export default function HelpCenterPage() {
  return (
    <>
      <Navbar />
      <main className="flex-grow bg-background min-h-screen transition-colors duration-300">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border py-20 px-4 sm:px-6 lg:px-8">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-secondary/6 blur-3xl pointer-events-none" />
          <motion.div
            className="max-w-3xl mx-auto text-center relative z-10"
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
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-secondary bg-secondary/10 px-3 py-1.5 rounded-full mb-4"
            >
              <HelpCircle className="w-3.5 h-3.5" /> Help Center
            </motion.span>
            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-5xl font-extrabold text-foreground leading-tight"
            >
              How Can We Help?
            </motion.h1>
            <motion.p
              variants={itemVariants}
              className="mt-4 text-base text-foreground-muted max-w-xl mx-auto leading-relaxed"
            >
              Browse answers to the most frequently asked questions about using the NEXORA platform.
            </motion.p>
          </motion.div>
        </section>

        {/* FAQ Section */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div
            className="space-y-3"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            <motion.h2
              variants={itemVariants}
              className="text-lg font-extrabold text-foreground mb-6"
            >
              Frequently Asked Questions
            </motion.h2>
            {faqs.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} index={i} />
            ))}
          </motion.div>
        </section>

      </main>
      <Footer />
    </>
  );
}
