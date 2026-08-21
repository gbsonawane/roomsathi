import pytest
import pytest_asyncio
import httpx
from httpx import Response
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from fastapi import HTTPException

# Assuming the backend paths
from backend.services.ai_service import parse_search_query, chat_with_assistant
from backend.main import app
from backend.core.security import create_access_token
from backend.routers.listings import get_current_user, get_current_user_optional

pytestmark = pytest.mark.asyncio

import uuid
from collections import namedtuple
TestUser = namedtuple('TestUser', ['id'])
user_id = str(uuid.uuid4())
token = create_access_token(data={"sub": user_id})
auth_headers = {"Authorization": f"Bearer {token}"}

# Override dependencies for tests to avoid db connections
app.dependency_overrides[get_current_user] = lambda: TestUser(id=user_id)
app.dependency_overrides[get_current_user_optional] = lambda: TestUser(id=user_id)

#
# 1. parse_search_query unit tests
#
@pytest.mark.asyncio
class TestParseSearchQuery:
    @patch("backend.services.ai_service.settings")
    @patch("backend.services.ai_service.httpx.AsyncClient")
    async def test_basic_2bhk_hinjewadi_girls(self, mock_client_class, mock_settings):
        mock_settings.NVIDIA_API_KEY = "test-key"
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "{\"area\":\"Hinjewadi\",\"property_type\":\"2bhk\",\"max_rent\":15000,\"gender_preference\":\"girls\"}"}}]
        }
        mock_client.post.return_value = mock_response

        result = await parse_search_query("2BHK near Hinjewadi under 15k girls only")
        assert result["area"] == "Hinjewadi"
        assert result["property_type"] == "2bhk"
        assert result["max_rent"] == 15000
        assert result["gender_preference"] == "girls"
        assert "city" not in result

    @patch("backend.services.ai_service.settings")
    @patch("backend.services.ai_service.httpx.AsyncClient")
    async def test_furnished_1rk_baner_pune(self, mock_client_class, mock_settings):
        mock_settings.NVIDIA_API_KEY = "test-key"
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "{\"area\":\"Baner\",\"city\":\"Pune\",\"property_type\":\"1rk\",\"furnishing\":\"fully\"}"}}]
        }
        mock_client.post.return_value = mock_response

        result = await parse_search_query("furnished 1rk in Baner Pune")
        assert result["area"] == "Baner"
        assert result["city"] == "Pune"
        assert result["property_type"] == "1rk"
        assert result["furnishing"] == "fully"

    @patch("backend.services.ai_service.settings")
    @patch("backend.services.ai_service.httpx.AsyncClient")
    async def test_pg_boys_under_8000(self, mock_client_class, mock_settings):
        mock_settings.NVIDIA_API_KEY = "test-key"
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "{\"property_type\":\"pg\",\"gender_preference\":\"boys\",\"max_rent\":8000}"}}]
        }
        mock_client.post.return_value = mock_response

        result = await parse_search_query("PG for boys under 8000")
        assert result["property_type"] == "pg"
        assert result["gender_preference"] == "boys"
        assert result["max_rent"] == 8000

    @patch("backend.services.ai_service.settings")
    @patch("backend.services.ai_service.httpx.AsyncClient")
    async def test_roommate_needed_kothrud(self, mock_client_class, mock_settings):
        mock_settings.NVIDIA_API_KEY = "test-key"
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "{\"area\":\"Kothrud\",\"listing_type\":\"roommate_needed\"}"}}]
        }
        mock_client.post.return_value = mock_response

        result = await parse_search_query("looking for roommate in Kothrud")
        assert result["area"] == "Kothrud"
        assert result["listing_type"] == "roommate_needed"

    @patch("backend.services.ai_service.settings")
    @patch("backend.services.ai_service.httpx.AsyncClient")
    async def test_nonsense_query_returns_empty(self, mock_client_class, mock_settings):
        mock_settings.NVIDIA_API_KEY = "test-key"
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "{}"}}]
        }
        mock_client.post.return_value = mock_response

        result = await parse_search_query("xyz abc 123")
        assert result == {}

    @patch("backend.services.ai_service.settings")
    @patch("backend.services.ai_service.httpx.AsyncClient")
    async def test_short_query_skips_ai(self, mock_client_class, mock_settings):
        mock_settings.NVIDIA_API_KEY = "test-key"
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        
        result = await parse_search_query("ab")
        assert result == {}

    @patch("backend.services.ai_service.settings")
    @patch("backend.services.ai_service.httpx.AsyncClient")
    async def test_invalid_property_type_dropped(self, mock_client_class, mock_settings):
        mock_settings.NVIDIA_API_KEY = "test-key"
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "{\"property_type\":\"5bhk\",\"city\":\"Pune\"}"}}]
        }
        mock_client.post.return_value = mock_response

        result = await parse_search_query("5bhk in Pune")
        assert "property_type" not in result
        assert result["city"] == "Pune"

    @patch("backend.services.ai_service.settings")
    @patch("backend.services.ai_service.httpx.AsyncClient")
    async def test_invalid_gender_dropped(self, mock_client_class, mock_settings):
        mock_settings.NVIDIA_API_KEY = "test-key"
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "{\"gender_preference\":\"everyone\",\"city\":\"Pune\"}"}}]
        }
        mock_client.post.return_value = mock_response

        result = await parse_search_query("room for everyone")
        assert "gender_preference" not in result
        assert result["city"] == "Pune"

    @patch("backend.services.ai_service.settings")
    @patch("backend.services.ai_service.httpx.AsyncClient")
    async def test_markdown_fence_stripped(self, mock_client_class, mock_settings):
        mock_settings.NVIDIA_API_KEY = "test-key"
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "```json\n{\"area\":\"Baner\",\"property_type\":\"1bhk\"}\n```"}}]
        }
        mock_client.post.return_value = mock_response

        result = await parse_search_query("1bhk in Baner")
        assert result["area"] == "Baner"
        assert result["property_type"] == "1bhk"

    @patch("backend.services.ai_service.settings")
    @patch("backend.services.ai_service.httpx.AsyncClient")
    async def test_nim_503_returns_empty(self, mock_client_class, mock_settings):
        mock_settings.NVIDIA_API_KEY = "test-key"
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_response = MagicMock()
        mock_response.status_code = 503
        mock_response.text = "Service Unavailable"
        mock_client.post.return_value = mock_response

        result = await parse_search_query("2bhk in Pune")
        assert result == {}

    @patch("backend.services.ai_service.settings")
    @patch("backend.services.ai_service.httpx.AsyncClient")
    async def test_malformed_json_returns_empty(self, mock_client_class, mock_settings):
        mock_settings.NVIDIA_API_KEY = "test-key"
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "not valid json {{{"}}]
        }
        mock_client.post.return_value = mock_response

        result = await parse_search_query("1bhk in Kothrud")
        assert result == {}

    @patch("backend.services.ai_service.settings")
    @patch("backend.services.ai_service.httpx.AsyncClient")
    async def test_rent_keys_are_integers(self, mock_client_class, mock_settings):
        mock_settings.NVIDIA_API_KEY = "test-key"
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "{\"min_rent\":10000,\"max_rent\":20000,\"area\":\"Baner\"}"}}]
        }
        mock_client.post.return_value = mock_response

        result = await parse_search_query("between 10k and 20k in Baner")
        assert isinstance(result["min_rent"], int)
        assert isinstance(result["max_rent"], int)
        assert result["min_rent"] == 10000
        assert result["max_rent"] == 20000

