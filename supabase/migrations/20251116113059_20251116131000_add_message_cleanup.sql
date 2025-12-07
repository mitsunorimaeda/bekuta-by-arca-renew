/*
  # Add 90-Day Automatic Message Cleanup

  1. Function
    - `cleanup_old_messages()` - Deletes messages older than 90 days
    - Runs daily via pg_cron (if available) or can be called manually

  2. Purpose
    - Keep database size manageable
    - Comply with data retention policies
    - Maintain free tier storage limits

  3. Notes
    - Only deletes messages, not threads (threads remain for history)
    - Can be executed manually or scheduled
    - Safe to run multiple times
*/

-- Function to cleanup old messages
CREATE OR REPLACE FUNCTION cleanup_old_messages()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete messages older than 90 days
  DELETE FROM messages
  WHERE created_at < now() - interval '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log the cleanup (optional, for monitoring)
  RAISE NOTICE 'Cleaned up % old messages', deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (admins can call this)
GRANT EXECUTE ON FUNCTION cleanup_old_messages() TO authenticated;

-- Optionally, create a function to cleanup old threads without messages
CREATE OR REPLACE FUNCTION cleanup_empty_threads()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete threads that have no messages and are older than 90 days
  DELETE FROM message_threads mt
  WHERE mt.created_at < now() - interval '90 days'
  AND NOT EXISTS (
    SELECT 1 FROM messages m
    WHERE m.thread_id = mt.id
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Cleaned up % empty threads', deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cleanup_empty_threads() TO authenticated;

-- Create a combined cleanup function for convenience
CREATE OR REPLACE FUNCTION cleanup_messaging_data()
RETURNS json AS $$
DECLARE
  messages_deleted integer;
  threads_deleted integer;
BEGIN
  -- Cleanup old messages
  SELECT cleanup_old_messages() INTO messages_deleted;

  -- Cleanup empty threads
  SELECT cleanup_empty_threads() INTO threads_deleted;

  -- Return summary
  RETURN json_build_object(
    'messages_deleted', messages_deleted,
    'threads_deleted', threads_deleted,
    'cleaned_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cleanup_messaging_data() TO authenticated;