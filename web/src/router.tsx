import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";

import UserLayout from "@/app/(user)/layout";
import NotFound from "@/app/not-found";
import { RouteErrorBoundary } from "@/components/route-error-boundary";

const HomePage = lazy(() => import("@/app/(user)/page"));
const ImagePage = lazy(() => import("@/app/(user)/image/page"));
const VideoPage = lazy(() => import("@/app/(user)/video/page"));
const AssetsPage = lazy(() => import("@/app/(user)/assets/page"));
const PromptsPage = lazy(() => import("@/app/(user)/prompts/page"));
const CanvasPage = lazy(() => import("@/app/(user)/canvas/page"));
const CanvasClientPage = lazy(() => import("@/app/(user)/canvas/[id]/canvas-client-page"));

function route(element: ReactNode) {
    return <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-stone-500">加载中...</div>}>{element}</Suspense>;
}

export const router = createBrowserRouter([
    {
        element: (
            <UserLayout>
                <Outlet />
            </UserLayout>
        ),
        errorElement: <RouteErrorBoundary />,
        children: [
            { path: "/", element: route(<HomePage />) },
            { path: "/image", element: route(<ImagePage />) },
            { path: "/video", element: route(<VideoPage />) },
            { path: "/assets", element: route(<AssetsPage />) },
            { path: "/prompts", element: route(<PromptsPage />) },
            { path: "/canvas", element: route(<CanvasPage />) },
            { path: "/canvas/:id", element: route(<CanvasClientPage />) },
        ],
    },
    { path: "*", element: <NotFound />, errorElement: <RouteErrorBoundary /> },
]);
