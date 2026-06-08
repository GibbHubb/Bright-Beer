import { useState } from 'react';
import type { VenueWithStatus } from '../lib/venueStatus';
import { isHiddenGem } from '../lib/hiddenGem';
import styles from './VenueList.module.css';

interface Props {
  venues: VenueWithStatus[];
  favouriteIds: Set<string>;
  onVenueClick: (v: VenueWithStatus) => void;
  onToggleFavourite: (id: string) => void;
}

export function VenueList({ venues, favouriteIds, onVenueClick, onToggleFavourite }: Props) {
  const [open, setOpen] = useState(false);

  const sunny = venues.filter(v => v.status === 'sunny');
  if (!sunny.length) return null;

  return (
    <div className={styles.wrap}>
      <button className={styles.toggle} onClick={() => setOpen(o => !o)}>
        {open ? '▾' : '▸'} {sunny.length} sunny spot{sunny.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <ul className={styles.list}>
          {sunny.map(v => {
            const fav = favouriteIds.has(v.id);
            const gem = isHiddenGem({ isSunnyNow: true, favCount: fav ? 1 : 0 });
            return (
              <li key={v.id} className={styles.item}>
                <button className={styles.name} onClick={() => onVenueClick(v)}>
                  {gem && <span className={styles.gem} title="Hidden gem — sunny and undiscovered">💎</span>}
                  {v.name}
                </button>
                <button
                  className={`${styles.fav} ${fav ? styles.favActive : ''}`}
                  onClick={() => onToggleFavourite(v.id)}
                  title={fav ? 'Remove favourite' : 'Add favourite'}
                >
                  {fav ? '★' : '☆'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
