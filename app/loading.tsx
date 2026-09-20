import { Logo } from "@/src/components/brand/logo";
import { Skeleton } from "@/src/components/ui/skeleton";

export default function Loading() { return <main className="auth-page"><div className="loading-mark"><Logo /><Skeleton className="skeleton-loading-line" /><Skeleton className="skeleton-loading-line short" /></div></main>; }
