import { LightningElement } from 'lwc';
import searchShoppers from '@salesforce/apex/WesterlyShopperCardController.searchShoppers';

// Shopper 360 app page: search unified shoppers by customer ID or name, then show the shopper card.
export default class WesterlyShopper360 extends LightningElement {
    term = '';
    matches;
    selectedId;
    errorMessage;
    isSearching = false;

    handleTermChange(event) {
        this.term = event.target.value;
    }

    handleKeyUp(event) {
        if (event.key === 'Enter') this.handleSearch();
    }

    async handleSearch() {
        const term = (this.term || '').trim();
        if (term.length < 2) {
            this.errorMessage = 'Enter at least 2 characters.';
            return;
        }
        this.isSearching = true;
        this.errorMessage = undefined;
        this.selectedId = undefined;
        try {
            const matches = await searchShoppers({ term });
            this.matches = matches.map((m) => ({
                ...m,
                label: m.name || 'Unnamed shopper'
            }));
            // Open the card straight away when the search finds exactly one shopper.
            if (this.matches.length === 1) this.selectedId = this.matches[0].unifiedId;
        } catch (error) {
            this.matches = undefined;
            this.errorMessage = (error.body && error.body.message) || 'Search failed.';
        } finally {
            this.isSearching = false;
        }
    }

    handleSelect(event) {
        this.selectedId = event.currentTarget.dataset.id;
    }

    get visibleMatches() {
        return (this.matches || []).map((m) => ({
            ...m,
            rowClass: m.unifiedId === this.selectedId ? 'match match_selected' : 'match'
        }));
    }

    get hasNoMatches() {
        return Array.isArray(this.matches) && this.matches.length === 0;
    }

    get hasMatches() {
        return Array.isArray(this.matches) && this.matches.length > 0;
    }
}
