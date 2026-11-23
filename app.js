(function () {
  "use strict";

  const CLASS_STORAGE_KEY = "showUpClasses";
  const FIRED_STORAGE_KEY = "showUpReminders";
  const classForm = document.getElementById("class-form");
  const classNameInput = document.getElementById("class-name");
  const classTimeInput = document.getElementById("class-time");
  const classLocationInput = document.getElementById("class-location");
  const reminderLeadInput = document.getElementById("reminder-lead");
  const dayChoices = document.getElementById("day-choices");
  const weekList = document.getElementById("week-list");
  const emptyState = document.getElementById("empty-state");
  const storageNotice = document.getElementById("storage-notice");
  const announcement = document.getElementById("announcement");
  const formError = document.getElementById("form-error");
  let classes = loadClasses();
  let editingId = null;
  let headingDate = new Date();
  let goingFor = "";
  const firedReminderKeys = loadFiredReminderKeys();

  function loadClasses() {
    try {
      const saved = localStorage.getItem(CLASS_STORAGE_KEY);
      if (saved === null) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error("Saved schedule is not a list.");

      const valid = parsed.filter(function (item) {
        return item && typeof item.id === "string" &&
          typeof item.name === "string" && item.name.trim() &&
          typeof item.time === "string" && /^\d{2}:\d{2}$/.test(item.time) &&
          Array.isArray(item.days) &&
          item.days.length > 0 &&
          item.days.every(function (day) { return WEEKDAYS.some(function (weekday) { return weekday.id === day; }); }) &&
          Number.isInteger(item.lead) && [5, 10, 15, 30].indexOf(item.lead) !== -1;
      });

      if (valid.length !== parsed.length) {
        storageNotice.textContent = "Some saved classes couldn’t be read. You can add them again below.";
        storageNotice.hidden = false;
      }
      return valid;
    } catch (error) {
      storageNotice.textContent = "Your saved schedule couldn’t be read. Add your classes again below.";
      storageNotice.hidden = false;
      return [];
    }
  }

  function loadFiredReminderKeys() {
    try {
      const saved = JSON.parse(localStorage.getItem(FIRED_STORAGE_KEY) || "[]");
      return new Set(Array.isArray(saved) ? saved.filter(function (key) { return typeof key === "string"; }) : []);
    } catch (error) {
      return new Set();
    }
  }

  function saveClasses(nextClasses) {
    try {
      localStorage.setItem(CLASS_STORAGE_KEY, JSON.stringify(nextClasses));
      classes = nextClasses;
      storageNotice.hidden = true;
      return true;
    } catch (error) {
      storageNotice.textContent = "Your browser couldn’t save this change. Check your browser’s storage settings and try again.";
      storageNotice.hidden = false;
      return false;
    }
  }

  function formatTime(time) {
    const parts = time.split(":");
    const date = new Date();
    date.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  }

  function getWeekday(dayId) {
    return WEEKDAYS.find(function (day) { return day.id === dayId; });
  }

  function getTodayClasses() {
    const today = new Date().getDay();
    return classes.filter(function (item) {
      return item.days.indexOf(today) !== -1;
    }).sort(function (a, b) {
      return a.time.localeCompare(b.time);
    });
  }

  function createDayChoices() {
    WEEKDAYS.forEach(function (day) {
      const label = document.createElement("label");
      label.className = "day-choice";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "days";
      input.value = String(day.id);
      const text = document.createElement("span");
      text.textContent = day.short;
      label.append(input, text);
      dayChoices.appendChild(label);
    });
  }

  function openForm(classItem) {
    editingId = classItem ? classItem.id : null;
    classForm.reset();
    formError.hidden = true;
    document.getElementById("form-heading").textContent = classItem ? "Edit class" : "Add a class";
    document.getElementById("save-class-button").textContent = classItem ? "Save changes" : "Save class";

    if (classItem) {
      classNameInput.value = classItem.name;
      classTimeInput.value = classItem.time;
      classLocationInput.value = classItem.location || "";
      reminderLeadInput.value = String(classItem.lead);
      classForm.querySelectorAll('input[name="days"]').forEach(function (input) {
        input.checked = classItem.days.indexOf(Number(input.value)) !== -1;
      });
    }

    classForm.hidden = false;
    classNameInput.focus();
    classForm.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function closeForm() {
    classForm.hidden = true;
    editingId = null;
    classForm.reset();
    formError.hidden = true;
  }

  function makeWeekClass(item) {
    const row = document.createElement("article");
    row.className = "class-row";

    const time = document.createElement("time");
    time.className = "class-time";
    time.textContent = formatTime(item.time);

    const details = document.createElement("div");
    details.className = "class-details";
    const name = document.createElement("h4");
    name.textContent = item.name;
    details.appendChild(name);
    if (item.location) {
      const location = document.createElement("p");
      location.textContent = item.location;
      details.appendChild(location);
    }

    const actions = document.createElement("div");
    actions.className = "class-actions";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "text-button";
    editButton.textContent = "Edit";
    editButton.setAttribute("aria-label", "Edit " + item.name);
    editButton.addEventListener("click", function () { openForm(item); });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "text-button remove-button";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", "Remove " + item.name);
    removeButton.addEventListener("click", function () {
      if (!window.confirm("Remove " + item.name + " from your schedule?")) return;
      const nextClasses = classes.filter(function (savedClass) { return savedClass.id !== item.id; });
      if (saveClasses(nextClasses)) {
        render();
        announcement.textContent = item.name + " removed from your schedule.";
      }
    });
    actions.append(editButton, removeButton);
    row.append(time, details, actions);
    return row;
  }

  function renderWeek() {
    weekList.replaceChildren();
    WEEKDAYS.forEach(function (day) {
      const dayClasses = classes.filter(function (item) {
        return item.days.indexOf(day.id) !== -1;
      }).sort(function (a, b) {
        return a.time.localeCompare(b.time);
      });
      if (dayClasses.length === 0) return;

      const group = document.createElement("section");
      group.className = "day-group";
      const heading = document.createElement("h3");
      heading.className = "day-heading";
      heading.textContent = day.name;
      group.appendChild(heading);
      dayClasses.forEach(function (item) {
        group.appendChild(makeWeekClass(item));
      });
      weekList.appendChild(group);
    });
  }

  function minutesUntil(time) {
    const [hours, minutes] = time.split(":").map(Number);
    const start = new Date();
    start.setHours(hours, minutes, 0, 0);
    return Math.ceil((start.getTime() - Date.now()) / 60000);
  }

  function renderNextClass() {
    const todayClasses = getTodayClasses();
    const upcoming = todayClasses.find(function (item) {
      return minutesUntil(item.time) > 0;
    });
    const heading = document.getElementById("next-heading");
    const detail = document.getElementById("next-detail");
    const eyebrow = document.getElementById("next-eyebrow");
    const action = document.getElementById("next-action");
    action.replaceChildren();

    if (!upcoming) {
      eyebrow.textContent = "YOUR NEXT CLASS";
      if (todayClasses.length > 0) {
        heading.textContent = "That’s your last class on today’s schedule.";
        detail.textContent = "Take the rest of the day at your own pace.";
      } else if (classes.length > 0) {
        heading.textContent = "No classes on your schedule today.";
        detail.textContent = "Enjoy the breathing room. Your next class is waiting in your week.";
      } else {
        heading.textContent = "Your next class starts here.";
        detail.textContent = "Add your classes to get a friendly reminder before you go.";
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-light";
      button.textContent = classes.length === 0 ? "Add my first class" : "Add a class";
      button.addEventListener("click", function () { openForm(); });
      action.appendChild(button);
      return;
    }

    const remaining = minutesUntil(upcoming.time);
    eyebrow.textContent = remaining <= upcoming.lead ? "TIME TO GET READY" : "YOUR NEXT CLASS";
    heading.textContent = upcoming.name;
    let detailText = "Today at " + formatTime(upcoming.time) + " · " +
      (remaining < 60 ? "in " + remaining + " min" : "in " + Math.floor(remaining / 60) + " hr" +
        (Math.floor(remaining / 60) === 1 ? "" : "s"));
    if (upcoming.location) detailText += " · " + upcoming.location;
    detail.textContent = detailText;

    const goingKey = new Date().toDateString() + ":" + upcoming.id;
    const goingButton = document.createElement("button");
    goingButton.type = "button";
    goingButton.className = "button button-light";
    goingButton.textContent = goingFor === goingKey ? "You’re on your way ✓" : "I’m going";
    goingButton.addEventListener("click", function () {
      goingFor = goingKey;
      goingButton.textContent = "You’re on your way ✓";
      announcement.textContent = "You’ve got this. One step at a time.";
      document.getElementById("pep-talk-text").textContent = "You’ve already started by deciding to go. One step at a time.";
    });
    action.appendChild(goingButton);
  }

  function render() {
    headingDate = new Date();
    document.getElementById("header-date").textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "short", month: "short", day: "numeric"
    }).format(headingDate);
    emptyState.hidden = classes.length > 0;
    weekList.hidden = classes.length === 0;
    renderWeek();
    renderNextClass();
    document.getElementById("pep-talk-text").textContent =
      ENCOURAGEMENT[headingDate.getDate() % ENCOURAGEMENT.length];
    updateReminderButton();
  }

  function updateReminderButton() {
    const button = document.getElementById("reminder-button");
    if (typeof Notification === "undefined") {
      button.textContent = "Reminders unavailable";
      button.disabled = true;
    } else if (Notification.permission === "granted") {
      button.textContent = "Reminders on ✓";
      button.classList.add("reminders-on");
      button.disabled = false;
    } else if (Notification.permission === "denied") {
      button.textContent = "Notifications blocked";
      button.classList.remove("reminders-on");
      button.disabled = true;
    } else {
      button.textContent = "Turn on reminders";
      button.classList.remove("reminders-on");
      button.disabled = false;
    }
  }

  async function enableReminders() {
    if (typeof Notification === "undefined") {
      announcement.textContent = "This browser doesn’t support notifications.";
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      updateReminderButton();
      if (permission === "granted") {
        announcement.textContent = "Reminders are on. We’ll nudge you before class.";
        checkReminders();
      } else {
        announcement.textContent = "Notifications weren’t enabled. You can still check your schedule here.";
      }
    } catch (error) {
      announcement.textContent = "We couldn’t turn on notifications. Check your browser settings and try again.";
    }
  }

  function checkReminders() {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const now = new Date();
    const dateKey = now.getFullYear() + "-" + now.getMonth() + "-" + now.getDate();
    classes.forEach(function (item) {
      if (item.days.indexOf(now.getDay()) === -1) return;
      const [hours, minutes] = item.time.split(":").map(Number);
      const start = new Date(now);
      start.setHours(hours, minutes, 0, 0);
      const reminderAt = new Date(start.getTime() - item.lead * 60000);
      if (now < reminderAt || now >= start) return;

      const key = dateKey + ":" + item.id + ":" + item.time;
      if (firedReminderKeys.has(key)) return;
      try {
        const notification = new Notification("A little nudge from Show Up", {
          body: item.name + " starts at " + formatTime(item.time) + ". You’ve got this!",
          tag: key
        });
        notification.onclick = function () {
          window.focus();
          notification.close();
        };
        firedReminderKeys.add(key);
        localStorage.setItem(FIRED_STORAGE_KEY, JSON.stringify(Array.from(firedReminderKeys).slice(-100)));
        announcement.textContent = "A reminder for " + item.name + " was sent.";
      } catch (error) {
        announcement.textContent = "We couldn’t send a notification. Check your browser’s notification settings.";
      }
    });
  }

  classForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const selectedDays = Array.from(classForm.querySelectorAll('input[name="days"]:checked'))
      .map(function (input) { return Number(input.value); });
    if (selectedDays.length === 0) {
      formError.textContent = "Choose at least one day for this class.";
      formError.hidden = false;
      return;
    }

    const item = {
      id: editingId || Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name: classNameInput.value.trim(),
      time: classTimeInput.value,
      location: classLocationInput.value.trim(),
      days: selectedDays,
      lead: Number(reminderLeadInput.value)
    };
    if (!item.name || !item.time || [5, 10, 15, 30].indexOf(item.lead) === -1) {
      formError.textContent = "Add a class name, start time, and reminder time.";
      formError.hidden = false;
      return;
    }

    const wasEditing = Boolean(editingId);
    const nextClasses = editingId
      ? classes.map(function (savedClass) { return savedClass.id === editingId ? item : savedClass; })
      : classes.concat(item);
    if (saveClasses(nextClasses)) {
      closeForm();
      render();
      announcement.textContent = item.name + (wasEditing ? " updated." : " added to your schedule.");
    }
  });

  document.getElementById("add-class-button").addEventListener("click", function () { openForm(); });
  document.getElementById("empty-add-button").addEventListener("click", function () { openForm(); });
  document.getElementById("next-class-cta").addEventListener("click", function () { openForm(); });
  document.getElementById("close-form-button").addEventListener("click", closeForm);
  document.getElementById("cancel-form-button").addEventListener("click", closeForm);
  document.getElementById("reminder-button").addEventListener("click", enableReminders);
  window.addEventListener("focus", function () {
    render();
    checkReminders();
  });

  createDayChoices();
  render();
  checkReminders();
  window.setInterval(checkReminders, 15000);
  window.setInterval(render, 60000);
})();
