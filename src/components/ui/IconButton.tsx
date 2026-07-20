import { Check, X, Wand2 } from "lucide-react";

type Variant = "confirm" | "cancel" | "magic";

const VARIANT_CLASSES: Record<Variant, string> = {
  confirm: "bg-accent-teal text-on-accent-light",
  cancel: "bg-accent-red/15 text-accent-red",
  magic: "bg-accent-amber/15 text-accent-amber",
};

const VARIANT_ICON = {
  confirm: Check,
  cancel: X,
  magic: Wand2,
};

export function IconButton({
  variant,
  onClick,
  ariaLabel,
  rounded = "full",
}: {
  variant: Variant;
  onClick?: () => void;
  ariaLabel: string;
  rounded?: "full" | "md";
}) {
  const Icon = VARIANT_ICON[variant];
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center ${
        rounded === "full" ? "rounded-full" : "rounded-md"
      } transition-opacity hover:opacity-90 ${VARIANT_CLASSES[variant]}`}
    >
      <Icon className="h-5 w-5" strokeWidth={2} />
    </button>
  );
}
