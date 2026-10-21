"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion, type Variants } from "framer-motion";
import {
  Shield,
  FileText,
  HelpCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.06 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] } },
};

const resources = [
  {
    href: "/help",
    icon: HelpCircle,
    label: "Help Center",
    desc: "Find answers to common questions about NEXORA — account setup, bookmarks, tracker, wallet, and more.",
    color: "bg-secondary/10 text-secondary border-secondary/20",
    iconBg: "bg-secondary/10 text-secondary",
  },
  {
    href: "/privacy",
    icon: Shield,
    label: "Privacy Policy",
    desc: "Understand how we collect, store, and protect your personal information on the NEXORA platform.",
    color: "bg-success-surface text-success border-success/20",
    iconBg: "bg-success-surface text-success",
  },
  {
    href: "/terms",
    icon: FileText,
    label: "Terms of Use",
    desc: "Read the terms and conditions that govern your access to and use of the NEXORA platform.",
    color: "bg-accent-gold-surface text-accent-gold border-accent-gold/20",
    iconBg: "bg-accent-gold-surface text-accent-gold",
  },
];

export default function ResourcesPage() {
  return (
    <>
      <Navbar />
      <main className="flex-grow bg-background min-h-screen transition-colors duration-300">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border py-20 px-4 sm:px-6 lg:px-8">
          {/* Background blobs */}
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/6 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-secondary/6 blur-3xl pointer-events-none" />

          <motion.div
            className="max-w-3xl mx-auto text-center relative z-10"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            <motion.span
              variants={itemVariants}
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1.5 rounded-full mb-4"
            >
              <Sparkles className="w-3.5 h-3.5" /> Resources
            </motion.span>
            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-5xl font-extrabold text-foreground leading-tight"
            >
              Everything You Need
            </motion.h1>
            <motion.p
              variants={itemVariants}
              className="mt-4 text-base text-foreground-muted max-w-xl mx-auto leading-relaxed"
            >
              Guides, policies, and support resources to help you get the most out of NEXORA — your women&apos;s opportunity platform.
            </motion.p>
          </motion.div>
        </section>

        {/* Resource Cards */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {resources.map(({ href, icon: Icon, label, desc, color, iconBg }) => (
              <motion.div key={href} variants={itemVariants}>
                <Link href={href} className="group block h-full">
                  <motion.div
                    whileHover={{ y: -4, boxShadow: "0 12px 40px rgba(0,0,0,0.10)" }}
                    transition={{ type: "spring", stiffness: 300, damping: 22 }}
                    className={`h-full p-6 bg-surface border rounded-lg shadow-sm transition-all ${color}`}
                  >
                    <div className={`inline-flex p-3 rounded-2xl mb-4 ${iconBg}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                      {label}
                    </h3>
                    <p className="text-xs text-foreground-muted leading-relaxed">{desc}</p>
                    <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary">
                      View {label}
                      <motion.span
                        className="inline-flex"
                        whileHover={{ x: 3 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </motion.span>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </section>

      </main>
      <Footer />
    </>
  );
}
