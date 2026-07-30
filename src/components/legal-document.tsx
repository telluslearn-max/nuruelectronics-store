export function LegalDocument({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-title sm:text-display">{title}</h1>
      <p className="mt-2 text-sm text-neutral-400">Last updated: {lastUpdated}</p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-neutral-600">
        {children}
      </div>
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-foreground">{heading}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
