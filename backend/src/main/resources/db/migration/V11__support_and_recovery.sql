-- Staging is populated only by the separately authorized legacy inventory/import process.
-- There is no public import endpoint and confirming a claim never rewrites current UUIDs.
CREATE TABLE staged_legacy_records (
 id uuid PRIMARY KEY, source_ref text NOT NULL UNIQUE, club_id uuid REFERENCES clubs(id),
 name_snapshot varchar(100) NOT NULL, call_name_snapshot varchar(100),
 reviewed_for_claim boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL
);
CREATE TABLE support_cases (
 id uuid PRIMARY KEY, requester_account_id uuid REFERENCES accounts(id),
 subject_account_id uuid REFERENCES accounts(id), type text NOT NULL CHECK(type IN
 ('account_recovery','legacy_claim','account_status','club_status','membership_correction','club_type_correction','mfa_recovery')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','awaiting_evidence','awaiting_new_email_proof','awaiting_password_reset','approved','rejected','resolved')),
 description varchar(5000) NOT NULL, proposed_email varchar(254), identifier_hash text,
 staged_record_id uuid REFERENCES staged_legacy_records(id),
 receipt_hash text UNIQUE, receipt_expires_at timestamptz, receipt_revoked_at timestamptz,
 decision_reason varchar(1000), handled_by uuid REFERENCES accounts(id),
 created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, closed_at timestamptz,
 legal_hold boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 0
);
CREATE INDEX support_cases_requester ON support_cases(requester_account_id,created_at);
CREATE TABLE support_case_assignments (
 case_id uuid PRIMARY KEY REFERENCES support_cases(id), account_id uuid NOT NULL REFERENCES accounts(id),
 assigned_by uuid REFERENCES accounts(id), assigned_at timestamptz NOT NULL
);
CREATE INDEX support_assignment_handler ON support_case_assignments(account_id);
CREATE TABLE legacy_claim_links (
 staged_record_id uuid PRIMARY KEY REFERENCES staged_legacy_records(id),
 account_id uuid NOT NULL REFERENCES accounts(id), member_id uuid NOT NULL REFERENCES members(id),
 case_id uuid NOT NULL UNIQUE REFERENCES support_cases(id),
 confirmed_at timestamptz NOT NULL
);
CREATE TABLE support_case_verifications (
 id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES support_cases(id),
 subject_account_id uuid NOT NULL REFERENCES accounts(id), verified_by uuid NOT NULL REFERENCES accounts(id),
 kind text NOT NULL CHECK(kind IN ('club_attestation','existing_session')),
 club_id uuid REFERENCES clubs(id), session_id uuid, reason varchar(1000) NOT NULL,
 recorded_at timestamptz NOT NULL, UNIQUE(case_id,verified_by,kind)
);
CREATE TABLE support_case_supplements (
 id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES support_cases(id),
 author_account_id uuid REFERENCES accounts(id), description varchar(5000) NOT NULL, created_at timestamptz NOT NULL
);
CREATE TABLE assets (
 id uuid PRIMARY KEY, owner_account_id uuid REFERENCES accounts(id), purpose text NOT NULL CHECK(purpose IN ('avatar','club_logo','support_evidence')),
 club_id uuid REFERENCES clubs(id), case_id uuid REFERENCES support_cases(id),
 media_type text NOT NULL DEFAULT 'image/png', size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 2097152),
 width integer NOT NULL CHECK(width BETWEEN 1 AND 4096), height integer NOT NULL CHECK(height BETWEEN 1 AND 4096),
 content bytea NOT NULL, visibility text NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public_derivative')),
 created_at timestamptz NOT NULL,
 CHECK(purpose<>'support_evidence' OR visibility='private')
);
CREATE INDEX assets_case ON assets(case_id);
CREATE TABLE recovery_tokens (
 token_hash text PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id),
 case_id uuid REFERENCES support_cases(id), kind text NOT NULL CHECK(kind IN ('password_reset','email_proof','case_password_reset')),
 email_key varchar(254) NOT NULL, created_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 consumed_at timestamptz, revoked_at timestamptz
);
CREATE INDEX recovery_token_account ON recovery_tokens(account_id,kind,created_at);
CREATE INDEX recovery_token_case ON recovery_tokens(case_id);
CREATE TABLE mail_outbox (
 id uuid PRIMARY KEY, account_id uuid REFERENCES accounts(id), case_id uuid REFERENCES support_cases(id),
 token_hash text REFERENCES recovery_tokens(token_hash), recipient_ciphertext text NOT NULL,
 payload_ciphertext text NOT NULL, kind text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','delivered','failed','cancelled')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 created_at timestamptz NOT NULL, delivered_at timestamptz, next_attempt_at timestamptz NOT NULL
);
CREATE INDEX mail_outbox_queue ON mail_outbox(status,next_attempt_at);
