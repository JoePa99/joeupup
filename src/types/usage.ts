// Usage tracking TypeScript types

export interface UserUsage {
  id: string;
  user_id: string;
  company_id: string;
  messages_used: number;
  messages_limit: number;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
}

export interface UsageStats {
  messages_used: number;
  messages_limit: number;
  messages_remaining: number;
  usage_percentage: number;
  period_start: string;
  period_end: string;
}

export interface UsageHistory {
  id: string;
  user_id: string;
  company_id: string;
  messages_used: number;
  messages_limit: number;
  period_start: string;
  period_end: string;
  archived_at: string;
}

export interface CompanyUsageStats {
  user_id: string;
  user_email: string;
  user_name: string;
  messages_used: number;
  messages_limit: number;
  usage_percentage: number;
  last_message_at: string | null;
}

export interface UsageError {
  code: string;
  message: string;
}

export type UsageStatusColor = 'green' | 'yellow' | 'red';

export interface UsageIndicatorData {
  messages_used: number;
  messages_limit: number;
  messages_remaining: number;
  percentage: number;
  color: UsageStatusColor;
}






