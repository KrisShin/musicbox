-- add a new column `is_cached` and 'last_played_at' to the `music` table
ALTER TABLE music ADD COLUMN last_played_at TEXT;
ALTER TABLE music ADD COLUMN file_path TEXT;