import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import CONTACT_ID from '@salesforce/schema/Case.ContactId';
import ORDER_ID from '@salesforce/schema/Case.Westerly_Order_Id__c';
import getUnifiedIdForContact from '@salesforce/apex/WesterlyShopperCardController.getUnifiedIdForContact';
import getRecentWebEvents from '@salesforce/apex/WesterlyShopperCardController.getRecentWebEvents';

const LABELS = {
    pageView: 'Viewed page',
    search: 'Searched',
    addToCart: 'Added to cart',
    removeFromCart: 'Removed from cart',
    orderPlaced: 'Placed order',
    logout: 'Signed out'
};

// Case page card for Westerly support: the case contact's recent website events (Web SDK → Data 360),
// newest first, with the case's order highlighted.
export default class WesterlyCaseWebActivity extends LightningElement {
    @api recordId;

    @wire(getRecord, { recordId: '$recordId', fields: [CONTACT_ID, ORDER_ID] })
    caseRecord;

    @wire(getUnifiedIdForContact, { contactId: '$contactId' })
    unifiedResult;

    @wire(getRecentWebEvents, { unifiedId: '$unifiedId' })
    eventsResult;

    get contactId() {
        return getFieldValue(this.caseRecord.data, CONTACT_ID);
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

    get events() {
        const events = (this.eventsResult && this.eventsResult.data) || [];
        return events.map((e) => ({
            ...e,
            // Data 360 returns "2026-10-21 21:25:44.542 UTC"; make it ISO for lightning-formatted-date-time.
            isoTime: e.eventTime ? e.eventTime.replace(' UTC', 'Z').replace(' ', 'T') : null,
            label: LABELS[e.eventType] || e.eventType,
            detail: this.detail(e),
            rowClass: e.orderId && e.orderId === this.caseOrderId ? 'event event_case' : 'event'
        }));
    }

    get hasEvents() {
        return this.events.length > 0;
    }

    get errorMessage() {
        const error =
            this.caseRecord.error ||
            (this.unifiedResult && this.unifiedResult.error) ||
            (this.eventsResult && this.eventsResult.error);
        if (!error) return undefined;
        return (error.body && error.body.message) || 'Could not load website activity for this case.';
    }

    detail(e) {
        switch (e.eventType) {
            case 'pageView':
                return e.page || '';
            case 'search':
                return e.searchQuery ? `"${e.searchQuery}"` : '';
            case 'addToCart':
            case 'removeFromCart':
                return [e.sku, e.quantity ? `× ${e.quantity}` : ''].filter(Boolean).join(' ');
            case 'orderPlaced':
                return e.orderId || '';
            default:
                return '';
        }
    }
}
