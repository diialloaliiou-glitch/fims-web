import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function Pill({
  icon: Icon,
  children,
  href,
  onClick,
  solid = false,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  solid?: boolean;
}) {
  const className = solid
    ? "flex items-center gap-2 rounded-full bg-accent-blue-solid px-4 py-1.5 text-sm text-on-accent-dark hover:opacity-90"
    : "flex items-center gap-2 rounded-full border border-border-subtle bg-bg-card px-4 py-1.5 text-sm text-text-secondary hover:bg-bg-card-muted";

  const content = (
    <>
      {Icon && <Icon className="h-4 w-4" strokeWidth={1.75} />}
      {children}
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
