import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Bot, Users, X, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Channel name is required").max(50, "Name too long"),
  description: z.string().max(200, "Description too long").optional(),
  is_private: z.boolean().default(false),
});

interface Agent {
  id: string;
  name: string;
  nickname: string | null;
  role: string;
  avatar_url: string | null;
  status: string;
}

interface TeamMember {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: string;
}

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChannelCreated: (channelId: string) => void;
}

export function CreateChannelModal({ isOpen, onClose, onChannelCreated }: CreateChannelModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = useState(false);
  const [userProfile, setUserProfile] = useState<{ company_id: string | null } | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      is_private: false,
    },
  });

  const fetchUserProfile = useCallback(async () => {
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
  }, [user?.id]);

  // Reset form and selections when modal opens
  useEffect(() => {
    if (isOpen && user) {
      fetchUserProfile();
      form.reset();
      setSelectedAgents(new Set());
      setSelectedMembers(new Set());
    }
  }, [isOpen, user, fetchUserProfile, form]);

  const fetchData = useCallback(async () => {
    if (!user?.id || !userProfile?.company_id) return;

    setLoadingData(true);
    try {
      // Fetch agents for the user's company
      const { data: agentsData, error: agentsError } = await supabase
        .from('agents')
        .select('id, name, nickname, role, avatar_url, status')
        .eq('company_id', userProfile.company_id)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (agentsError) throw agentsError;

      // Fetch team members - still needs company_id for team members
      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, avatar_url, role')
        .eq('company_id', userProfile.company_id)
        .neq('id', user.id) // Exclude current user
        .order('first_name', { ascending: true });

      if (membersError) throw membersError;

      setAgents(agentsData || []);
      setTeamMembers(membersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load agents and team members",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  }, [user?.id, userProfile?.company_id, toast]);

  useEffect(() => {
    if (isOpen && user) {
      fetchData();
    }
  }, [isOpen, user, fetchData]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user?.id || !userProfile?.company_id) return;

    setLoading(true);
    try {
      // Create channel
      const { data: channelData, error: channelError } = await supabase
        .from('channels')
        .insert({
          name: values.name,
          description: values.description || null,
          is_private: values.is_private,
          company_id: userProfile.company_id,
          created_by: user.id,
        })
        .select()
        .single();

      if (channelError) throw channelError;

      const channelId = channelData.id;

      // Add channel creator as admin member
      const { error: memberError } = await supabase
        .from('channel_members')
        .insert({
          channel_id: channelId,
          user_id: user.id,
          role: 'admin',
        });

      if (memberError) {
        console.error('Error adding creator as channel member:', memberError);
        throw new Error(`Failed to add creator as channel member: ${memberError.message}`);
      }

      // Add selected team members
      if (selectedMembers.size > 0) {
        const memberInserts = Array.from(selectedMembers).map(memberId => ({
          channel_id: channelId,
          user_id: memberId,
          role: 'member',
        }));

        await supabase.from('channel_members').insert(memberInserts);
      }

      // Add selected agents
      if (selectedAgents.size > 0) {
        const agentInserts = Array.from(selectedAgents).map(agentId => ({
          channel_id: channelId,
          agent_id: agentId,
          added_by: user.id,
        }));

        await supabase.from('channel_agents').insert(agentInserts);
      }

      toast({
        title: "Success",
        description: `Channel "${values.name}" created successfully`,
      });

      onChannelCreated(channelId);
      onClose();
    } catch (error: any) {
      console.error('Error creating channel:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create channel",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleAgent = useCallback((agentId: string) => {
    setSelectedAgents(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(agentId)) {
        newSelected.delete(agentId);
      } else {
        newSelected.add(agentId);
      }
      return newSelected;
    });
  }, []);

  const toggleMember = useCallback((memberId: string) => {
    setSelectedMembers(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(memberId)) {
        newSelected.delete(memberId);
      } else {
        newSelected.add(memberId);
      }
      return newSelected;
    });
  }, []);

  const getDisplayName = useCallback((member: TeamMember) => {
    if (member.first_name || member.last_name) {
      return `${member.first_name || ''} ${member.last_name || ''}`.trim();
    }
    return member.email;
  }, []);

  const getInitials = useCallback((member: TeamMember) => {
    if (member.first_name && member.last_name) {
      return `${member.first_name[0]}${member.last_name[0]}`.toUpperCase();
    }
    return member.email.slice(0, 2).toUpperCase();
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[95vh] flex flex-col w-[95vw] sm:w-full">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center space-x-2 text-lg sm:text-xl">
            <span>Create New Channel</span>
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            Create a channel to collaborate with AI agents and team members
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          <div className="overflow-y-auto max-h-[60vh] pr-2 sm:pr-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-4">
                {/* Channel Details */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Channel Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Marketing Team" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Brief description of the channel's purpose"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="is_private"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Private Channel</FormLabel>
                          <div className="text-sm text-muted-foreground">
                            Only invited members can see and join this channel
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* AI Agents Selection */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Bot className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Select AI Agents</h3>
                    {selectedAgents.size > 0 && (
                      <Badge variant="secondary">{selectedAgents.size} selected</Badge>
                    )}
                  </div>

                  {loadingData ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : agents.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">
                      No AI agents available
                    </div>
                  ) : (
                     <div className="grid grid-cols-1 gap-3">
                       {agents.map((agent) => (
                         <div
                           key={agent.id}
                           className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                             selectedAgents.has(agent.id)
                               ? 'border-primary bg-primary/5'
                               : 'border-border'
                           }`}
                         >
                           <div className="flex items-center space-x-3">
                             <Avatar className="h-8 w-8 flex-shrink-0">
                               <AvatarImage src={agent.avatar_url || ''} />
                               <AvatarFallback>
                                 <Bot className="h-4 w-4" />
                               </AvatarFallback>
                             </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{agent.name}</p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {agent.nickname || agent.role}
                                </p>
                              </div>
                           </div>
                           <Switch
                             checked={selectedAgents.has(agent.id)}
                             onCheckedChange={() => toggleAgent(agent.id)}
                           />
                         </div>
                       ))}
                     </div>
                  )}
                </div>

                <Separator />

                {/* Team Members Selection */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Invite Team Members</h3>
                    {selectedMembers.size > 0 && (
                      <Badge variant="secondary">{selectedMembers.size} selected</Badge>
                    )}
                  </div>

                  {loadingData ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">
                      No team members to invite
                    </div>
                  ) : (
                     <div className="grid grid-cols-1 gap-3">
                       {teamMembers.map((member) => (
                         <div
                           key={member.id}
                           className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                             selectedMembers.has(member.id)
                               ? 'border-primary bg-primary/5'
                               : 'border-border'
                           }`}
                         >
                           <div className="flex items-center space-x-3">
                             <Avatar className="h-8 w-8 flex-shrink-0">
                               <AvatarImage src={member.avatar_url || ''} />
                               <AvatarFallback>
                                 {getInitials(member)}
                               </AvatarFallback>
                             </Avatar>
                             <div className="flex-1 min-w-0">
                               <p className="font-medium truncate">{getDisplayName(member)}</p>
                               <p className="text-sm text-muted-foreground truncate">
                                 {member.email} • {member.role}
                               </p>
                             </div>
                           </div>
                           <Switch
                             checked={selectedMembers.has(member.id)}
                             onCheckedChange={() => toggleMember(member.id)}
                           />
                         </div>
                       ))}
                     </div>
                  )}
                </div>
              </form>
            </Form>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 mt-6">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={loading || !form.formState.isValid}
            className="min-w-[120px]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Channel'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
