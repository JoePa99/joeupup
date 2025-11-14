-- Usage Tracking Triggers
-- ======================

-- Function to check if user has remaining messages before allowing chat
CREATE OR REPLACE FUNCTION check_user_message_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_user_usage RECORD;
    v_company_status TEXT;
BEGIN
    -- Only track user messages (not assistant responses)
    IF NEW.role != 'user' THEN
        RETURN NEW;
    END IF;

    -- Get user_id from conversation or channel
    DECLARE
        v_user_id UUID;
        v_company_id UUID;
    BEGIN
        IF NEW.conversation_id IS NOT NULL THEN
            -- Get user_id from conversation
            SELECT user_id, company_id INTO v_user_id, v_company_id
            FROM public.chat_conversations
            WHERE id = NEW.conversation_id;
        ELSIF NEW.channel_id IS NOT NULL THEN
            -- For channel messages, we need to get the user from somewhere
            -- Assuming there's a way to track who sent the message
            -- This might need adjustment based on your channel implementation
            RETURN NEW; -- For now, skip channels
        ELSE
            RETURN NEW;
        END IF;

        -- Check company subscription status
        SELECT subscription_status INTO v_company_status
        FROM public.companies
        WHERE id = v_company_id;

        -- Only enforce limits if subscription is not active
        IF v_company_status != 'active' AND v_company_status != 'trialing' THEN
            RAISE EXCEPTION 'Subscription is not active. Please update your billing information.'
                USING ERRCODE = 'P0001';
        END IF;

        -- Get current usage for this user
        SELECT * INTO v_user_usage
        FROM public.user_usage
        WHERE user_id = v_user_id
        AND period_start <= NOW()
        AND period_end >= NOW()
        ORDER BY created_at DESC
        LIMIT 1;

        -- If no usage record exists, something is wrong
        IF NOT FOUND THEN
            RAISE EXCEPTION 'No usage record found for user. Please contact support.'
                USING ERRCODE = 'P0002';
        END IF;

        -- Check if user has exceeded their limit
        IF v_user_usage.messages_used >= v_user_usage.messages_limit THEN
            RAISE EXCEPTION 'Message limit exceeded. You have used % of % messages. Please upgrade your plan or wait for the next billing period.', v_user_usage.messages_used, v_user_usage.messages_limit
                USING ERRCODE = 'P0003';
        END IF;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage counter after message is created
CREATE OR REPLACE FUNCTION increment_user_message_usage()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
BEGIN
    -- Only track user messages (not assistant responses)
    IF NEW.role != 'user' THEN
        RETURN NEW;
    END IF;

    -- Get user_id from conversation or channel
    IF NEW.conversation_id IS NOT NULL THEN
        SELECT user_id, company_id INTO v_user_id, v_company_id
        FROM public.chat_conversations
        WHERE id = NEW.conversation_id;
        
        -- Increment the usage counter
        UPDATE public.user_usage
        SET 
            messages_used = messages_used + 1,
            updated_at = NOW()
        WHERE user_id = v_user_id
        AND period_start <= NOW()
        AND period_end >= NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to check message limit BEFORE insert
CREATE TRIGGER check_message_limit_trigger
BEFORE INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION check_user_message_limit();

-- Create trigger to increment usage AFTER insert
CREATE TRIGGER increment_usage_trigger
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION increment_user_message_usage();

-- Function to initialize usage for a new user
CREATE OR REPLACE FUNCTION initialize_user_usage(
    p_user_id UUID,
    p_company_id UUID,
    p_message_limit INTEGER,
    p_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    p_period_end TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 month')
)
RETURNS UUID AS $$
DECLARE
    v_usage_id UUID;
BEGIN
    INSERT INTO public.user_usage (
        user_id,
        company_id,
        messages_used,
        messages_limit,
        period_start,
        period_end
    ) VALUES (
        p_user_id,
        p_company_id,
        0,
        p_message_limit,
        p_period_start,
        p_period_end
    )
    RETURNING id INTO v_usage_id;

    RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset monthly usage and archive history
