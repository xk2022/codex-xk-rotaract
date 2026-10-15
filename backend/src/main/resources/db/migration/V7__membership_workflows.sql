ALTER TABLE memberships ADD COLUMN end_reason text CHECK(end_reason IN ('transferred','resigned','ob','correction'));
ALTER TABLE memberships ADD COLUMN date_precision text NOT NULL DEFAULT 'day' CHECK(date_precision IN ('day','month','year','unknown'));
ALTER TABLE memberships ADD COLUMN visibility text NOT NULL DEFAULT 'hidden' CHECK(visibility IN ('hidden','public'));
ALTER TABLE memberships ADD COLUMN content_version integer NOT NULL DEFAULT 0;
ALTER TABLE memberships ADD COLUMN visibility_version integer NOT NULL DEFAULT 0;
ALTER TABLE memberships ADD COLUMN annual_unconfirmed_year integer;
CREATE TABLE membership_transfers(
 id uuid PRIMARY KEY, member_id uuid NOT NULL REFERENCES members(id), from_membership_id uuid NOT NULL REFERENCES memberships(id),
 from_club_id uuid NOT NULL REFERENCES clubs(id), to_club_id uuid NOT NULL REFERENCES clubs(id), reason text NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','ready_for_member','needs_reapproval','completed','rejected','withdrawn','expired','terminated')),
 source_version integer NOT NULL, from_actor uuid REFERENCES accounts(id),from_grant uuid REFERENCES role_grants(id),from_approved_at timestamptz,
 to_actor uuid REFERENCES accounts(id),to_grant uuid REFERENCES role_grants(id),to_approved_at timestamptz,
 requested_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,ready_expires_at timestamptz,executed_at timestamptz,decision_reason text,
 version integer NOT NULL DEFAULT 0,CHECK(from_club_id<>to_club_id));
CREATE UNIQUE INDEX one_open_transfer ON membership_transfers(from_membership_id) WHERE status IN ('pending','ready_for_member','needs_reapproval');
CREATE TABLE membership_end_requests(id uuid PRIMARY KEY,member_id uuid NOT NULL REFERENCES members(id),membership_id uuid NOT NULL REFERENCES memberships(id),club_id uuid NOT NULL REFERENCES clubs(id),reason text NOT NULL CHECK(reason IN ('resigned','ob')),ends_on date NOT NULL,status text NOT NULL DEFAULT 'pending',source_version integer NOT NULL,requested_at timestamptz NOT NULL,version integer NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX one_pending_end ON membership_end_requests(membership_id) WHERE status='pending';
CREATE TABLE membership_years(membership_id uuid NOT NULL REFERENCES memberships(id),year_start date NOT NULL,status text NOT NULL CHECK(status IN ('confirmed','unconfirmed')),confirmed_by uuid REFERENCES accounts(id),confirmed_at timestamptz,version integer NOT NULL DEFAULT 0,PRIMARY KEY(membership_id,year_start));
CREATE TABLE publication_requests(id uuid PRIMARY KEY,membership_id uuid NOT NULL REFERENCES memberships(id),subject_member_id uuid NOT NULL REFERENCES members(id),requested_by uuid NOT NULL REFERENCES accounts(id),requester_name text NOT NULL,grant_id uuid NOT NULL REFERENCES role_grants(id),content_version integer NOT NULL,visibility_version integer NOT NULL,content jsonb NOT NULL,status text NOT NULL CHECK(status IN ('pending','approved','rejected','expired','invalidated')),requested_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,decided_at timestamptz,version integer NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX one_pending_publication ON publication_requests(membership_id) WHERE status='pending';
CREATE TABLE membership_audit_details(event_id uuid PRIMARY KEY REFERENCES audit_events(id) ON DELETE CASCADE,subject_member_id uuid REFERENCES members(id),club_id uuid REFERENCES clubs(id),target_type text NOT NULL,reason text,request_id uuid NOT NULL,changes jsonb NOT NULL DEFAULT '[]');
CREATE INDEX membership_transfer_member ON membership_transfers(member_id,requested_at);
CREATE INDEX publication_member ON publication_requests(subject_member_id,requested_at);
-- The server derives the type from Club; persistence also rejects mismatched labels.
ALTER TABLE clubs ADD CONSTRAINT clubs_id_type_unique UNIQUE(id,type_code);
ALTER TABLE memberships ADD CONSTRAINT membership_club_type_fk FOREIGN KEY(club_id,type_code) REFERENCES clubs(id,type_code);
