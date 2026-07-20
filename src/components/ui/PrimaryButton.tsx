export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md bg-accent-blue-solid px-6 py-2 font-medium text-on-accent-dark hover:opacity-90 disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}
