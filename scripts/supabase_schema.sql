-- Create the contacts table in Supabase
CREATE TABLE IF NOT EXISTS public.contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    region TEXT,
    job_title TEXT,
    member_type TEXT,
    status TEXT DEFAULT 'UNASSIGNED',
    survey_result TEXT,
    notes TEXT,
    assigned_to TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for access (Simple for now: allow all authenticated users)
-- NOTE: In production, we should restrict this based on role.
CREATE POLICY "Allow all access to authenticated users" 
ON public.contacts 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Create a policy for anonymous access if needed (optional)
-- CREATE POLICY "Allow anonymous read access" ON public.contacts FOR SELECT TO anon USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_name ON public.contacts (name);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts (phone);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON public.contacts (assigned_to);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON public.contacts (status);
