# Salesforce access for the agent: opens support Cases as the Westerly Google Agent integration user.
# Config vars: SF_DOMAIN (My Domain host), SF_CLIENT_ID, SF_CLIENT_SECRET (External Client App, client credentials flow).
import os
import time

import requests

API = "v62.0"
TOKEN_TTL = 15 * 60  # the client credentials token has no expiry in its response; refresh well before the session times out
_token = {"value": "", "at": 0.0}
_queue_id = ""


def _headers(refresh=False) -> dict:
    if refresh or time.time() - _token["at"] > TOKEN_TTL:
        r = requests.post(f"https://{os.environ['SF_DOMAIN']}/services/oauth2/token", timeout=15, data={
            "grant_type": "client_credentials",
            "client_id": os.environ["SF_CLIENT_ID"],
            "client_secret": os.environ["SF_CLIENT_SECRET"],
        })
        r.raise_for_status()
        _token.update(value=r.json()["access_token"], at=time.time())
    return {"Authorization": "Bearer " + _token["value"]}


def _call(method, path, headers_extra=None, **kw) -> dict:
    url = f"https://{os.environ['SF_DOMAIN']}/services/data/{API}{path}"
    r = requests.request(method, url, headers=_headers() | (headers_extra or {}), timeout=15, **kw)
    if r.status_code == 401:  # token expired early: get a new one and retry once
        r = requests.request(method, url, headers=_headers(refresh=True) | (headers_extra or {}), timeout=15, **kw)
    r.raise_for_status()
    return r.json()


def _one(soql: str) -> dict | None:
    records = _call("GET", "/query", params={"q": soql})["records"]
    return records[0] if records else None


def create_case(customer_id: str, subject: str, description: str, order_id: str, order_status: str) -> str:
    """Opens a Case on the shopper's Contact in the Westerly Support queue and returns its case number.
    customer_id and order_id are validated (CUST_123, W-123) before they get here."""
    global _queue_id
    if not _queue_id:
        _queue_id = _one("SELECT Id FROM Group WHERE Type = 'Queue' AND DeveloperName = 'Westerly_Support'")["Id"]
    contact = _one(f"SELECT Id FROM Contact WHERE Westerly_Customer_Id__c = '{customer_id}'")
    # The API applies the org's active Case assignment rule unless told not to; keep the Westerly Support owner.
    case = _call("POST", "/sobjects/Case", headers_extra={"Sforce-Auto-Assign": "FALSE"}, json={
        "Subject": subject[:255],
        "Description": description[:4000],
        "Origin": "Website",
        "Status": "New",
        "OwnerId": _queue_id,
        "ContactId": contact["Id"] if contact else None,
        "Westerly_Customer_Id__c": customer_id,
        "Westerly_Order_Id__c": order_id or None,
        "Westerly_Order_Status__c": order_status[:40] or None,
    })
    return _one(f"SELECT CaseNumber FROM Case WHERE Id = '{case['id']}'")["CaseNumber"]
