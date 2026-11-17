"use client";
import { Bell, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "@/lib/queries";
import { bookingApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export default function NotificationBell() {
    const [isOpen, setIsOpen] = useState(false);
    const [markingId, setMarkingId] = useState<string | null>(null);
    const [error, setError] = useState("");
    const queryClient = useQueryClient();

    // Shared cache with the notifications page; refreshed by realtime events.
    const { data: items = [], isPending: loading } = useNotifications();

    async function markAsRead(id: string) {
        if (markingId !== null) return;
        setMarkingId(id);
        setError("");
        try {
            await bookingApi(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
            await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not mark this notification as read.");
        } finally {
            setMarkingId(null);
        }
    }

    const unreadCount = items.filter((n) => !n.isRead).length;

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-gray-100"
                aria-label={loading ? "Loading notifications" : "Notifications"}
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-600" /> : <Bell className="w-5 h-5 text-gray-600" />}
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
            {unreadCount}
          </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                    <div className="p-3 border-b font-semibold text-sm">Notifications</div>
                    {error && <p role="alert" className="p-2 text-xs text-error">{error}</p>}
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 p-4 text-sm text-gray-500">
                            <Loader2 size={16} className="animate-spin" /> Loading notifications...
                        </div>
                    ) : items.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500 text-center">No notifications yet</div>
                    ) : (
                        <ul className="divide-y">
                            {items.map((n) => (
                                <li key={n.notificationId} className={`p-3 text-sm ${n.isRead ? 'text-gray-500' : 'bg-blue-50 font-medium'}`}>
                                    <p>{n.message}</p>
                                    {!n.isRead && <button type="button" disabled={markingId !== null} onClick={() => { void markAsRead(n.notificationId); }} className="mt-2 min-h-10 text-xs font-semibold text-blue-700 underline disabled:opacity-50">{markingId === n.notificationId ? "Marking as read..." : "Mark as read"}</button>}
                                    <span className="text-xs text-gray-400 mt-1 block">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : "Date unavailable"}
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
