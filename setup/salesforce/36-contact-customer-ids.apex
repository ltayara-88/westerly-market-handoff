// Step 15 Part 5: copy each Westerly Contact's customer ID (CUST_###, kept in its Description) into Westerly_Customer_Id__c,
// so the Google agent can find the Contact when it opens a Case. Run: sf apex run -o <ORG_ALIAS> -f 36-contact-customer-ids.apex
List<Contact> cs = [SELECT Id, Description FROM Contact WHERE Account.Name = 'Westerly Market Shoppers'];
Pattern p = Pattern.compile('CUST_\\d+');
for (Contact c : cs) {
    Matcher m = p.matcher(c.Description == null ? '' : c.Description);
    if (m.find()) c.Westerly_Customer_Id__c = m.group();
}
update cs;
System.debug('CHECK ' + [SELECT Count() FROM Contact WHERE Westerly_Customer_Id__c LIKE 'CUST_%']);
