import { useState } from 'react';
import type { BestWindow } from '../lib/bestWindow';
import styles from './BestWindowBanner.module.css';

interface Props {
  window: BestWindow | null;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtTime(min: number) { return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; }

export default function BestWindowBanner({ window: bw }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (!bw || dismissed) return null;

  return (
    <div className={styles.banner}>
      <span className={styles.text}>
        ☀ Best window: <strong>{fmtTime(bw.startMin)} – {fmtTime(bw.endMin)}</strong> at <strong>{bw.venue.name}</strong>
      </span>
      <button className={styles.close} onClick={() => setDismissed(true)}>✕</button>
    </div>
  );
}
