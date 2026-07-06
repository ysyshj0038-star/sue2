const referenceDate = new Date("2026-07-06T00:00:00+09:00");
const scheduleEndpoint = "/api/schedule";

const fallbackEvents = [
  { start: "2026-06-09", end: "2026-06-15", title: "기말고사" },
  { start: "2026-06-16", end: "2026-06-22", title: "보강기간" },
  { start: "2026-06-22", end: "2026-07-03", title: "재입학 신청기간" },
  { start: "2026-06-23", end: "2026-07-06", title: "하계 계절학기" },
  { start: "2026-06-23", end: "2026-08-31", title: "미등록 휴학기간" },
  { start: "2026-06-23", end: "2026-06-23", title: "하계방학" },
  { start: "2026-06-25", end: "2026-06-30", title: "성적공시 및 정정" },
  { start: "2026-07-13", end: "2026-08-31", title: "휴학연기 신청기간" },
  { start: "2026-07-13", end: "2026-07-17", title: "복학기간" },
  { start: "2026-07-29", end: "2026-07-31", title: "예비수강 신청기간" },
];

let events = [...fallbackEvents];

const state = {
  filter: "all",
  search: "",
};

const formatDate = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "short",
});

const formatShortDate = new Intl.DateTimeFormat("ko-KR", {
  month: "2-digit",
  day: "2-digit",
});

const monthFormat = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
});

const elements = {
  totalCount: document.querySelector("#totalCount"),
  activeCount: document.querySelector("#activeCount"),
  upcomingCount: document.querySelector("#upcomingCount"),
  longestDays: document.querySelector("#longestDays"),
  longestTitle: document.querySelector("#longestTitle"),
  todayLabel: document.querySelector("#todayLabel"),
  todayHint: document.querySelector("#todayHint"),
  timeline: document.querySelector("#timeline"),
  resultCount: document.querySelector("#resultCount"),
  monthList: document.querySelector("#monthList"),
  focusGrid: document.querySelector("#focusGrid"),
  searchInput: document.querySelector("#searchInput"),
  filterButtons: document.querySelectorAll(".filter-button"),
};

function toDate(value) {
  return new Date(`${value}T00:00:00+09:00`);
}

function daysBetween(start, end) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((end - start) / oneDay) + 1;
}

function getStatus(event) {
  const start = toDate(event.start);
  const end = toDate(event.end);

  if (referenceDate < start) {
    return "upcoming";
  }

  if (referenceDate > end) {
    return "done";
  }

  if (referenceDate.getTime() === start.getTime() || referenceDate.getTime() === end.getTime()) {
    return "today";
  }

  return "active";
}

function getStatusLabel(status) {
  const labels = {
    active: "진행 중",
    today: "오늘 포함",
    upcoming: "예정",
    done: "종료",
  };

  return labels[status];
}

function getDurationText(event) {
  const start = toDate(event.start);
  const end = toDate(event.end);
  const duration = daysBetween(start, end);
  return duration === 1 ? "하루 일정" : `${duration}일간 진행`;
}

function getDateRange(event) {
  const start = toDate(event.start);
  const end = toDate(event.end);

  if (event.start === event.end) {
    return formatDate.format(start);
  }

  return `${formatShortDate.format(start)} - ${formatShortDate.format(end)}`;
}

function getDayDistance(event) {
  const status = getStatus(event);
  const start = toDate(event.start);
  const end = toDate(event.end);
  const oneDay = 24 * 60 * 60 * 1000;

  if (status === "upcoming") {
    const days = Math.ceil((start - referenceDate) / oneDay);
    return `${days}일 후 시작`;
  }

  if (status === "done") {
    const days = Math.ceil((referenceDate - end) / oneDay);
    return `${days}일 전 종료`;
  }

  const remaining = Math.ceil((end - referenceDate) / oneDay);
  return remaining === 0 ? "오늘 종료" : `${remaining}일 남음`;
}

function enrichEvents() {
  return events
    .map((event) => ({
      ...event,
      status: getStatus(event),
      duration: daysBetween(toDate(event.start), toDate(event.end)),
    }))
    .sort((a, b) => toDate(a.start) - toDate(b.start));
}

