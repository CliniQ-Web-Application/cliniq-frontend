import { supabase} from "@/lib/supabase";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export interface NotificationItem {
    notificationId: string;
    type: string;
    message: string;
    isRead: boolean;
    createdAt: string;
}

export async function fetchMyNotifications(): Promise<NotificationItem[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No session");

    const res = await fetch(`${BASE_URL}/api/notifications/me`, {
        headers: {
            Authorization: `Bearer ${session.access_token}`,
        },
    });

    if (!res.ok) {
        throw new Error("Failed to fetch notifications");
    }

    return res.json();
}