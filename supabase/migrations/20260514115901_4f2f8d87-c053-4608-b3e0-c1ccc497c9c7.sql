
CREATE OR REPLACE FUNCTION public.assign_meeting_slots(p_event_id uuid)
 RETURNS TABLE(assigned integer, skipped integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ev RECORD;
  m RECORD;
  slot_start timestamptz;
  duration interval;
  room_name text;
  found_slot boolean;
  picked_time timestamptz;
  picked_room text;
  total_assigned integer := 0;
  total_skipped integer := 0;
BEGIN
  SELECT * INTO ev FROM public.events WHERE id = p_event_id;
  IF ev IS NULL OR ev.meetings_start_at IS NULL OR ev.meetings_end_at IS NULL THEN
    RAISE EXCEPTION 'Evento sin ventana de reuniones configurada';
  END IF;

  duration := make_interval(mins => COALESCE(ev.slot_duration_minutes, 30));

  FOR m IN
    SELECT * FROM public.meetings_1to1
    WHERE event_id = p_event_id AND scheduled_time IS NULL AND status = 'pending'
    ORDER BY created_at ASC
  LOOP
    found_slot := false;
    slot_start := ev.meetings_start_at;

    WHILE slot_start + duration <= ev.meetings_end_at AND NOT found_slot LOOP
      FOREACH room_name IN ARRAY ev.rooms LOOP
        IF EXISTS (
          SELECT 1 FROM public.meetings_1to1
          WHERE event_id = p_event_id AND room = room_name AND scheduled_time = slot_start
        ) THEN CONTINUE; END IF;

        IF EXISTS (
          SELECT 1 FROM public.meetings_1to1
          WHERE event_id = p_event_id AND empresa_user_id = m.empresa_user_id AND scheduled_time = slot_start
        ) THEN CONTINUE; END IF;

        IF EXISTS (
          SELECT 1 FROM public.meetings_1to1
          WHERE event_id = p_event_id AND sponsor_user_id = m.sponsor_user_id AND scheduled_time = slot_start
        ) THEN CONTINUE; END IF;

        picked_time := slot_start;
        picked_room := room_name;
        found_slot := true;
        EXIT;
      END LOOP;

      slot_start := slot_start + duration;
    END LOOP;

    IF found_slot THEN
      UPDATE public.meetings_1to1
        SET scheduled_time = picked_time, room = picked_room, status = 'confirmed'
        WHERE id = m.id;
      total_assigned := total_assigned + 1;
    ELSE
      total_skipped := total_skipped + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT total_assigned, total_skipped;
END;
$function$;
