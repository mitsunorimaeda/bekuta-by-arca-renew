-- Fix: global_admin could not read organization_subscriptions due to missing RLS bypass.
-- This caused usePlanLimits to default to Free (30 athletes) for sponsored orgs
-- when accessed via AdminView.

-- Add global admin SELECT policy
CREATE POLICY "Global admins can read all subscriptions"
ON public.organization_subscriptions
FOR SELECT
TO authenticated
USING (is_global_admin());

-- Add global admin ALL policy for management
CREATE POLICY "Global admins can manage all subscriptions"
ON public.organization_subscriptions
FOR ALL
TO authenticated
USING (is_global_admin())
WITH CHECK (is_global_admin());
