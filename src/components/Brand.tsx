import tuneTotsLogo from '../assets/brand/tune-tots-transparent.png';
import fieldWordmark from '../assets/brand/field-wordmark-grass.png';
import mileyRecord from '../assets/mascot/miley-record-v2.png';
import mileyWorld from '../assets/mascot/miley-world-v2.png';

export function TuneTotsLogo({ compact = false }: { compact?: boolean }) {
  return <img className={`brand-logo ${compact ? 'is-compact' : ''}`} src={tuneTotsLogo} alt="Tune Tots" />;
}

export function FieldWordmark() {
  return <img className="field-wordmark" src={fieldWordmark} alt="FIELD" />;
}

export function Miley({ state }: { state: 'record' | 'world' }) {
  const source = state === 'record' ? mileyRecord : mileyWorld;
  return <img className={`miley-art miley-${state}`} src={source} alt={state === 'record' ? 'Miley holding a field recorder' : 'Miley making music'} />;
}
