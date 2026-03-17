import type { Machine } from "@/lib/types";
import PCCard from "./PCCard";

type PCGridProps = {
  machines: Machine[];
  onFinishSession: (machine: Machine) => void;
};

export default function PCGrid({ machines, onFinishSession }: PCGridProps) {
  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 sm:gap-6">
        {machines.map((machine) => (
          <PCCard
            key={machine.id}
            machine={machine}
            onFinishSession={onFinishSession}
          />
        ))}
      </div>
    </div>
  );
}
