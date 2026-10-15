CREATE TABLE business_reports (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES business_companies(id),
 company_name_snapshot varchar(200) NOT NULL,
 reporter_member_id uuid NOT NULL REFERENCES members(id),
 reason text NOT NULL CHECK(reason IN ('missing','address','impersonation','other')),
 description varchar(2000) NOT NULL CHECK(char_length(btrim(description)) BETWEEN 1 AND 2000),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','processing','closed')),
 assigned_account_id uuid REFERENCES accounts(id),
 resolution varchar(2000),
 version integer NOT NULL DEFAULT 1 CHECK(version>=1),
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 CHECK(status='open' OR (assigned_account_id IS NOT NULL AND resolution IS NOT NULL AND char_length(btrim(resolution)) BETWEEN 1 AND 2000))
);
CREATE UNIQUE INDEX one_open_business_report ON business_reports(reporter_member_id,company_id) WHERE status IN ('open','processing');
CREATE INDEX business_reports_reporter ON business_reports(reporter_member_id,created_at);
CREATE INDEX business_reports_queue ON business_reports(status,updated_at);
CREATE TABLE business_report_audit_details (
 event_id uuid PRIMARY KEY REFERENCES audit_events(id) ON DELETE CASCADE,
 report_id uuid NOT NULL REFERENCES business_reports(id),
 explanation varchar(2000) NOT NULL
);
