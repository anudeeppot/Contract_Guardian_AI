import type { RiskLevel } from '../../types';
import { riskColor } from '../../utils/format';

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold uppercase ${riskColor[level]}`}>
      {level}
    </span>
  );
}
