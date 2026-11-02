import { Database, Search, ScrollText } from "lucide-react";
import { HOW_IT_WORKS } from "@/lib/content";

const icons = [Search, Database, ScrollText];

export function HowItWorks() {
  return (
    <section className="px-4 pb-20">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-xl font-bold text-text-primary mb-8">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {HOW_IT_WORKS.map((step, i) => {
            const Icon = icons[i] ?? Search;
            return (
              <div key={step.title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-accent" aria-hidden />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary text-sm mb-1">{step.title}</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
