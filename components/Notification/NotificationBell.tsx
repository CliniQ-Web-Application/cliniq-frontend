"use client";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fetchMyNotifications, markNotificationRead, NotificationItem } from "@/lib/notifications";

export default function NotificationBell() {
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [markingId, setMarkingId] = useState<string | null>(null);
    const [error, setError] = useState("");
    const mutationVersion = useRef(0);
    const saving = useRef(false);

    useEffect(() => {
        let disposed = false;
        const load = async () => {
            const version = mutationVersion.current;
            try {
                const data = await fetchMyNotifications();
                if (!disposed && !saving.current && version === mutationVersion.current) setItems(data);
            } catch (e) {
                console.error(e);
            }
        };

        load(); // Initial fetch
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") load();
        }, 25000);

        return () => { disposed = true; clearInterval(interval); };
    }, []);

    async function markAsRead(id: string) {
        if (saving.current) return;
        saving.current = true;
        mutationVersion.current++;
        setMarkingId(id);
        setError("");
        try {
            const updated = await markNotificationRead(id);
            setItems((current) => current.map((item) => item.notificationId === id ? updated : item));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not mark this notification as read.");
        } finally {
            mutationVersion.current++;
            saving.current = false;
            setMarkingId(null);
        }
    }

    const unreadCount = items.filter((n) => !n.isRead).length;

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-gray-100"
            >
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
            {unreadCount}
          </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                    <div className="p-3 border-b font-semibold text-sm">Notifications</div>
                    {error && <p role="alert" className="p-3 text-sm text-red-600">{error}</p>}
                    {items.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500 text-center">No notifications yet</div>
                    ) : (
                        <ul className="divide-y">
                            {items.map((n) => (
                                <li key={n.notificationId} className={`p-3 text-sm ${n.isRead ? 'text-gray-500' : 'bg-blue-50 font-medium'}`}>
                                    <p>{n.message}</p>
                                    {!n.isRead && <button type="button" disabled={markingId !== null} onClick={() => { void markAsRead(n.notificationId); }} className="mt-2 min-h-10 text-xs font-semibold text-blue-700 underline disabled:opacity-50">{markingId === n.notificationId ? "Marking as read..." : "Mark as read"}</button>}
                                    <span className="text-xs text-gray-400 mt-1 block">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}