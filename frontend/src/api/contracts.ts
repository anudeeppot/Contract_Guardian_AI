import { apiClient } from './client';
import type { ContractFile } from '../types';

export async function listContracts() {
  const { data } = await apiClient.get<ContractFile[]>('/contracts');
  return data;
}

export async function uploadContract(file: File, onUploadProgress?: (progress: number) => void) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<{ contract: ContractFile }>('/contracts/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (!event.total) return;
      onUploadProgress?.(Math.round((event.loaded / event.total) * 100));
    },
  });
  return data.contract;
}

export async function extractText(contractId: string) {
  const { data } = await apiClient.post<ContractFile>(`/contracts/${contractId}/extract-text`);
  return data;
}

export async function getContractText(contractId: string) {
  const { data } = await apiClient.get<{ contract_id: string; text: string }>(`/contracts/${contractId}/text`);
  return data;
}

export async function deleteContract(contractId: string) {
  await apiClient.delete(`/contracts/${contractId}`);
}
