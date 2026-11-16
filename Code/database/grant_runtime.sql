-- Run with psql -v runtime_role=... after provisioning a separate backend role.
BEGIN;

GRANT USAGE ON SCHEMA trinity TO :"runtime_role";
GRANT SELECT ON ALL TABLES IN SCHEMA trinity TO :"runtime_role";
GRANT EXECUTE ON FUNCTION trinity.submit_registration(uuid, jsonb) TO :"runtime_role";
GRANT EXECUTE ON FUNCTION trinity.decide_registration(
    uuid, uuid, trinity.registration_status, trinity.registration_status, boolean, text
) TO :"runtime_role";

GRANT INSERT ON trinity.organizers, trinity.organizer_invites, trinity.organizer_sessions,
    trinity.organizer_audit, trinity.media TO :"runtime_role";
GRANT INSERT (name) ON trinity.institutions TO :"runtime_role";
GRANT UPDATE (password_hash, disabled_at) ON trinity.organizers TO :"runtime_role";
GRANT UPDATE (accepted_by, accepted_at) ON trinity.organizer_invites TO :"runtime_role";
GRANT DELETE ON trinity.organizer_sessions TO :"runtime_role";
GRANT UPDATE (next_attempt_at, attempt_count, sent_at) ON trinity.receipt_outbox TO :"runtime_role";
GRANT USAGE ON SEQUENCE trinity.organizer_audit_id_seq TO :"runtime_role";

COMMIT;
