import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClockIcon } from "@heroicons/react/24/outline";

interface Activity {
  id: string;
  activity_type: string;
  activity_category: string;
  title: string;
  description: string | null;
  created_at: string;
  tags: string[] | null;
  metadata: any;
  agent_id: string | null;
  agents?: { name: string } | null;
}

interface ActivityFeedProps {
  limit?: number;
}

export function ActivityFeed({ limit = 10 }: ActivityFeedProps) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchActivities();
      subscribeToActivities();
    }
  }, [user, limit]);

  const fetchActivities = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) return;

      const { data, error } = await supabase
        .from('user_activities')
        .select(`
          id,
          activity_type,
          activity_category,
          title,
          description,
          created_at,
          tags,
          metadata,
          agent_id,
          agents(name)
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const subscribeToActivities = () => {
    const channel = supabase
      .channel('user_activities_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_activities'
        },
        () => {
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };


  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="p-6 text-center shadow-none border border-gray-200">
        <ClockIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No recent activity</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((activity) => (
        <Card key={activity.id} className="p-3 hover:shadow-sm transition-shadow shadow-none border border-gray-200">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground truncate">
                  {activity.title}
                </p>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatTimeAgo(activity.created_at)}
                </span>
              </div>
              {activity.description && (
                <p className="text-xs text-muted-foreground truncate mt-1">
                  {activity.description}
                </p>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
