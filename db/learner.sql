-- Creates the restricted "learner" login the app uses:
--   * can READ every Pagila table, but cannot change them
--   * owns the "playground" schema, where it can create/modify anything
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'learner') THEN
    CREATE ROLE learner LOGIN PASSWORD 'learner';
  END IF;
END $$;

GRANT CONNECT ON DATABASE pagila TO learner;
GRANT USAGE ON SCHEMA public TO learner;
GRANT SELECT, REFERENCES ON ALL TABLES IN SCHEMA public TO learner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

CREATE SCHEMA IF NOT EXISTS playground AUTHORIZATION learner;

ALTER ROLE learner SET search_path = playground, public;
ALTER ROLE learner SET statement_timeout = '8s';
ALTER ROLE learner SET idle_in_transaction_session_timeout = '60s';
