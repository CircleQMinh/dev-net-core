const levelBadgeClasses: Record<string, string> = {
  Beginner: "border-blue-500/30 bg-blue-500/10 text-blue-600",
  Intermediate: "border-orange-500/30 bg-orange-500/10 text-orange-600",
  Advanced: "border-red-500/30 bg-red-500/10 text-red-600",
};

export type QuestionLevelBadgeProps = {
  displayText?: string;
  level: string;
};

export function QuestionLevelBadge({
  displayText,
  level,
}: QuestionLevelBadgeProps) {
  const levelClassName =
    levelBadgeClasses[level] ?? levelBadgeClasses.Beginner;

  return (
    <span
      className={`gleeple-heading rounded border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${levelClassName}`}
    >
      {displayText ?? level}
    </span>
  );
}
