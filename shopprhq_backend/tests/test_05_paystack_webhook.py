"""
TEST GROUP 05 — Paystack Webhook Endpoint
"""

import os
import hmac
import hashlib
from fastapi import FastAPI
from fastapi.testclient import TestClient

def test_paystack_router_route_exists():
    from app.api.v1.paystack import router
    routes = {r.path for r in router.routes}
    assert any("paystack" in r for r in routes)

def test_paystack_router_prefix():
    from app.api.v1.paystack import router
    assert router.prefix == "/webhook"

def test_paystack_missing_signature_rejected():
    from app.api.v1.paystack import router
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app, raise_server_exceptions=False)
    r = client.post("/webhook/paystack", json={"event":"charge.success","data":{}})
    assert r.status_code == 401
