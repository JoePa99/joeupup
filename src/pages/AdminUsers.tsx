import { PlatformAdminProtectedRoute } from "@/components/auth/PlatformAdminProtectedRoute";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/ui/admin-sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  User,
  Mail,
  Building2,
  Calendar,
  Search,
  Loader2,
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface UserWithCompany {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  avatar_url: string | null;
  last_login_at: string | null;
  created_at: string;
  company_id: string | null;
  company?: {
    id: string;
    name: string;
    domain: string | null;
  };
}

function AdminUsersContent() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async (): Promise<UserWithCompany[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          company:companies(id, name, domain)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as UserWithCompany[];
    },
  });

  const filteredUsers = users?.filter((user) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      (user.first_name && user.first_name.toLowerCase().includes(searchLower)) ||
      (user.last_name && user.last_name.toLowerCase().includes(searchLower)) ||
      (user.company?.name && user.company.name.toLowerCase().includes(searchLower))
    );
  });

  // Pagination logic
  const totalPages = Math.ceil((filteredUsers?.length || 0) / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedUsers = filteredUsers?.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const getUserDisplayName = (user: UserWithCompany) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.email;
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'user': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-white">
        <Card className="p-8 text-center border border-gray-200 shadow-none">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Loading Users</h2>
          <p className="text-muted-foreground">Fetching user data...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-white">
        <Card className="p-8 text-center border border-gray-200 shadow-none">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-500" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Error Loading Users</h2>
          <p className="text-muted-foreground">{error instanceof Error ? error.message : 'Failed to load users'}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-white">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">User Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage all users across the platform ({users?.length || 0} total)
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-2">
            <User className="h-8 w-8 text-primary" />
            <Badge variant="secondary">{users?.length || 0}</Badge>
          </div>
          <p className="text-2xl font-bold text-foreground">{users?.length || 0}</p>
          <p className="text-sm text-muted-foreground">Total Users</p>
        </Card>
        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-2">
            <User className="h-8 w-8 text-primary" />
            <Badge variant="secondary">{users?.filter(u => u.role === 'admin').length || 0}</Badge>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {users?.filter(u => u.role === 'admin').length || 0}
          </p>
          <p className="text-sm text-muted-foreground">Admin Users</p>
        </Card>
        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-2">
            <Building2 className="h-8 w-8 text-primary" />
            <Badge variant="secondary">
              {new Set(users?.filter(u => u.company_id).map(u => u.company_id)).size || 0}
            </Badge>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {new Set(users?.filter(u => u.company_id).map(u => u.company_id)).size || 0}
          </p>
          <p className="text-sm text-muted-foreground">Companies</p>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="border border-gray-200 shadow-none">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name, email, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border border-gray-200 shadow-none">
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Complete list of users with their company associations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredUsers && filteredUsers.length > 0 ? (
            <>
            <div className="space-y-3">
              {paginatedUsers?.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-surface-subtle transition-colors cursor-pointer"
                  onClick={() => navigate(`/dashboard/users/${user.id}`)}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={user.avatar_url || ''} />
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-foreground truncate">
                          {getUserDisplayName(user)}
                        </p>
                        <Badge variant={getRoleBadgeVariant(user.role)} className="flex-shrink-0">
                          {user.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          {user.email}
                        </span>
                        {user.company && (
                          <span className="flex items-center gap-1 truncate">
                            <Building2 className="h-3 w-3 flex-shrink-0" />
                            {user.company.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                    {user.last_login_at && (
                      <div className="text-sm text-muted-foreground hidden md:flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(user.last_login_at).toLocaleDateString()}
                      </div>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/dashboard/users/${user.id}`);
                      }}
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredUsers?.length || 0)} of {filteredUsers?.length || 0} users
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-9 h-9"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
            </>
          ) : (
            <div className="text-center py-12">
              <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Users Found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try adjusting your search query' : 'No users in the system yet'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminUsers() {
  return (
    <PlatformAdminProtectedRoute>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-white">
          <AdminSidebar />
          <SidebarInset className="flex-1 bg-white">
            <header className="flex h-16 items-center gap-4 border-b border-gray-200 px-6 bg-white">
              <SidebarTrigger />
              <h2 className="text-lg font-semibold">Users</h2>
            </header>
            <AdminUsersContent />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </PlatformAdminProtectedRoute>
  );
}

