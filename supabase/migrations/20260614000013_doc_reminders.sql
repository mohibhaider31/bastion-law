-- Enable pg_cron extension (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;

-- Helper function called by the cron job
CREATE OR REPLACE FUNCTION dispatch_due_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $fn$
DECLARE
  r RECORD;
  deadline_48h DATE := CURRENT_DATE + INTERVAL '2 days';
  deadline_24h DATE := CURRENT_DATE + INTERVAL '1 day';
BEGIN
  -- 48-hour task reminders
  FOR r IN
    SELECT t.id, t.title, t.due_date, t.client_id, t.matter_id,
           m.matter_ref
    FROM tasks t
    LEFT JOIN matters m ON m.id = t.matter_id
    WHERE t.status NOT IN ('done', 'cancelled')
      AND t.due_date = deadline_48h
      AND t.assigned_to = 'client'
  LOOP
    INSERT INTO notifications (user_id, type, title, body, matter_id)
    VALUES (
      r.client_id, 'case_update',
      'Action due in 48h: ' || r.title,
      '"' || r.title || '" is due in 2 days' || COALESCE(' (' || r.matter_ref || ')', '') || '.',
      r.matter_id
    );
  END LOOP;

  -- 24-hour task reminders
  FOR r IN
    SELECT t.id, t.title, t.due_date, t.client_id, t.matter_id,
           m.matter_ref
    FROM tasks t
    LEFT JOIN matters m ON m.id = t.matter_id
    WHERE t.status NOT IN ('done', 'cancelled')
      AND t.due_date = deadline_24h
      AND t.assigned_to = 'client'
  LOOP
    INSERT INTO notifications (user_id, type, title, body, matter_id)
    VALUES (
      r.client_id, 'case_update',
      'URGENT – Action due today: ' || r.title,
      '"' || r.title || '" is due TODAY' || COALESCE(' (' || r.matter_ref || ')', '') || '. Please complete immediately.',
      r.matter_id
    );
  END LOOP;

  -- 48-hour event reminders
  FOR r IN
    SELECT e.id, e.title, e.event_date, e.matter_id,
           m.lead_lawyer_id, m.client_id, m.matter_ref
    FROM events e
    JOIN matters m ON m.id = e.matter_id
    WHERE e.event_date = deadline_48h
  LOOP
    INSERT INTO notifications (user_id, type, title, body, matter_id)
    VALUES (r.client_id, 'case_update', 'Upcoming in 48h: ' || r.title,
      '"' || r.title || '" in 2 days' || COALESCE(' (' || r.matter_ref || ')', '') || '.', r.matter_id);
    INSERT INTO notifications (user_id, type, title, body, matter_id)
    VALUES (r.lead_lawyer_id, 'case_update', 'Upcoming in 48h: ' || r.title,
      '"' || r.title || '" in 2 days' || COALESCE(' (' || r.matter_ref || ')', '') || '.', r.matter_id);
  END LOOP;

  -- 24-hour event reminders
  FOR r IN
    SELECT e.id, e.title, e.event_date, e.matter_id,
           m.lead_lawyer_id, m.client_id, m.matter_ref
    FROM events e
    JOIN matters m ON m.id = e.matter_id
    WHERE e.event_date = deadline_24h
  LOOP
    INSERT INTO notifications (user_id, type, title, body, matter_id)
    VALUES (r.client_id, 'case_update', 'Tomorrow: ' || r.title,
      '"' || r.title || '" is tomorrow' || COALESCE(' (' || r.matter_ref || ')', '') || '. Please be prepared.', r.matter_id);
    INSERT INTO notifications (user_id, type, title, body, matter_id)
    VALUES (r.lead_lawyer_id, 'case_update', 'Tomorrow: ' || r.title,
      '"' || r.title || '" is tomorrow' || COALESCE(' (' || r.matter_ref || ')', '') || '.', r.matter_id);
  END LOOP;
END;
$fn$;

-- Schedule: daily at 08:00 PKT = 03:00 UTC
SELECT cron.unschedule('doc-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'doc-reminders');

SELECT cron.schedule('doc-reminders', '0 3 * * *', 'SELECT dispatch_due_reminders()');
