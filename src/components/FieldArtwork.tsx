import { useId } from 'react';
import type { EffectId } from '../types';

const effects = import.meta.glob('../assets/effects/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** Transparent chrome renders derived from the FIELD material reference. */
export function FxArtwork({ effect }: { effect: EffectId }) {
  return <img className="effect-art" src={effects[`../assets/effects/${effect}.webp`]} alt="" width="320" height="320" decoding="async"/>;
}

export function FieldGlobe() {
  const id = useId().replace(/:/g, '');
  return <svg className="world-planet" viewBox="0 0 360 360" role="img" aria-label="A glossy pink globe with stylized continents">
    <defs>
      <radialGradient id={`${id}o`} cx="30%" cy="23%" r="80%"><stop stopColor="#fff8fd"/><stop offset=".34" stopColor="#ffd3ed"/><stop offset=".72" stopColor="#ff8acc"/><stop offset="1" stopColor="#e545a6"/></radialGradient>
      <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffeaf7"/><stop offset=".35" stopColor="#fc87cb"/><stop offset=".8" stopColor="#f344ad"/><stop offset="1" stopColor="#cc238a"/></linearGradient>
      <radialGradient id={`${id}h`} cx="30%" cy="18%" r="70%"><stop stopColor="white" stopOpacity=".68"/><stop offset=".45" stopColor="white" stopOpacity="0"/><stop offset="1" stopColor="#98035f" stopOpacity=".14"/></radialGradient>
      <clipPath id={`${id}c`}><circle cx="180" cy="180" r="164"/></clipPath>
    </defs>
    <circle cx="180" cy="180" r="164" fill={`url(#${id}o)`}/>
    <g clipPath={`url(#${id}c)`}>
      <g fill="none" stroke="white" strokeOpacity=".28" strokeWidth=".8"><ellipse cx="180" cy="180" rx="75" ry="164"/><ellipse cx="180" cy="180" rx="135" ry="164"/><ellipse cx="180" cy="180" rx="164" ry="57"/><ellipse cx="180" cy="180" rx="164" ry="116"/></g>
      <g fill={`url(#${id}l)`} stroke="#ffdfef" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M6 94L29 69L52 62L60 42L87 33L109 45L120 65L111 81L92 80L87 95L103 106L91 120L68 116L64 138L52 144L53 163L72 177L81 183L86 196L71 197L62 181L44 174L28 150L12 137Z"/>
        <path d="M73 195L97 195L116 208L136 220L135 237L122 249L122 266L106 280L99 306L85 324L78 308L79 280L66 255L69 237L59 217Z"/>
        <path d="M125 38L143 26L162 29L168 43L154 62L140 66L128 54Z"/>
        <path d="M175 103L188 94L197 74L211 69L216 85L208 97L223 101L233 91L242 97L239 110L251 116L260 103L277 111L290 124L317 128L327 148L319 165L298 170L284 188L268 183L255 164L244 167L238 151L223 148L215 133L201 141L186 133L172 136L163 124Z"/>
        <path d="M193 90L202 70L218 52L236 44L260 55L277 56L287 76L311 86L341 119L343 146L328 144L316 126L290 124L277 111L260 103L249 112L235 95L222 100L209 96L216 85L211 69Z"/>
        <path d="M177 145L199 141L219 154L222 175L237 181L228 202L217 216L211 240L197 258L184 249L180 227L167 208L154 197L151 174L160 155Z"/>
        <path d="M228 232L237 220L240 238L232 255L224 253Z"/>
        <path d="M261 251L281 240L299 243L310 232L324 249L327 269L309 284L287 280L269 286L258 270Z"/>
        <path d="M275 194L288 200L294 213L313 218L310 225L291 220L280 212L270 207Z"/>
        <path d="M324 290L334 277L340 286L330 302Z"/>
      </g>
      <circle cx="180" cy="180" r="164" fill={`url(#${id}h)`}/>
    </g>
    <circle cx="180" cy="180" r="163" fill="none" stroke="white" strokeOpacity=".65" strokeWidth="2"/>
  </svg>;
}
