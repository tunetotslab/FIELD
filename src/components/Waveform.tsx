export function Waveform({
  peaks,
  start = 0,
  end = 1,
  live = false,
}: {
  peaks: number[];
  start?: number;
  end?: number;
  live?: boolean;
}) {
  const values = peaks.length ? peaks : [];
  return (
    <svg
      className={`waveform ${live ? "is-live" : ""}`}
      viewBox={`0 0 ${values.length} 100`}
      preserveAspectRatio="none"
      aria-label="Audio waveform"
      role="img"
    >
      {values.map((value, index) => {
        const position = index / Math.max(1, values.length - 1);
        return (
          <line
            key={index}
            x1={index + 0.5}
            x2={index + 0.5}
            y1={50 - Math.max(2, value * 45)}
            y2={50 + Math.max(2, value * 45)}
            stroke={
              position >= start && position <= end ? "#f531a4" : "#bcb8ba"
            }
            strokeWidth=".72"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}
