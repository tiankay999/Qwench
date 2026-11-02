import { Search, Database, ShieldCheck } from "lucide-react";

const steps = [
  {
    number: "1",
    icon: Search,
    title: "Search or paste a link",
    desc: "Any company, token, or investment URL",
  },
  {
    number: "2",
    icon: Database,
    title: "We cross-check 50+ sources",
    desc: "SEC Ghana, blockchain, community data",
  },
  {
    number: "3",
    icon: ShieldCheck,
    title: "Get your risk score instantly",
    desc: "Clear verdict with data to back it up",
  },
];

export function HowItWorks() {
  return (
    <section className="px-4 pb-20">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-xl font-bold text-text-primary mb-8">
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div key={step.number} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                <span className="text-accent font-bold text-sm">
                  {step.number}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-text-primary text-sm mb-1">
                  {step.title}
                </h3>
                <p className="text-xs text-text-secondary">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
