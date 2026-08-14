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
      <p className="text-eyebrow font-mono uppercase text-accent">{eyebrow}</p>
      <h2 className="mt-2 text-title">{title}</h2>
      {subtitle && <p className="mt-2 max-w-md text-neutral-500">{subtitle}</p>}
    </div>
  );
}
