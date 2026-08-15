const pages = [
  {
    label: "Cover",
    body: (
      <div className="flex h-full flex-col">
        <div className="h-1/3 bg-surface-deep px-4 pt-4">
          <div className="text-[5px] font-semibold tracking-[0.2em] text-accent">YOUR AGENCY</div>
          <div className="mt-4 font-display text-[11px] leading-tight text-surface-deep-foreground">
            AI Search Visibility Report
          </div>
          <div className="mt-1 text-[6px] text-surface-deep-foreground/70">Northwind Dental Group</div>
        </div>
        <div className="space-y-2 p-4">
          <Bar w="70%" />
          <Bar w="45%" />
          <Bar w="58%" />
        </div>
      </div>
    ),
  },
  {
    label: "Executive summary",
    body: (
      <div className="space-y-2 p-4">
        <div className="text-[5px] font-semibold tracking-[0.2em] text-accent">01</div>
        <div className="font-display text-[9px]">Executive summary</div>
        <div className="space-y-1 pt-1">
          <Bar w="95%" /> <Bar w="88%" /> <Bar w="92%" /> <Bar w="61%" />
        </div>
        <div className="space-y-1.5 pt-2">
          <Meter w="24%" accent />
          <Meter w="71%" />
          <Meter w="55%" />
        </div>
      </div>
    ),
  },
  {
    label: "Platform breakdown",
    body: (
      <div className="space-y-2 p-4">
        <div className="text-[5px] font-semibold tracking-[0.2em] text-accent">02</div>
        <div className="font-display text-[9px]">Platform breakdown</div>
        {["ChatGPT", "Gemini", "Perplexity"].map((p) => (
          <div key={p} className="space-y-1 pt-1">
            <div className="text-[6px] font-semibold">{p}</div>
            <Meter w={p === "Gemini" ? "38%" : p === "ChatGPT" ? "22%" : "31%"} accent />
            <Bar w="90%" />
          </div>
        ))}
      </div>
    ),
  },
  {
    label: "Action plan",
    body: (
      <div className="space-y-2 p-4">
        <div className="text-[5px] font-semibold tracking-[0.2em] text-accent">04</div>
        <div className="font-display text-[9px]">Prioritised action plan</div>
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="flex gap-1.5 pt-1">
            <span className="text-[6px] font-semibold text-accent">{n}</span>
            <div className="flex-1 space-y-1">
              <Bar w="72%" dark />
              <Bar w="94%" />
            </div>
          </div>
        ))}
      </div>
    ),
  },
];

function Bar({ w, dark }: { w: string; dark?: boolean }) {
  return (
    <div
      className={`h-[3px] rounded-full ${dark ? "bg-foreground/35" : "bg-foreground/12"}`}
      style={{ width: w }}
    />
  );
}

function Meter({ w, accent }: { w: string; accent?: boolean }) {
  return (
    <div className="h-[5px] w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${accent ? "bg-accent" : "bg-foreground/30"}`} style={{ width: w }} />
    </div>
  );
}

export function ReportPreview() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {pages.map((page) => (
        <figure key={page.label} className="space-y-2">
          <div className="aspect-[210/297] overflow-hidden rounded-sm border border-border bg-card shadow-panel">
            {page.body}
          </div>
          <figcaption className="text-[11px] text-muted-foreground">{page.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}