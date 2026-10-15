ALTER TABLE accounts ADD COLUMN code_change_count integer NOT NULL DEFAULT 0 CHECK(code_change_count BETWEEN 0 AND 1);
CREATE TABLE account_code_reservations(code_key varchar(20) PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id));
INSERT INTO account_code_reservations SELECT lower(account_code),id FROM accounts;
CREATE FUNCTION reserve_account_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' OR lower(OLD.account_code)<>lower(NEW.account_code) THEN
    INSERT INTO account_code_reservations(code_key,account_id) VALUES(lower(NEW.account_code),NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER accounts_reserve_code AFTER INSERT OR UPDATE OF account_code ON accounts FOR EACH ROW EXECUTE FUNCTION reserve_account_code();
