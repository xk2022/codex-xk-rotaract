CREATE TABLE events (
 id uuid PRIMARY KEY,
 title varchar(200) NOT NULL,
 description text NOT NULL DEFAULT '',
 location varchar(300) NOT NULL DEFAULT '',
 organizer_type text NOT NULL CHECK (organizer_type IN ('club','district')),
 organizer_id uuid NOT NULL,
 visibility text NOT NULL CHECK (visibility IN ('public','members','club')),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','cancelled','archived')),
 time_kind text NOT NULL CHECK (time_kind IN ('timed','allDay')),
 time_zone text NOT NULL,
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 start_date date,
 end_date_exclusive date,
 cancellation_reason varchar(1000),
 public_withdrawn_at timestamptz,
 version integer NOT NULL DEFAULT 0,
 CHECK (ends_at > starts_at),
 CHECK (organizer_type <> 'district' OR visibility <> 'club'),
 CHECK ((time_kind='timed' AND start_date IS NULL AND end_date_exclusive IS NULL) OR
        (time_kind='allDay' AND start_date IS NOT NULL AND end_date_exclusive > start_date))
);
CREATE INDEX events_range ON events(starts_at,ends_at);
CREATE INDEX events_organizer ON events(organizer_type,organizer_id);
