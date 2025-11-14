import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTeamMemberDetails } from "@/hooks/useTeamMemberDetails";
import { useSeatValidation } from "@/hooks/useSeatValidation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { InviteTeamMemberModal } from "@/components/modals/InviteTeamMemberModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  UserPlusIcon, 
  UsersIcon, 
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  EnvelopeIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

interface TeamMember {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: string;
  last_login_at: string | null;
  created_at: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'moderator' | 'user';
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
  expires_at: string;
}

function InvitationItem({ 
  invitation, 
  onUpdate 
}: { 
  invitation: PendingInvitation; 
  onUpdate: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleResendInvitation = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: invitation.email,
          subject: 'Reminder: Team Invitation',
          invitation_id: invitation.id,
        }
      });

      if (error) throw error;

      toast({
        title: "Invitation Resent",
        description: `Invitation email sent to ${invitation.email}`,
      });
    } catch (error) {
      console.error('Error resending invitation:', error);
      toast({
        title: "Error",
        description: "Failed to resend invitation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelInvitation = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('team_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      if (error) throw error;

      toast({
        title: "Invitation Cancelled",
        description: "The invitation has been cancelled successfully.",
      });

      onUpdate();
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast({
        title: "Error",
        description: "Failed to cancel invitation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg hover:bg-gray-50 transition-colors">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  {invitation.first_name?.[0]}{invitation.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="font-medium">
                  {invitation.first_name} {invitation.last_name}
                </p>
                <p className="text-sm text-muted-foreground">{invitation.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline">
                {invitation.role}
              </Badge>
              <Badge variant="secondary">
                Pending
              </Badge>
              {isOpen ? (
                <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <Separator />
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Invited on</p>
                <p className="font-medium">{formatDate(invitation.created_at)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Expires on</p>
                <p className="font-medium">{formatDate(invitation.expires_at)}</p>
              </div>
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResendInvitation}
                disabled={isProcessing}
                className="flex-1"
              >
                <EnvelopeIcon className="h-4 w-4 mr-2" />
                Resend Invitation
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancelInvitation}
                disabled={isProcessing}
                className="flex-1"
              >
                <XMarkIcon className="h-4 w-4 mr-2" />
                Cancel Invitation
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function TeamMemberRow({ member, isCurrentUser }: { member: TeamMember; isCurrentUser: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { channels, messageCount, lastActivity, recentActivities, isLoading } = useTeamMemberDetails(
    isExpanded ? member.id : null,
    isExpanded ? member.id : null
  );

  const getDisplayName = (member: TeamMember) => {
    if (member.first_name || member.last_name) {
      return `${member.first_name || ''} ${member.last_name || ''}`.trim();
    }
    return member.email;
  };

  const getInitials = (member: TeamMember) => {
    if (member.first_name && member.last_name) {
      return `${member.first_name[0]}${member.last_name[0]}`.toUpperCase();
    }
    return member.email.slice(0, 2).toUpperCase();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'moderator':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <>
      <TableRow className="hover:bg-gray-50 transition-colors">
        <TableCell>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={member.avatar_url || undefined} />
              <AvatarFallback>
                {getInitials(member)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{getDisplayName(member)}</p>
                {isCurrentUser && (
                  <Badge variant="outline" className="text-xs">
                    You
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{member.email}</p>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                <Badge variant={getRoleBadgeVariant(member.role)}>
                  {member.role}
                </Badge>
                {isExpanded ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {member.last_login_at ? formatDate(member.last_login_at) : 'Never'}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {formatDate(member.created_at)}
        </TableCell>
      </TableRow>
      
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={4} className="bg-white">
            <Collapsible open={isExpanded}>
              <CollapsibleContent>
                {isLoading ? (
                  <div className="py-8 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
                  </div>
                ) : (
                  <div className="py-4 px-2 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Channels */}
                      <Card className="shadow-none hover:shadow-sm hover:shadow-gray-100 border border-gray-200">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">
                            Channels ({channels.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {channels.length > 0 ? (
                            <div className="space-y-2">
                              {channels.map((channel) => (
                                <div key={channel.id} className="flex items-center justify-between text-sm">
                                  <span className="truncate">{channel.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {channel.role}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No channels</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Messages Stats */}
                      <Card className="shadow-none hover:shadow-sm hover:shadow-gray-100 border border-gray-200">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">
                            Message Activity
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-2xl font-bold">{messageCount}</p>
                            <p className="text-xs text-muted-foreground">Total messages sent</p>
                          </div>
                          {lastActivity && (
                            <div>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <ClockIcon className="h-3 w-3" />
                                Last active
                              </p>
                              <p className="text-sm font-medium">{formatDateTime(lastActivity)}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Recent Activities */}
                      <Card className="shadow-none hover:shadow-sm hover:shadow-gray-100 border border-gray-200">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">
                            Recent Activities
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {recentActivities.length > 0 ? (
                            <div className="space-y-2">
                              {recentActivities.map((activity) => (
                                <div key={activity.id} className="text-xs">
                                  <p className="text-muted-foreground truncate">
                                    {activity.description}
                                  </p>
                                  <p className="text-muted-foreground/70">
                                    {formatDateTime(activity.timestamp)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No recent activity</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function InviteTeamMembers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{ company_id: string | null } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  
  // Seat validation hook
  const { 
    purchasedSeats, 
    activeMembers, 
    pendingInvitations: seatPendingInvitations, 
    availableSeats, 
    usagePercentage, 
    isUnlimited,
    isLoading: seatLoading 
  } = useSeatValidation();

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (userProfile?.company_id) {
      fetchTeamData();
    }
  }, [userProfile]);

  const fetchUserProfile = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchTeamData = async () => {
    if (!userProfile?.company_id) return;

    try {
      setIsLoading(true);

      // Fetch existing team members
      const { data: members, error: membersError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, avatar_url, role, last_login_at, created_at')
        .eq('company_id', userProfile.company_id)
        .order('created_at', { ascending: false });

      if (membersError) throw membersError;

      // Fetch pending invitations
      const { data: invitations, error: invitationsError } = await supabase
        .from('team_invitations')
        .select('id, email, first_name, last_name, role, status, created_at, expires_at')
        .eq('company_id', userProfile.company_id)
        .eq('status', 'pending');

      if (invitationsError) throw invitationsError;

      setTeamMembers(members || []);
      setPendingInvitations((invitations || []).map(inv => ({
        ...inv,
        role: inv.role as 'admin' | 'moderator' | 'user',
        status: inv.status as 'pending' | 'accepted' | 'expired'
      })));
    } catch (error) {
      console.error('Error fetching team data:', error);
      toast({
        title: "Error",
        description: "Failed to load team data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter team members based on search and role filter
  const filteredMembers = useMemo(() => {
    return teamMembers.filter(member => {
      const displayName = `${member.first_name || ''} ${member.last_name || ''}`.trim().toLowerCase();
      const email = member.email.toLowerCase();
      const search = searchQuery.toLowerCase();
      
      const matchesSearch = displayName.includes(search) || email.includes(search);
      const matchesRole = roleFilter === "all" || member.role === roleFilter;
      
      return matchesSearch && matchesRole;
    });
  }, [teamMembers, searchQuery, roleFilter]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-14 md:h-12 flex items-center border-b border-border px-4 sm:px-6 bg-white">
            <SidebarTrigger className="mr-4 h-10 w-10 md:h-7 md:w-7" />
            <h1 className="text-lg font-semibold">Team Management</h1>
          </header>
          
          {/* Content */}
          <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 bg-white">
            <div className=" mx-auto space-y-4 sm:space-y-6">
              {/* Page Header */}
              

              {/* Statistics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <Card className="shadow-none border border-gray-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-medium text-muted-foreground">
                      Active Members
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl sm:text-3xl font-bold">{teamMembers.length}</div>
                  </CardContent>
                </Card>
                <Card className="shadow-none border border-gray-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-medium text-muted-foreground">
                      Pending Invites
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl sm:text-3xl font-bold">{pendingInvitations.length}</div>
                  </CardContent>
                </Card>
                <Card className="shadow-none border border-gray-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-medium text-muted-foreground">
                      Seat Usage
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-2xl sm:text-3xl font-bold">
                      {isUnlimited ? "∞" : `${activeMembers + seatPendingInvitations} / ${purchasedSeats}`}
                    </div>
                    {!isUnlimited && (
                      <>
                        <Progress 
                          value={usagePercentage} 
                          className="h-2"
                        />
                        <div className="text-xs text-muted-foreground">
                          {availableSeats} seats available
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <Card className="shadow-none border border-gray-200">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="moderator">Moderator</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
              </Card>

              {/* Team Members Table */}
              <Card className="shadow-none border border-gray-200">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <CardTitle className="text-sm font-medium">
                    Team Members ({filteredMembers.length})
                  </CardTitle>
                  <div className="flex flex-col sm:flex-row items-end justify-end gap-4">
                <Button onClick={() => setIsInviteModalOpen(true)} className="w-full sm:w-auto">
                  Invite Team Member
                </Button>
              </div>
              </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                          <div className="h-10 w-10 bg-muted rounded-full animate-pulse" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-muted rounded animate-pulse" />
                            <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
                          </div>
                          <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : filteredMembers.length > 0 ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader className="hover:bg-gray-50">
                          <TableRow>
                            <TableHead>Member</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Last Active</TableHead>
                            <TableHead>Joined</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredMembers.map((member) => (
                            <TeamMemberRow
                              key={member.id}
                              member={member}
                              isCurrentUser={member.id === user?.id}
                            />
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <UsersIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        No team members found
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {searchQuery || roleFilter !== "all"
                          ? "Try adjusting your filters"
                          : "Invite your first team member to get started"}
                      </p>
                      {!searchQuery && roleFilter === "all" && (
                        <Button onClick={() => setIsInviteModalOpen(true)}>
                          <UserPlusIcon className="mr-2 h-4 w-4" />
                          Invite Team Member
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pending Invitations */}
              {pendingInvitations.length > 0 && (
                <Card className="shadow-none border border-gray-200">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      Pending Invitations ({pendingInvitations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {pendingInvitations.map((invitation) => (
                        <InvitationItem 
                          key={invitation.id} 
                          invitation={invitation}
                          onUpdate={fetchTeamData}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Invite Modal */}
      {userProfile?.company_id && (
        <InviteTeamMemberModal
          open={isInviteModalOpen}
          onOpenChange={setIsInviteModalOpen}
          companyId={userProfile.company_id}
          onInviteSent={fetchTeamData}
        />
      )}
    </SidebarProvider>
  );
}
