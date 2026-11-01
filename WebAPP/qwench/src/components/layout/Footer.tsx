import { Shield } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface py-6 mt-auto">
      <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-safe/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-safe" />
          </div>
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wide font-medium">
              Official Partner
            </p>
            <p className="text-sm font-semibold text-text-primary">
              SEC Ghana — Securities and Exchange Commission
            </p>
          </div>
        </div>
        <p className="text-xs text-text-muted">
          © 2026 Qwench. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
