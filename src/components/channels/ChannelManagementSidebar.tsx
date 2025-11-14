import { useState, useEffect } from "react";
import { useChannelManagement } from "@/hooks/useChannelManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Settings, Users, Bot, FileText, Save, Trash2, UserPlus, MoreVertical, Shield, UserCheck, Loader2, ChevronDown, Check, X, User } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ChannelFilesList } from "./ChannelFilesList";
interface ChannelManagementSidebarProps {
  channelId: string;
  isOpen: boolean;
  onClose: () => void;
  onChannelDeleted?: () => void;
}
export function ChannelManagementSidebar({
  channelId,
  isOpen,
  onClose,
  onChannelDeleted
}: ChannelManagementSidebarProps) {
  // Form states
  const [channelName, setChannelName] = useState("");
  const [channelDescription, setChannelDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isMemberSelectOpen, setIsMemberSelectOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const {
    channel,
    members,
    agents,
    availableAgents,
    companyMembers,
    userRole,
    isLoading,
    isUpdating,
    canManage,
    updateChannel,
    addMember,
    removeMember,
    toggleAgent,
    deleteChannel
  } = useChannelManagement(channelId);

  // Update form values when channel data loads
  useEffect(() => {
    if (channel) {
      setChannelName(channel.name);
      setChannelDescription(channel.description || "");
      setIsPrivate(channel.is_private);
    }
  }, [channel]);

  const handleSaveSettings = async () => {
    const success = await updateChannel({
      name: channelName,
      description: channelDescription || null,
      is_private: isPrivate
    });
    if (success) {
      // Form values are already updated by the hook
    }
  };
  const handleAddMember = async (userId: string) => {
    const success = await addMember(userId);
    if (success) {
      setIsMemberSelectOpen(false);
    }
  };
  const handleDeleteChannel = async () => {
    const success = await deleteChannel();
    if (success) {
      onClose();
      // Notify parent component that channel was deleted
      if (onChannelDeleted) {
        onChannelDeleted();
      }
    }
  };
  const getDisplayName = (member: any) => {
    const profile = member.profiles;
    if (profile.first_name || profile.last_name) {
      return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    }
    return profile.email;
  };
  const getInitials = (member: any) => {
    const profile = member.profiles;
    if (profile.first_name && profile.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    return profile.email.slice(0, 2).toUpperCase();
  };
  const getCompanyMemberDisplayName = (member: any) => {
    if (member.first_name || member.last_name) {
      return `${member.first_name || ''} ${member.last_name || ''}`.trim();
    }
    return member.email;
  };
  const getCompanyMemberInitials = (member: any) => {
    if (member.first_name && member.last_name) {
      return `${member.first_name[0]}${member.last_name[0]}`.toUpperCase();
    }
    return member.email.slice(0, 2).toUpperCase();
  };
  if (!isOpen) return null;
  if (isLoading) {
    return <div className="w-96 bg-card border-l border-border h-full p-4 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>;
  }
  return <div className="w-96 shrink-0 bg-card border-l border-border h-full flex flex-col">
      <div className="p-4 py-5 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-base">Channel Management</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}>
              {showSettings ? <User className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-h-0">
        {showSettings ? (
          // Settings View
          <ScrollArea className="h-full">
            <div className="px-4 py-4">
              <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Channel Name</label>
                <Input value={channelName} onChange={e => setChannelName(e.target.value)} disabled={!canManage} className="mt-1" />
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea value={channelDescription} onChange={e => setChannelDescription(e.target.value)} disabled={!canManage} className="mt-1" rows={3} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Private Channel</label>
                  <p className="text-xs text-muted-foreground">
                    Only members can see this channel
                  </p>
                </div>
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} disabled={!canManage} />
              </div>

              {canManage && (
                <>
                  <Button onClick={handleSaveSettings} disabled={isUpdating} className="w-full">
                    <Save className="h-4 w-4 mr-2" />
                    {isUpdating ? "Saving..." : "Save Changes"}
                  </Button>

                  <Separator />

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full text-red-500 bg-transparent">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Channel
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the channel and all its messages. 
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteChannel} className="bg-destructive text-destructive-foreground">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
              </div>
            </div>
          </ScrollArea>
        ) : (
          // Tabs View
          <Tabs defaultValue="team" className="h-full flex flex-col">
            <div className="px-4">
              <TabsList className="grid w-full grid-cols-2 bg-transparent gap-0 p-0 h-auto border-b rounded-none">
                <TabsTrigger 
                  value="team" 
                  className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
                >
                  Team
                </TabsTrigger>
                <TabsTrigger 
                  value="documents" 
                  className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
                >
                  Documents
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <div className="px-4">
              {/* Team Tab - Combined Members and AI Agents */}
              <TabsContent value="team" className="space-y-4 mt-4 pb-4">
                {/* Add Team Member Section */}
                {canManage && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Add Team Member</label>
                    <Popover open={isMemberSelectOpen} onOpenChange={setIsMemberSelectOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={isMemberSelectOpen} className="w-full justify-between" disabled={isUpdating}>
                          Select company member...
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0 bg-white">
                        <Command>
                          <CommandInput placeholder="Search company members..." className="border-0 focus:ring-0 focus:outline-none focus:border-0" />
                          <CommandEmpty>No members found.</CommandEmpty>
                          <CommandList>
                            <CommandGroup>
                              {companyMembers.filter(member => !member.is_in_channel).map(member => (
                                <CommandItem 
                                  key={member.id} 
                                  value={`${member.first_name || ''} ${member.last_name || ''} ${member.email}`} 
                                  onSelect={() => handleAddMember(member.id)} 
                                  className="flex items-center gap-2"
                                >
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={member.avatar_url || ''} />
                                    <AvatarFallback className="text-xs">
                                      {getCompanyMemberInitials(member)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">{getCompanyMemberDisplayName(member)}</p>
                                    <p className="text-xs text-muted-foreground">{member.email}</p>
                                  </div>
                                  <Check className={cn("h-4 w-4", "opacity-0")} />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                <Separator />

                {/* Team Members Section */}
                <div>
                  <h4 className="text-sm font-medium mb-3">
                    Members ({members.length})
                  </h4>
                  <div className="space-y-2 mb-4">
                    {members.map(member => (
                      <div key={member.id} className="flex items-center justify-between p-2 border-b border-border">
                         <div className="flex items-center gap-3">
                           <div>
                             <p className="text-sm font-medium">{getDisplayName(member)}</p>
                             <p className="text-xs text-muted-foreground">{member.profiles.email}</p>
                           </div>
                         </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                            {member.role === 'admin' ? <Shield className="h-3 w-3 mr-1" /> : <UserCheck className="h-3 w-3 mr-1" />}
                            {member.role}
                          </Badge>
                          {canManage && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => removeMember(member.id)} disabled={isUpdating}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* AI Agents Section - Scrollable */}
                <div>
                  <h4 className="text-sm font-medium mb-3">
                    AI Agents ({availableAgents.length})
                  </h4>
                  <div className="max-h-[400px] overflow-y-auto">
                    <div className="space-y-2 pr-2">
                      {availableAgents.map(agent => {
                        const isAdded = agents.some(ca => ca.agent_id === agent.id);
                        return (
                          <div key={agent.id} className="flex items-center justify-between p-3 border-b border-border">
                            <div>
                              <p className="text-sm font-medium">{agent.name}</p>
                              <p className="text-xs text-muted-foreground">
                                @{agent.nickname || agent.role}
                              </p>
                            </div>
                            <div className="scale-75 origin-right">
                              <Switch 
                                checked={isAdded} 
                                onCheckedChange={() => toggleAgent(agent.id)} 
                                disabled={!canManage || isUpdating} 
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="space-y-4 mt-4">
                <ChannelFilesList channelId={channelId} />
              </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        )}
      </div>
    </div>;
}