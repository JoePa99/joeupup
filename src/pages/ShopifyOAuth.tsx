import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShopifyOAuthButton } from '@/components/auth/ShopifyOAuthButton';
import { CheckCircle, XCircle, ArrowLeft, Package, ShoppingCart, Users, BarChart3, FileText, Settings } from 'lucide-react';

export default function ShopifyOAuth() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [integration, setIntegration] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkIntegration = async () => {
      if (!user) return;

      try {
        const { data, error } = await (supabase as any)
          .from('shopify_integrations')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking Shopify integration:', error);
        } else {
          setIntegration(data);
        }
      } catch (error) {
        console.error('Error checking Shopify integration:', error);
      } finally {
        setLoading(false);
      }
    };

    checkIntegration();
  }, [user]);

  const handleSuccess = () => {
    toast({
      title: "Shopify Connected Successfully!",
      description: "Your Shopify store has been connected and is ready to use.",
    });
    navigate('/integrations');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/integrations')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Integrations
          </Button>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <svg className="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.337 23.979c-.35 0-.665-.133-.905-.35l-6.177-5.52-2.52 1.95c-.403.308-.92.462-1.44.462-.35 0-.7-.07-1.02-.21l-3.12-1.31c-.77-.32-1.26-1.08-1.26-1.9V3.09c0-.82.49-1.58 1.26-1.9l3.12-1.31c.32-.14.67-.21 1.02-.21.52 0 1.04.15 1.44.46l2.52 1.95 6.177-5.52c.24-.22.555-.35.905-.35.35 0 .665.13.905.35l6.177 5.52 2.52-1.95c.403-.31.92-.46 1.44-.46.35 0 .7.07 1.02.21l3.12 1.31c.77.32 1.26 1.08 1.26 1.9v13.35c0 .82-.49 1.58-1.26 1.9l-3.12 1.31c-.32.14-.67.21-1.02.21-.52 0-1.04-.15-1.44-.46l-2.52-1.95-6.177 5.52c-.24.22-.555.35-.905.35z"/>
                </svg>
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">
              Connect Shopify Store
            </CardTitle>
            <CardDescription className="text-gray-600">
              Connect your Shopify store to enable AI agents to access your e-commerce data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {integration ? (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-green-800">
                    Shopify Store Already Connected
                  </h3>
                  <p className="text-sm text-gray-600 mt-2">
                    Your Shopify store is already connected and ready to use.
                  </p>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center justify-center space-x-2">
                    {integration.products_enabled ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span>Products</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    {integration.orders_enabled ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span>Orders</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    {integration.customers_enabled ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span>Customers</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    {integration.inventory_enabled ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span>Inventory</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    {integration.analytics_enabled ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span>Analytics</span>
                  </div>
                </div>
                <Button
                  onClick={() => navigate('/integrations')}
                  className="w-full"
                >
                  Go to Integrations
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p className="mb-2">
                    By connecting Shopify, you'll enable AI agents to:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Manage products and inventory</li>
                    <li>Process and track orders</li>
                    <li>Analyze customer data</li>
                    <li>Generate sales reports</li>
                    <li>Optimize store performance</li>
                  </ul>
                </div>
                
                <ShopifyOAuthButton 
                  onSuccess={handleSuccess}
                  className="w-full"
                  size="lg"
                />
                
                <div className="text-xs text-gray-500 text-center">
                  Your store data is secure and only accessible by your AI agents.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