CREATE OR REPLACE FUNCTION reset_monthly_usage(p_company_id UUID)
RETURNS TABLE(users_reset INTEGER, records_archived INTEGER) AS $$
DECLARE
    v_users_reset INTEGER := 0;
    v_records_archived INTEGER := 0;
BEGIN
    -- Archive current usage to history
    INSERT INTO public.usage_history (
        user_id,
        company_id,
        messages_used,
        messages_limit,
        period_start,
        period_end
    )
    SELECT 
        user_id,
        company_id,
        messages_used,
        messages_limit,
        period_start,
        period_end
    FROM public.user_usage
    WHERE company_id = p_company_id
    AND period_end < NOW();

    GET DIAGNOSTICS v_records_archived = ROW_COUNT;

    -- Reset usage for all users in the company
    UPDATE public.user_usage
    SET 
        messages_used = 0,
        period_start = NOW(),
        period_end = NOW() + INTERVAL '1 month',
        updated_at = NOW()
    WHERE company_id = p_company_id
    AND period_end < NOW();

    GET DIAGNOSTICS v_users_reset = ROW_COUNT;

    RETURN QUERY SELECT v_users_reset, v_records_archived;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current usage for a user
CREATE OR REPLACE FUNCTION get_user_current_usage(p_user_id UUID)
RETURNS TABLE(
    messages_used INTEGER,
    messages_limit INTEGER,
    messages_remaining INTEGER,
    usage_percentage NUMERIC,
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uu.messages_used,
        uu.messages_limit,
        (uu.messages_limit - uu.messages_used) as messages_remaining,
        ROUND((uu.messages_used::NUMERIC / NULLIF(uu.messages_limit, 0)::NUMERIC * 100), 2) as usage_percentage,
        uu.period_start,
        uu.period_end
    FROM public.user_usage uu
    WHERE uu.user_id = p_user_id
    AND uu.period_start <= NOW()
    AND uu.period_end >= NOW()
    ORDER BY uu.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get company-wide usage stats (admin only)
CREATE OR REPLACE FUNCTION get_company_usage_stats(p_company_id UUID)
RETURNS TABLE(
    user_id UUID,
    user_email TEXT,
    user_name TEXT,
    messages_used INTEGER,
    messages_limit INTEGER,
    usage_percentage NUMERIC,
    last_message_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Check if requesting user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND company_id = p_company_id
        AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Only company admins can view company-wide usage'
            USING ERRCODE = 'P0004';
    END IF;

    RETURN QUERY
    SELECT 
        uu.user_id,
        p.email,
        COALESCE(p.first_name || ' ' || p.last_name, p.email) as user_name,
        uu.messages_used,
        uu.messages_limit,
        ROUND((uu.messages_used::NUMERIC / NULLIF(uu.messages_limit, 0)::NUMERIC * 100), 2) as usage_percentage,
        (
            SELECT MAX(cm.created_at)
            FROM public.chat_messages cm
            JOIN public.chat_conversations cc ON cm.conversation_id = cc.id
            WHERE cc.user_id = uu.user_id
            AND cm.role = 'user'
        ) as last_message_at
    FROM public.user_usage uu
    JOIN public.profiles p ON uu.user_id = p.id
    WHERE uu.company_id = p_company_id
    AND uu.period_start <= NOW()
    AND uu.period_end >= NOW()
    ORDER BY uu.messages_used DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON FUNCTION check_user_message_limit() IS 'Trigger function to verify user has not exceeded message limit before creating a message';
COMMENT ON FUNCTION increment_user_message_usage() IS 'Trigger function to increment message usage counter after message creation';
COMMENT ON FUNCTION initialize_user_usage(UUID, UUID, INTEGER, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) IS 'Initialize usage tracking for a new user';
COMMENT ON FUNCTION reset_monthly_usage(UUID) IS 'Archive current usage and reset counters for monthly billing cycle';
COMMENT ON FUNCTION get_user_current_usage(UUID) IS 'Get current usage statistics for a specific user';
COMMENT ON FUNCTION get_company_usage_stats(UUID) IS 'Get usage statistics for all users in a company (admin only)';

