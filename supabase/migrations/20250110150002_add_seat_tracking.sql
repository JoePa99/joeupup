-- Add Seat Tracking to Companies
-- ==============================

-- Add purchased_seats column to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS purchased_seats INTEGER DEFAULT 1;

-- Add index for seat tracking
CREATE INDEX IF NOT EXISTS idx_companies_seats ON public.companies(purchased_seats);

-- Function to get active user count for a company
CREATE OR REPLACE FUNCTION get_company_active_users(p_company_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT id) INTO v_count
  FROM public.profiles
  WHERE company_id = p_company_id;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if company has available seats
CREATE OR REPLACE FUNCTION has_available_seats(p_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_active_users INTEGER;
  v_purchased_seats INTEGER;
BEGIN
  -- Get active user count
  SELECT COUNT(DISTINCT id) INTO v_active_users
  FROM public.profiles
  WHERE company_id = p_company_id;
  
  -- Get purchased seats
  SELECT purchased_seats INTO v_purchased_seats
  FROM public.companies
  WHERE id = p_company_id;
  
  -- Return true if there are available seats
  RETURN (v_active_users < v_purchased_seats);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for seat usage statistics
CREATE OR REPLACE VIEW company_seat_usage AS
SELECT 
  c.id as company_id,
  c.name as company_name,
  c.purchased_seats,
  COUNT(DISTINCT p.id) as active_users,
  (c.purchased_seats - COUNT(DISTINCT p.id)) as available_seats,
  ROUND((COUNT(DISTINCT p.id)::NUMERIC / NULLIF(c.purchased_seats, 0)::NUMERIC * 100), 2) as usage_percentage
FROM public.companies c
LEFT JOIN public.profiles p ON p.company_id = c.id
GROUP BY c.id, c.name, c.purchased_seats;

-- Grant access to the view
GRANT SELECT ON company_seat_usage TO authenticated;
GRANT SELECT ON company_seat_usage TO service_role;

-- Add helpful comments
COMMENT ON COLUMN public.companies.purchased_seats IS 'Number of seats purchased in subscription plan';
COMMENT ON FUNCTION get_company_active_users(UUID) IS 'Get count of active users in a company';
COMMENT ON FUNCTION has_available_seats(UUID) IS 'Check if company has available seats for new members';
COMMENT ON VIEW company_seat_usage IS 'Real-time view of seat usage across all companies';

