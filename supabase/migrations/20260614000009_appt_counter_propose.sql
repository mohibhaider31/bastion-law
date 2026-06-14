-- Add counter_proposed status + counter_notes to appointments
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled', 'completed', 'counter_proposed'));
