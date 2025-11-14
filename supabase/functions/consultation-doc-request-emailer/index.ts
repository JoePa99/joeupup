import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConsultationNotification {
  id: string;
  message_id: string;
  consultation_request_id: string;
  processed: boolean;
  created_at: string;
}

interface ConsultationMessage {
  id: string;
  consultation_request_id: string;
  sender_name: string;
  message: string;
  documents_requested: string[];
  created_at: string;
}

interface ConsultationRequest {
  id: string;
  company_id: string;
  contact_name: string;
  contact_email: string;
}

interface CompanyAdmin {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get unprocessed notifications
    const { data: notifications, error: notificationsError } = await supabaseClient
      .from('consultation_notifications')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(10);

    if (notificationsError) {
      console.error('Error fetching notifications:', notificationsError);
      throw notificationsError;
    }

    if (!notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No notifications to process' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const results = [];

    for (const notification of notifications) {
      try {
        // Get the consultation message details
        const { data: message, error: messageError } = await supabaseClient
          .from('consultation_messages')
          .select('*')
          .eq('id', notification.message_id)
          .single();

        if (messageError || !message) {
          console.error('Error fetching message:', messageError);
          continue;
        }

        // Get consultation request details
        const { data: request, error: requestError } = await supabaseClient
          .from('consultation_requests')
          .select('id, company_id, contact_name, contact_email')
          .eq('id', notification.consultation_request_id)
          .single();

        if (requestError || !request) {
          console.error('Error fetching consultation request:', requestError);
          continue;
        }

        // Get all company admins
        const { data: admins, error: adminsError } = await supabaseClient
          .from('profiles')
          .select('id, email, first_name, last_name')
          .eq('company_id', request.company_id)
          .eq('role', 'admin');

        if (adminsError || !admins || admins.length === 0) {
          console.error('Error fetching company admins:', adminsError);
          continue;
        }

        // Send email to each admin
        for (const admin of admins) {
          try {
            const { error: emailError } = await supabaseClient.functions.invoke('send-email', {
              body: {
                type: 'consultation_document_request',
                data: {
                  recipientEmail: admin.email,
                  recipientName: `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || admin.email,
                  companyName: request.contact_name || 'Your Company',
                  requesterName: message.sender_name,
                  documentsRequested: message.documents_requested || [],
                  message: message.message,
                  jumpUrl: `${Deno.env.get('SITE_URL') || 'http://localhost:3000'}/consultations`,
                  requestDate: new Date(message.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                }
              }
            });

            if (emailError) {
              console.error(`Error sending email to ${admin.email}:`, emailError);
            } else {
              console.log(`Email sent to ${admin.email} for consultation document request`);
            }
          } catch (emailError) {
            console.error(`Error sending email to ${admin.email}:`, emailError);
          }
        }

        // Mark notification as processed
        const { error: updateError } = await supabaseClient
          .from('consultation_notifications')
          .update({ 
            processed: true, 
            processed_at: new Date().toISOString() 
          })
          .eq('id', notification.id);

        if (updateError) {
          console.error('Error updating notification:', updateError);
        }

        results.push({
          notificationId: notification.id,
          messageId: message.id,
          adminsNotified: admins.length,
          success: true
        });

      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error);
        results.push({
          notificationId: notification.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processed ${notifications.length} notifications`,
        results 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Consultation doc request emailer error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
