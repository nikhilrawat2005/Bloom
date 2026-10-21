"use client";

import { useState, useEffect } from "react";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { NotificationItem } from "@/lib/types";

interface UseNotificationsResult {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
}

/**
 * Real-time notifications hook.
 * Subscribes to Firestore notifications/{uid}/items and returns items + unread count.
 * Used by Navbar for the bell badge and the Notifications page for the full list.
 */
export function useNotifications(uid: string | undefined): UseNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "notifications", uid, "items"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: NotificationItem[] = [];
        snap.forEach((d) => items.push({ id: d.id, ...d.data() } as NotificationItem));
        setNotifications(items);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [uid]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return { notifications, unreadCount, loading };
}
