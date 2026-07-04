export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-accent">{eyebrow}</p>
      <h2 className="mt-1 text-title">{title}</h2>
      {subtitle && <p className="mt-2 text-neutral-500">{subtitle}</p>}
    </div>
  );
}
