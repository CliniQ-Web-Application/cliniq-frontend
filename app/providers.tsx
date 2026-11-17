"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Keep server requests isolated; reuse one client in the browser across renders.
let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
    if (typeof window === "undefined") return new QueryClient();
    browserQueryClient ??= new QueryClient();
    return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
    return (
        <QueryClientProvider client={getQueryClient()}>
            {children}
        </QueryClientProvider>
    );
}
