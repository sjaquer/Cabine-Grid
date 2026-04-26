import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-6 bg-slate-950 min-h-screen">
      <div className="space-y-3">
        <div className="h-8 w-48 bg-slate-900/50 rounded-lg animate-pulse" />
        <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 md:gap-3">
          {Array.from({ length: 36 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl bg-slate-900/40 border border-slate-800/50" />
          ))}
        </div>
      </div>
    </div>
  );
}
