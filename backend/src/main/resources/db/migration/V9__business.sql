CREATE TABLE business_industries(id varchar(40) PRIMARY KEY,name varchar(100) NOT NULL,enabled boolean NOT NULL DEFAULT true);
INSERT INTO business_industries(id,name) VALUES ('food','餐飲咖啡'),('professional','專業服務'),('travel','生活旅遊'),('retail','零售選物');
CREATE TABLE business_companies(
 id uuid PRIMARY KEY,owner_member_id uuid NOT NULL REFERENCES members(id),name varchar(200) NOT NULL,
 description varchar(2000) NOT NULL DEFAULT '',city varchar(80) NOT NULL DEFAULT '',
 phone varchar(500) NOT NULL DEFAULT '',email varchar(500) NOT NULL DEFAULT '',website varchar(500) NOT NULL DEFAULT '',address varchar(500) NOT NULL DEFAULT '',
 phone_public boolean NOT NULL DEFAULT false,email_public boolean NOT NULL DEFAULT false,website_public boolean NOT NULL DEFAULT false,address_public boolean NOT NULL DEFAULT false,
 location_consent boolean NOT NULL DEFAULT false,latitude double precision,longitude double precision,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','approved','rejected','suspended')),
 first_published_at timestamptz,review_reason varchar(1000),version integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,
 CHECK((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
);
CREATE TABLE business_company_industries(company_id uuid NOT NULL REFERENCES business_companies(id) ON DELETE CASCADE,industry_id varchar(40) NOT NULL REFERENCES business_industries(id),PRIMARY KEY(company_id,industry_id));
CREATE TABLE business_company_links(
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES business_companies(id) ON DELETE CASCADE,member_id uuid NOT NULL REFERENCES members(id),
 kind text NOT NULL CHECK(kind IN ('editor','member')),status text NOT NULL CHECK(status IN ('pending','accepted','rejected','removed')),
 invited_by uuid NOT NULL REFERENCES accounts(id),invited_at timestamptz NOT NULL,decided_at timestamptz,version integer NOT NULL DEFAULT 0,
 UNIQUE(company_id,member_id,kind)
);
CREATE INDEX business_company_links_member ON business_company_links(member_id,status);
CREATE TABLE business_exposure_grants(
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES business_companies(id),starts_on date NOT NULL,
 status text NOT NULL CHECK(status IN ('active','void')),reason text NOT NULL,version integer NOT NULL DEFAULT 0,
 recorded_by uuid NOT NULL REFERENCES accounts(id),recorded_at timestamptz NOT NULL
);
CREATE INDEX business_exposure_grants_company ON business_exposure_grants(company_id,starts_on);
CREATE TABLE business_confirmations(
 company_id uuid NOT NULL REFERENCES business_companies(id) ON DELETE CASCADE,member_id uuid NOT NULL REFERENCES members(id),
 confirmed_at timestamptz NOT NULL,PRIMARY KEY(company_id,member_id)
);
CREATE TABLE business_audit_details(event_id uuid PRIMARY KEY REFERENCES audit_events(id) ON DELETE CASCADE,company_id uuid NOT NULL REFERENCES business_companies(id),reason text);
CREATE INDEX business_companies_owner ON business_companies(owner_member_id);
