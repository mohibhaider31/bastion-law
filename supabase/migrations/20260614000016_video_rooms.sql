-- Add video room URL to appointments
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS video_room_url TEXT;

-- Function: generate a Jitsi room URL for an appointment
CREATE OR REPLACE FUNCTION generate_video_room(p_appointment_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  room_id text;
BEGIN
  -- Deterministic room ID based on appointment UUID, so re-calling is idempotent
  room_id := 'bastion-' || replace(p_appointment_id::text, '-', '');
  RETURN 'https://meet.jit.si/' || room_id;
END;
$$;

-- Trigger: when appointment is confirmed, auto-set the video room URL
CREATE OR REPLACE FUNCTION set_video_room_on_confirm()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') AND NEW.meeting_type = 'video' THEN
    NEW.video_room_url := generate_video_room(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_video_room ON appointments;
CREATE TRIGGER trg_set_video_room
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_video_room_on_confirm();
