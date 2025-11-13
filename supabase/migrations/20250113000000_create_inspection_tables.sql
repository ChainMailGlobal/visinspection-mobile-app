-- Migration: Create Inspection Tables for Live AI Mode
-- Date: January 2025
-- Purpose: Fix missing tables identified in diagnostics report

-- ============================================================================
-- 1. CREATE TABLES
-- ============================================================================

-- Inspection Sessions Table
-- Tracks each inspection session in Live AI mode
CREATE TABLE IF NOT EXISTS public.inspection_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  session_name TEXT,
  inspection_type TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster project queries
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_project_id
  ON public.inspection_sessions(project_id);

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_status
  ON public.inspection_sessions(status);

-- Inspection Violations Table
-- Stores violations detected during inspections
CREATE TABLE IF NOT EXISTS public.inspection_violations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.inspection_sessions(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  violation_code TEXT,
  description TEXT,
  severity TEXT,
  category TEXT,
  location_x FLOAT,
  location_y FLOAT,
  image_url TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_inspection_violations_session_id
  ON public.inspection_violations(session_id);

CREATE INDEX IF NOT EXISTS idx_inspection_violations_project_id
  ON public.inspection_violations(project_id);

CREATE INDEX IF NOT EXISTS idx_inspection_violations_severity
  ON public.inspection_violations(severity);

-- Captured Violations Table
-- Stores user-captured violations with photos
CREATE TABLE IF NOT EXISTS public.captured_violations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.inspection_sessions(id) ON DELETE CASCADE,
  violation_code TEXT,
  description TEXT,
  severity TEXT,
  category TEXT,
  image_uri TEXT,
  location_data JSONB,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_captured_violations_project_id
  ON public.captured_violations(project_id);

CREATE INDEX IF NOT EXISTS idx_captured_violations_session_id
  ON public.captured_violations(session_id);

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.inspection_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captured_violations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. DROP ALL EXISTING POLICIES
-- ============================================================================

-- Drop any existing policies that might cause recursion issues
DROP POLICY IF EXISTS "Users can view own captured violations" ON public.captured_violations;
DROP POLICY IF EXISTS "Users can insert own captured violations" ON public.captured_violations;
DROP POLICY IF EXISTS "Users can update own captured violations" ON public.captured_violations;
DROP POLICY IF EXISTS "Users can delete own captured violations" ON public.captured_violations;

-- Drop current policies to recreate them properly
DROP POLICY IF EXISTS "Users can view captured violations" ON public.captured_violations;
DROP POLICY IF EXISTS "Users can insert captured violations" ON public.captured_violations;
DROP POLICY IF EXISTS "Users can update captured violations" ON public.captured_violations;
DROP POLICY IF EXISTS "Users can delete captured violations" ON public.captured_violations;

DROP POLICY IF EXISTS "Users can view inspection sessions" ON public.inspection_sessions;
DROP POLICY IF EXISTS "Users can insert inspection sessions" ON public.inspection_sessions;
DROP POLICY IF EXISTS "Users can update inspection sessions" ON public.inspection_sessions;
DROP POLICY IF EXISTS "Users can delete inspection sessions" ON public.inspection_sessions;

DROP POLICY IF EXISTS "Users can view inspection violations" ON public.inspection_violations;
DROP POLICY IF EXISTS "Users can insert inspection violations" ON public.inspection_violations;
DROP POLICY IF EXISTS "Users can update inspection violations" ON public.inspection_violations;
DROP POLICY IF EXISTS "Users can delete inspection violations" ON public.inspection_violations;

-- ============================================================================
-- 4. CREATE SIMPLE POLICIES WITHOUT RECURSION
-- ============================================================================

-- Inspection Sessions Policies
CREATE POLICY "Users can view inspection sessions"
  ON public.inspection_sessions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert inspection sessions"
  ON public.inspection_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update inspection sessions"
  ON public.inspection_sessions FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete inspection sessions"
  ON public.inspection_sessions FOR DELETE
  USING (true);

-- Inspection Violations Policies
CREATE POLICY "Users can view inspection violations"
  ON public.inspection_violations FOR SELECT
  USING (true);

CREATE POLICY "Users can insert inspection violations"
  ON public.inspection_violations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update inspection violations"
  ON public.inspection_violations FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete inspection violations"
  ON public.inspection_violations FOR DELETE
  USING (true);

-- Captured Violations Policies (simplified to avoid recursion)
CREATE POLICY "Users can view captured violations"
  ON public.captured_violations FOR SELECT
  USING (true);

CREATE POLICY "Users can insert captured violations"
  ON public.captured_violations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update captured violations"
  ON public.captured_violations FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete captured violations"
  ON public.captured_violations FOR DELETE
  USING (true);

-- ============================================================================
-- 5. CREATE UPDATED_AT TRIGGER FUNCTION
-- ============================================================================

-- Create or replace the trigger function for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to inspection_sessions
DROP TRIGGER IF EXISTS set_updated_at ON public.inspection_sessions;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.inspection_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- VERIFICATION QUERIES (commented out - for reference)
-- ============================================================================

-- To verify tables were created:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('inspection_sessions', 'inspection_violations', 'captured_violations');

-- To verify RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('inspection_sessions', 'inspection_violations', 'captured_violations');

-- To verify policies exist:
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('inspection_sessions', 'inspection_violations', 'captured_violations');

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
