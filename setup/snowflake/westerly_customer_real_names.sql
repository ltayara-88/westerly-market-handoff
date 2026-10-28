-- Westerly Market: swap the placeholder "Customer One".."Customer Five" names for
-- realistic (fictional) shopper names. Run in a Snowsight worksheet as ACCOUNTADMIN.
-- The Data 360 streams are zero copy, so the Individual and "Full Name" Party
-- Identification rows read the new names live; re-run identity resolution
-- (Individual_wstr) afterwards so the unified profiles pick them up.

USE WAREHOUSE WESTERLY_WH;
USE DATABASE WESTERLY_MARKET;

UPDATE SALES.CUSTOMERS t
SET FIRST_NAME = n.FIRST_NAME, LAST_NAME = n.LAST_NAME, LAST_MODIFIED = CURRENT_TIMESTAMP()
FROM (
  SELECT * FROM VALUES
    ('CUST_001', 'Stephanie', 'Smith'),
    ('CUST_002', 'Marcus', 'Johnson'),
    ('CUST_003', 'Priya', 'Patel'),
    ('CUST_004', 'Daniel', 'Kim'),
    ('CUST_005', 'Elena', 'Rodriguez')
  AS v(CUSTOMER_ID, FIRST_NAME, LAST_NAME)
) n
WHERE t.CUSTOMER_ID = n.CUSTOMER_ID;  -- 5 rows updated

-- Check: the view behind the "Full Name" Party Identification rows follows along.
SELECT c.CUSTOMER_ID, c.FIRST_NAME, c.LAST_NAME, v.FULL_NAME
FROM SALES.CUSTOMERS c
LEFT JOIN SALES.CUSTOMER_NAMES_V v ON v.CUSTOMER_ID = c.CUSTOMER_ID
ORDER BY c.CUSTOMER_ID;  -- 5 rows, no "Customer ..." names left
