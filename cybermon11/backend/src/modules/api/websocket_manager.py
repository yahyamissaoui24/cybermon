"""
WebSocket Manager — real-time event streaming to frontend
"""
import asyncio
import json
import logging
from typing import List, Set
from fastapi import WebSocket

logger = logging.getLogger("websocket")

class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        logger.info(f"WS client connected. Total: {len(self.active)}")

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)
        logger.info(f"WS client disconnected. Total: {len(self.active)}")

    async def broadcast(self, data: dict):
        if not self.active:
            return
        message = json.dumps(data, default=str)
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

ws_manager = ConnectionManager()

async def broadcast_event(event: dict):
    """Called by event bus — streams event to all WS clients"""
    try:
        await ws_manager.broadcast({"type": "event", "data": event})
    except Exception as e:
        logger.error(f"WS broadcast error: {e}")
