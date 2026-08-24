(function () {
  "use strict";

  // Idempotency guard: if this script somehow runs twice on the same page,
  // don't attach a second set of listeners/intervals.
  if (window.__ageCalProInitialized) return;
  window.__ageCalProInitialized = true;

  document.getElementById("currentYear").textContent = new Date().getFullYear();

  const birthDateInput = document.getElementById("birthDate");
  const calculateBtn = document.getElementById("calculateBtn");
  const errorMessage = document.getElementById("errorMessage");
  const birthdayMessage = document.getElementById("birthdayMessage");
  const dialRing = document.getElementById("dialRing");
  const shareBtn = document.getElementById("shareBtn");
  const shareBtnLabel = document.getElementById("shareBtnLabel");
  const copyLinkBtn = document.getElementById("copyLinkBtn");
  const shareStatus = document.getElementById("shareStatus");

  // ---- Web Share capability check --------------------------------------
  // navigator.share existing is not enough: on a non-secure/non-http(s)
  // origin (e.g. a page opened as file:///..., or plain http on some
  // platforms) some Chrome builds accept the call but fail Mojo validation
  // on the payload (particularly a `url` that isn't http/https), which can
  // crash the tab with RESULT_CODE_KILLED_BAD_MESSAGE instead of just
  // rejecting the promise. So we only ever attempt navigator.share() when
  // we're in a secure context AND the current page URL is itself
  // http/https, and we always pre-validate the payload with canShare().
  const isHttpUrl = /^https?:$/.test(window.location.protocol);
  const WEB_SHARE_SUPPORTED =
    typeof navigator.share === "function" &&
    window.isSecureContext === true &&
    isHttpUrl;

  if (!WEB_SHARE_SUPPORTED) {
    shareBtnLabel.textContent = "Copy Result";
  }

  let birthDateTime = null;
  let tickInterval = null;

  const ZODIAC = [
    { name: "Capricorn", end: [1, 19] },
    { name: "Aquarius", end: [2, 18] },
    { name: "Pisces", end: [3, 20] },
    { name: "Aries", end: [4, 19] },
    { name: "Taurus", end: [5, 20] },
    { name: "Gemini", end: [6, 20] },
    { name: "Cancer", end: [7, 22] },
    { name: "Leo", end: [8, 22] },
    { name: "Virgo", end: [9, 22] },
    { name: "Libra", end: [10, 22] },
    { name: "Scorpio", end: [11, 21] },
    { name: "Sagittarius", end: [12, 21] },
    { name: "Capricorn", end: [12, 31] }
  ];

  function getZodiac(month, day) {
    for (const z of ZODIAC) {
      const [m, d] = z.end;
      if (month < m || (month === m && day <= d)) return z.name;
    }
    return "Capricorn";
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function calculateAgeParts(from, to) {
    let years = to.getFullYear() - from.getFullYear();
    let months = to.getMonth() - from.getMonth();
    let days = to.getDate() - from.getDate();
    let hours = to.getHours() - from.getHours();
    let minutes = to.getMinutes() - from.getMinutes();
    let seconds = to.getSeconds() - from.getSeconds();

    if (seconds < 0) { seconds += 60; minutes--; }
    if (minutes < 0) { minutes += 60; hours--; }
    if (hours < 0) { hours += 24; days--; }
    if (days < 0) {
      const prevMonth = new Date(to.getFullYear(), to.getMonth(), 0);
      days += prevMonth.getDate();
      months--;
    }
    if (months < 0) { months += 12; years--; }

    return { years, months, days, hours, minutes, seconds };
  }

  function nextBirthdayDate(from, now) {
    let next = new Date(now.getFullYear(), from.getMonth(), from.getDate(), from.getHours(), from.getMinutes(), from.getSeconds());
    if (next <= now) {
      next = new Date(now.getFullYear() + 1, from.getMonth(), from.getDate(), from.getHours(), from.getMinutes(), from.getSeconds());
    }
    return next;
  }

  function updateLifeStats(from, now) {
    const totalMs = now - from;
    const totalDays = totalMs / 86400000;
    const totalYears = totalDays / 365.2425;

    document.getElementById("statHeartbeats").textContent =
      Math.floor(totalDays * 24 * 60 * 75).toLocaleString();
    document.getElementById("statMoons").textContent =
      Math.floor(totalDays / 29.53).toLocaleString();
    document.getElementById("statOrbits").textContent =
      Math.floor(totalYears).toLocaleString();
    document.getElementById("statSleep").textContent =
      Math.floor((totalDays * 8) / 24).toLocaleString();
    document.getElementById("statDaysLived").textContent =
      Math.floor(totalDays).toLocaleString();
    document.getElementById("statWeekends").textContent =
      Math.floor(totalDays / 7).toLocaleString();
  }

  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function tick() {
    if (!birthDateTime) return;
    const now = new Date();

    const age = calculateAgeParts(birthDateTime, now);
    document.getElementById("years").textContent = age.years;
    document.getElementById("months").textContent = age.months;
    document.getElementById("days").textContent = age.days;
    document.getElementById("hours").textContent = age.hours;
    document.getElementById("minutes").textContent = age.minutes;
    document.getElementById("seconds").textContent = age.seconds;

    const nextBday = nextBirthdayDate(birthDateTime, now);
    const diff = nextBday - now;
    const cDays = Math.floor(diff / 86400000);
    const cHours = Math.floor((diff % 86400000) / 3600000);
    const cMinutes = Math.floor((diff % 3600000) / 60000);
    const cSeconds = Math.floor((diff % 60000) / 1000);

    document.getElementById("countDays").textContent = pad(cDays);
    document.getElementById("countHours").textContent = pad(cHours);
    document.getElementById("countMinutes").textContent = pad(cMinutes);
    document.getElementById("countSeconds").textContent = pad(cSeconds);

    document.getElementById("nextBirthdayDate").textContent =
      nextBday.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

    // Progress ring: how far through the current birthday-to-birthday year we are.
    // Guarded against a zero-length span (would otherwise divide by zero and
    // write NaN into the CSS custom property).
    const lastBday = new Date(nextBday);
    lastBday.setFullYear(lastBday.getFullYear() - 1);
    const yearSpan = nextBday - lastBday;
    const elapsed = now - lastBday;
    const progressDeg = yearSpan > 0
      ? Math.max(0, Math.min(360, (elapsed / yearSpan) * 360))
      : 0;
    dialRing.style.setProperty("--progress", progressDeg + "deg");

    updateLifeStats(birthDateTime, now);
  }

  function handleCalculate() {
    errorMessage.textContent = "";
    const dateVal = birthDateInput.value;
    if (!dateVal) {
      errorMessage.textContent = "Enter a date of birth to wind the clock.";
      return;
    }

    const parts = dateVal.split("-").map(Number);
    const [y, m, d] = parts;

    // Guard against malformed/incomplete date values (e.g. a partially
    // cleared native date input) before they reach the Date constructor.
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
      errorMessage.textContent = "That date doesn't look valid — please re-select it.";
      return;
    }

    const candidate = new Date(y, m - 1, d, 0, 0, 0);

    // Guard against dates that overflowed (e.g. a stray Feb 30) — the Date
    // constructor silently rolls these into a different month/day rather
    // than throwing, so we detect it by checking the values round-trip.
    if (
      Number.isNaN(candidate.getTime()) ||
      candidate.getFullYear() !== y ||
      candidate.getMonth() !== m - 1 ||
      candidate.getDate() !== d
    ) {
      errorMessage.textContent = "That date doesn't look valid — please re-select it.";
      return;
    }

    if (candidate > new Date()) {
      errorMessage.textContent = "That date is in the future — try a date already lived.";
      return;
    }
    if (y < 1900) {
      errorMessage.textContent = "Please enter a birth year from 1900 onward.";
      return;
    }

    birthDateTime = candidate;

    const dayName = candidate.toLocaleDateString(undefined, { weekday: "long" });
    document.getElementById("birthdayDay").textContent = dayName;

    const now = new Date();
    let turningAge = now.getFullYear() - candidate.getFullYear();
    const hasHadBdayThisYear =
      now.getMonth() > candidate.getMonth() ||
      (now.getMonth() === candidate.getMonth() && now.getDate() >= candidate.getDate());
    if (!hasHadBdayThisYear) turningAge -= 1;
    document.getElementById("turningAge").textContent = ordinal(turningAge + 1);

    document.getElementById("zodiacSign").textContent = getZodiac(candidate.getMonth() + 1, candidate.getDate());

    birthdayMessage.textContent =
      "Live and counting — this dial updates every second.";

    // Prevent duplicate intervals if the calculator is run more than once —
    // always clear any interval from a previous calculation before starting
    // a new one.
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    tick();
    tickInterval = setInterval(tick, 1000);

    document.getElementById("dial").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function buildShareText() {
    const years = document.getElementById("years").textContent;
    const months = document.getElementById("months").textContent;
    const days = document.getElementById("days").textContent;
    const nextBday = document.getElementById("nextBirthdayDate").textContent;
    return `I'm ${years} years, ${months} months and ${days} days old, according to AgeCal Pro! My next birthday is on ${nextBday}. Find out your exact age here:`;
  }

  function flashStatus(msg, duration) {
    shareStatus.textContent = msg;
    if (duration !== 0) {
      setTimeout(() => { shareStatus.textContent = ""; }, duration || 3500);
    }
  }

  async function copyToClipboard(text) {
    // Clipboard API requires a secure context; on file:// or plain http it
    // simply won't exist, so we fall through to the legacy method below
    // rather than calling into it and risking an unhandled rejection.
    if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        // fall through to legacy method
      }
    }

    // Legacy fallback for browsers/contexts without the Clipboard API.
    const temp = document.createElement("textarea");
    temp.value = text;
    temp.setAttribute("readonly", "");
    temp.style.position = "fixed";
    temp.style.top = "0";
    temp.style.left = "0";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.focus();
    temp.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(temp);
    return ok;
  }

  async function handleShare() {
    if (!birthDateTime) {
      flashStatus("Wind the clock first, then share your result.");
      return;
    }

    const text = buildShareText();
    const pageUrl = window.location.href;

    if (WEB_SHARE_SUPPORTED) {
      // Only include http(s) URLs in the payload — a file:// or other
      // non-http URL is what triggers the invalid-payload crash on some
      // Chrome builds, so we simply omit the url field in that case
      // instead of passing it through.
      const shareData = isHttpUrl
        ? { title: "AgeCal Pro", text, url: pageUrl }
        : { title: "AgeCal Pro", text };

      try {
        // Pre-validate with canShare() where available so we never hand
        // navigator.share() a payload it doesn't accept.
        if (typeof navigator.canShare === "function" && !navigator.canShare(shareData)) {
          throw new Error("share-data-unsupported");
        }
        await navigator.share(shareData);
        return; // Successful share — nothing further to do.
      } catch (err) {
        // AbortError = user closed the native share sheet themselves.
        // That's a normal, expected outcome, not a failure — do nothing.
        if (err && err.name === "AbortError") return;
        // Any other failure (unsupported payload, permission issue, etc.)
        // falls through to the clipboard fallback below.
      }
    }

    const copied = await copyToClipboard(isHttpUrl ? `${text} ${pageUrl}` : text);
    flashStatus(
      copied
        ? "Result copied — paste it into WhatsApp, Messenger, email, or anywhere you like."
        : "Couldn't copy automatically — please copy the link manually."
    );
  }

  async function handleCopyLink() {
    const pageUrl = window.location.href;
    const copied = await copyToClipboard(pageUrl);
    flashStatus(copied ? "Link copied to clipboard." : "Couldn't copy the link automatically.");
  }

  calculateBtn.addEventListener("click", handleCalculate);
  birthDateInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleCalculate(); });
  shareBtn.addEventListener("click", handleShare);
  copyLinkBtn.addEventListener("click", handleCopyLink);
})();
