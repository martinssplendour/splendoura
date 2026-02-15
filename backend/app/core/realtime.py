import asyncio
import json
import uuid
from typing import Dict, Set

from fastapi import WebSocket
import redis.asyncio as redis_async

from app.core.config import settings


class ConnectionManager:
    def __init__(self, redis_url: str | None = None) -> None:
        self._groups: Dict[int, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()
        self._redis_url = redis_url
        self._redis: redis_async.Redis | None = None
        self._subscriptions: dict[int, asyncio.Task] = {}
        self._subscriptions_lock = asyncio.Lock()
        self._instance_id = uuid.uuid4().hex

    def _channel(self, group_id: int) -> str:
        return f"realtime:groups:{group_id}"

    async def _get_redis(self) -> redis_async.Redis | None:
        if not self._redis_url:
            return None
        if self._redis is None:
            self._redis = redis_async.from_url(self._redis_url, decode_responses=True)
        return self._redis

    async def _ensure_subscription(self, group_id: int) -> None:
        if not self._redis_url:
            return
        async with self._subscriptions_lock:
            if group_id in self._subscriptions:
                return
            redis_client = await self._get_redis()
            if not redis_client:
                return
            pubsub = redis_client.pubsub()
            await pubsub.subscribe(self._channel(group_id))
            self._subscriptions[group_id] = asyncio.create_task(
                self._listen_group(group_id, pubsub)
            )

    async def _stop_subscription(self, group_id: int) -> None:
        async with self._subscriptions_lock:
            task = self._subscriptions.pop(group_id, None)
        if task:
            task.cancel()

    async def connect(self, group_id: int, websocket: WebSocket, subprotocol: str | None = None) -> None:
        if subprotocol:
            await websocket.accept(subprotocol=subprotocol)
        else:
            await websocket.accept()
        async with self._lock:
            self._groups.setdefault(group_id, set()).add(websocket)
        await self._ensure_subscription(group_id)

    async def disconnect(self, group_id: int, websocket: WebSocket) -> None:
        should_stop = False
        async with self._lock:
            connections = self._groups.get(group_id)
            if not connections:
                return
            connections.discard(websocket)
            if not connections:
                self._groups.pop(group_id, None)
                should_stop = True
        if should_stop:
            await self._stop_subscription(group_id)

    async def _broadcast_local(self, group_id: int, payload: dict) -> None:
        message = json.dumps(payload, default=str)
        connections = list(self._groups.get(group_id, set()))
        if not connections:
            return
        stale: list[WebSocket] = []
        for connection in connections:
            try:
                await connection.send_text(message)
            except Exception:
                stale.append(connection)
        if stale:
            async with self._lock:
                active = self._groups.get(group_id)
                if not active:
                    return
                for connection in stale:
                    active.discard(connection)
                if not active:
                    self._groups.pop(group_id, None)

    async def _publish(self, group_id: int, payload: dict) -> None:
        if not self._redis_url:
            return
        try:
            redis_client = await self._get_redis()
            if not redis_client:
                return
            envelope = {"origin": self._instance_id, "payload": payload}
            await redis_client.publish(
                self._channel(group_id), json.dumps(envelope, default=str)
            )
        except Exception:
            return

    async def _listen_group(self, group_id: int, pubsub) -> None:
        try:
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                data = message.get("data")
                if not data:
                    continue
                try:
                    envelope = json.loads(data)
                except json.JSONDecodeError:
                    continue
                if envelope.get("origin") == self._instance_id:
                    continue
                payload = envelope.get("payload")
                if not isinstance(payload, dict):
                    continue
                await self._broadcast_local(group_id, payload)
        except asyncio.CancelledError:
            pass
        finally:
            try:
                await pubsub.unsubscribe(self._channel(group_id))
            except Exception:
                pass
            try:
                await pubsub.close()
            except Exception:
                pass

    async def broadcast(self, group_id: int, payload: dict) -> None:
        await self._broadcast_local(group_id, payload)
        await self._publish(group_id, payload)


realtime_manager = ConnectionManager(redis_url=settings.REDIS_URL)


def serialize_message(message, read_by: list[int] | None = None) -> dict:
    return {
        "id": message.id,
        "group_id": message.group_id,
        "sender_id": message.sender_id,
        "content": message.content,
        "attachment_url": message.attachment_url,
        "attachment_type": message.attachment_type,
        "message_type": message.message_type,
        "meta": message.meta,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "read_by": read_by or [],
    }
