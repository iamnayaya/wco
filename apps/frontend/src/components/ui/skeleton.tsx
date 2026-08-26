import { cn } from '../../lib/utils/format';

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'skeleton animate-pulse rounded-md bg-gray-200 dark:bg-gray-700',
        className,
      )}
    />
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-2 h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="mb-4 h-3 w-1/4 rounded bg-gray-100 dark:bg-gray-800" />
      <div className="space-y-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="flex gap-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="border-b border-gray-100 px-4 py-3 last:border-b-0 dark:border-gray-800"
        >
          <div className="flex gap-4">
            <Skeleton className={`h-3 ${i % 2 === 0 ? 'w-20' : 'w-16'}`} />
            <Skeleton className={`h-3 ${i % 3 === 0 ? 'w-32' : 'w-24'}`} />
            <Skeleton className={`h-3 ${i % 2 === 0 ? 'w-16' : 'w-20'}`} />
            <Skeleton className={`h-3 ${i % 3 === 0 ? 'w-24' : 'w-20'}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonStat() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="mb-2 h-8 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonTable, SkeletonStat };
