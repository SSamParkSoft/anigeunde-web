from fastapi.testclient import TestClient

VIEWER_HEADERS = {"X-Viewer-ID": "test-viewer"}


def test_health(client: TestClient):
    assert client.get("/health/live").json() == {"status": "ok"}
    assert client.get("/health/ready").json() == {"status": "ready"}


def test_position_gates_results(client: TestClient):
    issue = client.get("/api/v1/issues/four-and-half-day-workweek", headers=VIEWER_HEADERS).json()
    assert issue["results"] is None

    anonymous = client.post(
        f"/api/v1/issues/{issue['id']}/positions",
        json={"option_id": issue["options"][0]["id"]},
    )
    assert anonymous.status_code == 401

    response = client.post(
        f"/api/v1/issues/{issue['id']}/positions",
        headers=VIEWER_HEADERS,
        json={"option_id": issue["options"][1]["id"]},
    )
    assert response.status_code == 200
    first_total = response.json()["results"]["total"]
    assert first_total > 1000

    changed = client.post(
        f"/api/v1/issues/{issue['id']}/positions",
        headers=VIEWER_HEADERS,
        json={"option_id": issue["options"][2]["id"]},
    )
    assert changed.status_code == 200
    assert changed.json()["results"]["total"] == first_total

    updated = client.get(
        "/api/v1/issues/four-and-half-day-workweek", headers=VIEWER_HEADERS
    ).json()
    assert updated["my_position_id"] == issue["options"][2]["id"]
    assert updated["results"] is not None


def test_comment_rebuttal_and_reaction_flow(client: TestClient):
    issue = client.get("/api/v1/issues/four-and-half-day-workweek", headers=VIEWER_HEADERS).json()
    client.post(
        f"/api/v1/issues/{issue['id']}/positions",
        headers=VIEWER_HEADERS,
        json={"option_id": issue["options"][0]["id"]},
    )

    created = client.post(
        f"/api/v1/issues/{issue['id']}/comments",
        headers=VIEWER_HEADERS,
        json={"body": "법제화 방향에 동의하지만 업종별 유예기간은 반드시 필요합니다."},
    )
    assert created.status_code == 201
    assert created.json()["is_mine"] is True

    seeded_comment = client.get(
        f"/api/v1/issues/{issue['id']}/comments", headers=VIEWER_HEADERS
    ).json()["items"][-1]
    assert seeded_comment["replies"]
    assert any(reply["replies"] for reply in seeded_comment["replies"])
    reaction = client.put(
        f"/api/v1/comments/{seeded_comment['id']}/reactions/like",
        headers=VIEWER_HEADERS,
    )
    assert reaction.status_code == 200
    assert "LIKE" in reaction.json()["viewer_reactions"]

    rebuttal = client.post(
        f"/api/v1/comments/{seeded_comment['id']}/rebuttals",
        headers=VIEWER_HEADERS,
        json={"body": "시범사업의 종료 조건과 본사업 전환 기준도 먼저 정해야 합니다."},
    )
    assert rebuttal.status_code == 201
    assert rebuttal.json()["parent_id"] == seeded_comment["id"]
    assert rebuttal.json()["depth"] == 1
