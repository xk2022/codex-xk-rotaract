ALTER TABLE members ADD COLUMN avatar_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL;
ALTER TABLE clubs ADD CONSTRAINT club_logo_asset_fk FOREIGN KEY (logo_asset_id) REFERENCES assets(id) ON DELETE SET NULL;
