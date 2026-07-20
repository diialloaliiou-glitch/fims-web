export const fieldControlClass =
  "w-full rounded-xl border border-border-subtle bg-bg-card px-3 py-2 text-text-primary outline-none transition-shadow focus:border-accent-teal focus:shadow-[0_0_0_3px_rgba(52,224,176,0.15)]";

export function FormField({
  label,
  required = false,
  value,
  onChange,
  type = "text",
  placeholder,
  list,
  step,
  disabled,
  children,
}: {
  label: string;
  required?: boolean;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  list?: string;
  step?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
        {label}
        {required && <span className="text-accent-amber"> *</span>}
      </label>
      {children ?? (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          list={list}
          step={step}
          disabled={disabled}
          className={fieldControlClass}
        />
      )}
    </div>
  );
}
