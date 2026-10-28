-- Westerly Market: one "Full Name" Party Identification row per customer, so the
-- Data 360 unified profile page can show the name in its Customer IDs card.
-- Run in a Snowsight worksheet as ACCOUNTADMIN, after westerly_snowflake_setup.sql.
-- A Data 360 batch transform can't read the zero-copy CUSTOMERS stream, so the
-- rows come from a view instead (same pattern as CUSTOMERS_V).
-- The identity match rule only compares "Westerly Customer ID" rows, so these
-- "Full Name" rows never merge profiles.

USE WAREHOUSE WESTERLY_WH;
USE DATABASE WESTERLY_MARKET;

-- COPY GRANTS keeps the DATA360_READER grant if this script is re-run.
CREATE OR REPLACE VIEW SALES.CUSTOMER_NAMES_V COPY GRANTS AS
  SELECT
    c.CUSTOMER_ID || '-name' AS CUSTOMER_NAME_ID,   -- own key, so it never overwrites the Customer ID row
    c.CUSTOMER_ID,
    TRIM(COALESCE(c.FIRST_NAME, '') || ' ' || COALESCE(c.LAST_NAME, '')) AS FULL_NAME,
    'Full Name' AS PARTY_ID_NAME,
    'Full Name' AS PARTY_ID_TYPE,
    c.LAST_MODIFIED
  FROM SALES.CUSTOMERS c
  WHERE c.FIRST_NAME IS NOT NULL OR c.LAST_NAME IS NOT NULL;

-- DATA360_READER has SELECT on future tables only, so grant the view explicitly.
GRANT SELECT ON VIEW SALES.CUSTOMER_NAMES_V TO ROLE DATA360_READER;
SHOW GRANTS TO ROLE DATA360_READER;  -- needs a SELECT row for WESTERLY_MARKET.SALES.CUSTOMER_NAMES_V

-- Check
SELECT CUSTOMER_NAME_ID, CUSTOMER_ID, PARTY_ID_TYPE FROM SALES.CUSTOMER_NAMES_V ORDER BY CUSTOMER_ID;  -- 5 rows
