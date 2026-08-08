"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { cx } from "@/components/ui/heyy";
import type { HeyySelectOption } from "@/components/ui/heyy-select";

type SelectTone = "default" | "brand" | "architecture" | "interior" | "marketing" | "admin";

type HeyyMultiSelectProps = {
  value: string[];
  options: Array<string | HeyySelectOption>;
  onChange: (value: string[]) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  tone?: SelectTone;
};

const TONES: Record<SelectTone, { accent: string; strong: string; soft: string; border: string }> = {
  default: {
    accent: "#6f2dff",
    strong: "#5a16dc",
    soft: "rgba(111,45,255,.12)",
    border: "rgba(111,45,255,.34)",
  },
  brand: {
    accent: "#9f2ce0",
    strong: "#7e22b7",
    soft: "rgba(159,44,224,.14)",
    border: "rgba(159,44,224,.36)",
  },
  architecture: {
    accent: "#2e7cf6",
    strong: "#1769d2",
    soft: "rgba(46,124,246,.14)",
    border: "rgba(46,124,246,.38)",
  },
  interior: {
    accent: "#d06b14",
    strong: "#a84f08",
    soft: "rgba(208,107,20,.14)",
    border: "rgba(208,107,20,.36)",
  },
  marketing: {
    accent: "#eb3d87",
    strong: "#c62869",
    soft: "rgba(235,61,135,.14)",
    border: "rgba(235,61,135,.34)",
  },
  admin: {
    accent: "#6f2dff",
    strong: "#5a16dc",
    soft: "rgba(111,45,255,.12)",
    border: "rgba(111,45,255,.34)",
  },
};

function normalizeOptions(options: Array<string | HeyySelectOption>): HeyySelectOption[] {
  return options
    .map((option) =>
      typeof option === "string" ? { value: option, label: option } : option,
    )
    .sort((first, second) =>
      first.label.localeCompare(second.label, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
}

export default function HeyyMultiSelect({
  value,
  options,
  onChange,
  placeholder = "Select one or more options",
  ariaLabel,
  disabled = false,
  className,
  triggerClassName,
  tone = "default",
}: HeyyMultiSelectProps) {
  const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);
  const selectableOptions = useMemo(
    () => normalizedOptions.filter((option) => !option.disabled),
    [normalizedOptions],
  );
  const selectedOptions = normalizedOptions.filter((option) => value.includes(option.value));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const colors = TONES[tone];

  const colorStyle = {
    "--heyy-select-accent": colors.accent,
    "--heyy-select-strong": colors.strong,
    "--heyy-select-soft": colors.soft,
    "--heyy-select-border": colors.border,
  } as CSSProperties;

  useEffect(() => setMounted(true), []);

  function updatePosition() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const maxHeight = Math.min(340, window.innerHeight - viewportPadding * 2);
    const estimatedHeight = Math.min(maxHeight, normalizedOptions.length * 45 + 16);
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const openAbove = spaceBelow < Math.min(190, estimatedHeight) && rect.top > spaceBelow;
    const top = openAbove
      ? Math.max(viewportPadding, rect.top - estimatedHeight - 8)
      : Math.min(
          window.innerHeight - viewportPadding - Math.min(estimatedHeight, maxHeight),
          rect.bottom + 8,
        );
    const width = Math.max(rect.width, 220);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
    );
    setMenuStyle({ position: "fixed", top, left, width, maxHeight });
  }

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    updatePosition();

    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const reposition = () => updatePosition();
    document.addEventListener("pointerdown", closeOnOutside);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, normalizedOptions.length]);

  useEffect(() => {
    if (!open) return;
    const optionButtons = menuRef.current?.querySelectorAll<HTMLButtonElement>("[data-heyy-option]");
    optionButtons?.[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function toggle(option: HeyySelectOption) {
    if (option.disabled) return;
    onChange(
      value.includes(option.value)
        ? value.filter((item) => item !== option.value)
        : [...value, option.value],
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        const count = Math.max(1, selectableOptions.length);
        return (current + direction + count) % count;
      });
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) setOpen(true);
      else if (selectableOptions[activeIndex]) toggle(selectableOptions[activeIndex]);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  const menu = open && mounted
    ? createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-multiselectable="true"
          aria-label={ariaLabel || placeholder}
          className="heyy-select-menu heyy-scrollbar"
          style={{ ...menuStyle, ...colorStyle }}
        >
          {normalizedOptions.map((option) => {
            const selected = value.includes(option.value);
            const activeSelectableIndex = selectableOptions.findIndex(
              (item) => item.value === option.value,
            );
            const active = activeSelectableIndex === activeIndex;
            return (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                role="option"
                aria-selected={selected}
                data-heyy-option
                data-active={active}
                data-selected={selected}
                disabled={option.disabled}
                onMouseEnter={() => {
                  if (activeSelectableIndex >= 0) setActiveIndex(activeSelectableIndex);
                }}
                onClick={() => toggle(option)}
              >
                <span>{option.label}</span>
                {selected && <Check size={15} strokeWidth={2.5} aria-hidden="true" />}
              </button>
            );
          })}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className={cx("heyy-select", className)} style={colorStyle} data-open={open}>
      <button
        ref={triggerRef}
        type="button"
        className={cx("heyy-select-trigger", triggerClassName)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (!open) updatePosition();
          setOpen((current) => !current);
        }}
        onKeyDown={onKeyDown}
      >
        <span data-placeholder={selectedOptions.length === 0}>
          {selectedOptions.length === 0
            ? placeholder
            : selectedOptions.length === 1
              ? selectedOptions[0].label
              : `${selectedOptions.length} selected`}
        </span>
        <ChevronDown size={17} strokeWidth={2.2} aria-hidden="true" />
      </button>

      {selectedOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--heyy-select-border)] bg-[var(--heyy-select-soft)] px-3 py-1.5 text-[10px] font-black text-[var(--heyy-select-strong)]"
              aria-label={`Remove ${option.label}`}
            >
              {option.label}
              <X size={12} strokeWidth={2.5} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      {menu}
    </div>
  );
}
