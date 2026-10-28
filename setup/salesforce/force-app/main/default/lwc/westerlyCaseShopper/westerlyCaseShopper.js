import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import CONTACT_ID from '@salesforce/schema/Case.ContactId';
import DESCRIPTION from '@salesforce/schema/Case.Description';
import ORDER_ID from '@salesforce/schema/Case.Westerly_Order_Id__c';
import getUnifiedIdForContact from '@salesforce/apex/WesterlyShopperCardController.getUnifiedIdForContact';
import getRecentOrders from '@salesforce/apex/WesterlyShopperCardController.getRecentOrders';

// Case page panel for Westerly support: the Google agent's conversation summary, then the case
// contact's unified shopper card and recent orders from Data 360, with the case's order highlighted.
export default class WesterlyCaseShopper extends LightningElement {
    @api recordId;

    @wire(getRecord, { recordId: '$recordId', fields: [CONTACT_ID, DESCRIPTION, ORDER_ID] })
    caseRecord;

    @wire(getUnifiedIdForContact, { contactId: '$contactId' })
    unifiedResult;

    @wire(getRecentOrders, { unifiedId: '$unifiedId' })
    ordersResult;

    get contactId() {
        return getFieldValue(this.caseRecord.data, CONTACT_ID);
    }

    get summary() {
        return getFieldValue(this.caseRecord.data, DESCRIPTION);
    }

    get caseOrderId() {
        return getFieldValue(this.caseRecord.data, ORDER_ID);
    }

    get unifiedId() {
        return this.unifiedResult && this.unifiedResult.data;
    }

    get isLoading() {
        return !this.caseRecord.data && !this.caseRecord.error;
    }

    get hasNoContact() {
        return Boolean(this.caseRecord.data) && !this.contactId;
    }

    get isUnlinked() {
        return Boolean(this.contactId) && this.unifiedResult && this.unifiedResult.data === null;
    }

    get orders() {
        const orders = (this.ordersResult && this.ordersResult.data) || [];
        return orders.map((o) => ({
            ...o,
            rowClass: o.orderId === this.caseOrderId ? 'order order_case' : 'order'
        }));
    }

    get hasOrders() {
        return this.orders.length > 0;
    }

    get errorMessage() {
        const error =
            this.caseRecord.error ||
            (this.unifiedResult && this.unifiedResult.error) ||
            (this.ordersResult && this.ordersResult.error);
        if (!error) return undefined;
        return (error.body && error.body.message) || 'Could not load the shopper for this case.';
    }
}
