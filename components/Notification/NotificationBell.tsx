"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
    fetchMyNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    NotificationItem,
} from "@/lib/notifications";

export default function NotificationBell() {
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    const load = useCallback(async () => {
        try {
            const data = await fetchMyNotifications();
            setItems(data);
        } catch (e) {
            console.error(e);
        }
    }, []);

    useEffect(() => {
        void load();
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") void load();
        }, 10000);

        return () => clearInterval(interval);
    }, [load]);

    const handleMarkRead = async (item: NotificationItem) => {
        if (item.isRead) return;
        setItems((prev) =>
            prev.map((n) => (n.notificationId === item.notificationId ? { ...n, isRead: true } : n))
        );
        try {
            await markNotificationRead(item.notificationId);
        } catch (e) {
            console.error(e);
            void load();
        }
    };

    const handleMarkAllRead = async () => {
        setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
        try {
            await markAllNotificationsRead();
        } catch (e) {
            console.error(e);
            void load();
        }
    };

    const unreadCount = items.filter((n) => !n.isRead).length;

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-label="Notifications"
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
                    <div className="p-3 border-b flex items-center justify-between">
                        <span className="font-semibold text-sm">Notifications</span>
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={() => void handleMarkAllRead()}
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                                <CheckCheck className="w-3.5 h-3.5" />
                                Mark all read
                            </button>
                        )}
                    </div>

                    {items.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500 text-center">No notifications yet</div>
                    ) : (
                        <ul className="divide-y">
                            {items.map((n) => (
                                <li
                                    key={n.notificationId}
                                    onClick={() => void handleMarkRead(n)}
                                    className={`p-3 text-sm cursor-pointer transition ${
                                        n.isRead
                                            ? "text-gray-500 hover:bg-gray-50"
                                            : n.type === "QUEUE_CALLED"
                                                ? "bg-amber-50 font-semibold text-gray-900"
                                                : "bg-blue-50 font-medium text-gray-900"
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                      {n.type === "QUEUE_CALLED"
                          ? "Called Next"
                          : n.type === "NEW_BOOKING"
                              ? "New Booking"
                              : n.type}
                    </span>
                                        {!n.isRead && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                                    </div>
                                    <p>{n.message}</p>
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