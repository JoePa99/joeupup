# Supabase Health Monitoring System

## Overview

The Supabase Health Monitoring system provides administrators with comprehensive, real-time visibility into the health and performance of the Supabase backend infrastructure. This feature enables proactive monitoring and quick troubleshooting of potential issues.

## Features

### 1. **Overall System Status**
- Real-time health check with visual status indicators
- System-wide status: Healthy, Degraded, or Down
- Response time monitoring
- Last checked timestamp

### 2. **Service Status Monitoring**
The dashboard monitors four core Supabase services:

#### Database
- Connection status
- Response time
- Query execution health

#### Storage
- Bucket accessibility
- File operation status
- Storage service availability

#### Authentication
- Session management status
- Auth service availability
- User authentication capabilities

#### Realtime
- WebSocket connection status
- Channel creation capabilities
- Real-time subscription health

### 3. **Database Metrics**
- Total tables count
- Total rows across key tables
- Active connections
- Recent query activity

### 4. **Storage Metrics**
- Total storage buckets
- Total files stored
- Storage space used
- Storage limits and usage percentage

### 5. **Usage Statistics**
- Total authenticated users
- Estimated API requests
- Bandwidth usage
- Historical data for the last 30 days

### 6. **Edge Functions Monitoring**
- Individual edge function status (operational, down, or unknown)
- Response time per function
- Availability tracking for:
  - `analyze-document`
  - `generate-rich-content`
- CORS/Network error detection (common in development environments)
- Informative messages for unknown statuses

### 7. **Project Information**
- Project URL
- Project reference ID
- Region information
- Environment (production/development)

### 8. **Error Logging**
- Real-time error detection
- Service-specific error messages
- Timestamp tracking
- Visual error alerts

## Accessing the Dashboard

### Navigation
1. Log in as an admin user
2. Navigate to the Admin Dashboard
3. Click on "Supabase Health" in the admin sidebar menu
4. Or directly access: `/dashboard/supabase-health`

The dashboard uses the same sidebar layout as other admin pages for consistent navigation.

### URL
```
/dashboard/supabase-health
```

## How It Works

### Health Checks
The system performs the following checks:

1. **Database Connection Test**
   - Executes a simple query to the `profiles` table
   - Measures response time
   - Captures any connection errors

2. **Storage Connection Test**
   - Lists all storage buckets
   - Verifies storage service availability
   - Checks file access capabilities

3. **Auth Service Test**
   - Retrieves current session
   - Validates authentication service
   - Checks token refresh capabilities

4. **Realtime Service Test**
   - Creates a test channel
   - Subscribes to the channel
   - Cleans up test resources

### Status Levels

#### Healthy ✓
- All services operational
- Response times within normal range
- No errors detected

#### Degraded ⚠
- Some services experiencing issues
- Response times elevated
- Minor errors present
- WebSocket connections may be unstable

#### Down ✕
- Critical services unavailable
- Database connection failed
- Multiple service errors

#### Unknown ⚠
- Service status cannot be determined
- Common for edge functions in development (CORS restrictions)
- Network connectivity issues
- Not considered a critical error

## Utility Functions

### `checkSupabaseHealth()`
Performs comprehensive health checks on all Supabase services.

**Returns:** `SupabaseHealthMetrics`
```typescript
{
  connectionStatus: 'healthy' | 'degraded' | 'down',
  responseTime: number,
  databaseStatus: 'operational' | 'degraded' | 'down',
  storageStatus: 'operational' | 'degraded' | 'down',
  authStatus: 'operational' | 'degraded' | 'down',
  realtimeStatus: 'operational' | 'degraded' | 'down',
  errors: HealthCheckError[],
  timestamp: string
}
```

### `getDatabaseMetrics()`
Retrieves database usage and performance metrics.

**Returns:** `DatabaseMetrics | null`

### `getStorageMetrics()`
Fetches storage usage statistics.

