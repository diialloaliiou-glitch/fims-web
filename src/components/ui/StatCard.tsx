import type { LucideIcon } from "lucide-react";

type ValueColor = "teal" | "blue" | "amber";

const VALUE_CLASSES: Record<ValueColor, string> = {
  teal: "text-accent-teal",
  blue: "text-accent-blue",
  amber: "text-accent-amber",
};

export function StatCard({
  label,
  value,
  valueColor = "teal",
  icon: Icon,
}: {
  label: string;
  value: string | number;
  valueColor?: ValueColor;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-card px-4 py-2 text-left">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-text-secondary" strokeWidth={1.75} />}
        <p className="text-xs text-text-secondary">{label}</p>
      </div>
      <p className={`text-lg font-bold ${VALUE_CLASSES[valueColor]}`}>{value}</p>
    </div>
  );
}
