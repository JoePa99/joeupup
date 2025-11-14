import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Mail, 
  Lock, 
  Building,
  User,
  UserPlus
} from "lucide-react";
import { toast } from "sonner";

interface InvitationData {
  id: string;
  company_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  personal_message: string | null;
  status: string;
  expires_at: string;
  invited_by: string;
  inviter_name?: string;
  company_name?: string;
}

export default function AcceptInvitation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid invitation link");
      setIsLoading(false);
      return;
    }

    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    if (!token) return;

    try {
      // Fetch invitation details
      const { data: invitationData, error: invitationError } = await supabase
        .from('team_invitations')
        .select(`
          *,
          companies (name),
          profiles!team_invitations_invited_by_fkey (first_name, last_name)
        `)
        .eq('invitation_token', token)
        .maybeSingle();

      if (invitationError) throw invitationError;

      if (!invitationData) {
        setError("Invitation not found");
        setIsLoading(false);
        return;
      }

      if (invitationData.status === 'accepted') {
        setError("This invitation has already been accepted");
        setIsLoading(false);
        return;
      }

      if (invitationData.status === 'expired' || new Date(invitationData.expires_at) < new Date()) {
        setError("This invitation has expired");
        setIsLoading(false);
        return;
      }

      if (invitationData.status === 'cancelled') {
        setError("This invitation has been cancelled");
        setIsLoading(false);
        return;
      }

      // Format the data
      const formattedInvitation = {
        ...invitationData,
        company_name: (invitationData.companies as any)?.name,
        inviter_name: (invitationData.profiles as any)?.first_name 
          ? `${(invitationData.profiles as any).first_name} ${(invitationData.profiles as any).last_name || ''}`.trim()
          : null
      };

      setInvitation(formattedInvitation);
    } catch (error) {
      console.error('Error loading invitation:', error);
      setError("Failed to load invitation");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!invitation || !token) return;

    // If user is already logged in
    if (user) {
      setIsAccepting(true);
      try {
        // Check if user's email matches invitation email
        if (user.email !== invitation.email) {
          toast.error("You must be logged in with the invited email address");
          return;
        }

        // Update user's company and role
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            company_id: invitation.company_id,
            role: invitation.role as 'admin' | 'moderator' | 'user'
          })
          .eq('id', user.id);

        if (profileError) throw profileError;

        // Mark invitation as accepted
        const { error: invitationError } = await supabase
          .from('team_invitations')
          .update({ 
            status: 'accepted',
            accepted_at: new Date().toISOString(),
            accepted_by: user.id
          })
          .eq('id', invitation.id);

        if (invitationError) throw invitationError;

        toast.success("Invitation accepted! Welcome to the team!");
        navigate('/client-dashboard');
      } catch (error) {
        console.error('Error accepting invitation:', error);
        toast.error("Failed to accept invitation");
      } finally {
        setIsAccepting(false);
      }
      return;
    }

    // If user is not logged in, create new account
    if (!password || !confirmPassword) {
      toast.error("Please enter a password");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsAccepting(true);
    try {
      // Sign up the user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password: password,
        options: {
          data: {
            first_name: invitation.first_name,
            last_name: invitation.last_name,
            company_id: invitation.company_id,
            role: invitation.role
          }
        }
      });

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error("Failed to create user account");
      }

      // Update the profile with company and role
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email: authData.user.email,
          first_name: invitation.first_name,
          last_name: invitation.last_name,
          company_id: invitation.company_id,
          role: invitation.role as 'admin' | 'moderator' | 'user'
        });

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }

      // Mark invitation as accepted
      const { error: invitationError } = await supabase
        .from('team_invitations')
        .update({ 
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          accepted_by: authData.user.id
        })
        .eq('id', invitation.id);

      if (invitationError) {
        console.error('Error updating invitation:', invitationError);
      }

      toast.success("Account created! Welcome to the team!");
      navigate('/client-dashboard');
    } catch (error) {
      console.error('Error creating account:', error);
      toast.error(error instanceof Error ? error.message : "Failed to create account");
    } finally {
      setIsAccepting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-center">Invalid Invitation</CardTitle>
            <CardDescription className="text-center">
              {error || "This invitation link is not valid"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/login')} 
              className="w-full"
              variant="outline"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <UserPlus className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl">You're Invited!</CardTitle>
          <CardDescription className="text-center">
            Join {invitation.company_name} on Variable
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="space-y-3">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Company:</span>
                <span>{invitation.company_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Role:</span>
                <span className="capitalize">{invitation.role}</span>
              </div>
              {invitation.inviter_name && (
                <div className="flex items-center gap-2 text-sm">
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Invited by:</span>
                  <span>{invitation.inviter_name}</span>
                </div>
              )}
            </div>

            {invitation.personal_message && (
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription className="mt-2">
                  <p className="font-medium mb-1">Personal message:</p>
                  <p className="text-sm italic">"{invitation.personal_message}"</p>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* If user is logged in */}
          {user && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  You're logged in as {user.email}. Click accept to join the team!
                </AlertDescription>
              </Alert>
              <Button 
                onClick={handleAccept}
                disabled={isAccepting}
                className="w-full"
                size="lg"
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  "Accept Invitation"
                )}
              </Button>
            </div>
          )}

          {/* If user is not logged in */}
          {!user && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={invitation.email}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Create Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Button 
                onClick={handleAccept}
                disabled={isAccepting || !password || !confirmPassword}
                className="w-full"
                size="lg"
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account & Join Team"
                )}
              </Button>
              <div className="text-center">
                <Button 
                  variant="link" 
                  onClick={() => navigate('/login')}
                  className="text-sm"
                >
                  Already have an account? Log in
                </Button>
              </div>
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            By accepting this invitation, you agree to join {invitation.company_name} and 
            will have access to their Variable workspace.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

