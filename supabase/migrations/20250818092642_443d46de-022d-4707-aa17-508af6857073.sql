-- Fix RLS policies to allow company and onboarding session creation during signup

-- 1. Add INSERT policy for companies table
CREATE POLICY "Users can insert companies during signup" 
  ON public.companies 
  FOR INSERT 
  WITH CHECK (true);

-- 2. Add INSERT policy for onboarding_sessions table  
CREATE POLICY "Users can insert their own onboarding session" 
  ON public.onboarding_sessions 
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- 3. Data fix: Create company for users who don't have one
DO $$
DECLARE
    user_record RECORD;
    new_company_id UUID;
    session_exists BOOLEAN;
BEGIN
    -- Find users without a company_id
    FOR user_record IN 
        SELECT id, email 
        FROM public.profiles 
        WHERE company_id IS NULL
    LOOP
        -- Create a company for this user (extract domain from email for company name)
        INSERT INTO public.companies (name, domain)
        VALUES (
            COALESCE(
                SPLIT_PART(user_record.email, '@', 2), 
                'User Company'
            ),
            SPLIT_PART(user_record.email, '@', 2)
        )
        RETURNING id INTO new_company_id;
        
        -- Update user profile with the new company_id
        UPDATE public.profiles 
        SET company_id = new_company_id 
        WHERE id = user_record.id;
        
        -- Check if onboarding session exists
        SELECT EXISTS(
            SELECT 1 FROM public.onboarding_sessions 
            WHERE user_id = user_record.id
        ) INTO session_exists;
        
        -- Create onboarding session if it doesn't exist
        IF NOT session_exists THEN
            INSERT INTO public.onboarding_sessions (
                user_id, 
                company_id, 
                current_step, 
                progress_percentage,
                status
            )
            VALUES (
                user_record.id, 
                new_company_id, 
                1, 
                0,
                'in_progress'
            );
        END IF;
        
    END LOOP;
END $$;