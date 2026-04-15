import styles from './DatePicker.module.css';

interface Props {
  date: string;   // 'YYYY-MM-DD'
  onChange: (d: string) => void;
}

export default function DatePicker({ date, onChange }: Props) {
  return (
    <div className={styles.wrap}>
      <label className={styles.label}>Date</label>
      <input
        type="date"
        value={date}
        onChange={(e) => onChange(e.target.value)}
        className={styles.input}
      />
    </div>
  );
}
