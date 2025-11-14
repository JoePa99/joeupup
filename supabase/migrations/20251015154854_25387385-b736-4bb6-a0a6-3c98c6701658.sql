-- Add purchased_seats column to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS purchased_seats INTEGER DEFAULT 1;