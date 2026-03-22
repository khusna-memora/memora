"""
Memora — memory_search tool
Olas Mech Marketplace: cross-agent memory search.

Tool: memory_search
Author: khusna_memora
"""
import json
import os
import urllib.request
import urllib.parse
from typing import Any, Dict, Optional, Tuple

ALLOWED_TOOLS = ["memory_search"]

MechResponse = Tuple[str, Optional[str], Optional[Dict[str, Any]], Any, Any]

MEMORA_API_URL = os.environ.get("MEMORA_API_URL", "http://localhost:8716")


def error_response(msg: str) -> MechResponse:
    return msg, None, None, None, None


def call_memora(path: str, method: str = "POST", body: Optional[dict] = None) -> dict:
    url = f"{MEMORA_API_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method=method)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def run(**kwargs: Any) -> MechResponse:
    """
    Search memories across all agents in Memora.

    Prompt format (JSON string or plain string):
    {
        "query": "dark mode preferences",
        "limit": 10
    }
    Or just a plain string query.
    """
    prompt = kwargs.get("prompt")
    if prompt is None:
        return error_response("No prompt provided. Expected a search query string or JSON.")

    try:
        params = json.loads(prompt) if isinstance(prompt, str) and prompt.strip().startswith("{") else {"query": prompt}
    except Exception:
        params = {"query": str(prompt)}

    query = params.get("query") or params.get("q") or params.get("prompt")
    if not query:
        return error_response("'query' is required.")

    limit = params.get("limit", 10)

    try:
        result = call_memora("/request", method="POST", body={
            "tool": "memory_search",
            "prompt": json.dumps({"query": query, "limit": limit}),
            "sender": kwargs.get("sender", "mech_client"),
            "chain": "base"
        })
        response = json.dumps({
            "status": "success",
            "query": query,
            "memories": result.get("result", {}).get("memories", []),
            "count": result.get("result", {}).get("count", 0),
            "proof": result.get("result", {}).get("proof", "Memora — memora.codes — ERC-8004 verified"),
        })
        return response, prompt, None, None, None
    except Exception as e:
        return error_response(f"Memora search failed: {str(e)}")
