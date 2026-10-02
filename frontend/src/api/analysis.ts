import { apiClient } from './client';
import type { Analysis, RewriteClauseResponse } from '../types';

export async function getAnalysis(analysisId: string) {
  const { data } = await apiClient.get<Analysis>(`/analyses/${analysisId}`);
  return data;
}

export async function getLatestAnalysis(contractId: string) {
  const { data } = await apiClient.get<Analysis>(`/contracts/${contractId}/analysis`);
  return data;
}

export async function startAnalysis(contractId: string) {
  const { data } = await apiClient.post<Analysis>('/analyze', { contractId });
  window.localStorage.setItem('contract_guardian_last_analysis', JSON.stringify(data));
  return data;
}

export async function rewriteClause(clause: string, riskContext?: string) {
  const { data } = await apiClient.post<RewriteClauseResponse>('/rewrite-clause', {
    clause,
    riskContext,
  });
  return data;
}

export async function downloadReport(analysisId: string, format: 'json' | 'markdown' | 'pdf') {
  const { data } = await apiClient.post<Blob>(
    '/download-report',
    { analysisId, format },
    { responseType: 'blob' },
  );
  return data;
}

export async function getHistory() {
  const { data } = await apiClient.get<Analysis[]>('/history');
  return data;
}
