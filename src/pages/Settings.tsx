import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckIcon, TrashIcon, UserIcon, BuildingOffice2Icon, LockClosedIcon, ArrowRightOnRectangleIcon, BellIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { NotificationSettings } from "@/components/ui/notification-settings";
import { ImageUploader } from "@/components/ui/image-uploader";
import { SubscriptionRequiredModal } from "@/components/billing/SubscriptionRequiredModal";
import { useSubscriptionRequired } from "@/hooks/useSubscriptionRequired";

interface Profile {
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  company_id?: string;
}

interface Company {
  name: string;
  domain?: string;
  logo_url?: string;
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [profile, setProfile] = useState<Profile>({});
  const [company, setCompany] = useState<Company>({ name: "" });
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  // Check subscription status
  const { 
    showModal: showSubscriptionModal, 
    setShowModal: setShowSubscriptionModal,
    isAdmin: isCompanyAdmin, 
    companyId: userCompanyId,
    isLoading: isLoadingSubscription 
  } = useSubscriptionRequired();

  useEffect(() => {
    if (user) {
      loadUserData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    setInitialLoading(true);
    try {
      // Load profile with better error handling
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        toast({
          title: "Error loading profile",
          description: profileError.message,
          variant: "destructive",
        });
        return;
      }

      if (profileData) {
        console.log('Profile loaded:', profileData);
        setProfile(profileData);

        // Load company if profile has company_id
        if (profileData.company_id) {
          const { data: companyData, error: companyError } = await supabase
            .from('companies')
            .select('*')
            .eq('id', profileData.company_id)
            .single();

          if (companyError) {
            console.error('Company fetch error:', companyError);
            toast({
              title: "Error loading company",
              description: companyError.message,
              variant: "destructive",
            });
          } else if (companyData) {
            console.log('Company loaded:', companyData);
            setCompany(companyData);
          }
        } else {
          console.warn('User profile has no company_id');
        }
      }
    } catch (error: any) {
      console.error('Error loading user data:', error);
      toast({
        title: "Error loading data",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setInitialLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const saveCompany = async () => {
    if (!user || !profile.company_id) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: company.name,
          domain: company.domain,
        })
        .eq('id', profile.company_id);

      if (error) throw error;

      toast({
        title: "Company updated",
        description: "Company information has been saved successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const changePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      toast({
        title: "Password mismatch",
        description: "New password and confirmation don't match.",
        variant: "destructive",
      });
      return;
    }

    if (passwords.new.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.new
      });

      if (error) throw error;

      setPasswords({ current: "", new: "", confirm: "" });
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Password change failed",
        description: error.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;

    try {
      // Sanitize filename
      const sanitizedFileName = file.name
        .replace(/[^\w\s.-]/g, '')
        .replace(/\s+/g, '_')
        .trim();
      
      const filePath = `${user.id}/${Date.now()}-${sanitizedFileName}`;

      // Delete old avatar if exists
      if (profile.avatar_url) {
        const oldPath = profile.avatar_url.split('/').slice(-2).join('/');
        await supabase.storage.from('avatars').remove([oldPath]);
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Update local state
      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));

      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated successfully.",
      });
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload avatar",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteAvatar = async () => {
    if (!user || !profile.avatar_url) return;

