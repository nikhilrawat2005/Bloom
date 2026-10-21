"use client";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, getDoc, doc, deleteDoc } from "firebase/firestore";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Calendar,
  Plus,
  Clock,
  Loader2,
  CalendarDays,
  Trash2,
  ExternalLink,
  Download,
  X,
  Tag,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { useOpportunities } from "@/hooks/useOpportunities";
import type { CalendarEvent, CalendarEventType } from "@/lib/types";
import { Button, Card, Chip, EmptyState, Field, Select } from "@/components/ui";
import { Reveal } from "@/components/motion/Reveal";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EVENT_TYPE_OPTIONS: { value: CalendarEventType; label: string }[] = [
  { value: "reminder", label: "Personal Reminder" },
  { value: "interview", label: "Interview Slot" },
  { value: "deadline", label: "Personal Deadline" },
  { value: "event", label: "Workshop / Hackathon" },
  { value: "general", label: "Exam / Milestone" },
];

type Tone = "neutral" | "gold" | "info" | "danger";

/**
 * The month cell, the agenda row and the legend all used to hard-code
 * red / purple / blue for the same three categories, so a purple interview
 * chip and a purple legend dot were two separate colour decisions. One map,
 * read by all three.
 */
const EVENT_TONE: Record<CalendarEventType, Tone> = {
  deadline: "danger",
  interview: "gold",
  reminder: "info",
  event: "info",
  general: "info",
};

