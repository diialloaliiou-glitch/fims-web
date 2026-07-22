"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
        {label}
        {required && <span className="text-accent-amber"> *</span>}
      </label>
      {children ?? (
        isPassword ? (
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              list={list}
              step={step}
              disabled={disabled}
              className={`${fieldControlClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-text-secondary hover:text-text-primary"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        ) : (
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
        )
      )}
    </div>
  );
}
