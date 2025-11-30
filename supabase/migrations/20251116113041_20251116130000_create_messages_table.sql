/*
  # Create Bidirectional Messaging System

  1. New Tables
    - `message_threads` - Conversation threads between users
      - `id` (uuid, primary key)
      - `participant1_id` (uuid, references users) - First participant
      - `participant2_id` (uuid, references users) - Second participant
      - `last_message_at` (timestamp) - Last activity timestamp
      - `created_at` (timestamp)

    - `messages` - Individual messages in threads
      - `id` (uuid, primary key)
      - `thread_id` (uuid, references message_threads)
      - `sender_id` (uuid, references users)
      - `receiver_id` (uuid, references users)
      - `content` (text) - Message content
      - `is_read` (boolean) - Read status
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Users can only access threads they participate in
    - Users can only read messages in their threads
    - Users can only send messages in their threads
    - Users can only mark their received messages as read

  3. Performance
    - Index on thread participants for fast lookup
    - Index on thread last_message_at for sorting
    - Index on message thread_id + created_at for pagination
    - Index on receiver_id + is_read for unread counts

  4. Notes
    - Messages are kept for 90 days (cleanup handled separately)
    - Text-only messages to minimize storage (no file attachments)
    - Optimized for coach-athlete communication
*/

-- Create message_threads table
CREATE TABLE IF NOT EXISTS message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant1_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  participant2_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  last_message_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,

  -- Ensure participant1_id < participant2_id to avoid duplicate threads
  CONSTRAINT participant_order CHECK (participant1_id < participant2_id),
  CONSTRAINT different_participants CHECK (participant1_id != participant2_id),
  -- Unique constraint to prevent duplicate threads
  UNIQUE(participant1_id, participant2_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES message_threads(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL CHECK (length(content) > 0 AND length(content) <= 2000),
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Ensure sender and receiver are different
  CONSTRAINT different_users CHECK (sender_id != receiver_id)
);

-- Enable RLS
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for message_threads

-- Users can view threads they participate in
CREATE POLICY "Users can view own threads"
  ON message_threads FOR SELECT
  TO authenticated
  USING (
    auth.uid() = participant1_id
    OR auth.uid() = participant2_id
  );

-- Users can create threads with other users in their organization
CREATE POLICY "Users can create threads with organization members"
  ON message_threads FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = participant1_id OR auth.uid() = participant2_id)
    AND EXISTS (
      SELECT 1 FROM organization_members om1
      JOIN organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = participant1_id
      AND om2.user_id = participant2_id
    )
  );

-- Users can update last_message_at in their threads
CREATE POLICY "Users can update own threads"
  ON message_threads FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = participant1_id
    OR auth.uid() = participant2_id
  )
  WITH CHECK (
    auth.uid() = participant1_id
    OR auth.uid() = participant2_id
  );

-- RLS Policies for messages

-- Users can view messages in their threads
CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
  );

-- Users can send messages in their threads
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM message_threads mt
      WHERE mt.id = thread_id
      AND (mt.participant1_id = auth.uid() OR mt.participant2_id = auth.uid())
      AND (mt.participant1_id = receiver_id OR mt.participant2_id = receiver_id)
    )
  );

-- Users can update read status of their received messages
CREATE POLICY "Users can mark messages as read"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- Performance Indexes

-- Thread lookups by participant
CREATE INDEX IF NOT EXISTS idx_message_threads_participant1
  ON message_threads(participant1_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_threads_participant2
  ON message_threads(participant2_id, last_message_at DESC);

-- Message lookups within threads
CREATE INDEX IF NOT EXISTS idx_messages_thread_created
  ON messages(thread_id, created_at DESC);

-- Unread message counts
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread
  ON messages(receiver_id, is_read, created_at DESC)
  WHERE is_read = false;

-- Sender message lookups
CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON messages(sender_id, created_at DESC);

-- Update last_message_at trigger
CREATE OR REPLACE FUNCTION update_thread_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE message_threads
  SET last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_thread_last_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_last_message();

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_messages_updated_at();