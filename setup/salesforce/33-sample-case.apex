Group q = [SELECT Id FROM Group WHERE Type = 'Queue' AND DeveloperName = 'Westerly_Support' LIMIT 1];
Contact c = [SELECT Id, AccountId FROM Contact WHERE Email = 'customer1@example.com' LIMIT 1];
Case cs = new Case(
    ContactId = c.Id,
    AccountId = c.AccountId,
    OwnerId = q.Id,
    Subject = 'Add garam masala to order W-10482',
    Status = 'New',
    Origin = 'Website',
    Westerly_Order_Id__c = 'W-10482',
    Westerly_Order_Status__c = 'Not yet picked',
    Westerly_Customer_Id__c = 'CUST_001',
    Description = 'Conversation summary (Westerly Shopper, Google agent):\n' +
        '- Shopper is logged in on westerly.com; customer ID CUST_001 verified from the login.\n' +
        '- Shopper said: "I forgot to add garam masala" to the order placed earlier today, W-10482.\n' +
        '- Requested item: Garam Masala, 2 oz jar (SP-GARAM), qty 1, $4.49. In stock at the time of the chat.\n' +
        '- Order status seen by the agent: Not yet picked.\n' +
        '- The agent cannot change orders, so it opened this case for Westerly Support and told the shopper a team member will confirm.\n' +
        '- No payment data was collected in the conversation.'
);
insert cs;
System.debug('CHECK case=' + [SELECT CaseNumber FROM Case WHERE Id = :cs.Id].CaseNumber + ' id=' + cs.Id);
