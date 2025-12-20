// src/lib/riskUtils.ts
import type { RiskLevel } from './acwr';

export function getRiskLabel(level: RiskLevel): string {
  switch (level) {
    case 'high': return '高リスク';
    case 'caution': return '注意';
    case 'good': return '良好';
    case 'low': return '低負荷';
    case 'unknown': return '不明';
    default: return '不明';
  }
}

export function getRiskColor(riskLevel?: RiskLevel | null): string {
    switch (riskLevel) {
      case 'high':
        return '#EF4444';
      case 'caution':
        return '#F59E0B';
      case 'good':
        return '#10B981';
      case 'low':
        return '#3B82F6';
      default:
        return '#6B7280';
    }
  }