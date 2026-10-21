"use client";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, updateDoc, doc, onSnapshot } from "firebase/firestore";
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { authedFetch } from "@/lib/apiClient";
import {
  ShieldCheck,
  Building,
  Users,
  FileText,
  MessageSquare,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Loader2,
  Cpu,
  RefreshCw,
  Layers,
  Zap,
  Flame,
  Activity,
  Check,
  Copy,
} from "lucide-react";
import type { OrgOpportunity, AdminStats, OrgRequest } from "@/lib/types";
import { Button, Card, Chip, EmptyState, Select, Stat } from "@/components/ui";
import type { ChipTone } from "@/components/ui";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Moderation status to chip tone.
 *
 * Organization requests and organization opportunities are triaged with the
 * identical approved/rejected/pending triple, and both panels previously
 * re-declared their own green/amber/red triple inline. One mapping means the
 * two queues can never disagree about what "rejected" looks like.
 */
function reviewTone(status: string): ChipTone {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

function roleTone(role?: string): ChipTone {
  if (role === "admin") return "gold";
  if (role === "organization") return "info";
  return "neutral";
}

/** Per-key state inside a telemetry bucket. */
function keyTone(status: string): ChipTone {
  if (status === "in_use") return "success";
  if (status === "cooling_down") return "warning";
  return "neutral";
}

interface TelemetryKey {
  keyId: string;
  maskedKey: string;
  estimatedTokens?: number;
  status?: string;
}

interface BucketPanelProps {
  title: string;
  status: string;
  statusTone: ChipTone;
  /** The serving bucket gets a pulsing dot; standby stays static. */
  active?: boolean;
  blurb: ReactNode;
  keys: TelemetryKey[];
  copiedKeyId: string | null;
  onCopy: (keyId: string) => void;
  emptyMessage: string;
  /** Standby keys all render one fixed label instead of their raw status. */
  keyStatusLabel?: string;
  highlightNewKey?: boolean;
}

/**
 * One bucket of the double-queue system. Both buckets rendered the same
 * ~45-line key list independently, which meant a change to the copy button or
 * the token readout had to be made twice and could silently drift.
 */
function BucketPanel({
  title,
  status,
  statusTone,
  active = false,
  blurb,
  keys,
  copiedKeyId,
  onCopy,
  emptyMessage,
  keyStatusLabel,
  highlightNewKey = false,
}: BucketPanelProps) {
  return (
    <Card tone="raised" className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex min-w-0 items-center gap-2">
          {active ? (
            <motion.span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full bg-success"
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : (
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-info" />
          )}
          <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <Chip tone={statusTone}>{status}</Chip>
      </div>

      <p className="text-xs leading-relaxed text-foreground-muted text-pretty">{blurb}</p>

      <div className="space-y-2.5">
        {keys.map((k) => (
          <Card
            key={k.keyId}
            tone="inset"
            className="flex items-center justify-between gap-3 p-3 text-xs"
          >
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onCopy(k.keyId)}
                aria-label={`Copy the identifier for ${k.keyId}`}
                title="Copy Key Identifier"
                className="grid h-6 w-6 shrink-0 place-items-center rounded text-foreground-subtle transition-colors duration-fast hover:bg-surface hover:text-foreground"
              >
                {copiedKeyId === k.keyId ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <div className="min-w-0">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span className="truncate">{k.keyId}</span>
                  {highlightNewKey && Number(k.keyId.replace(/\D/g, "")) >= 9 ? (
                    <Chip tone="gold">NEW</Chip>
                  ) : null}
                </span>
                <span className="block font-mono text-2xs text-foreground-subtle">{k.maskedKey}</span>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <span className="block text-xs font-semibold text-foreground">
                {(k.estimatedTokens || 0).toLocaleString()} tokens
              </span>
              <Chip tone={keyTone(k.status ?? "")} className="mt-1 text-2xs uppercase">
                {keyStatusLabel ?? k.status}
              </Chip>
            </div>
          </Card>
        ))}

        {keys.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-5 w-5" />}
            title={emptyMessage}
            className="border-0 bg-transparent px-0 py-10"
          />
        ) : null}
      </div>
    </Card>
  );
}

export default function AdminPage() {
  const { currentUser, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalOpportunities: 0,
    orgPostedCount: 0,
    seededCount: 0,
    totalApplications: 0,
    totalCommunityPosts: 0,
  });
  const [orgOpps, setOrgOpps] = useState<OrgOpportunity[]>([]);
  const [orgRequests, setOrgRequests] = useState<OrgRequest[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // AI Keys Double-Queue Bucket Telemetry
  const [telemetry, setTelemetry] = useState<any | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser || !isAdmin) {
      router.push("/dashboard");
    }
  }, [currentUser, authLoading, isAdmin, router]);

  // Declared before the effect that calls it: `fetchTelemetry` is referenced
  // inside `loadAdminData`'s sibling call, and a `const` arrow function used
  // above its declaration is a temporal-dead-zone hazard the lint rule catches.
  const fetchTelemetry = async () => {
    try {
      setTelemetryLoading(true);
      const res = await authedFetch("/api/ai");
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data.telemetry);
      } else if (res.status === 401 || res.status === 403) {
        setTelemetry(null);
      }
    } catch (e) {
      console.warn("Failed to fetch AI telemetry:", e);
    } finally {
      setTelemetryLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    if (!isAdmin) return;

    // Both onSnapshot listeners must die with the effect. Cleanup is tracked
    // explicitly because the listeners are registered inside an async
    // function: by the time they attach, this effect may already have been
    // cleaned up (navigating away mid-load), so a late registration has to be
    // unsubscribed immediately instead of being orphaned.
    let disposed = false;
    const cleanups: Array<() => void> = [];

    // Load admin panel dashboard data
    const loadAdminData = async () => {
      try {
        // 1. Fetch Users
        const userSnap = await getDocs(collection(db, "users"));
        const users: any[] = [];
        userSnap.forEach((u) => users.push({ id: u.id, ...u.data() }));
        if (disposed) return;
        setUsersList(users);

        // 2/3. Counts for applications and community posts come from the server
        // (Admin-SDK aggregation). Reading them from the browser meant
        // downloading every applicant's document just to increment a counter,
        // and Firestore rejects an unfiltered `applications` query outright
        // because the read rule depends on `resource.data.uid` -- so the totals
        // silently rendered as 0.
        const overviewRes = await authedFetch("/api/admin/overview");
        let appCount = 0;
        let postCount = 0;
        if (overviewRes.ok) {
          const overview = await overviewRes.json();
          appCount = Number(overview?.totalApplications) || 0;
          postCount = Number(overview?.totalCommunityPosts) || 0;
        } else {
          console.warn("Admin overview counts unavailable:", overviewRes.status);
        }

        // 4. Fetch Org Opportunities (for moderation)
        const orgOppQuery = query(collection(db, "org_opportunities"));
        const unsubOrgOpp = onSnapshot(orgOppQuery, (snap) => {
          const items: OrgOpportunity[] = [];
          snap.forEach((d) => {
            items.push({ id: d.id, ...d.data() } as OrgOpportunity);
          });
          setOrgOpps(items);

          const seededCount = items.filter((o: OrgOpportunity) => (o as any).source === "seed-india-2026").length;
          const automatedCount = items.filter((o: OrgOpportunity) => o.source === "automated").length;
          const orgPostedCount = items.length - seededCount - automatedCount;

          setStats({
            totalUsers: users.length,
            totalOpportunities: items.length,
            orgPostedCount,
            seededCount,
            totalApplications: appCount,
            totalCommunityPosts: postCount,
          });
          setLoading(false);
        });
        if (disposed) unsubOrgOpp();
        else cleanups.push(unsubOrgOpp);

        // 5. Fetch organization access requests (self-service signups)
        const orgReqQuery = query(collection(db, "org_requests"));
        const unsubOrgReq = onSnapshot(orgReqQuery, (snap) => {
          const items: OrgRequest[] = [];
          snap.forEach((d) => items.push(d.data() as OrgRequest));
          setOrgRequests(items);
        });
        if (disposed) unsubOrgReq();
        else cleanups.push(unsubOrgReq);
      } catch (err) {
        console.error(err);
        if (!disposed) setLoading(false);
      }
    };

    loadAdminData();
    fetchTelemetry();

    return () => {
      disposed = true;
      for (const unsubscribe of cleanups) unsubscribe();
    };
  }, [currentUser, isAdmin]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const updateOppStatus = async (oppId: string, status: "approved" | "rejected") => {
    try {
      await updateDoc(doc(db, "org_opportunities", oppId), {
        status,
      });
      setOrgOpps((prev) =>
        prev.map((opp) => (opp.id === oppId ? { ...opp, status } : opp))
      );
      alert(`Opportunity program has been successfully: ${status}! 🌸`);
    } catch (err) {
      console.error(err);
    }
  };

  const reviewOrgRequest = async (uid: string, decision: "approved" | "rejected") => {
    try {
      await updateDoc(doc(db, "org_requests", uid), {
        status: decision,
        reviewedAt: new Date().toISOString(),
      });
      if (decision === "approved") {
        await updateDoc(doc(db, "users", uid), { role: "organization" });
      }
      setOrgRequests((prev) =>
        prev.map((r) => (r.uid === uid ? { ...r, status: decision } : r))
      );
      alert(`Organization request ${decision}! 🌸`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRoleChange = async (uid: string, nextRole: "user" | "organization" | "admin") => {
    try {
      await updateDoc(doc(db, "users", uid), {
        role: nextRole,
      });
      setUsersList((prev) =>
        prev.map((u) => (u.id === uid ? { ...u, role: nextRole } : u))
      );
      setSelectedUser((prev: any) => (prev && prev.id === uid ? { ...prev, role: nextRole } : prev));
      alert(`User role updated to: ${nextRole}! 🌸`);
    } catch (err) {
      console.error(err);
    }
  };

  // The member dialog could only be dismissed by clicking the backdrop, which
  // keyboard and screen-reader users never reach. Escape now closes it too.
  useEffect(() => {
    if (!selectedUser) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedUser(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedUser]);

  if (loading || authLoading || !currentUser || !isAdmin) {
    return (
      <div
        role="status"
        aria-label="Loading the admin panel"
        className="flex min-h-[50vh] items-center justify-center"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingCount = orgOpps.filter((o) => o.status === "pending").length;
  const pendingOrgRequestsCount = orgRequests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <span className="eyebrow">Operations</span>
        <h1 className="mt-1 flex items-center gap-2 font-display text-display-sm text-foreground text-balance">
          <ShieldCheck className="h-6 w-6 text-primary" /> Admin Panel
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-foreground-muted text-pretty">
          Moderate organization postings, change user access permissions, and evaluate platform statistics.
        </p>
      </div>

      {/* Stats Counters */}
      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StaggerItem>
          <Stat label="Total Members" value={stats.totalUsers} icon={<Users className="h-5 w-5" />} />
        </StaggerItem>
        <StaggerItem>
          <Stat
            label="Opportunities"
            value={stats.totalOpportunities}
            hint={`${stats.orgPostedCount} org-posted · ${stats.seededCount} seeded`}
            icon={<FileText className="h-5 w-5" />}
          />
        </StaggerItem>
        <StaggerItem>
          <Stat
            label="Applications"
            value={stats.totalApplications}
            icon={<FileSpreadsheet className="h-5 w-5" />}
          />
        </StaggerItem>
        <StaggerItem>
          <Stat
            label="Forum Posts"
            value={stats.totalCommunityPosts}
            icon={<MessageSquare className="h-5 w-5" />}
          />
        </StaggerItem>
      </Stagger>

      {/* ── AI Provider Keys & Double Queue Bucket Telemetry ── */}
      <Card className="space-y-6 p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-raised text-secondary">
              <Cpu className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-center gap-2 font-display text-lg text-foreground text-balance">
                AI Key Engine — Double-Queue Bucket System
                <Chip tone="success">Dual Failover Active</Chip>
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-foreground-muted text-pretty">
                Primary Queue processes all AI traffic. Secondary Queue remains on hot standby and activates upon 429/exhaustion.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={fetchTelemetry}
            disabled={telemetryLoading}
            leadingIcon={
              <RefreshCw
                className={`h-3.5 w-3.5 ${telemetryLoading ? "animate-spin text-primary" : ""}`}
              />
            }
          >
            Refresh Telemetry
          </Button>
        </div>

        {/* Global Key Bucket Metrics Summary */}
        <Stagger className="grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
          <StaggerItem>
            <Stat
              size="sm"
              label="Total Pool Keys"
              value={telemetry ? `${telemetry.totalKeys} keys` : "—"}
              hint={
                telemetry
                  ? `${telemetry.primaryBucket?.keysRemaining ?? 0} active · ${telemetry.fallbackBucket?.keysCount ?? 0} standby`
                  : "Loading telemetry…"
              }
              icon={<Layers className="h-4 w-4" />}
            />
          </StaggerItem>
          <StaggerItem>
            <Stat
              size="sm"
              label="Active Serving Bucket"
              value={`Bucket ${telemetry?.activeQueue || "A"}`}
              hint="Primary traffic routing"
              tone="success"
              icon={<Activity className="h-4 w-4" />}
            />
          </StaggerItem>
          <StaggerItem>
            <Stat
              size="sm"
              label="Total Tokens Processed"
              value={(telemetry?.summary?.totalEstimatedTokens ?? 0).toLocaleString()}
              hint="Across all requests"
              tone="gold"
              icon={<Zap className="h-4 w-4" />}
            />
          </StaggerItem>
          <StaggerItem>
            <Stat
              size="sm"
              label="Total AI Requests"
              value={telemetry?.summary?.totalRequests ?? 0}
              hint={`${telemetry?.summary?.totalSuccessful ?? 0} ok · ${telemetry?.summary?.totalFailed ?? 0} retried`}
              icon={<Flame className="h-4 w-4" />}
            />
          </StaggerItem>
        </Stagger>

        {/* 2 Bucket Queues Grid */}
        <div className="grid grid-cols-1 gap-6 pt-2 lg:grid-cols-2">
          <BucketPanel
            active
            title={telemetry?.primaryBucket?.name || "Bucket A (Active Serving)"}
            status={telemetry?.primaryBucket?.status || "Serving Traffic"}
            statusTone="success"
            blurb={
              <>
                Active Pool:{" "}
                <strong className="text-foreground">
                  {telemetry?.primaryBucket?.keysRemaining ?? 0} keys
                </strong>{" "}
                ready. Har rate-limit/error par key eject hokar Standby Bucket me chali
                jati hai.
              </>
            }
            keys={telemetry?.primaryBucket?.keys || []}
            copiedKeyId={copiedKeyId}
            onCopy={(keyId) => copyToClipboard(keyId, keyId)}
            emptyMessage="All keys ejected from active bucket. Automatic swap triggered!"
            highlightNewKey
          />

          <BucketPanel
            title={telemetry?.fallbackBucket?.name || "Standby / Replenishing Bucket"}
            status={telemetry?.fallbackBucket?.status || "Filling on Fallback"}
            statusTone="info"
            blurb={
              <>
                Keys in holding/cooldown:{" "}
                <strong className="text-foreground">
                  {telemetry?.fallbackBucket?.keysCount ?? 0} keys
                </strong>
                . Jab tak active bucket 0 nahi hoti, yahan se koi key consume nahi hogi.
              </>
            }
            keys={telemetry?.fallbackBucket?.keys || []}
            copiedKeyId={copiedKeyId}
            onCopy={(keyId) => copyToClipboard(keyId, keyId)}
            emptyMessage="Bucket is currently empty. Keys will move here as fallback occurs."
            keyStatusLabel="Cooldown / Standby"
          />
        </div>
      </Card>

      {/* ── Data Tools ── */}
      <Card className="space-y-4 p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-raised text-secondary">
            <RefreshCw className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg text-foreground">Data Tools</h2>
            <p className="mt-0.5 text-sm text-foreground-muted">
              One-shot utilities to fix existing data in Firestore — run once when needed.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-border pt-4">
          {/* Clean HTML from descriptions */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leadingIcon={<Zap className="h-3.5 w-3.5" />}
            onClick={async () => {
              if (!confirm("Strip HTML tags from ALL opportunity descriptions in Firestore? This fixes posts like '$<span>0</span>' showing raw HTML.")) return;
              try {
                const res = await authedFetch("/api/admin/clean-descriptions", { method: "POST" });
                const data = await res.json();
                if (res.ok) {
                  alert(data.message || "Done! 🌸");
                } else {
                  alert(`Error: ${data.error}`);
                }
              } catch (e) {
                alert("Request failed. Check console.");
                console.error(e);
              }
            }}
          >
            🧹 Clean HTML from All Descriptions
          </Button>
        </div>
      </Card>

      {/* Moderate Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Organization access requests */}
        <Card className="space-y-6 p-6">
          <h2 className="flex items-center justify-between gap-3 font-display text-lg text-foreground">
            <span>Organization requests</span>
            {pendingOrgRequestsCount > 0 && (
              <Chip tone="warning">{pendingOrgRequestsCount} Pending</Chip>
            )}
          </h2>

          <ul className="max-h-[400px] space-y-4 overflow-y-auto pr-1">
            {orgRequests.map((req) => (
              <li key={req.uid}>
                <Card tone="raised" className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span className="eyebrow">
                        {req.requesterName} · {req.requesterEmail}
                      </span>
                      <h3 className="mt-1 text-sm font-semibold leading-snug text-foreground text-balance">
                        {req.orgName}
                      </h3>
                      {req.website ? (
                        <a
                          href={req.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-ink mt-1 block truncate text-xs text-secondary"
                        >
                          {req.website}
                        </a>
                      ) : null}
                    </div>
                    <Chip tone={reviewTone(req.status)} className="shrink-0 uppercase">
                      {req.status}
                    </Chip>
                  </div>

                  <p className="text-sm leading-relaxed text-foreground-muted text-pretty line-clamp-3">
                    {req.description}
                  </p>

                  {req.status === "pending" ? (
                    <div className="flex justify-end gap-2 border-t border-border pt-3">
                      <Button
                        type="button"
                        size="sm"
                        leadingIcon={<CheckCircle className="h-3.5 w-3.5" />}
                        onClick={() => reviewOrgRequest(req.uid, "approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        leadingIcon={<XCircle className="h-3.5 w-3.5" />}
                        onClick={() => reviewOrgRequest(req.uid, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>

          {orgRequests.length === 0 ? (
            <EmptyState
              icon={<Building className="h-5 w-5" />}
              title="No requests yet"
              description="When users request organization access, they’ll show up here."
              className="border-0 bg-transparent px-0"
            />
          ) : null}
        </Card>

        <Card className="space-y-5 p-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-display text-lg text-foreground">Moderate org opportunities</h2>
              <p className="mt-0.5 text-xs text-foreground-muted">
                {pendingCount > 0
                  ? `${pendingCount} listings pending — new auto-ingested posts go live automatically.`
                  : "All listings reviewed."}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {pendingCount > 0 ? (
                <Chip tone="warning">{pendingCount} Pending</Chip>
              ) : null}
              {pendingCount > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  leadingIcon={<CheckCircle className="h-3.5 w-3.5" />}
                  onClick={async () => {
                    if (!confirm(`Approve all ${pendingCount} pending auto-ingested opportunities? They will go live on Explore immediately.`)) return;
                    try {
                      const res = await authedFetch("/api/admin/bulk-approve", { method: "POST" });
                      const data = await res.json();
                      if (res.ok) {
                        alert(data.message || "Bulk approve done! 🌸");
                      } else {
                        alert(`Error: ${data.error}`);
                      }
                    } catch (e) {
                      alert("Bulk approve failed. Check console.");
                      console.error(e);
                    }
                  }}
                >
                  Approve All
                </Button>
              ) : null}
            </div>
          </div>

          {/* List */}
          <ul className="max-h-[420px] space-y-2 overflow-y-auto overflow-x-hidden pr-1">
            {orgOpps.map((opp) => (
              <li key={opp.id}>
                <Card tone="raised" className="p-3">
                  {/* Title + status */}
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <h3 className="flex-1 truncate text-sm font-semibold text-foreground">
                      {opp.title}
                    </h3>
                    <Chip tone={reviewTone(opp.status)} className="shrink-0 text-2xs uppercase">
                      {opp.status}
                    </Chip>
                  </div>

                  {/* Org name + source badge — single line */}
                  <div className="mt-1 flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-2xs font-medium uppercase tracking-wide text-foreground-subtle">
                      {opp.orgName}
                    </span>
                    {opp.source === "automated" ? (
                      <Chip tone="info" className="shrink-0 text-2xs">
                        {opp.sourceType === "scraped" ? "🤖 Scraped" : "📡 Feed"}
                      </Chip>
                    ) : (
                      <Chip tone="neutral" className="shrink-0 text-2xs">🏢 Org</Chip>
                    )}
                  </div>

                  {/* Description */}
                  {opp.description ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-foreground-muted">
                      {opp.description}
                    </p>
                  ) : null}

                  {/* Actions */}
                  {opp.status === "pending" ? (
                    <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-border pt-2.5">
                      <Button
                        type="button"
                        size="sm"
                        leadingIcon={<CheckCircle className="h-3.5 w-3.5" />}
                        onClick={() => updateOppStatus(opp.id, "approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        leadingIcon={<XCircle className="h-3.5 w-3.5" />}
                        onClick={() => updateOppStatus(opp.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>

          {orgOpps.length === 0 ? (
            <EmptyState
              icon={<Building className="h-5 w-5" />}
              title="No programs to review"
              description="Once organizations publish opportunities, they will list here for approval."
              className="border-0 bg-transparent px-0"
            />
          ) : null}
        </Card>


        {/* User permissions moderator */}
        <Card className="space-y-6 p-6">
          <h2 className="font-display text-lg text-foreground">Manage Member Roles</h2>

          <ul className="max-h-[400px] space-y-4 overflow-y-auto pr-1">
            {usersList.map((usr) => (
              <li key={usr.id}>
                <Card
                  as="button"
                  type="button"
                  interactive
                  tone="raised"
                  onClick={() => setSelectedUser(usr)}
                  aria-label={`Review access for ${usr.name || "Unnamed User"}`}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left"
                >
                  <span className="truncate text-sm font-semibold text-foreground">
                    {usr.name || "Unnamed User"}
                  </span>
                  <Chip tone={roleTone(usr.role)} className="shrink-0 uppercase">
                    {usr.role || "user"}
                  </Chip>
                </Card>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* User details modal */}
      {selectedUser ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setSelectedUser(null)}
        >
          <Card
            role="dialog"
            aria-modal="true"
            aria-label={`Access details for ${selectedUser.name || "Unnamed User"}`}
            tone="raised"
            className="max-w-md space-y-5 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-display text-lg text-foreground text-balance">
                  {selectedUser.name || "Unnamed User"}
                </h2>
                <p className="mt-0.5 text-sm text-foreground-muted">
                  {selectedUser.email || "No email on file"}
                </p>
              </div>
              <Button
                type="button"
                variant="quiet"
                size="icon"
                onClick={() => setSelectedUser(null)}
                aria-label="Close member details"
              >
                <XCircle className="h-5 w-5" />
              </Button>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="card-inset p-3">
                <dt className="eyebrow">Joined</dt>
                <dd className="mt-1 font-semibold text-foreground">
                  {selectedUser.createdAt
                    ? new Date(selectedUser.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                    : "Unknown"}
                </dd>
              </div>
              <div className="card-inset p-3">
                <dt className="eyebrow">Location</dt>
                <dd className="mt-1 font-semibold text-foreground">
                  {selectedUser.location || "—"}
                </dd>
              </div>
              <div className="card-inset p-3">
                <dt className="eyebrow">Education</dt>
                <dd className="mt-1 font-semibold text-foreground">
                  {selectedUser.education || "—"}
                </dd>
              </div>
              <div className="card-inset p-3">
                <dt className="eyebrow">Category</dt>
                <dd className="mt-1 font-semibold text-foreground">
                  {selectedUser.category || "—"}
                </dd>
              </div>
            </dl>

            {selectedUser.bio ? (
              <div>
                <span className="eyebrow">Bio</span>
                <p className="mt-1 text-sm leading-relaxed text-foreground text-pretty">
                  {selectedUser.bio}
                </p>
              </div>
            ) : null}

            <div className="border-t border-border pt-3">
              <Select
                label="Access Level"
                value={selectedUser.role || "user"}
                onChange={(e) => handleRoleChange(selectedUser.id, e.target.value as any)}
                disabled={selectedUser.role === "admin"}
                options={[
                  { value: "user", label: "User" },
                  { value: "organization", label: "Organization" },
                  ...(selectedUser.role === "admin" ? [{ value: "admin", label: "Admin" }] : []),
                ]}
                hint={
                  selectedUser.role === "admin"
                    ? "Admin access is granted server-side from the deployment allow-list and can’t be changed here."
                    : undefined
                }
              />
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
