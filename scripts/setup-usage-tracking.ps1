# Usage Tracking Setup Script for Windows PowerShell
# This script guides you through setting up the usage tracking feature

$ErrorActionPreference = "Stop"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "📊 Usage Tracking Setup Script" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
try {
    $null = Get-Command supabase -ErrorAction Stop
    Write-Host "✅ Supabase CLI is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Supabase CLI is not installed" -ForegroundColor Red
    Write-Host "Install it with: npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Step 1: Apply migrations
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Step 1: Applying Database Migrations" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will create the necessary tables and functions" -ForegroundColor Yellow
Write-Host "You will be prompted for your database password" -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to continue"

try {
    supabase db push
    Write-Host "✅ Migrations applied successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to apply migrations: $_" -ForegroundColor Red
    Write-Host "You may need to run this manually from the terminal" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Step 2: Deploy edge function
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Step 2: Deploying Edge Function" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Deploying get-usage-stats function..." -ForegroundColor Yellow
Write-Host ""

try {
    supabase functions deploy get-usage-stats
    Write-Host "✅ Edge function deployed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to deploy edge function: $_" -ForegroundColor Red
    Write-Host "You may need to run this manually: supabase functions deploy get-usage-stats" -ForegroundColor Yellow
}

Write-Host ""

# Step 3: Backfill users
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Step 3: Initializing User Usage Records" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will create usage records for all existing users" -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to continue"

try {
    node scripts/backfill-user-usage.js
    Write-Host "✅ User usage records initialized" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Backfill had some issues - check output above" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "✨ Setup Complete!" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "1. Refresh your application" -ForegroundColor White
Write-Host "2. Check the sidebar for the usage indicator" -ForegroundColor White
Write-Host "3. Navigate to /usage to see detailed stats" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Remember to update Stripe product IDs in subscription_plans table" -ForegroundColor Yellow
Write-Host "   See USAGE_SETUP_GUIDE.md for details" -ForegroundColor Yellow
Write-Host ""






























