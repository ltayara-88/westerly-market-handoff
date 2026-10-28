-- Westerly Market: dummy phone and address for the 5 demo customers.
-- Run in a Snowsight worksheet as ACCOUNTADMIN, after westerly_snowflake_setup.sql.
-- All values are fictional: 555-01xx numbers are reserved for fiction, and the
-- street names are placeholders.
-- DATA360_READER already has SELECT on future tables, so no extra grant is needed.

USE WAREHOUSE WESTERLY_WH;
USE DATABASE WESTERLY_MARKET;

CREATE OR REPLACE TABLE SALES.CUSTOMER_CONTACTS (
  CUSTOMER_ID    VARCHAR PRIMARY KEY,   -- same as SALES.CUSTOMERS
  PHONE          VARCHAR,
  ADDRESS_LINE1  VARCHAR,
  CITY           VARCHAR,
  STATE_PROVINCE VARCHAR,
  POSTAL_CODE    VARCHAR,
  COUNTRY        VARCHAR,
  LAST_MODIFIED  TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

INSERT INTO SALES.CUSTOMER_CONTACTS (CUSTOMER_ID, PHONE, ADDRESS_LINE1, CITY, STATE_PROVINCE, POSTAL_CODE, COUNTRY) VALUES
  ('CUST_001', '+1 555-0101', '101 Example Street', 'Springfield', 'CA', '90001', 'United States'),
  ('CUST_002', '+1 555-0102', '202 Sample Avenue', 'Springfield', 'CA', '90002', 'United States'),
  ('CUST_003', '+1 555-0103', '303 Demo Road', 'Riverton', 'CA', '90003', 'United States'),
  ('CUST_004', '+1 555-0104', '404 Placeholder Lane', 'Riverton', 'CA', '90004', 'United States'),
  ('CUST_005', '+1 555-0105', '505 Test Boulevard', 'Springfield', 'CA', '90005', 'United States');

-- Check
SELECT * FROM SALES.CUSTOMER_CONTACTS ORDER BY CUSTOMER_ID;  -- 5 rows
