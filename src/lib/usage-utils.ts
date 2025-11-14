// Usage tracking utilities

import type { UsageStats, UsageStatusColor, UsageIndicatorData } from '@/types/usage';

/**
 * Calculate usage percentage
 */
export const calculateUsagePercentage = (used: number, limit: number): number => {
  if (limit === 0) return 0;
  return Math.round((used / limit) * 100);
};

/**
 * Calculate remaining messages
 */
export const calculateRemaining = (used: number, limit: number): number => {
  return Math.max(0, limit - used);
};

/**
 * Get usage status color based on percentage
 */
export const getUsageColor = (percentage: number): UsageStatusColor => {
  if (percentage >= 80) return 'red';
  if (percentage >= 50) return 'yellow';
  return 'green';
};

/**
 * Get usage indicator data
 */
export const getUsageIndicatorData = (
  messagesUsed: number,
  messagesLimit: number
): UsageIndicatorData => {
  const remaining = calculateRemaining(messagesUsed, messagesLimit);
  const percentage = calculateUsagePercentage(messagesUsed, messagesLimit);
  const color = getUsageColor(percentage);

  return {
    messages_used: messagesUsed,
    messages_limit: messagesLimit,
    messages_remaining: remaining,
    percentage,
    color,
  };
};

/**
 * Format usage text for display
 */
export const formatUsageText = (used: number, limit: number): string => {
  return `${used.toLocaleString()} / ${limit.toLocaleString()}`;
};

/**
 * Format percentage for display
 */
export const formatPercentage = (percentage: number): string => {
  return `${percentage}%`;
};

/**
 * Check if usage limit is exceeded
 */
export const isUsageLimitExceeded = (used: number, limit: number): boolean => {
  return used >= limit;
};

/**
 * Check if usage is approaching limit (>80%)
 */
export const isApproachingLimit = (used: number, limit: number): boolean => {
  const percentage = calculateUsagePercentage(used, limit);
  return percentage >= 80 && percentage < 100;
};

/**
 * Get warning message based on usage
 */
export const getUsageWarningMessage = (used: number, limit: number): string | null => {
  if (isUsageLimitExceeded(used, limit)) {
    return 'You have reached your message limit. Please upgrade your plan to continue.';
  }
  
  if (isApproachingLimit(used, limit)) {
    const remaining = calculateRemaining(used, limit);
    return `You have ${remaining} message${remaining === 1 ? '' : 's'} remaining. Consider upgrading your plan.`;
  }

  return null;
};

/**
 * Format date range for period display
 */
export const formatPeriodRange = (start: string, end: string): string => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  const options: Intl.DateTimeFormatOptions = { 
    month: 'short', 
    day: 'numeric',
    year: startDate.getFullYear() !== endDate.getFullYear() ? 'numeric' : undefined
  };
  
  return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
};

/**
 * Calculate days remaining in period
 */
export const getDaysRemainingInPeriod = (periodEnd: string): number => {
  const end = new Date(periodEnd);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

/**
 * Format days remaining text
 */
export const formatDaysRemaining = (periodEnd: string): string => {
  const days = getDaysRemainingInPeriod(periodEnd);
  if (days === 0) return 'Resets today';
  if (days === 1) return 'Resets tomorrow';
  return `Resets in ${days} days`;
};

/**
 * Get Tailwind color classes for usage status
 */
export const getUsageColorClasses = (color: UsageStatusColor): {
  bg: string;
  text: string;
  border: string;
  progress: string;
} => {
  switch (color) {
    case 'red':
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        progress: 'bg-red-500',
      };
    case 'yellow':
      return {
        bg: 'bg-yellow-50',
        text: 'text-yellow-700',
        border: 'border-yellow-200',
        progress: 'bg-yellow-500',
      };
    case 'green':
    default:
      return {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        progress: 'bg-green-500',
      };
  }
};






