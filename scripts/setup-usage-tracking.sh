#!/bin/bash

# Usage Tracking Setup Script
# This script guides you through setting up the usage tracking feature

set -e

echo "================================================"
echo "📊 Usage Tracking Setup Script"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI is not installed${NC}"
    echo "Install it with: npm install -g supabase"
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI is installed${NC}"
echo ""

# Step 1: Apply migrations
echo "================================================"
echo "Step 1: Applying Database Migrations"
echo "================================================"
echo ""
echo "This will create the necessary tables and functions"
echo "You will be prompted for your database password"
echo ""
read -p "Press Enter to continue..."

supabase db push

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migrations applied successfully${NC}"
else
    echo -e "${RED}❌ Failed to apply migrations${NC}"
    exit 1
fi

echo ""

# Step 2: Deploy edge function
echo "================================================"
echo "Step 2: Deploying Edge Function"
echo "================================================"
echo ""
echo "Deploying get-usage-stats function..."
echo ""

supabase functions deploy get-usage-stats

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Edge function deployed successfully${NC}"
else
    echo -e "${RED}❌ Failed to deploy edge function${NC}"
    exit 1
fi

echo ""

# Step 3: Backfill users
echo "================================================"
echo "Step 3: Initializing User Usage Records"
echo "================================================"
echo ""
echo "This will create usage records for all existing users"
echo ""
read -p "Press Enter to continue..."

node scripts/backfill-user-usage.js

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ User usage records initialized${NC}"
else
    echo -e "${YELLOW}⚠️  Backfill had some issues - check output above${NC}"
fi

echo ""
echo "================================================"
echo "✨ Setup Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Refresh your application"
echo "2. Check the sidebar for the usage indicator"
echo "3. Navigate to /usage to see detailed stats"
echo ""
echo -e "${YELLOW}⚠️  Remember to update Stripe product IDs in subscription_plans table${NC}"
echo "   See USAGE_SETUP_GUIDE.md for details"
echo ""






























