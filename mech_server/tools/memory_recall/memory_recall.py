"""
Memora — memory_recall tool
Olas Mech Marketplace: retrieves verifiable memories for an agent.

Tool: memory_recall
Author: khusna_memora
"""
import json
import os
import urllib.request
import urllib.parse
from typing import Any, Dict, Optional, Tuple

ALLOWED_TOOLS = ["memory_recall"]

MechResponse = Tuple[str, Optional[str], Optional[Dict[str, Any]], Any, Any]

MEMORA_API_URL = os.environ.get("MEMORA_API_URL", "http://localhost:8716")


def error_response(msg: str) -> MechResponse:
    return msg, None, None, None, None


def call_memora(path: str) -> dict:
    url = f"{MEMORA_API_URL}{path}"
    req = urllib.request.Request(url, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def run(**kwargs: Any) -> MechResponse:
    """
    Recall memories for an agent from Memora.

    Prompt format (JSON string):
    {
        "agent_id": "my-agent-001",
        "category": "preferences",  // optional
        "q": "dark mode",           // optional search query
        "limit": 10                 // optional, default 10
    }
    """
    prompt = kwargs.get("prompt")
    if prompt is None:
        return error_response("No prompt provided. Expected JSON with agent_id.")

    try:
        params = json.loads(prompt) if isinstance(prompt, str) else prompt
    except json.JSONDecodeError:
        params = {"agent_id": kwargs.get("sender", "mech_client")}

    agent_id = params.get("agent_id") or kwargs.get("sender", "mech_client")
    category = params.get("category", "")
    q = params.get("q", "")
    limit = params.get("limit", 10)

    query = urllib.parse.urlencode({
        k: v for k, v in {
            "agent_id": agent_id,
            "category": category,
            "q": q,
            "limit": limit,
        }.items() if v
    })

    try:
        result = call_memora(f"/recall?{query}")
        response = json.dumps({
            "status": "success",
            "agent_id": agent_id,
            "memories": result.get("memories", []),
            "total": result.get("total", 0),
            "proof": result.get("proof", {}),
        })
        return response, prompt, None, None, None
    except Exception as e:
        return error_response(f"Memora recall failed: {str(e)}")
