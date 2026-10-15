ALTER TABLE business_company_links DROP CONSTRAINT business_company_links_status_check;
ALTER TABLE business_company_links ADD CONSTRAINT business_company_links_status_check
 CHECK(status IN ('pending','accepted','rejected','removed','cancelled','revoked'));
ALTER TABLE business_company_links DROP CONSTRAINT business_company_links_company_id_member_id_kind_key;
CREATE UNIQUE INDEX one_open_business_link ON business_company_links(company_id,member_id,kind)
 WHERE status IN ('pending','accepted');
