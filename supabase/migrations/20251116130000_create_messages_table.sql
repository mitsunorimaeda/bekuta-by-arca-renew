/*
  # Create Bidirectional Messaging System (SAFE / IDEMPOTENT)

  - message_threads / messages
  - RLS + policies
  - indexes
  - triggers
  - 何回流しても落ちないように DROP IF EXISTS を徹底
*/

SET search_path = public;

-- ============================================================================
-- 1) Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant1_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  participant2_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  last_message_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,

  -- Ensure participant1_id < participant2_id to avoid duplicate threads
  CONSTRAINT participant_order CHECK (participant1_id < participant2_id),
  CONSTRAINT different_participants CHECK (participant1_id != participant2_id),
  UNIQUE(participant1_id, participant2_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES public.message_threads(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL CHECK (length(content) > 0 AND length(content) <= 2000),
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT different_users CHECK (sender_id != receiver_id)
);

-- ============================================================================
-- 2) RLS enable
-- ============================================================================

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3) Drop existing policies (so rerun won't collide)
-- ============================================================================

-- message_threads policies
DROP POLICY IF EXISTS "Users can view own threads" ON public.message_threads;
DROP POLICY IF EXISTS "Users can create threads with organization members" ON public.message_threads;
DROP POLICY IF EXISTS "Users can update own threads" ON public.message_threads;

-- messages policies
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can mark messages as read" ON public.messages;

-- ============================================================================
-- 4) Policies (recreate)
-- ============================================================================

-- Users can view threads they participate in
CREATE POLICY "Users can view own threads"
  ON public.message_threads
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = participant1_id
    OR auth.uid() = participant2_id
  );

-- Users can create threads with other users in their organization
CREATE POLICY "Users can create threads with organization members"
  ON public.message_threads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = participant1_id OR auth.uid() = participant2_id)
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om1
      JOIN public.organization_members om2
        ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = participant1_id
        AND om2.user_id = participant2_id
    )
  );

-- Users can update last_message_at in their threads
CREATE POLICY "Users can update own threads"
  ON public.message_threads
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = participant1_id
    OR auth.uid() = participant2_id
  )
  WITH CHECK (
    auth.uid() = participant1_id
    OR auth.uid() = participant2_id
  );

-- Users can view messages in their threads
CREATE POLICY "Users can view own messages"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
  );

-- Users can send messages in their threads
CREATE POLICY "Users can send messages"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.message_threads mt
      WHERE mt.id = thread_id
        AND (mt.participant1_id = auth.uid() OR mt.participant2_id = auth.uid())
        AND (mt.participant1_id = receiver_id OR mt.participant2_id = receiver_id)
    )
  );

-- Users can update read status of their received messages
CREATE POLICY "Users can mark messages as read"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- ============================================================================
-- 5) Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_message_threads_participant1
  ON public.message_threads(participant1_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_threads_participant2
  ON public.message_threads(participant2_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_thread_created
  ON public.messages(thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread
  ON public.messages(receiver_id, is_read, created_at DESC)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON public.messages(sender_id, created_at DESC);

-- ============================================================================
-- 6) Triggers / Functions (safe)
-- ============================================================================

-- last_message_at update
CREATE OR REPLACE FUNCTION public.update_thread_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.message_threads
  SET last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_thread_last_message ON public.messages;
CREATE TRIGGER trigger_update_thread_last_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_thread_last_message();

-- updated_at auto update
CREATE OR REPLACE FUNCTION public.update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_messages_updated_at ON public.messages;
CREATE TRIGGER trigger_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_messages_updated_at();