"""
Memora — memory_weave tool
Olas Mech Marketplace: stores a verifiable memory for an agent via ERC-8004 attestation.

Tool: memory_weave
Author: khusna_memora
"""
import json
import os
import urllib.request
import urllib.error
from typing import Any, Dict, Optional, Tuple

ALLOWED_TOOLS = ["memory_weave"]

MechResponse = Tuple[str, Optional[str], Optional[Dict[str, Any]], Any, Any]

# Memora API base URL (set via MEMORA_API_URL env var, defaults to local Pearl port)
MEMORA_API_URL = os.environ.get("MEMORA_API_URL", "http://localhost:8716")


def error_response(msg: str) -> MechResponse:
    """Return an error mech response."""
    return msg, None, None, None, None


def call_memora(path: str, method: str = "GET", body: Optional[dict] = None) -> dict:
    """Call Memora HTTP API."""
    url = f"{MEMORA_API_URL}{path}"
    headers = {"Content-Type": "application/json"}
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def run(**kwargs: Any) -> MechResponse:
    """
    Weave (store) a verifiable memory for an agent.

    Prompt format (JSON string):
    {
        "agent_id": "my-agent-001",
        "content": "The user prefers dark mode",
        "category": "preferences",  // optional
        "tags": ["ui"],              // optional
        "tx_hash": "0x..."           // optional on-chain tx
    }
    """
    prompt = kwargs.get("prompt")
    if prompt is None:
        return error_response("No prompt provided. Expected JSON with agent_id and content.")

    # Parse prompt
    try:
        if isinstance(prompt, str):
            params = json.loads(prompt)
        else:
            params = prompt
    except json.JSONDecodeError:
        # Treat raw string as content with default agent_id
        params = {
            "agent_id": kwargs.get("sender", "mech_client"),
            "content": prompt,
        }

    agent_id = params.get("agent_id") or kwargs.get("sender", "mech_client")
    content = params.get("content")

    if not content:
        return error_response("'content' is required in the prompt.")

    payload = {
        "agent_id": agent_id,
        "content": content,
        "category": params.get("category", "general"),
        "tags": params.get("tags", []),
        "tx_hash": params.get("tx_hash"),
        "chain": params.get("chain", "base"),
    }

    try:
        result = call_memora("/weave", method="POST", body=payload)
        response = json.dumps({
            "status": "success",
            "memory_id": result.get("memory", {}).get("id"),
            "agent_id": agent_id,
            "category": payload["category"],
            "proof": result.get("proof", {}),
            "attestation": result.get("memory", {}).get("attestation", {}),
        })
        return response, prompt, None, None, None
    except Exception as e:
        return error_response(f"Memora weave failed: {str(e)}")
