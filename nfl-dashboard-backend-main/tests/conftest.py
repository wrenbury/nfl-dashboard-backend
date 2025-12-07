import pytest
import respx
import httpx

@pytest.fixture
def mock_http():
    with respx.mock(assert_all_called=False) as res:
        yield res