**Returns:** `StorageMetrics | null`

### `getUsageMetrics()`
Gathers overall usage statistics for the Supabase project.

**Returns:** `UsageMetrics | null`

### `testEdgeFunctions()`
Tests availability and response time of edge functions.

**Returns:** Edge function status array

### `getSupabaseProjectInfo()`
Retrieves project configuration and environment details.

**Returns:** Project information object

## Visual Indicators

### Color Coding
- 🟢 **Green**: Operational/Healthy
- 🟡 **Yellow**: Degraded/Warning
- 🔴 **Red**: Down/Critical

### Icons
- ✓ CheckCircle: Healthy status
- ⚠ AlertTriangle: Warning/Degraded
- ✕ AlertCircle: Error/Down
- 🔄 RefreshCw: Manual refresh action

## Refresh Functionality

The dashboard includes a manual refresh button to update all metrics in real-time. This allows administrators to:
- Verify if issues have been resolved
- Get the latest metrics
- Confirm service restoration

## Error Handling

The system gracefully handles:
- Network timeouts
- Permission errors
- Service unavailability
- Invalid responses

All errors are:
- Logged with timestamps
- Displayed in the error section
- Service-specific for easy debugging

## Best Practices

### For Administrators

1. **Regular Monitoring**
   - Check the dashboard daily
   - Monitor during high-traffic periods
   - Keep an eye on response times

2. **Proactive Action**
   - Investigate degraded services immediately
   - Monitor error trends
   - Track usage patterns

3. **Issue Resolution**
   - Use error messages for debugging
   - Check service-specific status
   - Verify edge function availability

4. **Performance Optimization**
   - Monitor response times
   - Track database growth
   - Manage storage usage

## Technical Details

### File Structure
```
src/
├── pages/
│   └── AdminSupabaseHealth.tsx       # Main dashboard component
├── utils/
│   └── supabaseHealth.ts             # Health check utilities
├── components/
│   └── ui/
│       ├── admin-navigation.tsx      # Navigation with health link
│       └── admin-sidebar.tsx         # Sidebar with health link
└── App.tsx                           # Route configuration
```

### Dependencies
- React hooks for state management
- Supabase client for service checks
- Lucide React for icons
- Tailwind CSS for styling
- shadcn/ui components

### Protected Route
The dashboard is protected by `AdminProtectedRoute`, ensuring only authenticated administrators can access the monitoring system.

## Future Enhancements

Potential improvements for future versions:
- Historical metrics and trends
- Automated alerts via email/SMS
- Database query performance analytics
- Storage usage breakdown by bucket
- Real-time metric updates (auto-refresh)
- Custom alert thresholds
- Export metrics to CSV/PDF
- Integration with external monitoring services

## Troubleshooting

### Issue: All Services Show as Down
**Solution:** Check your internet connection and Supabase project status

### Issue: Edge Functions Show as "Unknown"
**Solution:** This is normal in development environments. CORS restrictions prevent proper health checks from localhost. In production, this should resolve automatically.

### Issue: Realtime Shows as Degraded
**Solution:** WebSocket connections can be unstable in development. This is usually not a concern unless it persists in production.

### Issue: CORS Errors in Console
**Solution:** These errors are expected when testing edge functions from localhost. They do not affect the health monitoring functionality.

### Issue: Metrics Not Loading
**Solution:** Refresh the page or check browser console for errors

### Issue: Storage Metrics Showing Zero
**Solution:** Verify storage buckets have appropriate read permissions

## Support

For issues or questions regarding the Supabase Health Monitoring system:
1. Check the error messages in the dashboard
2. Review the browser console for detailed logs
3. Verify Supabase project settings
4. Contact your system administrator

## Security Considerations

- Only admin users can access the dashboard
- No sensitive credentials are displayed
- All checks use read-only operations
- Error messages are sanitized for display

---

**Last Updated:** October 2, 2025
**Version:** 1.0.0

