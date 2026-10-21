import { Star } from "lucide-react";

const STARS = [1, 2, 3, 4, 5] as const;

/** Read-only stars; `value` may be fractional (the fill is clipped to the exact share). */
export function StarRating({ value, label, size = 16 }: { value: number; label: string; size?: number }) {
  const pct = Math.max(0, Math.min(5, value)) * 20;
  return (
    <span role="img" aria-label={label} className="relative inline-flex shrink-0 leading-none">
      <span className="flex gap-0.5 text-zinc-300 dark:text-zinc-600" aria-hidden>
        {STARS.map((n) => (
          <Star key={n} width={size} height={size} />
        ))}
      </span>
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }} aria-hidden>
        <span className="flex gap-0.5 text-amber-500" style={{ width: "max-content" }}>
          {STARS.map((n) => (
            <Star key={n} width={size} height={size} fill="currentColor" />
          ))}
        </span>
      </span>
    </span>
  );
}

/** Radio-button star input (arrow keys work natively). Labels come from the caller's translations. */
export function StarInput({
  value,
  onChange,
  legend,
  optionLabel,
  name,
}: {
  value: number;
  onChange: (rating: number) => void;
  legend: string;
  optionLabel: (rating: number) => string;
  name: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-zinc-900 dark:text-white">{legend}</legend>
      <div className="flex gap-1">
        {STARS.map((n) => (
          <label
            key={n}
            className="relative cursor-pointer rounded-md p-0.5 text-zinc-300 has-[:checked]:text-amber-500 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-moya-red dark:text-zinc-600"
            style={n <= value ? { color: "rgb(245 158 11)" } : undefined}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="peer sr-only"
              aria-label={optionLabel(n)}
            />
            <Star width={28} height={28} fill={n <= value ? "currentColor" : "none"} aria-hidden />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
