import axios from 'axios';
import * as Storage from './storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

export const TOKEN_KEY = 'hisword_token';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
});

api.interceptors.request.use(async (config) => {
  const token = await Storage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type User = {
  id: string;
  email: string;
  name?: string;
  bible_translation: 'NIV' | 'KJV';
  verses_used: number;
  free_verses_remaining: number;
  subscription_status: 'free' | 'trialing' | 'active' | 'expired';
  is_premium: boolean;
  current_period_end?: string | null;
};
export type AuthResponse = { access_token: string; token_type: string; user: User };
export type VerseMatch = {
  id: string;
  problem: string;
  reference: string;
  verse_text: string;
  explanation: string;
  created_at: string;
};
export type DailyVerse = {
  reference: string;
  verse_text: string;
  explanation: string;
  date: string;
};

export const formatError = (err: any): string => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((e: any) => (e?.msg ? e.msg : JSON.stringify(e))).join(' ');
  }
  return err?.message || 'Something went wrong. Please try again.';
};
