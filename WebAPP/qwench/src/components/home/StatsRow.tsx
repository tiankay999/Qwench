import { cacheLife } from "next/cache";
import { connection } from "next/server";
import { CalendarDays, FileText, Landmark } from "lucide-react";
import { about } from "@/lib/qwench";
import { Card } from "@/components/ui/Card";

/**
 * Real counts from GET /v1/public/about, or nothing.
 *
 * The prototype's figures ("847 scams flagged", "12,453 investments verified")
 * were invented and are gone. These three are the only counts Qwench can state
 * honestly: how many reviewed records are loaded, how many publishers they came
 * from, and when the data was last refreshed. No count of checks is shown,
 * because check_events holds no sender and there is no public endpoint for it.
 */

/** Throws on failure, so a failed call is never what gets cached for an hour. */
async function fetchAbout() {
  "use cache";
  cacheLife("hours");
  return about();
}

async function load() {
  // The image is built with no backend reachable, so without this the "couldn't
  // reach" branch would be prerendered into the deployed page and served for an
  // hour. Waiting for a real request means the first visitor fills the cache.
  await connection();
  try {
    return await fetchAbout();
  } catch {
    return null;
  }
}

export async function StatsRow() {
  const data = await load();
  if (!data) return null;

  const items = [
    {
      icon: FileText,
      value: data.total_records.toLocaleString(),
      label: "Reviewed records loaded",
    },
    {
      icon: Landmark,
      value: String(data.records_by_source.length),
      label: data.records_by_source.length === 1 ? "Official publisher" : "Official publishers",
    },
    {
      icon: CalendarDays,
      value: data.data_date ?? "—",
      label: "Data as of",
    },
  ];

  return (
    <section className="px-4 pb-12">
      <div className="mx-auto max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-4">
        {items.map((item) => (
          <Card key={item.label} className="flex items-center gap-4 p-5">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <item.icon className="w-6 h-6 text-accent" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-text-primary truncate">{item.value}</p>
              <p className="text-xs text-text-muted font-medium uppercase tracking-wide">
                {item.label}
              </p>
            </div>
          </Card>
        ))}
      </div>
      <p className="mx-auto max-w-4xl text-xs text-text-muted mt-3">
        From{" "}
        {data.records_by_source.map((s, i) => (
          <span key={s.publisher}>
            {i > 0 && (i === data.records_by_source.length - 1 ? " and " : ", ")}
            <span className="text-text-secondary font-medium">{s.publisher}</span> ({s.records})
          </span>
        ))}
        .
      </p>
    </section>
  );
}
