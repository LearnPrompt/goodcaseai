-- Manual rollback only.
-- Export analytics_events and feedback_messages before running this file.
-- Dropping source/evidence/source_candidate_id columns or their index is
-- intentionally omitted because it would destroy reviewed Case provenance.
-- Keeping unused nullable/defaulted columns is safer than deleting production
-- evidence or breaking resumable publication records.

begin;

drop table if exists public.feedback_messages;
drop table if exists public.analytics_events;

commit;
