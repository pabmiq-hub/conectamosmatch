
REVOKE EXECUTE ON FUNCTION public.assign_meeting_slots(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_meeting_slots(uuid) TO service_role;
