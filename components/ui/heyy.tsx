import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "heyy-button inline-flex items-center justify-center gap-2 rounded-full font-extrabold tracking-[-0.01em] transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--focus-ring)] disabled:pointer-events-none disabled:opacity-45";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-[var(--button-primary)] !text-[var(--button-primary-text)] shadow-[var(--shadow-button)] hover:-translate-y-0.5 hover:bg-[var(--button-primary-hover)] hover:shadow-[var(--shadow-button-hover)]",
  secondary:
    "border border-[var(--border-strong)] bg-[var(--surface-strong)] !text-[var(--text-primary)] hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]",
  ghost:
    "border border-transparent bg-transparent !text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
  danger:
    "border border-red-300/60 bg-red-500/10 text-red-700 hover:bg-red-500 hover:text-white dark:text-red-200",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-4 text-xs",
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-13 px-6 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cx(
        buttonBase,
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <a
      className={cx(
        buttonBase,
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function GlassCard({
  className,
  interactive = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cx(
        "heyy-glass rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--glass)] shadow-[var(--shadow-card)] backdrop-blur-2xl",
        interactive &&
          "transition duration-200 hover:-translate-y-1 hover:border-[var(--accent-border)] hover:shadow-[var(--shadow-card-hover)]",
        className,
      )}
      {...props}
    />
  );
}

export function Eyebrow({ children, className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cx(
        "text-[0.66rem] font-black uppercase tracking-[0.24em] text-[var(--accent-strong)]",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

export function CreditPill({
  credits,
  label = "credits",
  className,
}: {
  credits: number | string;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.11em] text-[var(--accent-strong)]",
        className,
      )}
    >
      <span aria-hidden="true">✦</span>
      {credits} {label}
    </span>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "info";
}) {
  return (
    <span className={cx("heyy-status-pill", `heyy-status-${tone}`)}>
      {children}
    </span>
  );
}

export function PageContainer({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8",
        className,
      )}
      {...props}
    />
  );
}
