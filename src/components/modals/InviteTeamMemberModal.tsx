import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSeatValidation } from "@/hooks/useSeatValidation";
import { triggerUpgradeFlow, calculateRequiredSeats } from "@/lib/subscription-upgrade";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowPathIcon,
  PaperAirplaneIcon,
  UsersIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["admin", "moderator", "user"], {
    required_error: "Please select a role",
  }),
  message: z.string().optional(),
});

interface InviteTeamMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onInviteSent: () => void;
}

export function InviteTeamMemberModal({
  open,
  onOpenChange,
  companyId,
  onInviteSent,
}: InviteTeamMemberModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isInviting, setIsInviting] = useState(false);
  const { canInvite, isLoading: seatLoading, purchasedSeats, activeMembers, pendingInvitations, isUnlimited } = useSeatValidation();

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      role: "user",
      message: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof inviteSchema>) => {
    if (!user) return;

    // Check seat availability before proceeding
    if (!canInvite && !isUnlimited) {
      toast({
        title: "Seat limit reached",
        description: "Please upgrade your plan to invite more team members",
        variant: "destructive",
      });
      
      // Trigger upgrade flow
      try {
        const recommendedSeats = calculateRequiredSeats(purchasedSeats, activeMembers + pendingInvitations + 1);
        const upgradeData = await triggerUpgradeFlow('', companyId, recommendedSeats);
        if (upgradeData?.url) {
          window.location.href = upgradeData.url;
        }
      } catch (error) {
        console.error('Error triggering upgrade:', error);
        toast({
          title: "Upgrade Error",
          description: "Please contact support to upgrade your plan",
          variant: "destructive",
        });
      }
      return;
    }

    setIsInviting(true);
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id, email, company_id')
        .eq('email', values.email)
        .maybeSingle();

      if (existingUser) {
        if (existingUser.company_id === companyId) {
          toast({
            title: "User already exists",
            description: "This email is already registered in your company",
            variant: "destructive",
          });
          return;
        } else {
          toast({
            title: "User already registered",
            description: "This email is already registered with another company",
            variant: "destructive",
          });
          return;
        }
      }

      // Check if there's a pending invitation for this email
      const { data: existingInvitation } = await supabase
        .from('team_invitations')
        .select('id, status')
        .eq('email', values.email)
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingInvitation) {
        toast({
          title: "Invitation already sent",
          description: "There's already a pending invitation for this email",
          variant: "destructive",
        });
        return;
      }

      // Generate unique invitation token
      const invitationToken = crypto.randomUUID();

      // Create invitation record
      const { error: invitationError } = await supabase
        .from('team_invitations')
        .insert({
          company_id: companyId,
          invited_by: user.id,
          email: values.email,
          first_name: values.firstName,
          last_name: values.lastName,
          role: values.role,
          personal_message: values.message || null,
          invitation_token: invitationToken,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        });

      if (invitationError) throw invitationError;

      // Get company name
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single();

      if (companyError) {
        console.error('Error fetching company:', companyError);
      }

      // Get inviter name
      const { data: inviterProfile, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching inviter profile:', profileError);
      }

      const inviterName = inviterProfile?.first_name 
        ? `${inviterProfile.first_name} ${inviterProfile.last_name || ''}`.trim()
        : user.email || 'A team member';

      const companyName = company?.name || 'Your Team';

      // Send invitation email
      const invitationUrl = `${window.location.origin}/accept-invitation?token=${invitationToken}`;
      
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'team_invitation',
          data: {
            recipientEmail: values.email,
            recipientName: `${values.firstName} ${values.lastName}`,
            inviterName: inviterName,
            companyName: companyName,
            invitationUrl: invitationUrl,
            personalMessage: values.message || undefined,
            role: values.role
          }
        }
      });

      if (emailError) {
        console.error('Error sending invitation email:', emailError);
        toast({
          title: "Invitation created",
          description: `Invitation created but email failed to send. Error: ${emailError.message || 'Unknown error'}`,
        });
      } else {
        toast({
          title: "Invitation sent",
          description: `Invitation sent to ${values.email}`,
        });
      }

      // Reset form and close modal
      form.reset();
      onOpenChange(false);
      onInviteSent();

    } catch (error) {
      console.error('Error sending invitation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your team
          </DialogDescription>
        </DialogHeader>

        {/* Seat Usage Display */}
        {!seatLoading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-white rounded-lg">
              <div className="flex items-center gap-2">
                <UsersIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Seat Usage</span>
              </div>
              <Badge 
                variant={
                  isUnlimited ? "secondary" : 
                  activeMembers + pendingInvitations >= purchasedSeats ? "destructive" :
                  activeMembers + pendingInvitations >= purchasedSeats * 0.8 ? "default" : 
                  "secondary"
                }
              >
                {isUnlimited ? "Unlimited" : `${activeMembers + pendingInvitations} / ${purchasedSeats}`}
              </Badge>
            </div>
            
            {!isUnlimited && activeMembers + pendingInvitations >= purchasedSeats && (
              <Alert variant="destructive">
                <ExclamationTriangleIcon className="h-4 w-4" />
                <AlertDescription>
                  You have reached your seat limit. Upgrade your plan to invite more team members.
                </AlertDescription>
              </Alert>
            )}
            
            {!isUnlimited && activeMembers + pendingInvitations >= purchasedSeats * 0.8 && activeMembers + pendingInvitations < purchasedSeats && (
              <Alert>
                <ExclamationTriangleIcon className="h-4 w-4" />
                <AlertDescription>
                  You are approaching your seat limit. Consider upgrading your plan.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                placeholder="John"
                {...form.register("firstName")}
              />
              {form.formState.errors.firstName && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Doe"
                {...form.register("lastName")}
              />
              {form.formState.errors.lastName && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@company.com"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={form.watch("role")}
              onValueChange={(value) => form.setValue("role", value as "admin" | "moderator" | "user")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.role && (
              <p className="text-sm text-destructive">
                {form.formState.errors.role.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Personal Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Welcome to our team! We're excited to have you join us."
              className="resize-none"
              rows={3}
              {...form.register("message")}
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isInviting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isInviting || (!canInvite && !isUnlimited)}
            >
              {isInviting ? (
                <>
                  <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="mr-2 h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

