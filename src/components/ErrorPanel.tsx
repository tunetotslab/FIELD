export function ErrorPanel({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="error-panel" role="alert"><strong>Something got quiet.</strong><p>{message}</p>{retry && <button className="secondary-button" onClick={retry}>TRY AGAIN</button>}</div>;
}