function renderSummary(enrichedEvents) {
  if (enrichedEvents.length === 0) {
    elements.totalCount.textContent = "0";
    elements.activeCount.textContent = "0";
    elements.upcomingCount.textContent = "0";
    elements.longestDays.textContent = "0일";
    elements.longestTitle.textContent = "-";
    return;
  }

  const activeStatuses = new Set(["active", "today"]);
  const active = enrichedEvents.filter((event) => activeStatuses.has(event.status));
  const upcoming = enrichedEvents.filter((event) => event.status === "upcoming");
  const longest = enrichedEvents.reduce((current, event) => (
    event.duration > current.duration ? event : current
  ), enrichedEvents[0]);

  elements.todayLabel.textContent = "2026.07.06";
  elements.totalCount.textContent = enrichedEvents.length;
  elements.activeCount.textContent = active.length;
  elements.upcomingCount.textContent = upcoming.length;
  elements.longestDays.textContent = `${longest.duration}일`;
  elements.longestTitle.textContent = longest.title;
}

function renderMonths(enrichedEvents) {
  const months = enrichedEvents.reduce((accumulator, event) => {
    const monthKey = `${toDate(event.start).getMonth() + 1}`;
    const monthName = monthFormat.format(toDate(event.start));
    accumulator[monthKey] = accumulator[monthKey] || { name: monthName, count: 0 };
    accumulator[monthKey].count += 1;
    return accumulator;
  }, {});

  elements.monthList.innerHTML = Object.values(months)
    .map((month) => `
      <div class="month-item">
        <strong>${month.name}</strong>
        <span>${month.count}개 일정</span>
      </div>
    `)
    .join("");
}

function getFilteredEvents(enrichedEvents) {
  const normalizedSearch = state.search.trim().toLowerCase();

  return enrichedEvents.filter((event) => {
    const statusMatches = state.filter === "all"
      || event.status === state.filter
      || (state.filter === "active" && event.status === "today");
    const searchMatches = !normalizedSearch
      || event.title.toLowerCase().includes(normalizedSearch);

    return statusMatches && searchMatches;
  });
}

function renderTimeline(filteredEvents) {
  elements.resultCount.textContent = `${filteredEvents.length}개 일정`;

  if (filteredEvents.length === 0) {
    elements.timeline.innerHTML = `
      <div class="empty-state">
        조건에 맞는 일정이 없습니다. 검색어나 필터를 다시 확인해 주세요.
      </div>
    `;
    return;
  }

  elements.timeline.innerHTML = filteredEvents
    .map((event) => `
      <article class="event-card">
        <div class="event-date">
          <strong>${getDateRange(event)}</strong>
          <span>${getDurationText(event)}</span>
        </div>
        <div class="event-body">
          <h3>${event.title}</h3>
          <p>${getDayDistance(event)}</p>
        </div>
        <div class="event-meta">
          <span class="badge ${event.status}">${getStatusLabel(event.status)}</span>
        </div>
      </article>
    `)
    .join("");
}

function renderFocus(enrichedEvents) {
  const activeStatuses = new Set(["active", "today"]);
  const focusEvents = enrichedEvents
    .filter((event) => activeStatuses.has(event.status) || event.status === "upcoming")
    .slice(0, 3);

  elements.focusGrid.innerHTML = focusEvents
    .map((event) => `
      <article class="focus-card">
        <span class="badge ${event.status}">${getStatusLabel(event.status)}</span>
        <h3>${event.title}</h3>
        <p>${getDateRange(event)} · ${getDayDistance(event)}</p>
      </article>
    `)
    .join("");
}

function render() {
  const enrichedEvents = enrichEvents();
  const filteredEvents = getFilteredEvents(enrichedEvents);

  renderSummary(enrichedEvents);
  renderMonths(enrichedEvents);
  renderTimeline(filteredEvents);
  renderFocus(enrichedEvents);
}

function isValidEvent(event) {
  return event
    && /^\d{4}-\d{2}-\d{2}$/.test(event.start)
    && /^\d{4}-\d{2}-\d{2}$/.test(event.end)
    && typeof event.title === "string"
    && event.title.trim();
}

async function loadSchedule() {
  elements.todayHint.textContent = "Google Sheet에서 최신 일정을 불러오는 중입니다.";

  try {
    const response = await fetch(scheduleEndpoint, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Schedule API responded with ${response.status}`);
    }

    const data = await response.json();
    const sheetEvents = Array.isArray(data.events) ? data.events.filter(isValidEvent) : [];

    if (sheetEvents.length === 0) {
      throw new Error("No valid events were found in the sheet.");
    }

    events = sheetEvents;
    elements.todayHint.textContent = `Google Sheet와 연동됨 · ${sheetEvents.length}개 일정`;
  } catch (error) {
    console.warn(error);
    events = [...fallbackEvents];
    elements.todayHint.textContent = "시트 연동 실패로 기본 예시 데이터를 표시 중입니다.";
  }

  render();
}

elements.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  render();
});

elements.filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    elements.filterButtons.forEach((item) => item.classList.remove("is-selected"));
    button.classList.add("is-selected");
    render();
  });
});

render();
loadSchedule();
