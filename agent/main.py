# Westerly agent service for Heroku: POST /chat, called only by the site's server.js.
# Config vars: GOOGLE_API_KEY (Gemini), AGENT_SHARED_SECRET (same value as on the site app),
# SF_DOMAIN, SF_CLIENT_ID, SF_CLIENT_SECRET (Salesforce, for support cases; see westerly_agent/salesforce.py). Heroku sets PORT.
import hmac
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import BaseModel, Field

load_dotenv(Path(__file__).parent / "westerly_agent" / ".env")  # local runs only; Heroku uses config vars

from westerly_agent.agent import root_agent  # noqa: E402

APP_NAME = "westerly"
SESSION_ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")


class CartLine(BaseModel):
    sku: str = Field(max_length=40)
    quantity: int = Field(ge=1, le=99)


class LastOrder(BaseModel):
    id: str = Field(pattern=r"^W-\d{1,10}$")
    status: str = Field(max_length=40)
    items: list[str] = Field(default_factory=list, max_length=60)


class ChatRequest(BaseModel):
    sessionId: str
    message: str = Field(min_length=1, max_length=1000)
    customerName: str | None = Field(default=None, max_length=60)
    customerId: str | None = Field(default=None, pattern=r"^CUST_\d{1,10}$")  # signed-in shopper; the case goes on their Contact
    cart: list[CartLine] = Field(default_factory=list, max_length=60)
    lastOrder: LastOrder | None = None  # signed-in shopper only; from the site's demo profile until phase 2
    usualItems: list[str] = Field(default_factory=list, max_length=20)


sessions = InMemorySessionService()  # conversations are lost when the dyno restarts; fine for the demo
runner = Runner(app_name=APP_NAME, agent=root_agent, session_service=sessions)
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/chat")
async def chat(req: ChatRequest, x_westerly_agent_secret: str = Header(default="")):
    secret = os.getenv("AGENT_SHARED_SECRET", "")
    if not secret or not hmac.compare_digest(x_westerly_agent_secret.encode(), secret.encode()):
        raise HTTPException(status_code=401)
    if not SESSION_ID.match(req.sessionId):
        raise HTTPException(status_code=400, detail="Invalid session id")

    user_id = "web-" + req.sessionId
    if not await sessions.get_session(app_name=APP_NAME, user_id=user_id, session_id=req.sessionId):
        await sessions.create_session(app_name=APP_NAME, user_id=user_id, session_id=req.sessionId)

    reply, actions = "", []
    async for event in runner.run_async(
        user_id=user_id,
        session_id=req.sessionId,
        new_message=types.Content(role="user", parts=[types.Part(text=req.message)]),
        state_delta={
            "customer_name": req.customerName,
            "customer_id": req.customerId,
            "cart": [c.model_dump() for c in req.cart],
            "last_order": req.lastOrder.model_dump() if req.lastOrder else None,
            "usual_items": req.usualItems,
        },
    ):
        for call in event.get_function_responses():
            result = call.response or {}
            if call.name == "add_to_cart" and result.get("ok"):
                actions.append({"type": "add_to_cart", "sku": result["sku"], "quantity": result["quantity"]})
            if call.name == "create_support_case" and result.get("ok"):
                actions.append({"type": "case_created", "caseNumber": result["case_number"]})
        if event.is_final_response() and event.content and event.content.parts:
            reply = "".join(p.text or "" for p in event.content.parts)
    return {"reply": reply, "actions": actions}
