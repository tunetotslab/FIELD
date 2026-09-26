import { useId } from 'react';

export function Waveform({ peaks, start = 0, end = 1, live = false }: { peaks: number[]; start?: number; end?: number; live?: boolean }) {
  const id = useId();
  const values = peaks.length ? peaks : Array.from({ length: 80 }, () => .04);
  return <svg className={`waveform ${live ? 'is-live' : ''}`} viewBox={`0 0 ${values.length} 100`} preserveAspectRatio="none" aria-label="Audio waveform" role="img">
    <defs><linearGradient id={id} x1="0" x2="1"><stop offset={`${start * 100}%`} stopColor="#f531a4"/><stop offset={`${start * 100}%`} stopColor="#f531a4"/><stop offset={`${end * 100}%`} stopColor="#f531a4"/><stop offset={`${end * 100}%`} stopColor="#bcb8ba"/></linearGradient></defs>
    {values.map((value, index) => <line key={index} x1={index + .5} x2={index + .5} y1={50 - Math.max(2, value * 45)} y2={50 + Math.max(2, value * 45)} stroke={`url(#${id})`} strokeWidth=".72" strokeLinecap="round" />)}
  </svg>;
}