#
# 2. POST /listings/parse-search route tests
#
client = TestClient(app)

@pytest.mark.asyncio
class TestParseSearchRoute:
    async def test_route_requires_auth(self):
        app.dependency_overrides.pop(get_current_user, None)
        response = client.post("/listings/parse-search", json={"query": "hello"})
        app.dependency_overrides[get_current_user] = lambda: TestUser(id=user_id)
        assert response.status_code in [401, 403]

    async def test_empty_query_returns_empty_dict(self):
        response = client.post("/listings/parse-search", json={"query": ""}, headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == {}

    async def test_two_char_query_returns_empty_dict(self):
        response = client.post("/listings/parse-search", json={"query": "ab"}, headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == {}

    @patch("backend.routers.listings.ai_service.parse_search_query", new_callable=AsyncMock)
    async def test_valid_query_returns_parsed_filters(self, mock_parse):
        mock_parse.return_value = {"area": "Baner", "property_type": "1bhk", "max_rent": 12000}
        response = client.post("/listings/parse-search", json={"query": "1bhk in Baner under 12k"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["area"] == "Baner"
        assert data["property_type"] == "1bhk"
        assert data["max_rent"] == 12000

    @patch("backend.routers.listings.ai_service.parse_search_query", new_callable=AsyncMock)
    async def test_ai_failure_returns_empty_not_500(self, mock_parse):
        mock_parse.side_effect = Exception("NIM down")
        response = client.post("/listings/parse-search", json={"query": "2bhk in Pune"}, headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == {}

#
# 3. chat_with_assistant unit tests
#
@pytest.mark.asyncio
class TestChatWithAssistant:
    @patch("backend.services.ai_service.settings")
    @patch("backend.services.ai_service.httpx.AsyncClient")
    async def test_basic_response_returned(self, mock_client_class, mock_settings):
        mock_settings.NVIDIA_API_KEY = "test-key"
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Baner is generally considered safe..."}}]
        }
        mock_client.post.return_value = mock_response

        ctx = {
            "area": "Baner", "city": "Pune", "rent": 12000, "deposit": 24000,
            "property_type": "1bhk", "furnishing": "semi",
            "gender_preference": "any", "parking": "none",
            "floor": "2nd", "available_from": "2026-09-01",
            "description": "Quiet locality near D-Mart"
        }
        msg = [{"role": "user", "content": "Is this area safe?"}]

        result = await chat_with_assistant(msg, ctx)
        assert result == "Baner is generally considered safe..."
        assert mock_client.post.call_count == 1

    @patch("backend.services.ai_service.settings")
    @patch("backend.services.ai_service.httpx.AsyncClient")
    async def test_conversation_history_included(self, mock_client_class, mock_settings):
        mock_settings.NVIDIA_API_KEY = "test-key"
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Baner is safe at night too..."}}]
        }
        mock_client.post.return_value = mock_response

        msg = [
            {"role": "user", "content": "Is this area safe?"},
            {"role": "assistant", "content": "Yes, Baner is safe."},
            {"role": "user", "content": "What about at night?"}
        ]

        await chat_with_assistant(msg, {})
        payload = mock_client.post.call_args[1]["json"]
        assert len(payload["messages"]) == 4
        assert payload["messages"][0]["role"] == "system"
        assert payload["messages"][-1]["content"] == "What about at night?"

    @patch("backend.services.ai_service.settings")
    @patch("backend.services.ai_service.httpx.AsyncClient")
    async def test_listing_context_in_system_prompt(self, mock_client_class, mock_settings):
        mock_settings.NVIDIA_API_KEY = "test-key"
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Hello!"}}]
        }
        mock_client.post.return_value = mock_response

        ctx = {"area": "Kothrud", "city": "Pune", "rent": 9000}
        msg = [{"role": "user", "content": "hello"}]

        await chat_with_assistant(msg, ctx)
        payload = mock_client.post.call_args[1]["json"]
        sys_prompt = payload["messages"][0]["content"]
        assert "Kothrud" in sys_prompt
        assert "9000" in sys_prompt
        assert "Pune" in sys_prompt

    @patch("backend.services.ai_service.settings")
    @patch("backend.services.ai_service.httpx.AsyncClient")
    async def test_nim_502_raises_http_exception(self, mock_client_class, mock_settings):
        mock_settings.NVIDIA_API_KEY = "test-key"
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_response = MagicMock()
        mock_response.status_code = 502
        mock_client.post.return_value = mock_response

        msg = [{"role": "user", "content": "test"}]
        with pytest.raises(HTTPException) as excinfo:
            await chat_with_assistant(msg, {})
        assert excinfo.value.status_code == 502

    @patch("backend.services.ai_service.settings")
    @patch("backend.services.ai_service.httpx.AsyncClient")
    async def test_nim_network_error_raises_http_exception(self, mock_client_class, mock_settings):
        mock_settings.NVIDIA_API_KEY = "test-key"
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client.post.side_effect = httpx.ConnectError("Network Down")

        msg = [{"role": "user", "content": "test"}]
        with pytest.raises(HTTPException) as excinfo:
            await chat_with_assistant(msg, {})
        assert excinfo.value.status_code == 502

#
# 4. POST /listings/{listing_id}/chat route tests
#
from uuid import uuid4
@pytest.mark.asyncio
class TestChatRoute:
    async def test_route_requires_auth(self):
        app.dependency_overrides.pop(get_current_user, None)
        response = client.post(f"/listings/{uuid4()}/chat", json={})
        app.dependency_overrides[get_current_user] = lambda: TestUser(id=user_id)
        assert response.status_code in [401, 403]

    async def test_empty_messages_returns_400(self):
        response = client.post(f"/listings/{uuid4()}/chat", json={"messages": [], "listing_context": {}}, headers=auth_headers)
        assert response.status_code == 400

    async def test_last_message_not_user_returns_400(self):
        body = {
            "messages": [{"role": "assistant", "content": "Hi"}],
            "listing_context": {}
        }
        response = client.post(f"/listings/{uuid4()}/chat", json=body, headers=auth_headers)
        assert response.status_code == 400

    @patch("backend.routers.listings.ai_service.chat_with_assistant", new_callable=AsyncMock)
    async def test_valid_request_returns_reply(self, mock_chat):
        mock_chat.return_value = "Baner is safe."
        body = {
            "messages": [{"role": "user", "content": "Is this area safe?"}],
            "listing_context": {"area": "Baner", "city": "Pune", "rent": 12000}
        }
        response = client.post(f"/listings/{uuid4()}/chat", json=body, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["reply"] == "Baner is safe."

    @patch("backend.routers.listings.ai_service.chat_with_assistant", new_callable=AsyncMock)
    async def test_messages_capped_at_10(self, mock_chat):
        mock_chat.return_value = "Baner is safe."
        msgs = [{"role": "user", "content": f"msg {i}"} for i in range(15)]
        body = {
            "messages": msgs,
            "listing_context": {}
        }
        response = client.post(f"/listings/{uuid4()}/chat", json=body, headers=auth_headers)
        assert response.status_code == 200
        passed_msgs = mock_chat.call_args[0][0]
        assert len(passed_msgs) == 10
        assert passed_msgs[0]["content"] == "msg 5"

    @patch("backend.routers.listings.ai_service.chat_with_assistant", new_callable=AsyncMock)
    async def test_ai_failure_returns_502(self, mock_chat):
        mock_chat.side_effect = HTTPException(status_code=502)
        body = {
            "messages": [{"role": "user", "content": "Hi"}],
            "listing_context": {}
        }
        response = client.post(f"/listings/{uuid4()}/chat", json=body, headers=auth_headers)
        assert response.status_code == 502
