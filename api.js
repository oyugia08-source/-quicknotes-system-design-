const API_URL = "https://jsonplaceholder.typicode.com/posts";
const loadButton = document.querySelector("#load-btn");
const noteForm = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitButton = document.querySelector("#submit-btn");
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

    const deleteButton = document.createElement("button");
    deleteButton.className = "button button-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", "Delete note");
    deleteButton.addEventListener("click", () => deleteNote(note, deleteButton));

    const heading = document.createElement("div");
    heading.className = "note-heading";
    heading.append(title, deleteButton);

    const body = document.createElement("p");
    body.className = "note-body";
    body.textContent = note.body;

    item.append(heading, body);
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

async function createNote(event) {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value;

  if (title.length === 0 || title.length > 100) {
    setStatus("Enter a title with 1 to 100 characters.", "status-error");
    titleInput.focus();
    return;
  }

  submitButton.disabled = true;
  setStatus("Creating note...", "status-loading");

  try {
    const result = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ title, body, userId: 1 })
    });
    const createdNote = {
      ...result.data,
      title: result.data.title ?? title,
      body: result.data.body ?? body
    };

    notes = [createdNote, ...notes];
    renderNotes(notes);
    noteForm.reset();
    setStatus(`Note created (status ${result.status}, id ${createdNote.id}).`, "status-success");
  } catch (error) {
    setStatus("We couldn't create your note. Please try again.", "status-error");
  } finally {
    submitButton.disabled = false;
  }
}

async function deleteNote(note, deleteButton) {
  deleteButton.disabled = true;
  setStatus("Deleting note...", "status-loading");

  try {
    const result = await request(`${API_URL}/${encodeURIComponent(note.id)}`, {
      method: "DELETE"
    });

    // JSONPlaceholder acknowledges writes but does not persist them across reloads; remove only from this session's list.
    notes = notes.filter((item) => item.id !== note.id);
    renderNotes(notes);
    setStatus(`Note deleted (status ${result.status}).`, "status-success");
  } catch (error) {
    deleteButton.disabled = false;
    setStatus("We couldn't delete your note. Please try again.", "status-error");
  }
}

loadButton.addEventListener("click", loadNotes);
noteForm.addEventListener("submit", createNote);
renderNotes(notes);