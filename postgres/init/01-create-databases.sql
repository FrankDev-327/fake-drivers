-- one database per service; auth_db comes from POSTGRES_DB in compose.
-- runs only when the postgres volume is empty (first boot, or after `docker compose down -v`)
CREATE DATABASE driver_db;
CREATE DATABASE rider_db;
CREATE DATABASE ride_db;
CREATE DATABASE payment_db;
CREATE DATABASE email_db;
