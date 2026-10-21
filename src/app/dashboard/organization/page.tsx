"use client";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { authedFetch } from "@/lib/apiClient";
import { collection, query, where, addDoc, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  BarChart3,
  Users,
  Eye,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Sparkles,
  Loader2,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";
import type { OrgOpportunity, OrgOpportunityStatus, OrgRequest } from "@/lib/types";
import { Button, Card, Chip, EmptyState, ErrorState, Field, Select, Stat, Textarea, type ChipTone } from "@/components/ui";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";

const EASE = [0.22, 1, 0.36, 1] as const;

const CATEGORY_OPTIONS = [
  { value: "Scholarships", label: "Scholarships" },
  { value: "Internships", label: "Internships" },
  { value: "Hackathons", label: "Hackathons" },
  { value: "Competitions", label: "Competitions" },
  { value: "Research", label: "Research" },
  { value: "Conferences", label: "Conferences" },
  { value: "Fellowships", label: "Fellowships" },
  { value: "Workshops", label: "Workshops" },
  { value: "Exchange Programs", label: "Exchange Programs" },
];

/**
 * These two maps exist because the original page picked status colours inline,
 * with three separate ternaries each. Two of those branches referenced classes
 * that do not exist (`bg-emerald-650`, `text-amber-650`, `text-red-650`,
 * `text-slate-805`), so "approved" opportunities rendered as unstyled text.
 */
function opportunityStatusTone(status: OrgOpportunityStatus | string): ChipTone {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

function applicationStatusTone(status: string): ChipTone {
  if (status === "Shortlisted") return "gold";
  if (status === "Rejected") return "danger";
  return "neutral";
}

function PageSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-secondary" />
    </div>
  );
}

