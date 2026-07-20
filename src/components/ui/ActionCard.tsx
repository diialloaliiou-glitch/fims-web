import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type Color = "teal" | "blue" | "muted";

const COLOR_CLASSES: Record<Color, string> = {
  teal: "border-accent-teal/40 bg-bg-card-teal text-accent-teal hover:border-accent-teal",
  blue: "border-border-subtle bg-bg-card text-accent-blue hover:border-accent-teal",
  muted: "border-border-subtle bg-bg-card-muted text-text-secondary hover:border-accent-teal/50",
};

export function ActionCard({
  icon: Icon,
  color,
  label,
  href,
  onClick,
}: {
  icon: LucideIcon;
  color: Color;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const className = `flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-2xl border p-6 text-center transition-colors ${COLOR_CLASSES[color]}`;

  const content = (
    <>
      <Icon className="h-8 w-8" strokeWidth={1.75} />
      <p className="font-semibold">{label}</p>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  );
}
