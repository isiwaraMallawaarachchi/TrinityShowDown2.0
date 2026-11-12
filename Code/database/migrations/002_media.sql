BEGIN;

CREATE TABLE trinity.media (
    key text PRIMARY KEY,
    registration_id uuid REFERENCES trinity.registrations,
    content_type text NOT NULL,
    bytes bytea NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 10485760),
    CHECK (
        (registration_id IS NULL AND content_type = 'application/pdf')
        OR (registration_id IS NOT NULL AND content_type IN ('image/jpeg', 'image/png', 'image/webp'))
    )
);
CREATE INDEX receipt_outbox_pending ON trinity.receipt_outbox (next_attempt_at) WHERE sent_at IS NULL;

COMMIT;
