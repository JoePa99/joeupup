# Role-Based Access Control System

## Overview

This document describes the role-based access control (RBAC) system implemented in the Knowledge Engine platform. The system uses a two-tier role structure to separate company-level administration from platform-level administration.

## Role Types

### Company Admin (`admin`)

**Assignment**: Automatically assigned when a user creates a company during signup or onboarding.

**Permissions**:
- Full control over their company's resources:
  - Create, read, update, and delete agents
  - Manage documents, playbooks, and knowledge base
  - Invite and manage team members
  - Configure company settings and integrations
  - Access company analytics and reports
  - Manage channels and communication

**Restrictions**:
- **Cannot** access platform admin dashboard (`/dashboard/*` routes)
- **Cannot** view or manage other companies
- **Cannot** access platform-wide administrative functions

**Use Case**: This is the default administrative role for company owners and administrators who need full control over their organization's resources within the platform.

---

### Platform Admin (`platform-admin`)

**Assignment**: Manually assigned by platform administrators (superuser role).

**Permissions**:
- Access to platform admin dashboard with all routes:
  - `/dashboard` - Platform overview
  - `/dashboard/agents` - Global agent management
  - `/dashboard/consultations` - All consultations across companies
  - `/dashboard/users` - All user management
  - `/dashboard/companies` - All company management
  - `/dashboard/documents` - All document management
  - `/dashboard/supabase-health` - Platform health monitoring

- Can manage platform-wide resources:
  - All companies and their settings
  - All users across all companies
  - Global agents and tools
  - Platform health monitoring
  - System-wide consultations and communications
  - All documents across the platform

- **Inherits all company admin permissions**

**Use Case**: Reserved for platform operators and administrators who need access to manage the entire platform and all tenant companies.

---

### Moderator (`moderator`)

**Assignment**: Manually assigned by company admins.

**Permissions**:
- Limited administrative capabilities within their company
- Can moderate content and communications
- Cannot make major structural changes

**Use Case**: Team leads or moderators who need some administrative capabilities without full admin access.

---

### Regular User (`user`)

**Assignment**: Default role for invited team members.

**Permissions**:
- Access to company resources based on assigned permissions
- Can interact with agents and documents
- Can participate in channels and communications
- Cannot modify company settings or invite users

**Use Case**: Standard team members who use the platform for their daily work.

## Implementation Details

### Database Schema

**Enum Definition**:
```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user', 'platform-admin');
```

**Storage**:
- Primary role storage: `profiles.role` column
- Multi-role support: `user_roles` table (for future use)
- Company associations: `user_companies` table

**Helper Functions**:
```sql
-- Check if user is a platform admin
public.is_platform_admin(_user_id uuid) -> boolean

-- Check if user is a company admin (admin OR platform-admin)
public.is_company_admin(_user_id uuid, _company_id uuid) -> boolean

-- Get user's role
public.get_user_role() -> app_role

-- Get user's company ID
public.get_user_company_id() -> uuid
```

### Row-Level Security (RLS) Policies

The RLS policies use the helper functions to enforce access control:

**Platform Admin Access**:
- Tools and agent management
- Global agents and documents
- All consultation messages
- All profiles and user roles
- KPI metrics across platform
- Storage policies for consultation documents

**Company Admin Access**:
- Company-specific resources
- Team member management within company
- Company settings and integrations
- Documents within company

### Frontend Implementation

**Hooks**:
```typescript
// Check if user is platform admin
useIsPlatformAdmin() -> boolean

// Check if user is company admin (admin OR platform-admin)
useIsCompanyAdmin() -> boolean

// Check if user is admin (legacy, company-level only)
useIsAdmin() -> boolean
```

**Protected Route Components**:
```typescript
// For platform admin routes (/dashboard/*)
<PlatformAdminProtectedRoute>
  {children}
</PlatformAdminProtectedRoute>

// For company admin routes
<AdminProtectedRoute>
  {children}
</AdminProtectedRoute>

// For authenticated users
<ProtectedRoute>
  {children}
</ProtectedRoute>
```

