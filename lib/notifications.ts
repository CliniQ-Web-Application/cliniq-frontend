import { supabase} from "@/lib/supabase";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export interface NotificationItem {
    notificationId: string;
    type: string;
    message: string;
    isRead: boolean;
    createdAt: string;
}

async function notificationRequest(path: string, method: "GET" | "PATCH"): Promise<Response> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No session");

    const res = await fetch(`${BASE_URL}/api/notifications${path}`, {
        method,
        cache: "no-store",
        headers: {
            Authorization: `Bearer ${session.access_token}`,
        },
    });

    if (!res.ok) {
        throw new Error(method === "PATCH" ? "Could not mark this notification as read. Please try again." : "Failed to fetch notifications");
    }

    return res;
}

export async function fetchMyNotifications(): Promise<NotificationItem[]> {
    return (await notificationRequest("/me", "GET")).json();
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
    return (await notificationRequest(`/${encodeURIComponent(id)}/read`, "PATCH")).json();
}