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
import { Check, ChevronDown } from "lucide-react";
import { cx } from "@/components/ui/heyy";

export type HeyySelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectTone = "default" | "brand" | "architecture" | "interior" | "marketing" | "admin";

type ToneConfig = {
  accent: string;
  strong: string;
  soft: string;
  border: string;
  surface?: string;
  text?: string;
  muted?: string;
  menuSurface?: string;
};

type HeyySelectProps = {
  value: string;
  options: Array<string | HeyySelectOption>;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  tone?: SelectTone;
};

const TONES: Record<SelectTone, ToneConfig> = {
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
    surface: "#ffffff",
    text: "#211c28",
    muted: "#746d7c",
    menuSurface: "rgba(255,255,255,.99)",
  },
};

function optionRank(label: string) {
  const normalized = label.trim().toLowerCase();
  if (normalized === "all" || normalized.startsWith("all ")) return 0;
  if (normalized === "none" || normalized === "unassigned") return 1;
  if (normalized === "other") return 3;
  return 2;
}

function normalizeOptions(options: Array<string | HeyySelectOption>): HeyySelectOption[] {
  const seen = new Set<string>();
  return options
    .map((option) =>
      typeof option === "string" ? { value: option, label: option } : option,
    )
    .filter((option) => {
      const key = `${option.value}::${option.label}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((first, second) => {
      const rankDifference = optionRank(first.label) - optionRank(second.label);
      if (rankDifference !== 0) return rankDifference;
      const labelDifference = first.label.localeCompare(second.label, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return labelDifference || first.value.localeCompare(second.value, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

export default function HeyySelect({
  value,
  options,
  onChange,
  placeholder = "Select an option",
  ariaLabel,
  disabled = false,
  className,
  triggerClassName,
  tone = "default",
}: HeyySelectProps) {
  const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);
  const selectableOptions = useMemo(
    () => normalizedOptions.filter((option) => !option.disabled),
    [normalizedOptions],
  );
  const selectedOption = normalizedOptions.find((option) => option.value === value);
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
    "--heyy-select-surface": colors.surface || "var(--surface-strong)",
    "--heyy-select-text": colors.text || "var(--text-primary)",
    "--heyy-select-muted": colors.muted || "var(--text-muted)",
    "--heyy-select-menu-surface":
      colors.menuSurface || "color-mix(in srgb, var(--surface-strong) 96%, transparent)",
  } as CSSProperties;

  useEffect(() => setMounted(true), []);

  function updatePosition() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const maxHeight = Math.min(320, window.innerHeight - viewportPadding * 2);
    const estimatedHeight = Math.min(maxHeight, normalizedOptions.length * 45 + 16);
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const openAbove = spaceBelow < Math.min(190, estimatedHeight) && rect.top > spaceBelow;
    const top = openAbove
      ? Math.max(viewportPadding, rect.top - estimatedHeight - 8)
      : Math.min(window.innerHeight - viewportPadding - Math.min(estimatedHeight, maxHeight), rect.bottom + 8);
    const width = Math.max(rect.width, 180);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
    );
    setMenuStyle({ position: "fixed", top, left, width, maxHeight });
  }

  useEffect(() => {
    if (!open) return;
    const selectedIndex = selectableOptions.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
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
  }, [open, selectableOptions, value]);

  useEffect(() => {
    if (!open) return;
    const optionButtons = menuRef.current?.querySelectorAll<HTMLButtonElement>("[data-heyy-option]");
    optionButtons?.[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function choose(option: HeyySelectOption) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
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
      else if (selectableOptions[activeIndex]) choose(selectableOptions[activeIndex]);
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
          aria-label={ariaLabel || placeholder}
          className="heyy-select-menu heyy-scrollbar"
          data-tone={tone}
          style={{ ...menuStyle, ...colorStyle }}
        >
          {normalizedOptions.map((option) => {
            const selected = option.value === value;
            const activeSelectableIndex = selectableOptions.findIndex((item) => item.value === option.value);
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
                onClick={() => choose(option)}
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
    <div
      className={cx("heyy-select", className)}
      style={colorStyle}
      data-open={open}
      data-tone={tone}
    >
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
        <span data-placeholder={!selectedOption}>{selectedOption?.label || placeholder}</span>
        <ChevronDown size={17} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {menu}
    </div>
  );
}
