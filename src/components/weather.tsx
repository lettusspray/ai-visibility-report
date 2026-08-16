import type { SVGProps } from "react";

/** Thin-line weather-map marks. Stroke inherits currentColor. */
export function SunMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" {...props}>
      <circle cx="24" cy="24" r="8" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <line
            key={i}
            x1={24 + Math.cos(a) * 13}
            y1={24 + Math.sin(a) * 13}
            x2={24 + Math.cos(a) * 18}
            y2={24 + Math.sin(a) * 18}
          />
        );
      })}
    </svg>
  );
}

export function CloudMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" {...props}>
      <path d="M14 33h19a7 7 0 0 0 .6-13.97A11 11 0 0 0 12.4 21.4 6.8 6.8 0 0 0 14 33Z" />
    </svg>
  );
}

export function SunBehindCloudMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" {...props}>
      <circle cx="31" cy="17" r="6" />
      <line x1="31" y1="5" x2="31" y2="8" />
      <line x1="41" y1="8" x2="39" y2="10" />
      <line x1="44" y1="17" x2="41" y2="17" />
      <path d="M12 36h17a6.5 6.5 0 0 0 .6-12.97A10.5 10.5 0 0 0 10.6 24.7 6.4 6.4 0 0 0 12 36Z" />
    </svg>
  );
}

export function IsobarMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" {...props}>
      <path d="M4 34c6-10 14-14 22-12s12 8 18 6" />
      <path d="M4 26c6-10 14-14 22-12s12 8 18 6" opacity={0.6} />
      <path d="M4 42c6-10 14-14 22-12s12 8 18 6" opacity={0.35} />
    </svg>
  );
}

export function RainMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" {...props}>
      <path d="M13 28h18a6.5 6.5 0 0 0 .6-12.97A10.5 10.5 0 0 0 11.6 16.7 6.4 6.4 0 0 0 13 28Z" />
      <line x1="17" y1="34" x2="15" y2="40" />
      <line x1="25" y1="34" x2="23" y2="40" />
      <line x1="33" y1="34" x2="31" y2="40" />
    </svg>
  );
}

/** Animated cloud that drifts away to reveal a sun once `done` is true. */
export function ClearingSky({ done, label }: { done?: boolean; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="relative h-24 w-40">
        <SunMark
          className={`absolute left-1/2 top-1 h-20 w-20 -translate-x-1/2 text-accent transition-all duration-1000 ${
            done ? "scale-100 opacity-100" : "scale-90 opacity-30"
          }`}
        />
        <CloudMark
          className={`absolute top-3 h-20 w-20 text-storm transition-all duration-1000 ease-out ${
            done ? "left-[120%] opacity-0" : "left-4 opacity-90 animate-[drift_4s_ease-in-out_infinite]"
          }`}
        />
        <CloudMark
          className={`absolute top-8 h-16 w-16 text-border transition-all duration-1000 ease-out ${
            done ? "-left-24 opacity-0" : "left-16 opacity-80 animate-[drift_5.5s_ease-in-out_infinite_reverse]"
          }`}
        />
      </div>
      {label ? <p className="text-sm text-muted-foreground">{label}</p> : null}
    </div>
  );
}
