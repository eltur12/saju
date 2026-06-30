import WheelPicker from "./WheelPicker";
import type { WheelPickerItem } from "./WheelPicker";
import styles from "./WheelPickerModal.module.css";

interface Column {
  items: WheelPickerItem[];
  value: number;
  onChange: (value: number) => void;
}

interface Props {
  open: boolean;
  title: string;
  columns: Column[];
  onClose: () => void;
  onConfirm: () => void;
}

export default function WheelPickerModal({ open, title, columns, onClose, onConfirm }: Props) {
  if (!open) return null;
  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.sheet}>
        <div className={styles.handle} />
        <div className={styles.header}>
          <button className={styles.cancelBtn} onClick={onClose}>취소</button>
          <span className={styles.title}>{title}</span>
          <button className={styles.confirmBtn} onClick={onConfirm}>확인</button>
        </div>
        <div className={styles.pickerRow}>
          {columns.map((col, i) => (
            <WheelPicker key={i} {...col} />
          ))}
        </div>
      </div>
    </>
  );
}
