import type { ReactNode } from 'react';
import { TuneTotsLogo } from './Brand';

export function Shell({ children, title, back, right, nav, variant }: { children: ReactNode; title?: string; back?: () => void; right?: ReactNode; nav?: ReactNode; variant?: 'home' | 'world' | 'fx' }) {
  return <main className={`app-shell${variant ? ` shell-${variant}` : ''}`}>
    <div className="blob blob-a"/><div className="blob blob-b"/><div className="blob blob-c"/>
    <header className="app-header">
      <div className="header-side">{back && <button className="icon-button" onClick={back} aria-label="Go back">←</button>}</div>
      <TuneTotsLogo />
      <div className="header-side header-right">{right}</div>
    </header>
    {title && <h1 className="screen-title">{title}</h1>}
    <section className="screen-content">{children}</section>
    {nav}
  </main>;
}

export function BrandFooter() {
  return <div className="brand-footer"><TuneTotsLogo compact/><span>Made by<br/><strong>TUNE TOTS LAB</strong></span></div>;
}

export function BottomNav({ go, active }: { go: (screen: 'library' | 'daily' | 'map') => void; active?: string }) {
  return <nav className="bottom-nav" aria-label="Main navigation">
    {([['library','▣','LIBRARY'],['daily','☆','DAILY'],['map','◎','MAP']] as const).map(([screen, icon, label]) => <button className={active === screen ? 'active' : ''} key={screen} onClick={() => go(screen)}><span>{icon}</span>{label}</button>)}
  </nav>;
}
