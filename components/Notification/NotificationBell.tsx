"use client";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchMyNotifications, NotificationItem } from "@/lib/notifications";

export default function NotificationBell() {
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchMyNotifications();
                setItems(data);
            } catch (e) {
                console.error(e);
            }
        };

        load(); // Initial fetch
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") load();
        }, 25000);

        return () => clearInterval(interval);
    }, []);

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
                    {items.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500 text-center">No notifications yet</div>
                    ) : (
                        <ul className="divide-y">
                            {items.map((n) => (
                                <li key={n.notificationId} className={`p-3 text-sm ${n.isRead ? 'text-gray-500' : 'bg-blue-50 font-medium'}`}>
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