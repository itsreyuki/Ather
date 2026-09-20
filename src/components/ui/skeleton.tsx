export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

export function DashboardSkeleton() {
  return <div className="skeleton-stack"><div className="skeleton-heading"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-button" /></div><div className="skeleton-grid">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="skeleton-card" />)}</div><Skeleton className="skeleton-panel" /></div>;
}
