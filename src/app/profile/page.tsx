"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema } from "@/lib/schemas";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Save, Loader2, Sparkles, Check, ChevronDown, X } from "lucide-react";
import { z } from "zod";
import { motion, AnimatePresence, type Variants } from "framer-motion";

type ProfileFormInputs = z.infer<typeof profileSchema>;

/* ── Animation Variants ─────────────────────────────────────── */
const pageVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.36, ease: "easeOut" } },
};

const bannerVariants: Variants = {
  hidden: { opacity: 0, y: -12, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, y: -10, scale: 0.97, transition: { duration: 0.22 } },
};

/* ── Input base class ───────────────────────────────────────── */
const inputBase =
  "w-full text-sm px-4 py-3 bg-surface-raised border rounded-xl outline-none focus:bg-surface focus:border-primary transition-all text-foreground placeholder:text-foreground-muted";

/* ── Category options ───────────────────────────────────────── */
const ALL_CATEGORIES = [
  "Hackathons",
  "Internships",
  "Scholarships",
  "Conferences",
  "Fellowships",
  "Research",
  "Workshops",
  "Exchange Programs",
];

/* ── Skill options (grouped catalogue flattened into one searchable list) ── */
const SKILL_OPTIONS = [
  // Programming & Web
  "Python", "JavaScript", "TypeScript", "Java", "C", "C++", "C#", "Go", "Rust",
  "Kotlin", "Swift", "PHP", "Ruby", "R", "MATLAB", "SQL", "HTML", "CSS",
  "React", "Next.js", "Node.js", "Express.js", "Django", "Flask", "Spring Boot",
  ".NET", "Flutter", "React Native", "Android Development", "iOS Development",
  "REST APIs", "GraphQL", "MongoDB", "PostgreSQL", "MySQL", "Redis",
  // Data & AI
  "Machine Learning", "Deep Learning", "Data Analysis", "Data Science",
  "Data Visualization", "Natural Language Processing", "Computer Vision",
  "TensorFlow", "PyTorch", "scikit-learn", "Pandas", "NumPy", "Power BI",
  "Tableau", "Microsoft Excel", "Statistics", "Big Data", "Data Engineering",
  // Cloud, DevOps & Security
  "AWS", "Azure", "Google Cloud", "Docker", "Kubernetes", "Linux", "Git",
  "CI/CD", "Terraform", "Cybersecurity", "Ethical Hacking", "Networking",
  // Design & Creative
  "UI/UX Design", "Figma", "Adobe Photoshop", "Adobe Illustrator",
  "Graphic Design", "Canva", "3D Modeling", "Video Editing", "Animation",
  // Business & Communication
  "Public Speaking", "Communication", "Leadership", "Teamwork",
  "Project Management", "Product Management", "Marketing", "Digital Marketing",
  "SEO", "Content Writing", "Copywriting", "Business Analysis", "Finance",
  "Accounting", "Entrepreneurship", "Problem Solving", "Time Management",
  "Critical Thinking", "Negotiation", "Event Management",
  // Research & Academic
  "Research Writing", "Academic Writing", "Literature Review",
  "Scientific Writing", "Presentation Skills", "Lab Techniques", "Chemistry",
  "Physics", "Biology", "Mathematics", "Economics", "Psychology",
  // Languages
  "English", "Hindi", "Spanish", "French", "German", "Mandarin", "Japanese",
];

