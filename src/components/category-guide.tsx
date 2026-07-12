import type { CategoryGuide as CategoryGuideData } from "@/lib/category-guides";
import { Faq } from "./faq";
import { SectionHeading } from "./section-heading";

export function CategoryGuide({ guide }: { guide: CategoryGuideData }) {
  return (
    <section className="mt-16">
      <SectionHeading eyebrow={guide.eyebrow} title={guide.title} subtitle={guide.intro} />

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">What matters most</h3>
          <ul className="mt-4 space-y-4">
            {guide.whatMattersMost.map((item) => (
              <li key={item.point}>
                <p className="text-sm font-medium">{item.point}</p>
                <p className="mt-1 text-sm text-neutral-500">{item.why}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Common mistakes to avoid</h3>
          <ul className="mt-4 space-y-2">
            {guide.commonMistakes.map((mistake) => (
              <li key={mistake} className="flex gap-2 text-sm text-neutral-500">
                <span aria-hidden="true" className="text-neutral-400">
                  &ndash;
                </span>
                {mistake}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-10">
        <h3 className="text-sm font-semibold">Budget tiers</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {guide.budgetTiers.map((tier) => (
            <div key={tier.label} className="rounded-card border border-border-subtle p-5">
              <p className="text-sm font-semibold text-accent">{tier.label}</p>
              <p className="mt-2 text-sm text-neutral-500">{tier.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <Faq items={guide.faqs} />
      </div>
    </section>
  );
}
