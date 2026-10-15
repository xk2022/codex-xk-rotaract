CREATE TABLE coupon_offers (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES business_companies(id),
 title varchar(120) NOT NULL,
 description varchar(2000) NOT NULL,
 terms varchar(2000) NOT NULL,
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 total_quota integer NOT NULL CHECK(total_quota>0),
 per_member_limit integer NOT NULL CHECK(per_member_limit>0 AND per_member_limit<=total_quota),
 status text NOT NULL CHECK(status IN ('draft','pending','approved','rejected','suspended')),
 review_reason varchar(500),
 created_at timestamptz NOT NULL,
 version integer NOT NULL DEFAULT 1,
 CHECK(starts_at<ends_at)
);
CREATE INDEX coupon_offers_company ON coupon_offers(company_id,status);
CREATE TABLE coupon_claims (
 id uuid PRIMARY KEY,
 offer_id uuid NOT NULL REFERENCES coupon_offers(id),
 company_id uuid NOT NULL REFERENCES business_companies(id),
 member_id uuid NOT NULL REFERENCES members(id),
 code_hash text NOT NULL UNIQUE,
 code_encrypted text NOT NULL,
 title varchar(120) NOT NULL,
 description varchar(2000) NOT NULL,
 terms varchar(2000) NOT NULL,
 claimed_at timestamptz NOT NULL,
 starts_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 status text NOT NULL CHECK(status IN ('available','used','void')),
 used_at timestamptz,
 void_reason varchar(500),
 version integer NOT NULL DEFAULT 1,
 CHECK(starts_at<expires_at),
 CHECK((status='used')=(used_at IS NOT NULL)),
 CHECK((status='void')=(void_reason IS NOT NULL))
);
CREATE INDEX coupon_claims_member ON coupon_claims(member_id,claimed_at);
CREATE INDEX coupon_claims_offer_member ON coupon_claims(offer_id,member_id);
CREATE TABLE coupon_claim_requests (
 actor_id uuid NOT NULL REFERENCES accounts(id),
 request_key varchar(128) NOT NULL,
 offer_id uuid NOT NULL REFERENCES coupon_offers(id),
 claim_id uuid NOT NULL REFERENCES coupon_claims(id),
 PRIMARY KEY(actor_id,request_key)
);
CREATE TABLE coupon_audit_details (
 event_id uuid PRIMARY KEY REFERENCES audit_events(id) ON DELETE CASCADE,
 reason varchar(500)
);