/* ── Searchable multi-select dropdown for skills ─────────────── */
function SkillsMultiSelect({
  value,
  onChange,
  error,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q ? SKILL_OPTIONS.filter((s) => s.toLowerCase().includes(q)) : SKILL_OPTIONS;

  function toggle(skill: string) {
    onChange(value.includes(skill) ? value.filter((s) => s !== skill) : [...value, skill]);
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${inputBase} flex items-center justify-between gap-2 text-left ${
          error ? "border-danger" : open ? "border-primary" : "border-border"
        }`}
      >
        <span className={`flex-1 truncate ${value.length ? "text-foreground" : "text-foreground-muted"}`}>
          {value.length
            ? `${value.length} skill${value.length > 1 ? "s" : ""} selected`
            : "Select your skills"}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-foreground-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-lg border border-secondary/30 bg-secondary/10 px-2 py-1 text-xs font-medium text-foreground"
            >
              {s}
              <button
                type="button"
                onClick={() => toggle(s)}
                className="text-foreground-muted transition-colors hover:text-danger"
                aria-label={`Remove ${s}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
          >
            <div className="border-b border-border p-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                placeholder="Search skills…"
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none placeholder:text-foreground-muted focus:border-primary"
              />
            </div>
            <div className="max-h-60 overflow-y-auto p-1.5">
              {filtered.map((skill) => {
                const checked = value.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggle(skill)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                      checked
                        ? "bg-secondary/10 font-medium text-foreground"
                        : "text-foreground-muted hover:bg-surface-raised"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        checked ? "border-secondary bg-secondary" : "border-border bg-background"
                      }`}
                    >
                      {checked && (
                        <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
                          <path
                            d="M2 6l3 3 5-5"
                            stroke="white"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="leading-snug">{skill}</span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-2.5 py-3 text-xs text-foreground-muted">No matching skills.</p>
              )}
            </div>
            {value.length > 0 && (
              <div className="border-t border-border p-2 text-right">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-xs font-medium text-foreground-muted transition-colors hover:text-danger"
                >
                  Clear all
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Profile() {
  const { currentUser, profile, updateUserProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm<ProfileFormInputs>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/auth/login");
    }
  }, [currentUser, authLoading, router]);

  // Load existing profile values
  useEffect(() => {
    if (profile) {
      setValue("name", profile.name || "");
      setValue("email", profile.email || "");
      setValue("bio", profile.bio || "");
      setValue("education", profile.education || "");
      setValue("skills", profile.skills ? profile.skills.join(", ") : "");
      setValue("interests", profile.interests ? profile.interests.join(", ") : "");
      setValue("location", profile.location || "");
      // Backward-compat: migrate old single `category` string → array
      const savedCategories = profile?.categories
        ? (Array.isArray(profile.categories) ? profile.categories : [profile.categories])
        : (profile?.category ? [profile.category] : []);
      setValue("categories", savedCategories);
    }
  }, [profile, setValue]);

  const onSubmit = async (data: ProfileFormInputs) => {
    setSaving(true);
    setSuccess(false);
    try {
      const skillsArray = data.skills
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const interestsArray = data.interests
        .split(",")
        .map((i) => i.trim())
        .filter((i) => i.length > 0);

      await updateUserProfile({
        name: data.name,
        email: data.email,
        bio: data.bio,
        education: data.education,
        skills: skillsArray,
        interests: interestsArray,
        location: data.location,
        categories: data.categories,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  /* ── Loading ──────────────────────────────────────────────── */
  if (authLoading || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background transition-colors duration-300">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
        >
          <Loader2 className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Navbar />

      <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 bg-background transition-colors duration-300">
        <motion.div
          className="max-w-3xl mx-auto"
          variants={pageVariants}
          initial="hidden"
          animate="show"
        >
          {/* Header */}
          <motion.div className="mb-8" variants={itemVariants}>
            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="w-3.5 h-3.5" /> Profile Settings
            </span>
            <h1 className="text-3xl font-extrabold text-foreground mt-2">Personalize Your Space</h1>
            <p className="text-sm text-foreground-muted mt-1">
              Provide your background details so NEXORA can match you with relevant scholarships and reminders.
            </p>
          </motion.div>

          <motion.div
            className="bg-surface border border-border shadow-xl dark:shadow-[0_8px_40px_rgba(255,60,110,0.08)] rounded-lg dark:shadow-[0_8px_40px_rgba(255,60,110,0.08)] p-8 transition-colors duration-300"
            variants={itemVariants}
          >
            {/* Success Banner */}
            <AnimatePresence>
              {success && (
                <motion.div
                  key="success-banner"
                  variants={bannerVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="mb-6 flex items-center gap-2 text-sm bg-success-surface text-success p-4 rounded-lg border border-success/20"
                >
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  >
                    <Check className="w-4 h-4" />
                  </motion.span>
                  Profile saved successfully!
                </motion.div>
              )}
            </AnimatePresence>

            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-6" variants={pageVariants}>
                {/* Name */}
                <motion.div variants={itemVariants}>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    {...register("name")}
                    className={`${inputBase} ${
                      errors.name ? "border-danger focus:border-danger" : "border-border"
                    }`}
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
                  )}
                </motion.div>

                {/* Email (Read only) */}
                <motion.div variants={itemVariants}>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    {...register("email")}
                    readOnly
                    className="w-full text-sm px-4 py-3 bg-surface-raised border border-border rounded-xl outline-none text-foreground-muted cursor-not-allowed"
                  />
                </motion.div>

                {/* Education */}
                <motion.div variants={itemVariants}>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-2">
                    Highest Education Level
                  </label>
                  <select
                    {...register("education")}
                    className={`${inputBase} ${
                      errors.education ? "border-danger" : "border-border"
                    }`}
                  >
                    <option value="">Select Level</option>
                    <option value="High School">High School</option>
                    <option value="Bachelor">Bachelor&apos;s Degree</option>
                    <option value="Master">Master&apos;s Degree</option>
                    <option value="PhD">PhD / Doctorate</option>
                  </select>
                  {errors.education && (
                    <p className="mt-1 text-xs text-danger">{errors.education.message}</p>
                  )}
                </motion.div>

                {/* Location */}
                <motion.div variants={itemVariants}>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-2">
                    Location (Country)
                  </label>
                  <select
                    {...register("location")}
                    className={`${inputBase} ${
                      errors.location ? "border-danger" : "border-border"
                    }`}
                  >
                    <option value="">Select Location</option>
                    <option value="India">India</option>
                    <option value="Global">Global / Worldwide</option>
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Canada">Canada</option>
                    <option value="Singapore">Singapore</option>
                    <option value="Australia">Australia</option>
                    <option value="Germany">Germany</option>
                  </select>
                  {errors.location && (
                    <p className="mt-1 text-xs text-danger">{errors.location.message}</p>
                  )}
                </motion.div>

              </motion.div>

              {/* Preferred Categories – multi-select */}
              <motion.div variants={itemVariants}>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Preferred Categories <span className="text-danger">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ALL_CATEGORIES.map((cat) => {
                    const checked = (watch("categories") || []).includes(cat);
                    return (
                      <label
                        key={cat}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                          checked
                            ? "border-secondary bg-secondary/10 text-foreground font-medium"
                            : "border-border bg-surface-raised text-foreground-muted hover:border-secondary/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => {
                            const current = getValues("categories") || [];
                            const next = checked
                              ? current.filter((c) => c !== cat)
                              : [...current, cat];
                            setValue("categories", next, { shouldValidate: true });
                          }}
                        />
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked ? "border-secondary bg-secondary" : "border-border bg-background"
                        }`}>
                          {checked && (
                            <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
                              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                        <span className="leading-snug">{cat}</span>
                      </label>
                    );
                  })}
                </div>
                {errors.categories && (
                  <p className="mt-1.5 text-xs text-danger">{errors.categories.message as string}</p>
                )}
              </motion.div>

              {/* Bio */}
              <motion.div variants={itemVariants}>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-2">
                  Short Bio
                </label>
                <textarea
                  rows={3}
                  placeholder="Tell us a little bit about yourself..."
                  {...register("bio")}
                  className={`${inputBase} resize-none border-border`}
                />
              </motion.div>

              {/* Skills */}
              <motion.div variants={itemVariants}>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-2">
                  Skills
                </label>
                <SkillsMultiSelect
                  value={(watch("skills") || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)}
                  onChange={(next) => setValue("skills", next.join(", "), { shouldValidate: true })}
                  error={errors.skills?.message}
                />
                {errors.skills && (
                  <p className="mt-1 text-xs text-danger">{errors.skills.message}</p>
                )}
              </motion.div>

              {/* Interests */}
              <motion.div variants={itemVariants}>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-2">
                  Fields of Interest (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. STEM, Artificial Intelligence, Business"
                  {...register("interests")}
                  className={`${inputBase} ${
                    errors.interests ? "border-danger" : "border-border"
                  }`}
                />
                {errors.interests && (
                  <p className="mt-1 text-xs text-danger">{errors.interests.message}</p>
                )}
              </motion.div>

              {/* Submit button */}
              <motion.div className="pt-2" variants={itemVariants}>
                <motion.button
                  type="submit"
                  disabled={saving}
                  whileHover={!saving ? { scale: 1.02 } : {}}
                  whileTap={!saving ? { scale: 0.97 } : {}}
                  transition={{ type: "spring", stiffness: 380, damping: 18 }}
                  className="w-full bg-primary hover:bg-primary/25 text-primary-foreground font-semibold text-sm py-3.5 rounded-2xl shadow-md dark:shadow-[0_4px_16px_rgba(255,60,110,0.22)] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {saving ? (
                      <motion.span
                        key="saving"
                        className="flex items-center gap-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving…
                      </motion.span>
                    ) : (
                      <motion.span
                        key="save"
                        className="flex items-center gap-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <Save className="w-4 h-4" />
                        Save Profile Settings
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </motion.div>
            </form>
          </motion.div>
        </motion.div>
      </main>

      <Footer />
    </>
  );
}
