const API_URL = "https://jsonplaceholder.typicode.com/posts";
const loadButton = document.querySelector("#load-btn");
const noteList = document.querySelector("#notes-list");
const statusMessage = document.querySelector("#status");
let notes = [];

async function request(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}.`);
  }

  const data = response.status === 204 ? null : await response.json();
  return { data, status: response.status };
}

function setStatus(message, state = "") {
  statusMessage.textContent = message;
  statusMessage.className = state ? `status ${state}` : "status";
}

function renderNotes(list) {
  noteList.replaceChildren();

  if (list.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "No notes yet. Create one above or load notes from the server.";
    noteList.append(emptyItem);
    return;
  }

  list.forEach((note) => {
    const item = document.createElement("li");
    item.className = "note-item";

    const title = document.createElement("h3");
    title.textContent = note.title;

    const body = document.createElement("p");
    body.className = "note-body";
    body.textContent = note.body;

    item.append(title, body);
    noteList.append(item);
  });
}

async function loadNotes() {
  loadButton.disabled = true;
  setStatus("Loading notes...", "status-loading");

  try {
    const result = await request(`${API_URL}?_limit=10`);
    notes = result.data;
    renderNotes(notes);

    if (notes.length === 0) {
      setStatus("No notes were returned by the server.", "status-success");
      return;
    }

    setStatus(`Loaded ${notes.length} notes from the server.`, "status-success");
  } catch (error) {
    setStatus("We couldn't load your notes. Please try again.", "status-error");
  } finally {
    loadButton.disabled = false;
  }
}

loadButton.addEventListener("click", loadNotes);
renderNotes(notes);