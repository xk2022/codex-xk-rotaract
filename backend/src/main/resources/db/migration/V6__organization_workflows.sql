CREATE TABLE club_move_requests (
 id uuid PRIMARY KEY,
 club_id uuid NOT NULL REFERENCES clubs(id),
 source_district_id uuid NOT NULL REFERENCES districts(id),
 target_district_id uuid NOT NULL REFERENCES districts(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','completed','rejected','expired')),
 source_approved_by uuid REFERENCES accounts(id),
 target_approved_by uuid REFERENCES accounts(id),
 source_grant_id uuid REFERENCES role_grants(id),
 target_grant_id uuid REFERENCES role_grants(id),
 reason text NOT NULL,
 club_version integer NOT NULL,
 version integer NOT NULL DEFAULT 0,
 requested_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 CHECK(source_district_id <> target_district_id)
);
CREATE UNIQUE INDEX one_open_club_move ON club_move_requests(club_id) WHERE status IN ('pending','ready');
CREATE INDEX club_move_districts ON club_move_requests(source_district_id,target_district_id);
CREATE TABLE organization_audit_details (
 event_id uuid PRIMARY KEY REFERENCES audit_events(id) ON DELETE CASCADE,
 reason text NOT NULL,
 changes jsonb NOT NULL DEFAULT '{}'
);
