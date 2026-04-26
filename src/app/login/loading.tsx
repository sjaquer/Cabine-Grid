import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md space-y-6 bg-card/40 p-8 rounded-2xl border border-border/50 shadow-lg">
        <Skeleton className="h-8 w-[150px] mx-auto rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[80px] rounded" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-[80px] rounded" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
