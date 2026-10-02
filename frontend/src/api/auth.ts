import { apiClient } from './client';
import type { AuthResponse, User } from '../types';

export async function login(email: string, password: string) {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  persistAuth(data);
  return data;
}

export async function signup(fullName: string, email: string, password: string) {
  const { data } = await apiClient.post<AuthResponse>('/auth/signup', { fullName, email, password });
  persistAuth(data);
  return data;
}

export async function getMe() {
  const { data } = await apiClient.get<User>('/auth/me');
  return data;
}

export function persistAuth(data: AuthResponse) {
  window.localStorage.setItem('contract_guardian_token', data.accessToken);
  window.localStorage.setItem('contract_guardian_refresh', data.refreshToken);
  window.localStorage.setItem('contract_guardian_user', JSON.stringify(data.user));
}

export function logout() {
  window.localStorage.removeItem('contract_guardian_token');
  window.localStorage.removeItem('contract_guardian_refresh');
  window.localStorage.removeItem('contract_guardian_user');
}

export function isAuthenticated() {
  return Boolean(window.localStorage.getItem('contract_guardian_token'));
}
