import { LightningElement, api, wire } from 'lwc';
import getProfile from '@salesforce/apex/WesterlyShopperCardController.getProfile';

// Shopper summary for one unified profile (UnifiedssotIndividualWstr__dlm.ssot__Id__c), set by westerlyShopper360.
export default class WesterlyShopperCard extends LightningElement {
    @api unifiedId;

    @wire(getProfile, { unifiedId: '$unifiedId' })
    profileResult;

    get profile() {
        return this.profileResult.data;
    }

    get isLoading() {
        return !this.profileResult.data && !this.profileResult.error;
    }

    get errorMessage() {
        const error = this.profileResult.error;
        if (!error) return undefined;
        return (error.body && error.body.message) || 'Could not load this shopper profile.';
    }

    get initials() {
        const name = (this.profile && this.profile.name) || '';
        return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?';
    }

    get location() {
        const p = this.profile;
        return p ? [p.city, p.stateProvince].filter(Boolean).join(', ') : '';
    }

    get cityLine() {
        const p = this.profile;
        if (!p) return '';
        const cityState = [p.city, p.stateProvince].filter(Boolean).join(', ');
        return [cityState, p.postalCode].filter(Boolean).join(' ');
    }

    get hasAddress() {
        const p = this.profile;
        return Boolean(p && (p.addressLine1 || this.cityLine));
    }

    get hasOrders() {
        return Boolean(this.profile && this.profile.totalOrders);
    }
}
