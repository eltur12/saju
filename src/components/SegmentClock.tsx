import styles from "./SegmentClock.module.css";

interface Segment {
  startHour: number;
  endHour:   number;
  score:     number;
}

interface Props {
  segments:        Segment[];
  selectedHour:    number | null;
  onSelect:        (startHour: number) => void;
  bestStartHour?:  number;
  worstStartHour?: number;
  overallScore:    number;
}

const CX = 120, CY = 120, R_OUT = 103, R_IN = 64, GAP = 1.5;
const IR_OUT = 58, IR_IN = 47, IR_MID = (IR_OUT + IR_IN) / 2;

function toRad(deg: number) { return (deg * Math.PI) / 180; }
function hourToDeg(h: number) { return (h / 24) * 360 - 90; }

function segAngles(seg: Segment) {
  return {
    sa: toRad(hourToDeg(seg.startHour) + GAP / 2),
    ea: toRad(hourToDeg(seg.endHour)   - GAP / 2),
    large: (seg.endHour - seg.startHour) > 12 ? 1 : 0,
  };
}

function wedgePath(seg: Segment): string {
  const { sa, ea, large } = segAngles(seg);
  const pt = (r: number, a: number) =>
    `${(CX + r * Math.cos(a)).toFixed(2)},${(CY + r * Math.sin(a)).toFixed(2)}`;
  return (
    `M ${pt(R_OUT, sa)} A ${R_OUT} ${R_OUT} 0 ${large} 1 ${pt(R_OUT, ea)} ` +
    `L ${pt(R_IN,  ea)} A ${R_IN}  ${R_IN}  0 ${large} 0 ${pt(R_IN,  sa)} Z`
  );
}

function outerArcPath(seg: Segment): string {
  const { sa, ea, large } = segAngles(seg);
  const ox = (a: number) => (CX + R_OUT * Math.cos(a)).toFixed(2);
  const oy = (a: number) => (CY + R_OUT * Math.sin(a)).toFixed(2);
  return `M ${ox(sa)},${oy(sa)} A ${R_OUT} ${R_OUT} 0 ${large} 1 ${ox(ea)},${oy(ea)}`;
}

function arcStroke(score: number, sel: boolean): string {
  const a = sel ? 0.90 : 0.60;
  if (score >= 70) return `rgba(58,171,140,${a})`;
  if (score >= 55) return `rgba(120,120,120,${a})`;
  return `rgba(224,92,92,${a})`;
}

function scoreTextColor(score: number): string {
  if (score >= 70) return "var(--accent-mint)";
  if (score >= 55) return "var(--text-muted)";
  return "var(--danger)";
}

function fmtH(h: number) { return String(h).padStart(2, "0"); }

function markerPos(startHour: number, endHour: number, r: number) {
  const midRad = toRad((hourToDeg(startHour) + hourToDeg(endHour)) / 2);
  return { x: CX + r * Math.cos(midRad), y: CY + r * Math.sin(midRad) };
}

export default function SegmentClock({
  segments, selectedHour, onSelect, bestStartHour, worstStartHour, overallScore,
}: Props) {
  return (
    <div className={styles.wrap}>
      <svg viewBox="0 0 240 240" className={styles.svg}>
        {/* Wedge fills — neutral */}
        {segments.map(seg => {
          const isSel  = seg.startHour === selectedHour;
          const midRad = toRad((hourToDeg(seg.startHour) + hourToDeg(seg.endHour)) / 2);
          const mr     = (R_OUT + R_IN) / 2;
          const tx     = CX + mr * Math.cos(midRad);
          const ty     = CY + mr * Math.sin(midRad);

          return (
            <g key={seg.startHour} onClick={() => onSelect(seg.startHour)} style={{ cursor: "pointer" }}>
              <path
                d={wedgePath(seg)}
                fill={isSel ? "rgba(180,180,180,0.13)" : "rgba(180,180,180,0.06)"}
                stroke="rgba(180,180,180,0.18)"
                strokeWidth="0.5"
              />
              <path
                d={outerArcPath(seg)}
                fill="none"
                stroke={arcStroke(seg.score, isSel)}
                strokeWidth={isSel ? 2.5 : 1.5}
                strokeLinecap="butt"
                style={{ pointerEvents: "none" }}
              />
              <text
                x={tx} y={ty - 5}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="11" fontWeight={isSel ? "700" : "500"}
                fill={scoreTextColor(seg.score)}
                style={{ pointerEvents: "none" }}
              >
                {seg.score}
              </text>
              <text
                x={tx} y={ty + 7}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="6.5" fontWeight="400"
                fill="var(--text-muted)" opacity={isSel ? "0.9" : "0.65"}
                style={{ pointerEvents: "none" }}
              >
                {fmtH(seg.startHour)}–{fmtH(seg.endHour)}
              </text>
            </g>
          );
        })}

        {/* Inner indicator ring track */}
        <circle
          cx={CX} cy={CY} r={IR_MID}
          fill="none"
          stroke="rgba(150,150,150,0.10)"
          strokeWidth={IR_OUT - IR_IN}
        />

        {/* Best marker */}
        {bestStartHour != null && (() => {
          const seg = segments.find(s => s.startHour === bestStartHour);
          if (!seg) return null;
          const { x, y } = markerPos(seg.startHour, seg.endHour, IR_MID);
          return (
            <circle key="best" cx={x} cy={y} r={4}
              fill="rgba(58,171,140,0.85)"
              stroke="rgba(58,171,140,0.35)" strokeWidth="0.8" />
          );
        })()}

        {/* Worst marker */}
        {worstStartHour != null && (() => {
          const seg = segments.find(s => s.startHour === worstStartHour);
          if (!seg) return null;
          const { x, y } = markerPos(seg.startHour, seg.endHour, IR_MID);
          return (
            <circle key="worst" cx={x} cy={y} r={4}
              fill="rgba(224,92,92,0.85)"
              stroke="rgba(224,92,92,0.35)" strokeWidth="0.8" />
          );
        })()}

        {/* Center: overall score */}
        <text x={CX} y={CY - 11} textAnchor="middle" dominantBaseline="middle"
          fontSize="7" fill="var(--text-muted)" fontWeight="400" opacity="0.8">
          오늘의 흐름
        </text>
        <text x={CX} y={CY + 12} textAnchor="middle" dominantBaseline="middle"
          fontSize="22" fontWeight="700" fill={scoreTextColor(overallScore)}>
          {overallScore}
        </text>
      </svg>
    </div>
  );
}
