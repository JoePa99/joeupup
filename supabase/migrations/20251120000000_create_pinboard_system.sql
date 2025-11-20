-- Create pinboard collections table
CREATE TABLE IF NOT EXISTS public.pin_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create pins table
CREATE TABLE IF NOT EXISTS public.pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES public.pin_collections(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  conversation_id UUID,
  channel_id UUID,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text',
  tags TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pins_user_id ON public.pins(user_id);
CREATE INDEX IF NOT EXISTS idx_pins_company_id ON public.pins(company_id);
CREATE INDEX IF NOT EXISTS idx_pins_collection_id ON public.pins(collection_id);
CREATE INDEX IF NOT EXISTS idx_pins_message_id ON public.pins(message_id);
CREATE INDEX IF NOT EXISTS idx_pins_created_at ON public.pins(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pins_tags ON public.pins USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_pin_collections_user_id ON public.pin_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_pin_collections_company_id ON public.pin_collections(company_id);

-- Enable RLS
ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pin_collections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pins
CREATE POLICY "Users can view their own pins"
  ON public.pins
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pins"
  ON public.pins
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pins"
  ON public.pins
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pins"
  ON public.pins
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for pin_collections
CREATE POLICY "Users can view their own collections"
  ON public.pin_collections
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own collections"
  ON public.pin_collections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own collections"
  ON public.pin_collections
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own collections"
  ON public.pin_collections
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create default collections function
CREATE OR REPLACE FUNCTION create_default_pin_collections(p_user_id UUID, p_company_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Create Quick Pins collection
  INSERT INTO public.pin_collections (user_id, company_id, name, description, icon, color)
  VALUES (
    p_user_id,
    p_company_id,
    'Quick Pins',
    'Quickly saved snippets and notes',
    '📌',
    '#56E3FF'
  ) ON CONFLICT DO NOTHING;

  -- Create Favorites collection
  INSERT INTO public.pin_collections (user_id, company_id, name, description, icon, color)
  VALUES (
    p_user_id,
    p_company_id,
    'Favorites',
    'Your favorite content',
    '⭐',
    '#FFC107'
  ) ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default collections for new users
CREATE OR REPLACE FUNCTION trigger_create_default_pin_collections()
RETURNS TRIGGER AS $$
BEGIN
  -- Get user's company_id from their first company membership
  PERFORM create_default_pin_collections(
    NEW.id,
    (SELECT company_id FROM public.company_members WHERE user_id = NEW.id LIMIT 1)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Trigger creation commented out to avoid interfering with existing user setup
-- This can be enabled if needed or called manually for existing users
-- CREATE TRIGGER on_auth_user_created_create_pin_collections
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION trigger_create_default_pin_collections();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_pins_updated_at
  BEFORE UPDATE ON public.pins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pin_collections_updated_at
  BEFORE UPDATE ON public.pin_collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE public.pins IS 'Stores user-pinned content snippets from messages';
COMMENT ON TABLE public.pin_collections IS 'Organizes pins into user-created collections';
COMMENT ON COLUMN public.pins.content IS 'The selected text or content that was pinned';
COMMENT ON COLUMN public.pins.content_type IS 'Type of content (text, code, etc.)';
COMMENT ON COLUMN public.pins.metadata IS 'Additional context like original question, timestamp, etc.';
COMMENT ON COLUMN public.pins.tags IS 'Array of tags for cross-collection organization';
