import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {
  getDatabase,
  onValue,
  push,
  ref,
  remove,
  set,
  update,
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

const form = document.querySelector("#todo-form");
const input = document.querySelector("#todo-input");
const addButton = form.querySelector('button[type="submit"]');
const list = document.querySelector("#todo-list");
const emptyState = document.querySelector("#empty-state");
const remainingCount = document.querySelector("#remaining-count");
const clearCompletedButton = document.querySelector("#clear-completed");
const filterButtons = document.querySelectorAll(".filter-button");
const statusMessage = document.querySelector("#status-message");

const firebaseConfig = {
  apiKey: "AIzaSyBwhPYEk_1zPeIFXTFxHE8434LB53coR4w",
  authDomain: "gihwan-todolist-backend.firebaseapp.com",
  projectId: "gihwan-todolist-backend",
  storageBucket: "gihwan-todolist-backend.firebasestorage.app",
  messagingSenderId: "110549659469",
  appId: "1:110549659469:web:735471a6e3893effcad104",
  databaseURL: "https://gihwan-todolist-backend-default-rtdb.firebaseio.com/",
};

let todos = [];
let activeFilter = "all";
let editingTodoId = null;
let database;
let userTodosRef;
let userId;

input.disabled = true;
addButton.disabled = true;

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("is-error", isError);
}

function showDatabaseError(error) {
  console.error("Firebase 할 일 처리 오류:", error);
  setStatus("Firebase 연결 오류입니다. 데이터베이스 URL, 익명 로그인, 보안 규칙을 확인해 주세요.", true);
}

async function saveTodoChange(operation) {
  try {
    await operation();
    setStatus("");
    return true;
  } catch (error) {
    showDatabaseError(error);
    return false;
  }
}

function renderTodos() {
  const visibleTodos = todos.filter((todo) => {
    if (activeFilter === "active") return !todo.completed;
    if (activeFilter === "completed") return todo.completed;
    return true;
  });

  list.replaceChildren();

  for (const todo of visibleTodos) {
    const item = document.createElement("li");
    item.className = `todo-item${todo.completed ? " is-completed" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.className = "todo-checkbox";
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;
    checkbox.setAttribute("aria-label", `${todo.text} 완료`);
    checkbox.addEventListener("change", () => toggleTodo(todo.id));

    const actions = document.createElement("div");
    actions.className = "todo-actions";

    if (editingTodoId === todo.id) {
      const editInput = document.createElement("input");
      editInput.className = "todo-edit-input";
      editInput.type = "text";
      editInput.value = todo.text;
      editInput.maxLength = 120;
      editInput.setAttribute("aria-label", "할 일 내용 수정");
      editInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") saveEdit(todo.id, editInput);
        if (event.key === "Escape") cancelEdit();
      });

      const saveButton = createActionButton("저장", "✓", "save-button", () =>
        saveEdit(todo.id, editInput),
      );
      const cancelButton = createActionButton("취소", "×", "cancel-button", cancelEdit);
      actions.append(saveButton, cancelButton);
      item.append(checkbox, editInput, actions);
    } else {
      const text = document.createElement("span");
      text.className = "todo-text";
      text.textContent = todo.text;

      const editButton = createActionButton("수정", "✎", "edit-button", () =>
        editTodo(todo.id),
      );
      const deleteButton = createActionButton("삭제", "×", "delete-button", () =>
        deleteTodo(todo.id),
      );
      actions.append(editButton, deleteButton);
      item.append(checkbox, text, actions);
    }

    list.append(item);
  }

  if (editingTodoId) {
    const editInput = list.querySelector(".todo-edit-input");
    editInput?.focus();
    editInput?.select();
  }

  emptyState.hidden = visibleTodos.length > 0;
  const remaining = todos.filter((todo) => !todo.completed).length;
  remainingCount.textContent = `남은 할 일 ${remaining}개`;
  clearCompletedButton.hidden = !todos.some((todo) => todo.completed);
}

function createActionButton(label, icon, className, onClick) {
  const button = document.createElement("button");
  button.className = `icon-button ${className}`;
  button.type = "button";
  button.textContent = icon;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.addEventListener("click", onClick);
  return button;
}

async function addTodo(text) {
  return saveTodoChange(() =>
    set(push(userTodosRef), {
      text,
      completed: false,
      createdAt: Date.now(),
    }),
  );
}

function toggleTodo(id) {
  const todo = todos.find((item) => item.id === id);
  if (!todo) return;
  return saveTodoChange(() =>
    update(ref(database, `users/${userId}/todos/${id}`), {
      completed: !todo.completed,
    }),
  );
}

function editTodo(id) {
  editingTodoId = id;
  renderTodos();
}

function saveEdit(id, inputElement) {
  const trimmedText = inputElement.value.trim();
  if (!trimmedText) {
    inputElement.setCustomValidity("할 일 내용을 입력해 주세요.");
    inputElement.reportValidity();
    return;
  }

  inputElement.setCustomValidity("");
  editingTodoId = null;
  renderTodos();
  return saveTodoChange(() =>
    update(ref(database, `users/${userId}/todos/${id}`), {
      text: trimmedText,
    }),
  );
}

function cancelEdit() {
  editingTodoId = null;
  renderTodos();
}

function deleteTodo(id) {
  if (editingTodoId === id) editingTodoId = null;
  return saveTodoChange(() => remove(ref(database, `users/${userId}/todos/${id}`)));
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }

  addButton.disabled = true;
  const saved = await addTodo(text);
  addButton.disabled = false;
  if (!saved) return;

  form.reset();
  input.focus();
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((filterButton) => {
      const isActive = filterButton === button;
      filterButton.classList.toggle("is-active", isActive);
      filterButton.setAttribute("aria-pressed", String(isActive));
    });
    renderTodos();
  });
});

clearCompletedButton.addEventListener("click", () => {
  const deletions = todos
    .filter((todo) => todo.completed)
    .map((todo) => remove(ref(database, `users/${userId}/todos/${todo.id}`)));
  void saveTodoChange(() => Promise.all(deletions));
});

async function startApp() {
  if (firebaseConfig.databaseURL === "PASTE_YOUR_REALTIME_DATABASE_URL_HERE") {
    setStatus("Firebase Console에서 Realtime Database를 만든 뒤 app.js에 데이터베이스 URL을 입력해 주세요.", true);
    renderTodos();
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    database = getDatabase(app);
    const auth = getAuth(app);
    setStatus("Firebase에 연결하는 중...");

    const credentials = await signInAnonymously(auth);
    userId = credentials.user.uid;
    userTodosRef = ref(database, `users/${userId}/todos`);
    input.disabled = false;
    addButton.disabled = false;
    onValue(
      userTodosRef,
      (snapshot) => {
        const savedTodos = snapshot.val() ?? {};
        todos = Object.entries(savedTodos)
          .filter(
            ([id, todo]) =>
              todo &&
              typeof todo.text === "string" &&
              typeof todo.completed === "boolean",
          )
          .map(([id, todo]) => ({ ...todo, id }))
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        renderTodos();
        setStatus("");
      },
      showDatabaseError,
    );
  } catch (error) {
    showDatabaseError(error);
  }
}

renderTodos();
void startApp();
