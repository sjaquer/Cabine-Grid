import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 p-8 animate-pulse">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-[200px] rounded-lg" />
        <Skeleton className="h-10 w-[120px] rounded-lg" />
      </div>
      <Skeleton className="h-[500px] w-full rounded-xl" />
    </div>
  );
}
