import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { WeightBadge } from '../components/WeightBadge.js';
import { ScriptChain } from '../components/ScriptChain.js';
import { DetectionTable } from '../components/DetectionTable.js';
import type { Detection, ScanAdSlot } from '../types.js';
import { getTierLabel } from '../types.js';

export function DetectionDetail() {
  const { id } = useParams<{ id: string }>();
  const [detection, setDetection] = useState<Detection | null>(null);
  const [related, setRelated] = useState<Detection[]>([]);
  const [adSlot, setAdSlot] = useState<ScanAdSlot | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getDetection(Number(id)).then(d => {
      setDetection(d);
      if (d.source_script_url) {
        api.listDetectionsByScript(d.source_script_url).then(r => setRelated(r.data.filter(rd => rd.id !== d.id)));
      }
      if (d.ad_slot_id) {
        api.listAdSlots(d.scan_id).then(slots => {
          const match = slots.find(s => s.id === d.ad_slot_id);
          if (match) setAdSlot(match);
        });
      }
    });
  }, [id]);

  if (!detection) return <div className="text-gray-400">Loading...</div>;

  const chain: string[] = detection.initiator_chain ? JSON.parse(detection.initiator_chain) : [];
  const details = detection.details ? JSON.parse(detection.details) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-gray-400 hover:text-white">&larr; Dashboard</Link>
        <h1 className="mt-2 text-xl font-bold">{detection.signal_name}</h1>
        <div className="mt-1 flex items-center gap-3">
          <span className="text-sm text-gray-400">{detection.category}</span>
          <WeightBadge weight={detection.weight} />
          <span className="text-sm text-gray-500">{getTierLabel(detection.weight)}</span>
          <span className="text-xs text-gray-500">{new Date(detection.detected_at).toLocaleString()}</span>
        </div>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <h2 className="mb-2 text-sm font-medium text-gray-400">Source Script</h2>
        <div className="font-mono text-sm break-all">{detection.source_script_url || 'unknown'}</div>
        {detection.source_script_hash && <div className="mt-1 text-xs text-gray-500">SHA-256: {detection.source_script_hash}</div>}
      </div>

      {adSlot && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h2 className="mb-2 text-sm font-medium text-gray-400">Ad Context</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-500">Provider</dt><dd>{adSlot.provider}</dd>
            <dt className="text-gray-500">Slot</dt><dd>{adSlot.slot_id}</dd>
            {adSlot.creative_id && <><dt className="text-gray-500">Creative ID</dt><dd>{adSlot.creative_id}</dd></>}
            {adSlot.advertiser_id && <><dt className="text-gray-500">Advertiser ID</dt><dd>{adSlot.advertiser_id}</dd></>}
            {adSlot.bidder && <><dt className="text-gray-500">Bidder</dt><dd>{adSlot.bidder}</dd></>}
            {adSlot.bid_price != null && <><dt className="text-gray-500">Bid Price</dt><dd>${adSlot.bid_price.toFixed(2)}</dd></>}
            {adSlot.wrapper_chain && <><dt className="text-gray-500">VAST Chain</dt><dd className="font-mono text-xs break-all">{adSlot.wrapper_chain}</dd></>}
          </dl>
        </div>
      )}

      {chain.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h2 className="mb-2 text-sm font-medium text-gray-400">Initiator Chain</h2>
          <ScriptChain chain={chain} />
        </div>
      )}

      {detection.stack_trace && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h2 className="mb-2 text-sm font-medium text-gray-400">Stack Trace</h2>
          <pre className="overflow-x-auto whitespace-pre text-xs text-gray-300">{detection.stack_trace}</pre>
        </div>
      )}

      {details && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h2 className="mb-2 text-sm font-medium text-gray-400">Details</h2>
          <pre className="overflow-x-auto whitespace-pre text-xs text-gray-300">{JSON.stringify(details, null, 2)}</pre>
        </div>
      )}

      {related.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h2 className="mb-4 text-sm font-medium text-gray-400">Related Detections (same script)</h2>
          <DetectionTable detections={related} />
        </div>
      )}
    </div>
  );
}
