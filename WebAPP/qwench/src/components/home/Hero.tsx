import { SearchBar } from "@/components/ui/SearchBar";
import { Star } from "lucide-react";

export function Hero() {
  return (
    <section className="py-16 md:py-24 text-center px-4">
      
      <h1 className="text-4xl md:text-6xl font-extrabold text-text-primary leading-tight mb-2">
        Protect your money.
      </h1>
      <h1 className="text-4xl md:text-6xl font-extrabold text-accent leading-tight mb-6">
        Verify first.
      </h1>
      <p className="text-text-secondary text-base md:text-lg max-w-xl mx-auto mb-10">
        Check any company, token, or investment in Ghana before you put in a
        single cedi.
      </p>
      <div className="flex justify-center">
        <SearchBar />
      </div>
    </section>
  );
}
