export function UiIcon({
  name,
}: {
  name:
    | "discard"
    | "confirm"
    | "trim"
    | "split"
    | "loop"
    | "fade"
    | "plus"
    | "minus";
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "discard")
    return <svg {...common}><path d="M9 7 4 12l5 5M4 12h11.5a4.5 4.5 0 0 0 0-9H13" /></svg>;
  if (name === "confirm")
    return <svg {...common}><path d="m5 12.5 4.2 4.2L19 7" /></svg>;
  if (name === "trim")
    return <svg {...common}><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="m8.2 7.2 10.3 7.1M8.2 16.8 18.5 9.7" /></svg>;
  if (name === "split")
    return <svg {...common}><path d="M12 4v16M4 12h16" /></svg>;
  if (name === "loop")
    return <svg {...common}><path d="M17.5 7H8a4 4 0 0 0-4 4v1M15 4.5 17.5 7 15 9.5M6.5 17H16a4 4 0 0 0 4-4v-1M9 14.5 6.5 17 9 19.5" /></svg>;
  if (name === "fade")
    return <svg {...common}><path d="M4 17h16M5 15c4.5 0 5.5-7 14-7" /></svg>;
  if (name === "plus")
    return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  return <svg {...common}><path d="M5 12h14" /></svg>;
}
