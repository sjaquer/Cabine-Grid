import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 p-8 animate-pulse">
      <Skeleton className="h-10 w-[250px] rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      <Skeleton className="h-[400px] w-full rounded-xl" />
    </div>
  );
}