function StatusCallout({
  tone,
  icon,
  title,
  children,
  action,
}: {
  tone: ChipTone;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const surface =
    tone === "danger"
      ? "border-danger/25 bg-danger-surface"
      : tone === "warning"
        ? "border-warning/25 bg-warning-surface"
        : "border-border bg-surface-raised";
  const accent = tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-secondary";

  return (
    <Reveal>
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <span className={`mx-auto grid h-14 w-14 place-items-center rounded-lg border ${surface} ${accent}`}>
          {icon}
        </span>
        <h1 className="font-display text-xl text-foreground">{title}</h1>
        <div className="text-sm leading-relaxed text-foreground-muted">{children}</div>
        {action}
      </div>
    </Reveal>
  );
}

export default function OrgDashboardPage() {
  const { currentUser, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<OrgOpportunity[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shortlistingId, setShortlistingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const isOrg = profile?.role === "organization" || profile?.role === "admin";

  // ── Self-service org access request state (only relevant if NOT yet org) ──
  const [orgRequest, setOrgRequest] = useState<OrgRequest | null>(null);
  const [requestLoading, setRequestLoading] = useState(true);
  const [reqOrgName, setReqOrgName] = useState("");
  const [reqWebsite, setReqWebsite] = useState("");
  const [reqDescription, setReqDescription] = useState("");
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqError, setReqError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.push("/auth/login");
    }
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    if (!currentUser || isOrg) {
      setRequestLoading(false);
      return;
    }
    getDoc(doc(db, "org_requests", currentUser.uid))
      .then((snap) => {
        if (snap.exists()) setOrgRequest(snap.data() as OrgRequest);
      })
      .catch((err) => console.error("Failed to load org request:", err))
      .finally(() => setRequestLoading(false));
  }, [currentUser, isOrg]);

  const submitOrgRequest = async () => {
    if (!currentUser) return;
    if (!reqOrgName.trim() || !reqDescription.trim()) {
      setReqError("Organization name and description are required.");
      return;
    }
    setReqError("");
    setReqSubmitting(true);
    try {
      const newRequest: OrgRequest = {
        uid: currentUser.uid,
        orgName: reqOrgName.trim(),
        website: reqWebsite.trim() || undefined,
        description: reqDescription.trim(),
        requesterName: profile?.name || currentUser.displayName || "Unknown",
        requesterEmail: currentUser.email || "",
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "org_requests", currentUser.uid), newRequest);
      setOrgRequest(newRequest);
    } catch (err) {
      console.error(err);
      setReqError("Something went wrong submitting your request. Please try again.");
    } finally {
      setReqSubmitting(false);
    }
  };

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [deadline, setDeadline] = useState("");
  const [category, setCategory] = useState("Scholarships");
  const [field, setField] = useState("");
  const [applyLink, setApplyLink] = useState("");

  useEffect(() => {
    if (!currentUser || !isOrg) {
      setLoading(false);
      return;
    }

    // Fetch organization posted opportunities
    const oppQuery = query(collection(db, "org_opportunities"), where("postedByUid", "==", currentUser.uid));
    const unsubOpp = onSnapshot(oppQuery, (snap) => {
      const items: OrgOpportunity[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as OrgOpportunity);
      });
      setOpportunities(items);
      setLoading(false);
    });

    // Fetch candidate submissions for programs THIS organization posted.
    //
    // Reading `applications` directly from the browser is not possible: the
    // rules scope each document to its applicant (and to the org that posted the
    // program), and Firestore rules cannot join an `org_opportunities` lookup
    // against an `applications` query. So the list is fetched server-side, where
    // the caller's uid is verified before their posted programs are resolved.
    const loadSubmissions = async () => {
      if (!currentUser) return;
      const res = await authedFetch("/api/organization/applications");
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setActionError(data?.error || `Could not load applications (${res.status}).`);
        setApplications([]);
        return;
      }
      const data = await res.json();
      const list: any[] = Array.isArray(data?.applications) ? data.applications : [];
      setApplications(list);
    };
    loadSubmissions();

    return () => unsubOpp();
  }, [currentUser, profile, isOrg]);

  const handlePostOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !title.trim() || !desc.trim()) return;

    try {
      const newOpp = {
        postedByUid: currentUser.uid,
        orgName: profile?.name || "Global Women Foundation",
        title: title.trim(),
        description: desc.trim(),
        eligibility: eligibility.trim(),
        deadline: deadline || new Date(Date.now() + 45 * 86400000).toISOString().split("T")[0],
        country: "Global",
        category,
        field: field.trim() || "STEM",
        applyLink: applyLink.trim() || "https://nexora.app/apply",
        requiredDocuments: ["Resume", "Certificate"],
        status: "pending" as OrgOpportunityStatus,
        applicationCount: 0,
        viewCount: 0, // real count, incremented on each opportunity detail page view
        source: "organization",
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "org_opportunities"), newOpp);

      // Reset
      setTitle("");
      setDesc("");
      setEligibility("");
      setDeadline("");
      setField("");
      setApplyLink("");
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleShortlistCandidate = async (appId: string, status: "Shortlisted" | "Rejected") => {
    setShortlistingId(appId);
    setActionError("");
    try {
      const res = await authedFetch("/api/organization/applications/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: appId, status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Could not update the application (${res.status}).`);
      }
      setApplications((prev) =>
        prev.map((app) => (app.id === appId ? { ...app, status } : app))
      );
    } catch (err: any) {
      console.error(err);
      setActionError(err?.message || "Could not update the application.");
    } finally {
      setShortlistingId(null);
    }
  };

  if (authLoading || !currentUser) {
    return <PageSpinner />;
  }

  // Not yet an organization: show the self-service access request flow
  // instead of the org dashboard (and instead of redirecting away).
  if (!isOrg) {
    if (requestLoading) {
      return <PageSpinner />;
    }

    if (orgRequest?.status === "pending") {
      return (
        <StatusCallout
          tone="warning"
          icon={<Clock className="h-6 w-6" />}
          title="Request under review"
        >
          Your request to register <strong className="text-foreground">{orgRequest.orgName}</strong> as an
          organization partner is pending admin approval. You&apos;ll get organization dashboard
          access as soon as it&apos;s approved.
        </StatusCallout>
      );
    }

    if (orgRequest?.status === "rejected") {
      return (
        <StatusCallout
          tone="danger"
          icon={<XCircle className="h-6 w-6" />}
          title="Request not approved"
          action={
            <Button onClick={() => setOrgRequest(null)}>Submit a new request</Button>
          }
        >
          Your request for <strong className="text-foreground">{orgRequest.orgName}</strong> wasn&apos;t
          approved. If you believe this was a mistake, you can submit a new request below.
        </StatusCallout>
      );
    }

    // No request yet — show the form
    return (
      <div className="mx-auto max-w-lg py-12">
        <Reveal>
          <div className="mb-8 text-center">
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-lg border border-border bg-surface-raised text-secondary">
              <Building2 className="h-6 w-6" />
            </span>
            <h1 className="font-display text-xl text-foreground">Become an organization partner</h1>
            <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
              Post scholarships, fellowships, internships, or programs directly to NEXORA. An admin
              will review your request before you get posting access.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <Card className="space-y-4 p-6">
            {reqError && <ErrorState description={reqError} />}

            <Field
              label="Organization Name"
              type="text"
              value={reqOrgName}
              onChange={(e) => setReqOrgName(e.target.value)}
              placeholder="e.g. AnitaB.org India"
              required
            />
            <Field
              label="Website (optional)"
              type="text"
              value={reqWebsite}
              onChange={(e) => setReqWebsite(e.target.value)}
              placeholder="https://..."
            />
            <Textarea
              label="Tell us about your organization"
              value={reqDescription}
              onChange={(e) => setReqDescription(e.target.value)}
              rows={4}
              placeholder="What does your organization do, and what kind of opportunities do you want to post?"
              required
            />

            <Button onClick={submitOrgRequest} disabled={reqSubmitting} block>
              {reqSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Request"}
            </Button>
          </Card>
        </Reveal>
      </div>
    );
  }

  if (loading) {
    return <PageSpinner />;
  }

  // Analytics summary
  const totalViews = opportunities.reduce((acc, curr) => acc + curr.viewCount, 0);
  const totalSubmissions = applications.length;
  const conversionRate = totalViews > 0 ? ((totalSubmissions / totalViews) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-10">
      {/* Header */}
      <Reveal>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="eyebrow text-secondary">Partner Workspace</span>
            <h1 className="mt-2 flex items-center gap-2 font-display text-display-sm text-foreground">
              <Building2 className="h-5 w-5 text-secondary" />
              Organization Hub
            </h1>
            <p className="mt-2 text-sm text-foreground-muted">
              Post opportunities, check candidate analytics, and shortlist candidates from submissions.
            </p>
          </div>

          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            leadingIcon={<Plus className="h-3.5 w-3.5" />}
          >
            Post Opportunity
          </Button>
        </div>
      </Reveal>

      {/* Analytics Dashboard */}
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StaggerItem>
          <Stat
            label="Opportunity Views"
            value={totalViews}
            hint={`${totalViews} views across ${opportunities.length} published programs`}
            icon={<Eye className="h-4 w-4" />}
          />
        </StaggerItem>
        <StaggerItem>
          <Stat
            label="Total Applicants"
            value={totalSubmissions}
            hint={`${totalSubmissions} applied to your programs`}
            icon={<Users className="h-4 w-4" />}
            tone="gold"
          />
        </StaggerItem>
        <StaggerItem>
          <Stat
            label="Conversion Ratio"
            value={`${conversionRate}%`}
            hint={`${totalSubmissions} applications per ${totalViews} views`}
            icon={<BarChart3 className="h-4 w-4" />}
            tone="success"
          />
        </StaggerItem>
      </Stagger>

      {/* Add form */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: EASE }}
        >
          <Card className="p-6">
            <h2 className="mb-5 flex items-center gap-2 font-display text-base text-foreground">
              <Sparkles className="h-4 w-4 text-secondary" />
              Publish Opportunity Program
            </h2>
            <form
              onSubmit={handlePostOpportunity}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <Field
                label="Program Title"
                type="text"
                placeholder="Google Generation Scholarship"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <Field
                label="Field of study"
                type="text"
                placeholder="e.g. Computer Science, Aerospace"
                value={field}
                onChange={(e) => setField(e.target.value)}
              />
              <Field
                label="Deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
              <Select
                label="Opportunity Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={CATEGORY_OPTIONS}
              />
              <Textarea
                label="Program Description"
                rows={3}
                placeholder="Details of the opportunity..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                required
                className="sm:col-span-2"
              />
              <Field
                label="Eligibility criteria"
                type="text"
                placeholder="e.g. Open to female students enrolled in Bachelor's program."
                value={eligibility}
                onChange={(e) => setEligibility(e.target.value)}
                className="sm:col-span-2"
              />
              <Field
                label="Application Link"
                type="url"
                placeholder="https://company.com/careers"
                value={applyLink}
                onChange={(e) => setApplyLink(e.target.value)}
                className="sm:col-span-2"
              />
              <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
                <Button type="button" variant="secondary" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button type="submit">Publish Program</Button>
              </div>
            </form>
          </Card>
        </motion.div>
      )}

      {/* Main grids: Published list & Candidate Applications */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Published opportunities */}
        <section className="space-y-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-display text-base text-foreground">
            <FileSpreadsheet className="h-4.5 w-4.5 text-secondary" />
            Published Opportunities
            <Chip>{opportunities.length}</Chip>
          </h2>

          {opportunities.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-5 w-5" />}
              title="No published programs yet"
              description="Click the Post Opportunity button to publish women-focused scholarships or hackathons."
            />
          ) : (
            <Stagger className="space-y-3">
              {opportunities.map((opp) => (
                <StaggerItem key={opp.id}>
                  <Card className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Chip tone="gold">{opp.category}</Chip>
                        <h3 className="mt-2 font-display text-base leading-snug text-foreground">
                          {opp.title}
                        </h3>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
                          <span className="inline-flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            {opp.viewCount} views
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {opp.applicationCount} applicants
                          </span>
                        </p>
                      </div>
                      <Chip tone={opportunityStatusTone(opp.status)}>{opp.status}</Chip>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground-muted line-clamp-2">
                      {opp.description}
                    </p>
                  </Card>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </section>

        {/* Candidate evaluation tracker */}
        <section className="space-y-5">
          <h2 className="flex items-center gap-2 font-display text-base text-foreground">
            <Users className="h-4.5 w-4.5 text-secondary" />
            Review Submissions
            <Chip>{applications.length}</Chip>
          </h2>

          {actionError && <ErrorState description={actionError} />}

          {applications.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No candidate applications"
              description="Once users submit applications targeting your programs, they will appear here."
            />
          ) : (
            <ul className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
              {applications.map((app) => {
                const busy = shortlistingId === app.id;
                return (
                  <li key={app.id}>
                    <Card className="space-y-3 p-4">
                      <div className="space-y-1">
                        <span className="eyebrow">Program Applied</span>
                        <h3 className="text-sm font-medium leading-snug text-foreground">
                          {app.opportunityTitle}
                        </h3>
                        <p className="text-xs text-foreground-subtle">
                          Candidate UID: {app.uid.slice(0, 10)}...
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                        <Chip tone={applicationStatusTone(app.status)}>{app.status}</Chip>
                        {app.status === "Applied" && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleShortlistCandidate(app.id, "Shortlisted")}
                              disabled={busy}
                              title="Shortlist Candidate"
                              aria-label={`Shortlist candidate for ${app.opportunityTitle}`}
                              className="grid h-7 w-7 place-items-center rounded-sm text-success transition-colors duration-fast hover:bg-success-surface disabled:opacity-50"
                            >
                              {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShortlistCandidate(app.id, "Rejected")}
                              disabled={busy}
                              title="Reject Candidate"
                              aria-label={`Reject candidate for ${app.opportunityTitle}`}
                              className="grid h-7 w-7 place-items-center rounded-sm text-danger transition-colors duration-fast hover:bg-danger-surface disabled:opacity-50"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}