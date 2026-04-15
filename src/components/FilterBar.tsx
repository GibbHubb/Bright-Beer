import React from 'react';
import styles from './FilterBar.module.css';

interface Props {
  sunnyCount: number;
  totalCount:  number;
  sunnyOnly:   boolean;
  onToggle:    () => void;
}

export default function FilterBar({ sunnyCount, totalCount, sunnyOnly, onToggle }: Props) {
  return (
    <div className={styles.bar}>
      <span className={styles.count}>
        <span className={styles.sunny}>{sunnyCount}</span>
        <span className={styles.muted}> / {totalCount} sunny</span>
      </span>
      <button
        className={`${styles.toggle} ${sunnyOnly ? styles.active : ''}`}
        onClick={onToggle}
      >
        ☀️ Sunny only
      </button>
    </div>
  );
}