    try {
      // Extract path from URL
      const oldPath = profile.avatar_url.split('/').slice(-2).join('/');
      
      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('avatars')
        .remove([oldPath]);

      if (deleteError) throw deleteError;

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Update local state
      setProfile(prev => ({ ...prev, avatar_url: null }));

      toast({
        title: "Avatar removed",
        description: "Your profile picture has been removed.",
      });
    } catch (error: any) {
      console.error('Avatar delete error:', error);
      toast({
        title: "Delete failed",
        description: error.message || "Failed to remove avatar",
        variant: "destructive",
      });
      throw error;
    }
  };

  const uploadCompanyLogo = async (file: File) => {
    if (!user || !profile.company_id) return;

    try {
      // Sanitize filename
      const sanitizedFileName = file.name
        .replace(/[^\w\s.-]/g, '')
        .replace(/\s+/g, '_')
        .trim();
      
      const filePath = `${profile.company_id}/${Date.now()}-${sanitizedFileName}`;

      // Delete old logo if exists
      if (company.logo_url) {
        const oldPath = company.logo_url.split('/').slice(-2).join('/');
        await supabase.storage.from('company-logos').remove([oldPath]);
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      // Update company
      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: publicUrl })
        .eq('id', profile.company_id);

      if (updateError) throw updateError;

      // Update local state
      setCompany(prev => ({ ...prev, logo_url: publicUrl }));

      toast({
        title: "Logo updated",
        description: "Company logo has been updated successfully.",
      });
    } catch (error: any) {
      console.error('Logo upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload logo",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteCompanyLogo = async () => {
    if (!user || !profile.company_id || !company.logo_url) return;

    try {
      // Extract path from URL
      const oldPath = company.logo_url.split('/').slice(-2).join('/');
      
      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('company-logos')
        .remove([oldPath]);

      if (deleteError) throw deleteError;

      // Update company
      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: null })
        .eq('id', profile.company_id);

      if (updateError) throw updateError;

      // Update local state
      setCompany(prev => ({ ...prev, logo_url: undefined }));

      toast({
        title: "Logo removed",
        description: "Company logo has been removed.",
      });
    } catch (error: any) {
      console.error('Logo delete error:', error);
      toast({
        title: "Delete failed",
        description: error.message || "Failed to remove logo",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const getInitials = () => {
    const first = profile.first_name?.[0] || "";
    const last = profile.last_name?.[0] || "";
    return (first + last).toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          {/* Header with sidebar trigger */}
          <header className="h-14 md:h-12 flex bg-white items-center border-b border-border px-4 sm:px-6">
            <SidebarTrigger className="mr-4 h-10 w-10 md:h-7 md:w-7" />
            <h1 className="text-lg font-semibold">Account Settings</h1>
          </header>
          
          {/* Main content area */}
          <div className="flex-1 p-4 sm:p-6 bg-white">
            <div className="w-full mx-auto space-y-6 sm:space-y-8">
              

              {initialLoading && (
                <div className="flex items-center justify-center py-12">
                  <ArrowPathIcon className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}

              {!initialLoading && (

              <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 bg-transparent gap-0 p-0 h-auto border-b rounded-none">
                  <TabsTrigger 
                    value="profile" 
                    className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
                  >
                    <UserIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Profile</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="company" 
                    className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
                  >
                    <BuildingOffice2Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Company</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="notifications" 
                    className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
                  >
                    <BellIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Notifications</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="profile">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="p-4 sm:p-6 space-y-4 sm:space-y-6 shadow-none border border-gray-200">
                      <div className="flex items-center space-x-2">
                        <UserIcon className="h-5 w-5 text-primary" />
                        <h2 className="text-xl font-semibold">Profile Information</h2>
                      </div>

                      <div className="space-y-4">
                        <div className="flex flex-col items-center space-y-4">
                          <ImageUploader
                            currentImageUrl={profile.avatar_url}
                            onUpload={uploadAvatar}
                            onDelete={deleteAvatar}
                            variant="circular"
                            size="lg"
                            label="Profile Picture"
                          />
                          
                          <div className="text-center">
                            <p className="font-medium">{user?.email}</p>
                            <p className="text-sm text-muted-foreground">Account Email</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="first-name">First Name</Label>
                            <Input
                              id="first-name"
                              value={profile.first_name || ""}
                              onChange={(e) => setProfile(prev => ({ ...prev, first_name: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="last-name">Last Name</Label>
                            <Input
                              id="last-name"
                              value={profile.last_name || ""}
                              onChange={(e) => setProfile(prev => ({ ...prev, last_name: e.target.value }))}
                            />
                          </div>
                        </div>
                        <Button onClick={saveProfile} disabled={loading} className="w-full">
                          <CheckIcon className="h-4 w-4 mr-2" />
                          Save Profile
                        </Button>
                      </div>
                    </Card>

                    <Card className="p-6 space-y-6 shadow-none border border-gray-200">
                      <div className="flex items-center space-x-2">
                        <LockClosedIcon className="h-5 w-5 text-primary" />
                        <h2 className="text-xl font-semibold">Security</h2>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="new-password">New Password</Label>
                          <Input
                            id="new-password"
                            type="password"
                            value={passwords.new}
                            onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirm-password">Confirm Password</Label>
                          <Input
                            id="confirm-password"
                            type="password"
                            value={passwords.confirm}
                            onChange={(e) => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                          />
                        </div>
                        <Button 
                          onClick={changePassword} 
                          disabled={loading || !passwords.new || !passwords.confirm} 
                          className="w-full"
                        >
                          <LockClosedIcon className="h-4 w-4 mr-2" />
                          Change Password
                        </Button>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <Button onClick={handleSignOut} variant="outline" className="w-full">
                          <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                          Sign Out
                        </Button>
                      </div>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="company">
                  <Card className="p-6 space-y-6 shadow-none border border-gray-200">
                    <div className="flex items-center space-x-2">
                      <BuildingOffice2Icon className="h-5 w-5 text-primary" />
                      <h2 className="text-xl font-semibold">Company Information</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                      {/* Left side - Company Logo */}
                      <div className="flex flex-col items-center md:items-start">
                        <ImageUploader
                          currentImageUrl={company.logo_url}
                          onUpload={uploadCompanyLogo}
                          onDelete={deleteCompanyLogo}
                          variant="square"
                          size="lg"
                          label="Company Logo"
                          disabled={!profile.company_id}
                        />
                      </div>

                      {/* Right side - Form Fields */}
                      <div className="md:col-span-2 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="company-name">Company Name</Label>
                          <Input
                            id="company-name"
                            value={company.name}
                            onChange={(e) => setCompany(prev => ({ ...prev, name: e.target.value }))}
                            disabled={!profile.company_id}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="company-domain">Company Domain</Label>
                          <Input
                            id="company-domain"
                            placeholder="company.com"
                            value={company.domain || ""}
                            onChange={(e) => setCompany(prev => ({ ...prev, domain: e.target.value }))}
                            disabled={!profile.company_id}
                          />
                        </div>
                        <Button onClick={saveCompany} disabled={loading || !profile.company_id} className="w-full">
                          <CheckIcon className="h-4 w-4 mr-2" />
                          Save Company
                        </Button>
                        {!profile.company_id && (
                          <p className="text-sm text-muted-foreground text-center">
                            You need to be associated with a company to edit company information.
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="notifications">
                  <NotificationSettings />
                </TabsContent>
              </Tabs>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Subscription Required Modal */}
      {showSubscriptionModal && userCompanyId && (
        <SubscriptionRequiredModal
          isOpen={showSubscriptionModal}
          onClose={isCompanyAdmin ? () => setShowSubscriptionModal(false) : undefined}
          companyId={userCompanyId}
          isAdmin={isCompanyAdmin}
        />
      )}
    </SidebarProvider>
  );
}