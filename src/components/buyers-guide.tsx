import type { BuyersGuide as BuyersGuideData } from "@/lib/buyers-guides";
import { SectionHeading } from "./section-heading";

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 shrink-0 text-accent"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 8.5 6 12l7.5-7.5" />
    </svg>
  );
}

export function BuyersGuide({ guide }: { guide: BuyersGuideData }) {
  return (
    <section className="mt-16">
      <SectionHeading eyebrow={guide.eyebrow} title={guide.title} />

      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        {guide.requirements.map((requirement) => (
          <li key={requirement} className="flex items-center gap-2 text-sm text-neutral-600">
            <CheckIcon />
            {requirement}
          </li>
        ))}
      </ul>

      <ol className="mt-8 grid gap-6 sm:grid-cols-3">
        {guide.steps.map((step, i) => (
          <li key={step.title} className="flex flex-col gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
              {i + 1}
            </span>
            <div>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-neutral-500">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-8 rounded-card bg-amber-50 px-4 py-3 text-xs text-amber-900">
        {guide.disclaimer}
      </p>
    </section>
  );
}
