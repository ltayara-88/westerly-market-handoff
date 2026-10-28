// Searches and reads unified shopper profiles from Data 360 for the westerlyShopper360 page.
public with sharing class WesterlyShopperCardController {
    // Unified ids are letters and digits only; reject anything else before it goes into SQL.
    private static final Pattern UNIFIED_ID = Pattern.compile('^[A-Za-z0-9]{1,64}$');
    private static final String CUSTOMER_ID_TYPE = 'Westerly Customer ID';
    private static final String FULL_NAME_TYPE = 'Full Name';
    private static final Pattern SEARCH_TERM = Pattern.compile('^[a-z0-9 ._@\\-]{2,60}$');
    private static final Integer MAX_MATCHES = 20;

    public class ShopperProfile {
        @AuraEnabled public String name;
        @AuraEnabled public String customerId;
        @AuraEnabled public String email;
        @AuraEnabled public String phone;
        @AuraEnabled public String addressLine1;
        @AuraEnabled public String city;
        @AuraEnabled public String stateProvince;
        @AuraEnabled public String postalCode;
        @AuraEnabled public String country;
        @AuraEnabled public Integer totalOrders;
        @AuraEnabled public Decimal lifetimeValue;
        @AuraEnabled public Decimal avgCartValue;
    }

    public class ShopperMatch {
        @AuraEnabled public String unifiedId;
        @AuraEnabled public String name;
        @AuraEnabled public String customerId;
    }

    public class ShopperOrder {
        @AuraEnabled public String orderId;
        @AuraEnabled public String orderDate;
        @AuraEnabled public String status;
        @AuraEnabled public Decimal total;
    }

    public class ShopperWebEvent {
        @AuraEnabled public String eventId;
        @AuraEnabled public String eventType;
        @AuraEnabled public String eventTime;
        @AuraEnabled public String page;
        @AuraEnabled public String searchQuery;
        @AuraEnabled public String sku;
        @AuraEnabled public Decimal quantity;
        @AuraEnabled public String orderId;
    }

    // Unified profile a CRM Contact resolved into, or null if identity resolution hasn't linked it yet.
    @AuraEnabled(cacheable=true)
    public static String getUnifiedIdForContact(Id contactId) {
        if (contactId == null) {
            return null;
        }
        List<Object> link = firstRow(
            'SELECT UnifiedRecordId__c FROM UnifiedLinkssotIndividualWstr__dlm WHERE SourceRecordId__c = \'' + String.valueOf(contactId) + '\' LIMIT 1'
        );
        return link == null ? null : asString(link[0]);
    }

    // Most recent orders across every source record linked to the unified profile, newest first.
    @AuraEnabled(cacheable=true)
    public static List<ShopperOrder> getRecentOrders(String unifiedId) {
        String id = checkId(unifiedId);
        List<ShopperOrder> result = new List<ShopperOrder>();
        for (List<Object> row : query(
            'SELECT o.ssot__Id__c, o.ssot__OrderStartDate__c, o.ssot__SalesOrderStatusId__c, o.ssot__GrandTotalAmount__c' +
            ' FROM ssot__SalesOrder__dlm o JOIN UnifiedLinkssotIndividualWstr__dlm l ON o.ssot__SoldToCustomerId__c = l.SourceRecordId__c' +
            ' WHERE l.UnifiedRecordId__c = \'' + id + '\' ORDER BY o.ssot__OrderStartDate__c DESC LIMIT ' + MAX_MATCHES
        )) {
            ShopperOrder o = new ShopperOrder();
            o.orderId = asString(row[0]);
            o.orderDate = asString(row[1]);
            o.status = asString(row[2]);
            o.total = asDecimal(row[3]);
            result.add(o);
        }
        return result;
    }

    // Most recent website events (Web SDK → Product Browse Engagement) across every source record linked to the unified profile, newest first.
    @AuraEnabled(cacheable=true)
    public static List<ShopperWebEvent> getRecentWebEvents(String unifiedId) {
        String id = checkId(unifiedId);
        List<ShopperWebEvent> result = new List<ShopperWebEvent>();
        for (List<Object> row : query(
            'SELECT e.ssot__Id__c, e.ssot__ProductBrowseEventType__c, e.ssot__EngagementDateTm__c, e.ssot__PageName__c,' +
            ' e.ssot__KeywordSearch__c, e.ssot__ProductSKU__c, e.ssot__ProductQuantity__c, e.ssot__SalesOrderId__c' +
            ' FROM ssot__ProductBrowseEngagement__dlm e JOIN UnifiedLinkssotIndividualWstr__dlm l ON e.ssot__IndividualId__c = l.SourceRecordId__c' +
            ' WHERE l.UnifiedRecordId__c = \'' + id + '\' ORDER BY e.ssot__EngagementDateTm__c DESC LIMIT ' + MAX_MATCHES
        )) {
            ShopperWebEvent e = new ShopperWebEvent();
            e.eventId = asString(row[0]);
            e.eventType = asString(row[1]);
            e.eventTime = asString(row[2]);
            e.page = asString(row[3]);
            e.searchQuery = asString(row[4]);
            e.sku = asString(row[5]);
            e.quantity = row[6] == null ? null : Decimal.valueOf(String.valueOf(row[6]));
            e.orderId = asString(row[7]);
            result.add(e);
        }
        return result;
    }

    // Finds unified shoppers whose customer ID or first + last name contains the search term.
    @AuraEnabled(cacheable=true)
    public static List<ShopperMatch> searchShoppers(String term) {
        String pattern = '%' + checkTerm(term) + '%';
        Map<String, ShopperMatch> matches = new Map<String, ShopperMatch>();

        for (List<Object> row : query(
            'SELECT ssot__PartyId__c, ssot__IdentificationNumber__c FROM UnifiedssotPartyIdentificationWstr__dlm' +
            ' WHERE ssot__PartyIdentificationTypeId__c = \'' + CUSTOMER_ID_TYPE + '\'' +
            ' AND LOWER(ssot__IdentificationNumber__c) LIKE \'' + pattern + '\' LIMIT ' + MAX_MATCHES
        )) {
            match(matches, asString(row[0])).customerId = asString(row[1]);
        }

        for (List<Object> row : query(
            'SELECT ssot__Id__c, ssot__FirstName__c, ssot__LastName__c FROM UnifiedssotIndividualWstr__dlm' +
            ' WHERE LOWER(CONCAT(COALESCE(ssot__FirstName__c, \'\'), \' \', COALESCE(ssot__LastName__c, \'\'))) LIKE \'' + pattern + '\'' +
            ' LIMIT ' + MAX_MATCHES
        )) {
            match(matches, asString(row[0])).name = joinNonBlank(new List<Object>{ row[1], row[2] }, ' ');
        }
        if (matches.isEmpty()) {
            return new List<ShopperMatch>();
        }

        // Fill in whichever of name and customer ID the matching query didn't return.
        String idList = '\'' + String.join(new List<String>(matches.keySet()), '\', \'') + '\'';
        for (List<Object> row : query(
            'SELECT ssot__Id__c, ssot__FirstName__c, ssot__LastName__c FROM UnifiedssotIndividualWstr__dlm WHERE ssot__Id__c IN (' + idList + ')'
        )) {
            ShopperMatch m = matches.get(asString(row[0]));
            if (m != null && m.name == null) {
                m.name = joinNonBlank(new List<Object>{ row[1], row[2] }, ' ');
            }
        }
        for (List<Object> row : query(
            'SELECT ssot__PartyId__c, ssot__IdentificationNumber__c FROM UnifiedssotPartyIdentificationWstr__dlm' +
            ' WHERE ssot__PartyIdentificationTypeId__c = \'' + CUSTOMER_ID_TYPE + '\' AND ssot__PartyId__c IN (' + idList + ')'
        )) {
            ShopperMatch m = matches.get(asString(row[0]));
            if (m != null && m.customerId == null) {
                m.customerId = asString(row[1]);
            }
        }

        List<ShopperMatch> result = matches.values();
        if (result.size() > MAX_MATCHES) {
            List<ShopperMatch> trimmed = new List<ShopperMatch>();
            for (Integer i = 0; i < MAX_MATCHES; i++) {
                trimmed.add(result[i]);
            }
            result = trimmed;
        }
        return result;
    }

    @AuraEnabled(cacheable=true)
    public static ShopperProfile getProfile(String unifiedId) {
        String id = checkId(unifiedId);
        ShopperProfile p = new ShopperProfile();

        List<Object> individual = firstRow(
            'SELECT ssot__FirstName__c, ssot__LastName__c FROM UnifiedssotIndividualWstr__dlm WHERE ssot__Id__c = \'' + id + '\' LIMIT 1'
        );
        if (individual != null) {
            p.name = joinNonBlank(new List<Object>{ individual[0], individual[1] }, ' ');
        }

        for (List<Object> row : query(
            'SELECT ssot__PartyIdentificationTypeId__c, ssot__IdentificationNumber__c FROM UnifiedssotPartyIdentificationWstr__dlm WHERE ssot__PartyId__c = \'' + id + '\''
        )) {
            String type = asString(row[0]);
            if (type == CUSTOMER_ID_TYPE && p.customerId == null) {
                p.customerId = asString(row[1]);
            } else if (type == FULL_NAME_TYPE && String.isNotBlank(asString(row[1]))) {
                p.name = asString(row[1]);
            }
        }

        List<Object> email = firstRow(
            'SELECT ssot__EmailAddress__c FROM UnifiedssotContactPointEmailWstr__dlm WHERE ssot__PartyId__c = \'' + id + '\' LIMIT 1'
        );
        p.email = email == null ? null : asString(email[0]);

        List<Object> phone = firstRow(
            'SELECT ssot__TelephoneNumber__c FROM UnifiedssotContactPointPhoneWstr__dlm WHERE ssot__PartyId__c = \'' + id + '\' LIMIT 1'
        );
        p.phone = phone == null ? null : asString(phone[0]);

        List<Object> address = firstRow(
            'SELECT ssot__AddressLine1__c, ssot__CityName__c, ssot__StateProvinceName__c, ssot__PostalCodeText__c, ssot__CountryName__c' +
            ' FROM UnifiedssotContactPointAddressWstr__dlm WHERE ssot__PartyId__c = \'' + id + '\' LIMIT 1'
        );
        if (address != null) {
            p.addressLine1 = asString(address[0]);
            p.city = asString(address[1]);
            p.stateProvince = asString(address[2]);
            p.postalCode = asString(address[3]);
            p.country = asString(address[4]);
        }

        // Same join as the Westerly order insights: source orders → unified link → unified individual.
        List<Object> orders = firstRow(
            'SELECT COUNT(o.ssot__Id__c), SUM(o.ssot__GrandTotalAmount__c), AVG(o.ssot__GrandTotalAmount__c)' +
            ' FROM ssot__SalesOrder__dlm o JOIN UnifiedLinkssotIndividualWstr__dlm l ON o.ssot__SoldToCustomerId__c = l.SourceRecordId__c' +
            ' WHERE l.UnifiedRecordId__c = \'' + id + '\''
        );
        if (orders != null) {
            p.totalOrders = orders[0] == null ? 0 : Integer.valueOf(orders[0]);
            p.lifetimeValue = asDecimal(orders[1]);
            p.avgCartValue = asDecimal(orders[2]);
        }
        return p;
    }

    private static ShopperMatch match(Map<String, ShopperMatch> matches, String unifiedId) {
        if (!matches.containsKey(unifiedId)) {
            ShopperMatch m = new ShopperMatch();
            m.unifiedId = unifiedId;
            matches.put(unifiedId, m);
        }
        return matches.get(unifiedId);
    }

    // Search terms go into a LIKE pattern, so only allow characters that can't break out of the quotes.
    private static String checkTerm(String term) {
        String trimmed = term == null ? '' : term.trim().toLowerCase();
        if (!SEARCH_TERM.matcher(trimmed).matches()) {
            throw new AuraHandledException('Enter 2 to 60 letters, digits, spaces, or . _ @ -');
        }
        return trimmed;
    }

    private static String checkId(String unifiedId) {
        if (unifiedId == null || !UNIFIED_ID.matcher(unifiedId).matches()) {
            throw new AuraHandledException('Invalid unified profile id');
        }
        return unifiedId;
    }

    private static List<Object> firstRow(String sql) {
        List<List<Object>> rows = query(sql);
        return rows.isEmpty() ? null : rows[0];
    }

    private static List<List<Object>> query(String sql) {
        ConnectApi.CdpQueryInput input = new ConnectApi.CdpQueryInput();
        input.sql = sql;
        ConnectApi.CdpQueryOutputV2 output = ConnectApi.CdpQuery.queryAnsiSqlV2(input);
        List<List<Object>> rows = new List<List<Object>>();
        if (output.data != null) {
            for (ConnectApi.CdpQueryV2Row row : output.data) {
                rows.add(row.rowData);
            }
        }
        return rows;
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static Decimal asDecimal(Object value) {
        return value == null ? null : Decimal.valueOf(String.valueOf(value)).setScale(2);
    }

    private static String joinNonBlank(List<Object> parts, String separator) {
        List<String> kept = new List<String>();
        for (Object part : parts) {
            if (String.isNotBlank(asString(part))) {
                kept.add(asString(part));
            }
        }
        return kept.isEmpty() ? null : String.join(kept, separator);
    }
}
