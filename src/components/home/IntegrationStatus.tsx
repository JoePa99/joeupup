import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";

interface Integration {
  name: string;
  icon: JSX.Element;
  isConnected: boolean;
}

export function IntegrationStatus() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  useEffect(() => {
    if (user) {
      fetchIntegrations();
    }
  }, [user]);

  const fetchIntegrations = async () => {
    if (!user) return;

    try {
      // Fetch all integrations in parallel
      const [googleData, hubspotData, quickbooksData] = await Promise.all([
        supabase
          .from('google_integrations')
          .select('is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle(),
        (supabase as any)
          .from('hubspot_integrations')
          .select('is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle(),
        (supabase as any)
          .from('quickbooks_integrations')
          .select('is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle(),
      ]);

      setIntegrations([
        {
          name: "Google Workspace",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          ),
          isConnected: !!googleData.data,
        },
        {
          name: "HubSpot",
          icon: (
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13.107 13.099" preserveAspectRatio="xMidYMid">
              <path d="M12.027 6.222a3.33 3.33 0 0 0-1.209-1.201c-.382-.222-.777-.363-1.223-.424V3a1.17 1.17 0 0 0 .722-1.097 1.2 1.2 0 0 0-1.2-1.206 1.21 1.21 0 0 0-1.21 1.206c0 .49.26.908.707 1.097v1.588a3.49 3.49 0 0 0-1.064.334L3.275 1.685c.03-.113.056-.23.056-.353 0-.738-.598-1.336-1.336-1.336S.66.594.66 1.332s.598 1.336 1.336 1.336c.252 0 .485-.074.686-.195l.28.212L6.797 5.45c-.203.186-.392.398-.543.636-.306.485-.493 1.018-.493 1.6v.12a3.35 3.35 0 0 0 .21 1.156c.116.316.286.604.497.864l-1.274 1.277c-.377-.14-.8-.047-1.085.238-.194.193-.303.456-.302.73s.108.535.303.73.456.303.73.303.537-.108.73-.303.303-.456.302-.73a1.03 1.03 0 0 0-.048-.31l1.316-1.316c.18.125.375.23.585.32a3.42 3.42 0 0 0 1.369.288h.09c.552 0 1.073-.13 1.562-.395a3.23 3.23 0 0 0 1.224-1.153c.307-.49.475-1.033.475-1.63v-.03c0-.587-.136-1.128-.42-1.624zM10.42 8.984c-.357.397-.768.642-1.232.642H9.1c-.265 0-.525-.073-.778-.207a1.8 1.8 0 0 1-.682-.621c-.184-.26-.284-.544-.284-.845v-.09c0-.296.057-.577.2-.842.153-.3.36-.515.635-.694s.558-.265.88-.265h.03c.29 0 .567.057.827.19a1.75 1.75 0 0 1 .65.591 1.88 1.88 0 0 1 .291.83l.007.187c0 .407-.156.784-.467 1.126z" fill="#f8761f"/>
            </svg>
          ),
          isConnected: !!hubspotData.data,
        },
        {
          name: "QuickBooks",
          icon: (
            <svg className="h-5 w-5" enableBackground="new 0 0 2500 2500" viewBox="0 0 2500 2500" xmlns="http://www.w3.org/2000/svg">
              <circle cx="1250" cy="1250" fill="#2ca01c" r="1250"/>
              <path d="m301.3 1249.6c.1 282.6 228 512.4 510.6 514.9h72.3v-188.9h-72.3c-175.2 47.8-355.9-55.5-403.6-230.7-.4-1.4-.7-2.8-1.1-4.2-49.1-177.5 53.7-361.4 230.6-412.5h36.1c45.3-9.9 92.2-9.9 137.5 0h175.6v1002.9c-.9 106.1 84.4 192.9 190.5 193.9v-1395.4h-364.5c-284.6 1.5-514 233.4-512.5 518v.1zm1387.5-519.8h-72.3v198.9h72.3c174.8-47.7 355.1 55.3 402.8 230 .4 1.3.7 2.7 1.1 4 48.8 176.9-53.7 360.1-229.9 411.1h-36.1c-45.3 9.9-92.2 9.9-137.5 0h-175.6v-1002.8c.9-106.1-84.4-192.9-190.5-193.9v1397.4h364.5c287.1-4.5 516.2-240.8 511.8-527.9-4.4-280.8-230.9-507.4-511.8-511.8z" fill="#fff"/>
            </svg>
          ),
          isConnected: !!quickbooksData.data,
        },
      ]);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {integrations.map((integration, index) => (
        <Card key={index} className="p-4 hover:shadow-sm transition-shadow shadow-none border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {integration.icon}
              </div>
              <span className="text-sm font-medium text-foreground">
                {integration.name}
              </span>
            </div>
            <Badge 
              variant={integration.isConnected ? "default" : "secondary"}
              className={integration.isConnected ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}
            >
              {integration.isConnected ? (
                <>
                  <CheckCircleIcon className="h-3 w-3 mr-1" />
                  Connected
                </>
              ) : (
                <>
                  <XCircleIcon className="h-3 w-3 mr-1" />
                  Not Connected
                </>
              )}
            </Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}

