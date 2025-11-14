import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useUsage } from '@/hooks/useUsage';
import { getUsageIndicatorData, getUsageColorClasses } from '@/lib/usage-utils';
import { Skeleton } from '@/components/ui/skeleton';

export function UsageIndicator() {
  const navigate = useNavigate();
  const { usage, isLoading, error } = useUsage();
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 p-3 bg-white">
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-2 w-full" />
      </div>
    );
  }

  if (error || !usage) {
    return (
      <div className="rounded-lg border border-gray-200 p-3 bg-white">
        <div className="flex items-center gap-2 text-sm text-yellow-700">
          <AlertTriangle className="h-4 w-4" />
          <span>Unable to load usage data</span>
        </div>
      </div>
    );
  }

  const indicatorData = getUsageIndicatorData(
    usage.messages_used,
    usage.messages_limit
  );

  return (
    <div 
      className="rounded-lg border border-gray-200 p-3 bg-white cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={() => navigate('/client-dashboard/usage')}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-900">
              {indicatorData.messages_remaining.toLocaleString()} left
            </span>
          </div>
          <span className="text-xs text-gray-500">
            {indicatorData.percentage}%
          </span>
        </div>
        
        <Progress 
          value={indicatorData.percentage} 
          className="h-1.5 bg-gray-200"
        />

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{indicatorData.messages_used.toLocaleString()} / {indicatorData.messages_limit.toLocaleString()} messages</span>
          <Button 
            variant="link" 
            size="sm" 
            className="h-auto p-0 text-gray-600 hover:text-gray-800"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/client-dashboard/usage');
            }}
          >
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
}