const LEGEND: { type: CalendarEventType; label: string; dot: string }[] = [
  { type: "deadline", label: "Application Deadline", dot: "bg-danger" },
  { type: "interview", label: "Interview Slot", dot: "bg-secondary" },
  { type: "reminder", label: "Personal Task / Exam", dot: "bg-info" },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export default function CalendarPage() {
  const { currentUser } = useAuth();
  const { opportunities } = useOpportunities();
  const [customEvents, setCustomEvents] = useState<CalendarEvent[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [appliedOpps, setAppliedOpps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Form states (User Manual Entry)
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [type, setType] = useState<CalendarEventType>("reminder");
  const [desc, setDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Selected date filter (clicking a date on grid)
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Grid dates calculation
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!currentUser) return;

    const loadEventsAndDeadlines = async () => {
      try {
        const list: CalendarEvent[] = [];

        // 1. Fetch user manually created custom events
        const q = query(collection(db, "calendar_events"), where("uid", "==", currentUser.uid));
        const customSnap = await getDocs(q);
        customSnap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as CalendarEvent);
        });
        setCustomEvents(list);

        // 2. Fetch bookmarks
        const bookSnap = await getDoc(doc(db, "bookmarks", currentUser.uid));
        if (bookSnap.exists()) {
          const bData = bookSnap.data();
          const ids: string[] = bData.opportunityIds || [];
          const items: any[] = Array.isArray(bData.items) ? bData.items : [];
          setSavedIds(ids);
          setSavedItems(items);
        } else {
          setSavedIds([]);
          setSavedItems([]);
        }

        // 3. Fetch applications (for interview rounds)
        const appQ = query(collection(db, "applications"), where("uid", "==", currentUser.uid));
        const appSnap = await getDocs(appQ);
        const appsList: any[] = [];
        appSnap.forEach((d) => {
          appsList.push({ id: d.id, ...d.data() });
        });
        setAppliedOpps(appsList);
      } catch (err) {
        console.error("Error loading calendar data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadEventsAndDeadlines();
  }, [currentUser, syncing]);

  // Combine automatic deadlines, interview rounds, and manual custom tasks
  const events = useMemo(() => {
    const list: (CalendarEvent & { linkedUrl?: string; isManual?: boolean })[] = customEvents.map((c) => ({
      ...c,
      isManual: true,
    }));

    // Auto-feed from Bookmarked Opportunities (prefer snapshot items, fallback to live feed)
    const processedIds = new Set<string>();

    savedItems.forEach((opp) => {
      if (opp && opp.id && opp.deadline) {
        processedIds.add(opp.id);
        list.push({
          id: `deadline_${opp.id}`,
          uid: currentUser?.uid || "",
          title: `${opp.title}`,
          date: opp.deadline,
          type: "deadline",
          description: `Application deadline for ${opp.organization || opp.orgName || "Opportunity"} (${opp.category || "General"})`,
          linkedOpportunityId: opp.id,
          linkedUrl: `/opportunity/${opp.id}`,
          createdAt: new Date().toISOString(),
          isManual: false,
        });
      }
    });

    savedIds.forEach((id) => {
      if (processedIds.has(id)) return;
      const opp = opportunities.find((o) => o.id === id);
      if (opp && opp.deadline) {
        list.push({
          id: `deadline_${opp.id}`,
          uid: currentUser?.uid || "",
          title: `${opp.title}`,
          date: opp.deadline,
          type: "deadline",
          description: `Application deadline for ${opp.organization} (${opp.category})`,
          linkedOpportunityId: opp.id,
          linkedUrl: `/opportunity/${opp.id}`,
          createdAt: new Date().toISOString(),
          isManual: false,
        });
      }
    });

    // Auto-feed from Applied status / interviews
    appliedOpps.forEach((app) => {
      if (app.interviewDate) {
        list.push({
          id: `interview_${app.id}`,
          uid: currentUser?.uid || "",
          title: `Interview Round: ${app.opportunityTitle || "Opportunity"}`,
          date: app.interviewDate,
          type: "interview",
          description: app.notes || "Live technical / evaluation interview",
          linkedUrl: app.applyLink || `/opportunity/${app.opportunityId}`,
          createdAt: new Date().toISOString(),
          isManual: false,
        });
      }
    });

    return list;
  }, [customEvents, savedIds, opportunities, appliedOpps, currentUser]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !title.trim() || !dateStr) return;

    try {
      setSubmitting(true);
      const newEvent = {
        uid: currentUser.uid,
        title: title.trim(),
        date: dateStr,
        type,
        description: desc.trim(),
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "calendar_events"), newEvent);

      setTitle("");
      setDateStr("");
      setDesc("");
      setShowAddForm(false);
      setSyncing((s) => !s);
    } catch (err) {
      console.error("Failed to add custom event:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomEvent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this custom event?")) return;
    try {
      await deleteDoc(doc(db, "calendar_events", id));
      setCustomEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Failed to delete event:", err);
    }
  };

  // Export all calendar items to .ics format for Google / Apple / Outlook Calendar
  const exportToICS = () => {
    if (events.length === 0) {
      alert("No events to export!");
      return;
    }

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Bloom//Student Career Hub Calendar//EN",
      "CALSCALE:GREGORIAN",
    ];

    const nowStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    events.forEach((ev) => {
      // Ensure date is strictly YYYYMMDD
      const rawDate = ev.date ? ev.date.split("T")[0].replace(/[^0-9]/g, "") : "";
      const validDate = rawDate.length >= 8 ? rawDate.slice(0, 8) : new Date().toISOString().slice(0, 10).replace(/[-]/g, "");

      icsContent.push(
        "BEGIN:VEVENT",
        `UID:${ev.id.replace(/[^a-zA-Z0-9_-]/g, "")}@Bloom.platform`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART;VALUE=DATE:${validDate}`,
        `SUMMARY:[Bloom] ${(ev.title || "Event").replace(/[\r\n]+/g, " ")}`,
        `DESCRIPTION:${(ev.description || "Bloom Calendar Event").replace(/[\r\n]+/g, " ")}`,
        "STATUS:CONFIRMED",
        "END:VEVENT"
      );
    });

    icsContent.push("END:VCALENDAR");

    const blob = new Blob([icsContent.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute("download", `Bloom_schedule_${MONTHS[currentMonth]}_${currentYear}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  // Filtered list: either selected day or upcoming sorted
  const sortedUpcoming = events
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const displayedAgenda = selectedDate
    ? sortedUpcoming.filter((e) => e.date === selectedDate)
    : sortedUpcoming.filter((e) => new Date(e.date).getTime() >= new Date().setHours(0, 0, 0, 0));

  const todayKey = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-10">
      {/* Header */}
      <Reveal>
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="max-w-xl">
            <span className="grid h-10 w-10 place-items-center rounded-md border border-border bg-surface-raised text-secondary">
              <CalendarDays className="h-5 w-5" />
            </span>
            <span className="eyebrow mt-4">Schedule</span>
            <h1 className="mt-2 text-display-sm text-foreground">Calendar Hub</h1>
            <p className="mt-3 text-sm text-foreground-muted">
              Auto-syncs application deadlines &amp; interview schedules with manual entries for
              tests, LOR submissions, and exams.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={exportToICS}
              title="Download .ics file to import into Google Calendar or Apple Calendar"
              leadingIcon={<Download className="h-3.5 w-3.5" />}
            >
              Export to Google Calendar (.ics)
            </Button>
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              leadingIcon={<Plus className="h-4 w-4" />}
            >
              New Custom Event
            </Button>
          </div>
        </div>
      </Reveal>

      {/* Manual Entry Form Box (Dedicated Section) */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: EASE }}
        >
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-accent-gold-surface text-secondary">
                  <Tag className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-display text-base text-foreground">
                    Add Personal Calendar Event
                  </h2>
                  <p className="mt-1 text-sm text-foreground-muted">
                    Add interview prep, LOR submission, exam, or project milestone.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                aria-label="Close event form"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-foreground-subtle transition-colors duration-fast hover:bg-surface-raised hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field
                label="Event Title"
                type="text"
                className="sm:col-span-2"
                placeholder="e.g. Stanford LOR Submission / Mock Interview"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <Field
                label="Date"
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                required
              />

              <Select
                label="Event Type"
                value={type}
                onChange={(e) => setType(e.target.value as CalendarEventType)}
                options={EVENT_TYPE_OPTIONS}
              />

              <Field
                label="Notes / Links (Optional)"
                type="text"
                className="sm:col-span-3"
                placeholder="Zoom / Meet link, preparation checklist, contact person"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />

              <div className="flex items-end justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Save Event"}
                </Button>
              </div>
            </form>
          </Card>
        </motion.div>
      )}

      {/* Calendar & Agenda Layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Interactive Month Grid */}
        <Card className="space-y-6 p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg text-foreground">
                {MONTHS[currentMonth]} {currentYear}
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                Click any day to inspect scheduled deadlines and interviews.
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="icon"
                variant="ghost"
                onClick={prevMonth}
                aria-label="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="quiet" onClick={() => {
                setCurrentMonth(new Date().getMonth());
                setCurrentYear(new Date().getFullYear());
                setSelectedDate(null);
              }}>
                Today
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={nextMonth}
                aria-label="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Weekday Header */}
          <div className="grid grid-cols-7 gap-2 text-center">
            {WEEKDAYS.map((day) => (
              <div key={day} className="eyebrow">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Pad first week */}
            {[...Array(firstDay)].map((_, i) => (
              <div key={`empty-${i}`} className="h-20 border border-transparent" />
            ))}

            {/* Month Days */}
            {[...Array(daysInMonth)].map((_, i) => {
              const day = i + 1;
              const formattedDay = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayEvents = events.filter((e) => e.date === formattedDay);
              const isSelected = selectedDate === formattedDay;
              const isToday = todayKey === formattedDay;

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => setSelectedDate(isSelected ? null : formattedDay)}
                  aria-pressed={isSelected}
                  aria-label={`${MONTHS[currentMonth]} ${day}, ${currentYear}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}` : ""}`}
                  className={`flex h-20 flex-col items-start justify-between overflow-hidden rounded-md p-2 text-left transition-colors duration-fast ${
                    isSelected
                      ? "border border-secondary bg-accent-gold-surface ring-2 ring-accent-gold"
                      : isToday
                      ? "border border-border-strong bg-surface-raised"
                      : "border border-border hover:border-border-strong hover:bg-surface-raised"
                  }`}
                >
                  <span className="flex w-full items-center justify-between">
                    <span
                      className={`text-xs ${
                        isToday ? "w-semibold text-secondary" : "w-medium text-foreground"
                      }`}
                    >
                      {day}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                    )}
                  </span>

                  {dayEvents.length > 0 && (
                    <span className="w-full space-y-1">
                      {dayEvents.slice(0, 2).map((de) => (
                        <span
                          key={de.id}
                          className={`chip ${EVENT_TONE[de.type] === "danger" ? "chip-danger" : EVENT_TONE[de.type] === "gold" ? "chip-gold" : "chip-info"} block max-w-full overflow-hidden text-[9px] uppercase leading-tight`}
                          title={de.title}
                        >
                          {de.title}
                        </span>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="block text-center text-[9px] text-foreground-subtle">
                          +{dayEvents.length - 2} more
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-5 border-t border-border pt-4">
            {LEGEND.map((item) => (
              <span key={item.type} className="flex items-center gap-2 text-xs text-foreground-muted">
                <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                {item.label}
              </span>
            ))}
          </div>
        </Card>

        {/* Right Sidebar Agenda & Urgency Timeline */}
        <Card className="flex flex-col space-y-6 p-6">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
            <h2 className="flex items-center gap-2 font-display text-base text-foreground">
              <Clock className="h-4 w-4 text-secondary" />
              {selectedDate ? `Date: ${selectedDate}` : "Upcoming Timeline"}
            </h2>
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="text-xs font-medium text-secondary transition-colors duration-fast hover:text-secondary-hover hover:underline"
              >
                Show All
              </button>
            )}
          </div>

          {displayedAgenda.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-5 w-5" />}
              title="No scheduled events"
              description={
                selectedDate
                  ? "No events on this specific date. Click 'Show All' or pick another date."
                  : "Bookmark opportunities or click 'New Custom Event' to add entries."
              }
              className="border-0 bg-transparent px-0"
            />
          ) : (
            <ul className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
              {displayedAgenda.map((e) => {
                const daysLeft = Math.ceil(
                  (new Date(e.date).getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)
                );
                const isClosingSoon = daysLeft >= 0 && daysLeft <= 3;

                return (
                  <li key={e.id}>
                    <Card
                      tone="raised"
                      className="space-y-3 p-4 transition-colors duration-fast hover:border-border-strong"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Chip tone={EVENT_TONE[e.type]}>{e.type}</Chip>
                          {e.isManual && <Chip>User Added</Chip>}
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          {isClosingSoon && (
                            <motion.span
                              animate={{ opacity: [1, 0.55, 1] }}
                              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                            >
                              <Chip tone="danger">
                                {daysLeft === 0 ? "Today" : daysLeft > 0 ? `${daysLeft}d left` : "Passed"}
                              </Chip>
                            </motion.span>
                          )}
                          {!isClosingSoon && (
                            <Chip>
                              {daysLeft === 0 ? "Today" : daysLeft > 0 ? `${daysLeft}d left` : "Passed"}
                            </Chip>
                          )}

                          {e.isManual && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomEvent(e.id)}
                              aria-label={`Delete custom event ${e.title}`}
                              title="Delete Custom Event"
                              className="grid h-7 w-7 place-items-center rounded-sm text-foreground-subtle transition-colors duration-fast hover:bg-danger-surface hover:text-danger"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium leading-snug text-foreground">{e.title}</h3>
                        {e.description && (
                          <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
                            {e.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-border pt-2 text-xs">
                        <span className="text-foreground-muted">
                          {new Date(e.date).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>

                        {e.linkedUrl && (
                          <Link
                            href={e.linkedUrl}
                            className="inline-flex items-center gap-1 font-medium text-secondary transition-colors duration-fast hover:text-secondary-hover"
                          >
                            Open <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}