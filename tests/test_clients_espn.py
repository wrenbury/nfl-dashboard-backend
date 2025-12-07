import httpx
from app.clients import espn
from app.config import settings

def test_scoreboard_fetch(mock_http):
    url = f"{settings.ESPN_BASE}/nfl/scoreboard?dates=20250101"
    mock_http.get(url).mock(return_value=httpx.Response(200, json={"events":[
        {
          "id":"123",
          "date":"2025-01-01T17:00Z",
          "status":{"type":{"description":"Final"}},
          "competitions":[{
            "competitors":[
              {"homeAway":"away","score":"21","team":{"id":"1","displayName":"A","shortDisplayName":"A","abbreviation":"A","logos":[{"href":"a.png"}]}},
              {"homeAway":"home","score":"24","team":{"id":"2","displayName":"B","shortDisplayName":"B","abbreviation":"B","logos":[{"href":"b.png"}]}}
            ]
          }]
        }
    ]}))
    data = espn.scoreboard("nfl", date="20250101")
    assert data["events"][0]["id"] == "123"