### Automatic Role Assignment

**Company Creation Flow**:

1. **During Signup** (`src/contexts/AuthContext.tsx`):
   ```typescript
   // When user signs up with a new company
   await supabase.from('profiles').upsert({
     id: user.id,
     email: user.email,
     company_id: company.id,
     role: 'admin' // Automatically assigned
   });
   ```

2. **During Onboarding** (`src/pages/Onboarding.tsx`):
   ```typescript
   // If user creates company during onboarding
   await supabase.from('profiles').update({
     company_id: newCompany.id,
     role: 'admin' // Automatically assigned
   });
   ```

## Usage Examples

### Protecting Platform Admin Routes

```typescript
// src/pages/AdminUsers.tsx
import { PlatformAdminProtectedRoute } from '@/components/auth/PlatformAdminProtectedRoute';

export default function AdminUsers() {
  return (
    <PlatformAdminProtectedRoute>
      <AdminUsersContent />
    </PlatformAdminProtectedRoute>
  );
}
```

### Protecting Company Admin Features

```typescript
// src/pages/CompanySettings.tsx
import { AdminProtectedRoute } from '@/components/auth/AdminProtectedRoute';

export default function CompanySettings() {
  return (
    <AdminProtectedRoute>
      <CompanySettingsContent />
    </AdminProtectedRoute>
  );
}
```

### Checking Roles in Components

```typescript
import { useIsPlatformAdmin, useIsCompanyAdmin } from '@/hooks/useAdminData';

function MyComponent() {
  const { data: isPlatformAdmin } = useIsPlatformAdmin();
  const { data: isCompanyAdmin } = useIsCompanyAdmin();

  return (
    <div>
      {isPlatformAdmin && <PlatformAdminFeatures />}
      {isCompanyAdmin && <CompanyAdminFeatures />}
      <RegularUserFeatures />
    </div>
  );
}
```

## Security Considerations

1. **Platform Admin Access**: The `platform-admin` role should be assigned sparingly and only to trusted platform operators.

2. **Role Escalation Prevention**: 
   - Company admins cannot promote themselves to platform admins
   - Only platform admins can assign platform admin role (via direct database access)

3. **RLS Enforcement**: All database queries are protected by Row-Level Security policies that check user roles.

4. **Frontend Protection**: All sensitive routes are protected with appropriate role-checking components.

5. **API Security**: Backend functions and edge functions should verify user roles before performing operations.

## Manual Role Assignment

To manually assign a platform admin role:

1. **Via Supabase Dashboard**:
   - Navigate to Table Editor > profiles
   - Find the user by email or ID
   - Update the `role` column to `platform-admin`

2. **Via SQL**:
   ```sql
   UPDATE public.profiles 
   SET role = 'platform-admin' 
   WHERE email = 'admin@example.com';
   ```

## Testing Checklist

- [ ] New user signup automatically gets `admin` role when creating company
- [ ] Company admin can access company resources
- [ ] Company admin **cannot** access `/dashboard/*` platform routes
- [ ] Platform admin can access all `/dashboard/*` routes
- [ ] Platform admin can view all companies and users
- [ ] RLS policies properly enforce role-based access
- [ ] Role hooks return correct values
- [ ] Protected routes properly redirect unauthorized users

## Migration Path

If upgrading from a system where all admins had platform access:

1. Run the migration: `20251002190000_implement_role_based_access.sql`
2. Identify users who should retain platform access
3. Update their roles to `platform-admin`
4. All other admins will become company-level admins

## Future Enhancements

- [ ] Multi-company support for users (via `user_companies` table)
- [ ] Custom role definitions per company
- [ ] Fine-grained permissions system
- [ ] Role delegation and temporary permissions
- [ ] Audit logging for role changes
- [ ] Self-service role request workflow

