export function ScriptChain({ chain }: { chain: string[] }) {
  if (chain.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs font-mono">
      {chain.map((url, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-gray-600">&rarr;</span>}
          <span className="rounded bg-gray-800 px-2 py-0.5 truncate max-w-xs" title={url}>{url}</span>
        </span>
      ))}
    </div>
  );
}
