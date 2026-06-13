export function SkeletonBlock({ h = 80 }: { h?: number }) {
  return <div className="skeleton-block" style={{ minHeight: h }} />;
}

export function SkeletonText({ w = "70%" }: { w?: string }) {
  return <div className="skeleton-line" style={{ width: w }} />;
}

export function PageSkeleton() {
  return (
    <div className="page-content" style={{ animation: "none" }}>
      <div className="skeleton-header">
        <SkeletonText w="55%" />
        <SkeletonText w="36%" />
      </div>
      <SkeletonBlock h={120} />
      <SkeletonBlock h={72} />
      <SkeletonBlock h={72} />
      <SkeletonBlock h={72} />
    </div>
  );
}
