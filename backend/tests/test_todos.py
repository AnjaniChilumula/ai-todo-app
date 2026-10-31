def create(client, **fields):
    response = client.post("/api/todos", json={"title": "Task", **fields})
    assert response.status_code == 201, response.text
    return response.json()


def titles(client, status="all"):
    return [todo["title"] for todo in client.get(f"/api/todos?status={status}").json()]


# --- create ---


def test_create_todo_with_defaults(client):
    todo = create(client, title="Buy groceries")

    assert todo["id"] > 0
    assert todo["title"] == "Buy groceries"
    assert todo["priority"] == "medium"
    assert todo["completed"] is False
    assert todo["parent_id"] is None
    assert todo["created_at"].endswith("Z")


def test_create_todo_converts_due_date_to_utc(client):
    todo = create(client, due_at="2026-11-01T18:00:00+05:30")

    assert todo["due_at"] == "2026-11-01T12:30:00Z"


def test_create_rejects_empty_title(client):
    assert client.post("/api/todos", json={"title": ""}).status_code == 422


def test_create_rejects_unknown_priority(client):
    assert client.post("/api/todos", json={"title": "x", "priority": "urgent"}).status_code == 422


def test_create_subtask(client):
    parent = create(client, title="Plan party")

    sub = create(client, title="Order cake", parent_id=parent["id"])

    assert sub["parent_id"] == parent["id"]


def test_create_subtask_of_missing_parent_returns_404(client):
    response = client.post("/api/todos", json={"title": "x", "parent_id": 999})

    assert response.status_code == 404


def test_subtasks_cannot_be_nested(client):
    parent = create(client)
    sub = create(client, parent_id=parent["id"])

    response = client.post("/api/todos", json={"title": "x", "parent_id": sub["id"]})

    assert response.status_code == 400


# --- list ---


def test_list_is_empty_at_start(client):
    assert client.get("/api/todos").json() == []


def test_list_filters_by_status(client):
    create(client, title="Active")
    done = create(client, title="Done")
    client.patch(f"/api/todos/{done['id']}", json={"completed": True})

    assert titles(client) == ["Active", "Done"]
    assert titles(client, "active") == ["Active"]
    assert titles(client, "completed") == ["Done"]


def test_list_rejects_unknown_status(client):
    assert client.get("/api/todos?status=later").status_code == 422


# --- update ---


def test_update_changes_only_sent_fields(client):
    todo = create(client, title="Call mom", priority="high")

    response = client.patch(f"/api/todos/{todo['id']}", json={"completed": True})

    updated = response.json()
    assert response.status_code == 200
    assert updated["completed"] is True
    assert updated["title"] == "Call mom"
    assert updated["priority"] == "high"
    assert updated["updated_at"] >= todo["updated_at"]


def test_update_can_clear_due_date(client):
    todo = create(client, due_at="2026-11-01T10:00:00Z")

    updated = client.patch(f"/api/todos/{todo['id']}", json={"due_at": None}).json()

    assert updated["due_at"] is None


def test_update_rejects_null_title(client):
    todo = create(client)

    assert client.patch(f"/api/todos/{todo['id']}", json={"title": None}).status_code == 422


def test_update_missing_todo_returns_404(client):
    assert client.patch("/api/todos/999", json={"completed": True}).status_code == 404


# --- delete ---


def test_delete_removes_todo_and_its_subtasks(client):
    parent = create(client, title="Plan party")
    create(client, title="Order cake", parent_id=parent["id"])
    create(client, title="Keep me")

    response = client.delete(f"/api/todos/{parent['id']}")

    assert response.status_code == 204
    assert titles(client) == ["Keep me"]


def test_delete_missing_todo_returns_404(client):
    assert client.delete("/api/todos/999").status_code == 404


def test_clear_completed(client):
    done = create(client, title="Done parent")
    create(client, title="Its subtask", parent_id=done["id"])
    create(client, title="Still active")
    client.patch(f"/api/todos/{done['id']}", json={"completed": True})

    response = client.delete("/api/todos?completed=true")

    assert response.json() == {"deleted": 2}
    assert titles(client) == ["Still active"]


def test_clear_completed_requires_flag(client):
    assert client.delete("/api/todos").status_code == 422
    assert client.delete("/api/todos?completed=false").status_code == 400
