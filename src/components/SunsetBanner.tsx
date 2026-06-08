import styles from './SunsetBanner.module.css';
import { useSunsetCountdown } from '../hooks/useSunsetCountdown';
import { formatDuration } from '../lib/formatDuration';

interface Props {
  dateStr: string;
  cityCentre: [number, number];
}

export function SunsetBanner({ dateStr, cityCentre }: Props) {
  const c = useSunsetCountdown(dateStr, cityCentre);
  if (!c) return null;

  let text: string;
  if (c.isToday) {
    text = c.afterSunset
      ? "Sun's down — see you tomorrow"
      : `☀️ ${formatDuration(c.minutesLeft)} of sun left`;
  } else {
    const hhmm = c.sunsetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    text = `☀️ Sunset at ${hhmm}`;
  }

  return <div className={styles.banner}>{text}</div>;
}
