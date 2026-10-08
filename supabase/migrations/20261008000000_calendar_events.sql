CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  time text,
  event_date date NOT NULL,
  collab_id text NOT NULL,
  creator_email text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all events
CREATE POLICY "Allow select all calendar_events" ON public.calendar_events
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert events
CREATE POLICY "Allow insert calendar_events" ON public.calendar_events
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users to update/delete their own events
CREATE POLICY "Allow update own calendar_events" ON public.calendar_events
  FOR UPDATE USING (creator_email = auth.jwt()->>'email' OR auth.role() = 'service_role');

CREATE POLICY "Allow delete own calendar_events" ON public.calendar_events
  FOR DELETE USING (creator_email = auth.jwt()->>'email' OR auth.role() = 'service_role');
