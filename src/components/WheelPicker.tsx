import { useRef, useEffect } from "react";
import styles from "./WheelPicker.module.css";

export interface WheelPickerItem { label: string; value: number; }

interface Props {
  items: WheelPickerItem[];
  value: number;
  onChange: (value: number) => void;
  visibleCount?: number;
  itemHeight?: number;
}

export default function WheelPicker({
  items,
  value,
  onChange,
  visibleCount = 5,
  itemHeight = 44,
}: Props) {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const spinningRef = useRef(false);
  const timerRef   = useRef<ReturnType<typeof setTimeout>>();
  const itemsRef   = useRef(items);
  const valueRef   = useRef(value);
  itemsRef.current = items;
  valueRef.current = value;

  const padding     = Math.floor(visibleCount / 2) * itemHeight;
  const selectedIdx = items.findIndex(it => it.value === value);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || selectedIdx < 0) return;
    const top = selectedIdx * itemHeight;
    if (!mountedRef.current) {
      el.scrollTop = top;
      mountedRef.current = true;
    } else if (!spinningRef.current && Math.abs(el.scrollTop - top) > 2) {
      el.scrollTo({ top, behavior: "smooth" });
    }
  }, [selectedIdx, itemHeight]);

  useEffect(() => () => { clearTimeout(timerRef.current); }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    spinningRef.current = true;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      spinningRef.current = false;
      const idx = Math.max(0, Math.min(itemsRef.current.length - 1, Math.round(el.scrollTop / itemHeight)));
      const picked = itemsRef.current[idx];
      if (picked && picked.value !== valueRef.current) onChange(picked.value);
    }, 120);
  };

  return (
    <div className={styles.wrapper} style={{ height: visibleCount * itemHeight }}>
      <div className={styles.highlight} style={{ top: padding, height: itemHeight }} />
      <div ref={scrollRef} className={styles.scroller} onScroll={handleScroll}>
        <div style={{ height: padding }} />
        {items.map(item => (
          <div
            key={item.value}
            className={`${styles.item} ${item.value === value ? styles.itemSelected : ""}`}
            style={{ height: itemHeight }}
          >
            {item.label}
          </div>
        ))}
        <div style={{ height: padding }} />
      </div>
    </div>
  );
}
