import { Progress } from '@/components/ui/progress';
import { getUsageColorClasses } from '@/lib/usage-utils';
import type { UsageStatusColor } from '@/types/usage';

interface UsageProgressBarProps {
  used: number;
  limit: number;
  color: UsageStatusColor;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function UsageProgressBar({
  used,
  limit,
  color,
  showLabel = true,
  size = 'md',
}: UsageProgressBarProps) {
  const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0;
  const colorClasses = getUsageColorClasses(color);

  const heightClass = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  }[size];

  return (
    <div className="space-y-2">
      {showLabel && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Messages Used</span>
          <span className={`font-semibold ${colorClasses.text}`}>
            {used.toLocaleString()} / {limit.toLocaleString()}
          </span>
        </div>
      )}
      <div className={`relative ${heightClass} w-full overflow-hidden rounded-full bg-gray-200`}>
        <div
          className={`${heightClass} ${colorClasses.progress} transition-all duration-300 ease-in-out`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{percentage}% used</span>
          <span>{Math.max(0, limit - used).toLocaleString()} remaining</span>
        </div>
      )}
    </div>
  );
}






