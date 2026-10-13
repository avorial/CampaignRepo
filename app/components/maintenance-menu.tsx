"use client";

import { useRef, useState } from "react";
import { Database, RefreshCw, Upload, Wrench } from "lucide-react";

type MaintenanceAction = {
  label: string;
  kind: "index" | "repair" | "sync" | "refresh";
  run: () => unknown | Promise<unknown>;
};

export default function MaintenanceMenu({ actions }: { actions: MaintenanceAction[] }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const icons = { index: Database, repair: Wrench, sync: Upload, refresh: RefreshCw };
  return (
    <div className="maintenance-control">
      <details className="maintenance-menu" ref={menu}>
        <summary title="Repository maintenance"><Wrench size={16} aria-hidden="true" />Maintenance</summary>
        <div className="maintenance-options">
          {actions.map((action) => {
            const Icon = icons[action.kind];
            return <button key={action.label} type="button" disabled={busy} onClick={async () => {
              setBusy(true);
              setError("");
              if (menu.current) menu.current.open = false;
              try { await action.run(); }
              catch (error) { setError(error instanceof Error ? error.message : "Maintenance failed."); }
              finally { setBusy(false); }
            }}><Icon size={16} aria-hidden="true" />{action.label}</button>;
          })}
        </div>
      </details>
      {busy && <span role="status">Working...</span>}
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  );
}
