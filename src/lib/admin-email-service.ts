import { supabase } from '@/integrations/supabase/client';
import { AdminOnboardingRequestEmailData } from './email-service';

/**
 * Get all admin users from the database
 */
export async function getAdminUsers(): Promise<Array<{ id: string; email: string; first_name: string; last_name: string }>> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('role', 'admin');

    if (error) {
      console.error('Error fetching admin users:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getAdminUsers:', error);
    return [];
  }
}

/**
 * Send admin onboarding request email to all admins
 */
export async function sendAdminOnboardingRequestEmail(
  requestData: AdminOnboardingRequestEmailData
): Promise<{ success: boolean; error?: string; sentTo: string[] }> {
  try {
    // Get all admin users
    const adminUsers = await getAdminUsers();
    
    if (adminUsers.length === 0) {
      return {
        success: false,
        error: 'No admin users found',
        sentTo: []
      };
    }

    const sentTo: string[] = [];
    const errors: string[] = [];

    // Send email to each admin
    for (const admin of adminUsers) {
      try {
        const { error } = await supabase.functions.invoke('send-email', {
          body: {
            type: 'admin_onboarding_request',
            data: {
              recipientEmail: admin.email,
              recipientName: `${admin.first_name} ${admin.last_name}`.trim() || admin.email,
              requesterName: requestData.requesterName,
              requesterEmail: requestData.requesterEmail,
              companyName: requestData.companyName,
              requestDetails: requestData.requestDetails,
              requestDate: requestData.requestDate,
              adminDashboardUrl: requestData.adminDashboardUrl
            }
          }
        });

        if (error) {
          console.error(`Error sending email to admin ${admin.email}:`, error);
          errors.push(`Failed to send to ${admin.email}: ${error.message}`);
        } else {
          sentTo.push(admin.email);
        }
      } catch (error) {
        console.error(`Error sending email to admin ${admin.email}:`, error);
        errors.push(`Failed to send to ${admin.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (sentTo.length === 0) {
      return {
        success: false,
        error: `Failed to send to any admins. Errors: ${errors.join(', ')}`,
        sentTo: []
      };
    }

    return {
      success: true,
      sentTo,
      error: errors.length > 0 ? `Some emails failed: ${errors.join(', ')}` : undefined
    };
  } catch (error) {
    console.error('Error in sendAdminOnboardingRequestEmail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      sentTo: []
    };
  }
}

/**
 * Send admin onboarding request email to specific admin
 */
export async function sendAdminOnboardingRequestEmailToAdmin(
  requestData: AdminOnboardingRequestEmailData,
  adminEmail: string,
  adminName: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const { error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'admin_onboarding_request',
        data: {
          recipientEmail: adminEmail,
          recipientName: adminName,
          requesterName: requestData.requesterName,
          requesterEmail: requestData.requesterEmail,
          companyName: requestData.companyName,
          requestDetails: requestData.requestDetails,
          requestDate: requestData.requestDate,
          adminDashboardUrl: requestData.adminDashboardUrl
        }
      }
    });

    if (error) {
      console.error('Error sending admin onboarding request email:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('Error in sendAdminOnboardingRequestEmailToAdmin:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Create admin onboarding request data from form data
 */
export function createAdminOnboardingRequestData(
  requesterName: string,
  requesterEmail: string,
  companyName: string,
  requestDetails: string,
  adminDashboardUrl?: string
): AdminOnboardingRequestEmailData {
  return {
    requesterName,
    requesterEmail,
    companyName,
    requestDetails,
    requestDate: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    adminDashboardUrl: adminDashboardUrl || `${window.location.origin}/admin/onboarding`
  };
}
