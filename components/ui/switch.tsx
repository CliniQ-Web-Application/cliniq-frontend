"use client";

import { cn } from "cn";

interface SwitchProps {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
    size?: "sm" | "default";
}

function Switch({
    checked = false,
    onCheckedChange,
    disabled = false,
    className,
    size = "default",
}: SwitchProps) {
    const dimensions = size === "sm" ? "h-3.5 w-6" : "h-[18px] w-8";
    const thumb = size === "sm" ? "size-3" : "size-4";

    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            data-size={size}
            className={cn(
                "relative inline-flex shrink-0 items-center rounded-full border border-transparent p-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                dimensions,
                checked ? "bg-primary" : "bg-neutral-300",
                className,
            )}
            onClick={() => onCheckedChange?.(!checked)}
        >
            <span
                aria-hidden="true"
                className={cn(
                    "pointer-events-none block rounded-full bg-white shadow-sm transition-transform",
                    thumb,
                    checked ? "translate-x-[calc(100%-2px)]" : "translate-x-0",
                )}
            />
        </button>
    );
}

export { Switch };
