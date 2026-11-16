import { supabase } from "@/lib/supabase";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

export interface NotificationItem {
    notificationId: string;
    type: string;
    message: string;
    isRead: boolean;
    createdAt: string;
    appointmentId?: string | null;
}

async function authHeaders(): Promise<HeadersInit> {
    const {
        data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("No session");
    return {
        Authorization: `Bearer ${session.access_token}`,
    };
}

export async function fetchMyNotifications(): Promise<NotificationItem[]> {
    const headers = await authHeaders();
    const res = await fetch(`${BASE_URL}/api/notifications/me`, {
        headers,
        cache: "no-store",
    });

    if (!res.ok) {
        throw new Error("Failed to fetch notifications");
    }

    return res.json();
}

export async function markNotificationRead(notificationId: string): Promise<NotificationItem> {
    const headers = await authHeaders();
    const res = await fetch(`${BASE_URL}/api/notifications/${encodeURIComponent(notificationId)}/read`, {
        method: "PATCH",
        headers,
    });

    if (!res.ok) {
        throw new Error("Failed to mark notification as read");
    }

    return res.json();
}

export async function markAllNotificationsRead(): Promise<void> {
    const headers = await authHeaders();
    const res = await fetch(`${BASE_URL}/api/notifications/read-all`, {
        method: "PATCH",
        headers,
    });

    if (!res.ok) {
        throw new Error("Failed to mark all notifications as read");
    }
}