import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { steps } from "./schema.js";
import "./style.css";

const app = document.querySelector("#app");
const state = Object.fromEntries(steps.flatMap((step) => step.fields.map(([key]) => [key, ""])));
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
let currentStep = 0;
let theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
let googleMapsPromise;
document.documentElement.dataset.theme = theme;

const logo = `
  <svg aria-label="River Garden Apply logo" viewBox="0 0 40 40" fill="none">
    <rect x="1" y="1" width="38" height="38" rx="10" stroke="currentColor" stroke-width="2"/>
    <path d="M8 25c6-6 12-9 24-9M10 30c7-5 13-6 22-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M11 10h11a6 6 0 0 1 0 12h-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`;

function safe(value, fallback = "N/A") {
  return String(value || fallback).trim();
}

function splitCombined(value, count) {
  const parts = String(value || "").split(",").map((part) => part.trim());
  return Array.from({ length: count }, (_, index) => parts[index] || "");
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${month}/${day}/${year}`;
}

function fieldHtml(field) {
  const [key, label, type, required, options] = field;
  const requiredMark = required ? "" : `<span class="optional">optional / leave blank</span>`;
  if (type === "select") {
    return `<div class="field">
      <label for="${key}">${label}${requiredMark}</label>
      <select id="${key}" name="${key}" ${required ? "required" : ""} data-testid="input-${key}">
        <option value="">Choose one</option>
        ${options.map((option) => `<option value="${option}" ${state[key] === option ? "selected" : ""}>${option}</option>`).join("")}
      </select>
      <span class="error-text" id="error-${key}" role="alert"></span>
    </div>`;
  }
  const tag = type === "textarea" ? "textarea" : "input";
  const inputType = type === "address" ? "text" : type;
  const addressAttrs = type === "address" ? `data-google-address="${key}" autocomplete="street-address"` : "";
  const attrs = tag === "input" ? `type="${inputType}" value="${escapeHtml(state[key])}" ${addressAttrs}` : "";
  const content = tag === "textarea" ? escapeHtml(state[key]) : "";
  return `<div class="field">
    <label for="${key}">${label}${requiredMark}</label>
    <${tag} id="${key}" name="${key}" ${attrs} ${required ? "required" : ""} autocomplete="off" data-testid="input-${key}">${content}</${tag}>
    ${type === "address" ? `<button class="map-verify" type="button" data-verify-address="${key}">Verify in Google Maps ↗</button>` : ""}
    <span class="error-text" id="error-${key}" role="alert"></span>
  </div>`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function saveVisibleFields() {
  steps[currentStep].fields.forEach(([key]) => {
    const input = document.querySelector(`#${key}`);
    if (input) state[key] = input.value;
  });
}

function validateStep() {
  saveVisibleFields();
  let valid = true;
  steps[currentStep].fields.forEach(([key, , , required]) => {
    const error = document.querySelector(`#error-${key}`);
    if (required && !state[key].trim()) {
      error.textContent = "This answer is required by the application.";
      valid = false;
    } else {
      error.textContent = "";
    }
  });
  return valid;
}

function header() {
  const themeIcon = theme === "dark"
    ? `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`
    : `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>`;
  return `<header class="topbar">
    <div class="brand">${logo}<span>River Garden Apply</span></div>
    <span class="privacy">Private by design · nothing is uploaded</span>
    <button class="icon-button" id="themeToggle" aria-label="Switch color mode" data-testid="button-theme">
      ${themeIcon}
    </button>
  </header>`;
}

function photoBand() {
  return `<figure class="photo-band">
    <img src="./river-garden-waterfront.webp" alt="River Garden condominiums viewed from the waterfront dock" width="1800" height="1350" decoding="async">
    <figcaption>River Garden · Fort Myers waterfront</figcaption>
  </figure>`;
}

function rail() {
  return `<aside class="rail" aria-label="Application progress">
    <h2>Your application</h2>
    <p>Answers remain only in this tab until you download the PDF.</p>
    <ol class="step-list">
      ${steps.map((step, index) => `<li>
        <button type="button" data-step="${index}" ${index === currentStep ? 'aria-current="step"' : ""} data-testid="button-step-${index + 1}">
          <span class="step-number">${index + 1}</span><span class="step-label">${step.title}</span>
        </button>
      </li>`).join("")}
      <li><button type="button" data-step="review" ${currentStep === steps.length ? 'aria-current="step"' : ""} data-testid="button-step-review">
        <span class="step-number">✓</span><span class="step-label">Review & download</span>
      </button></li>
    </ol>
  </aside>`;
}

function renderStep() {
  const step = steps[currentStep];
  app.innerHTML = `<div class="shell">${header()}${photoBand()}
    <main id="main" class="layout">
      ${rail()}
      <section class="main-card" aria-labelledby="pageTitle">
        <div class="card-head">
          <div class="eyebrow">${step.eyebrow}</div>
          <h1 id="pageTitle">${step.title}</h1>
          <p>${step.description}</p>
          ${currentStep === 5 ? `<div class="notice"><strong>Print & sign:</strong><span>The export fills names, dates, and initials. For safest HOA acceptance, sign the printed authorization and acknowledgment lines by hand.</span></div>` : ""}
        </div>
        <form id="stepForm" novalidate>
          <div class="form-body">${step.fields.map(fieldHtml).join("")}</div>
          <div class="card-actions">
            <button type="button" class="button secondary" id="backButton" ${currentStep === 0 ? "disabled" : ""} data-testid="button-back">Back</button>
            <button type="submit" class="button primary" data-testid="button-continue">${currentStep === steps.length - 1 ? "Review application" : "Continue"}</button>
          </div>
        </form>
      </section>
    </main>
    <footer class="footer-note">Convenience tool based on the River Garden Inc. lease application dated September 2023. It is not an official HOA portal or legal advice.</footer>
  </div>`;
  bindCommon();
  document.querySelector("#stepForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validateStep()) return;
    currentStep += 1;
    currentStep === steps.length ? renderReview() : renderStep();
    scrollTo({ top: 0, behavior: "smooth" });
  });
  document.querySelector("#backButton").addEventListener("click", () => {
    saveVisibleFields();
    if (currentStep > 0) currentStep -= 1;
    renderStep();
  });
}

function completionPercent() {
  const requiredKeys = steps.flatMap((step) => step.fields.filter((field) => field[3]).map((field) => field[0]));
  const completed = requiredKeys.filter((key) => state[key]?.trim()).length;
  return Math.round((completed / requiredKeys.length) * 100);
}

function recommendationUrl() {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("recommend", "1");
  url.searchParams.set("applicant", state.applicantName);
  url.searchParams.set("unit", state.unitAddress);
  return url.toString();
}

function renderReview() {
  const percent = completionPercent();
  const link = recommendationUrl();
  const body = `Hello! I’m applying to lease ${state.unitAddress || "a unit"} at River Garden Condominiums. The HOA requires two letters of recommendation. Please use this short template so you do not have to write one from scratch. When you finish, it will open an email addressed directly to Marilu: ${link} Thank you!`;
  const emailHref = `mailto:?subject=${encodeURIComponent(`Recommendation for ${state.applicantName || "River Garden applicant"}`)}&body=${encodeURIComponent(body)}`;
  const smsHref = `sms:?&body=${encodeURIComponent(body)}`;
  const applicationEmail = `mailto:marilugarbi@pm.me?subject=${encodeURIComponent(`River Garden application — ${state.applicantName || "Applicant"}`)}&body=${encodeURIComponent(`Hello Marilu,\n\nAttached are my signed River Garden application, driver’s-license pictures for all residents, and support-animal documents if applicable.\n\nApplicant: ${state.applicantName || ""}\nUnit: ${state.unitAddress || ""}\nMove-in date: ${formatDate(state.occupancyDate)}\n\nThank you.`)}`;
  app.innerHTML = `<div class="shell">${header()}${photoBand()}
    <main id="main" class="layout">
      ${rail()}
      <section class="main-card" aria-labelledby="pageTitle">
        <div class="card-head">
          <div class="eyebrow">Application next steps</div>
          <h1 id="pageTitle">Finish and send your application</h1>
          <p>Complete these three steps so Marilu receives the full package for Board review.</p>
        </div>
        <div class="completion">
          <div>
            <div class="eyebrow">${percent}% of required answers present</div>
            <div class="progress" aria-label="${percent}% complete"><span style="width:${percent}%"></span></div>
          </div>
          <ol class="next-steps">
            <li class="export-panel">
              <div class="step-badge">1</div>
              <div>
                <h2>Forward the recommendation link</h2>
                <p>Send this link to the people giving you letters of recommendation. They can fill out the template, and it’ll open a completed email to me directly, ready for them to send.</p>
                <label class="sr-only" for="recommendationLink">Recommendation form link</label>
                <input id="recommendationLink" value="${escapeHtml(link)}" readonly data-testid="input-recommendation-link">
                <div class="share-row">
                  <button class="button secondary" id="copyRequest" data-testid="button-copy-request">Copy request</button>
                  <a class="button secondary" href="${emailHref}" data-testid="link-email-request">Email</a>
                  <a class="button secondary" href="${smsHref}" data-testid="link-text-request">Text</a>
                </div>
              </div>
            </li>
            <li class="export-panel">
              <div class="step-badge">2</div>
              <div>
                <h2>Download, sign, and email</h2>
                <p>Download the filled PDF, sign it, and email it to <strong>marilugarbi@pm.me</strong> along with a driver’s-license picture for every resident and any support-animal documents for your pet, if applicable.</p>
                <div class="share-row two">
                  <button class="button primary" id="downloadHoa" data-testid="button-download-hoa">Download filled PDF</button>
                  <a class="button secondary" href="${applicationEmail}" data-testid="link-email-application">Email Marilu</a>
                </div>
              </div>
            </li>
            <li class="export-panel">
              <div class="step-badge">3</div>
              <div>
                <h2>Pay $216</h2>
                <p>Pay both required fees, $150 application plus $66 credit and criminal background check, via Cash App or Venmo to <strong>@mascottproperties</strong>.</p>
                <div class="share-row two">
                  <a class="button primary" href="https://cash.app/$mascottproperties" target="_blank" rel="noopener" data-testid="link-cashapp">Cash App</a>
                  <a class="button secondary" href="https://account.venmo.com/u/mascottproperties" target="_blank" rel="noopener" data-testid="link-venmo">Venmo</a>
                </div>
              </div>
            </li>
          </ol>
          <div class="status" id="status" role="status" data-testid="status-export"></div>
          <div class="deadline-note">Allow 30 days for the Board to review your application after a complete submission, before you move in.</div>
        </div>
        <div class="card-actions">
          <button class="button secondary" id="backButton" data-testid="button-edit">Edit answers</button>
          <a class="button secondary" href="./river-garden-application.pdf" download data-testid="link-blank-packet">Blank HOA packet</a>
        </div>
      </section>
    </main>
    <footer class="footer-note">Your entries disappear when this tab closes or refreshes. Keep the downloaded PDF in a secure location.</footer>
  </div>`;
  bindCommon();
  document.querySelector("#backButton").addEventListener("click", () => {
    currentStep = steps.length - 1;
    renderStep();
  });
  document.querySelector("#copyRequest").addEventListener("click", async () => {
    await navigator.clipboard.writeText(body);
    document.querySelector("#status").textContent = "Recommendation request copied.";
  });
  document.querySelector("#downloadHoa").addEventListener("click", downloadHoaPdf);
}

function bindCommon() {
  document.querySelector("#themeToggle").addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    currentStep === steps.length ? renderReview() : renderStep();
  });
  document.querySelectorAll("[data-step]").forEach((button) => button.addEventListener("click", () => {
    if (currentStep < steps.length) saveVisibleFields();
    const target = button.dataset.step;
    currentStep = target === "review" ? steps.length : Number(target);
    currentStep === steps.length ? renderReview() : renderStep();
  }));
  document.querySelectorAll("[data-verify-address]").forEach((button) => button.addEventListener("click", () => {
    const input = document.querySelector(`#${button.dataset.verifyAddress}`);
    if (!input?.value.trim()) {
      input?.focus();
      return;
    }
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(input.value)}`, "_blank", "noopener");
  }));
  attachGoogleAddressFields();
}

function loadGoogleMaps() {
  if (!GOOGLE_MAPS_KEY) return Promise.resolve(false);
  if (window.google?.maps?.places) return Promise.resolve(true);
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = new Promise((resolve, reject) => {
    window.__riverGardenMapsReady = () => resolve(true);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&libraries=places&callback=__riverGardenMapsReady`;
    script.async = true;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

async function attachGoogleAddressFields() {
  if (!GOOGLE_MAPS_KEY) return;
  try {
    await loadGoogleMaps();
    document.querySelectorAll("[data-google-address]").forEach((input) => {
      if (input.dataset.googleBound) return;
      input.dataset.googleBound = "true";
      const autocomplete = new google.maps.places.Autocomplete(input, {
        types: ["address"],
        componentRestrictions: { country: "us" },
        fields: ["formatted_address", "address_components"]
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address) input.value = place.formatted_address;
        if (input.id === "currentStreet" || input.id === "priorStreet") {
          const prefix = input.id === "currentStreet" ? "current" : "prior";
          const parts = {};
          (place.address_components || []).forEach((component) => component.types.forEach((type) => { parts[type] = component.short_name; }));
          const city = parts.locality || parts.postal_town || parts.sublocality || "";
          const region = [city, parts.administrative_area_level_1, parts.postal_code].filter(Boolean).join(", ").replace(/, ([0-9]{5})$/, " $1");
          const target = document.querySelector(`#${prefix}CityStateZip`);
          if (target) target.value = region;
        }
      });
    });
  } catch (error) {
    console.warn("Google address autocomplete unavailable", error);
  }
}

function drawValue(page, font, value, x, y, size = 8, maxWidth = 220) {
  const text = safe(value, "");
  if (!text) return;
  const limited = text.length > 110 ? `${text.slice(0, 107)}...` : text;
  page.drawText(limited, { x, y, size, font, color: rgb(0.05, 0.12, 0.11), maxWidth });
}

function drawWrapped(page, font, value, x, y, maxWidth = 470, size = 7.5, maxLines = 2) {
  const words = safe(value).split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((entry, index) => drawValue(page, font, entry, x, y - index * (size + 2), size, maxWidth));
}

function markYesNo(page, font, value, yesX, noX, y) {
  if (value === "Yes") drawValue(page, font, "X", yesX, y, 9, 10);
  if (value === "No") drawValue(page, font, "X", noX, y, 9, 10);
}

async function downloadHoaPdf() {
  const status = document.querySelector("#status");
  try {
    status.textContent = "Preparing your 13-page packet…";
    const source = await fetch("./river-garden-application.pdf").then((response) => response.arrayBuffer());
    const pdf = await PDFDocument.load(source);
    pdf.setTitle("Completed River Garden Lease Application");
    pdf.setAuthor("River Garden applicant");
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const pages = pdf.getPages();
    const initials = safe(state.initials, "");
    pages.forEach((page) => initials && drawValue(page, font, initials, 455, 20, 8, 80));

    const p1 = pages[0];
    drawValue(p1, font, state.applicantName, 338, 411, 8, 210);
    drawValue(p1, font, state.applicantSsn, 34, 365, 8, 230);
    drawValue(p1, font, formatDate(state.applicantDob), 338, 365, 8, 170);
    drawValue(p1, font, formatDate(state.signedDate), 34, 326, 8, 180);
    drawValue(p1, font, state.spouseName, 338, 248, 8, 210);
    drawValue(p1, font, state.spouseSsn, 34, 205, 8, 230);
    drawValue(p1, font, formatDate(state.spouseDob), 338, 205, 8, 170);
    drawValue(p1, font, formatDate(state.signedDate), 34, 166, 8, 180);

    const p2 = pages[1];
    drawValue(p2, font, formatDate(state.occupancyDate), 144, 511, 8, 100);
    drawValue(p2, font, state.unitAddress, 190, 484, 8, 370);
    drawValue(p2, font, state.peopleCount, 219, 457, 8, 80);
    drawValue(p2, font, formatDate(state.leaseStart), 142, 414, 8, 95);
    drawValue(p2, font, formatDate(state.leaseEnd), 360, 414, 8, 180);
    drawValue(p2, font, state.applicantName, 67, 389, 8, 255);
    drawValue(p2, font, formatDate(state.applicantDob), 394, 389, 8, 150);
    drawValue(p2, font, state.applicantDl, 155, 361, 8, 210);
    drawValue(p2, font, state.applicantPhone, 430, 361, 8, 120);
    drawValue(p2, font, state.applicantEmail, 118, 333, 8, 430);
    drawValue(p2, font, state.spouseName, 112, 302, 8, 215);
    drawValue(p2, font, formatDate(state.spouseDob), 395, 302, 8, 150);
    drawValue(p2, font, state.spouseDl, 155, 274, 8, 210);
    drawValue(p2, font, state.spousePhone, 430, 274, 8, 120);
    drawValue(p2, font, state.spouseEmail, 118, 246, 8, 430);
    drawValue(p2, font, state.occupant1, 68, 193, 7.5, 480);
    drawValue(p2, font, state.occupant2, 68, 164, 7.5, 480);
    drawValue(p2, font, state.ownerName, 152, 129, 8, 395);
    drawValue(p2, font, state.realtor, 207, 101, 8, 340);

    const p3 = pages[2];
    const e1 = splitCombined(state.emergency1, 3);
    const e2 = splitCombined(state.emergency2, 3);
    drawValue(p3, font, e1[0], 95, 718, 8, 260);
    drawValue(p3, font, e1[1], 392, 718, 8, 150);
    drawValue(p3, font, e1[2], 95, 685, 8, 447);
    drawValue(p3, font, e2[0], 95, 653, 8, 260);
    drawValue(p3, font, e2[1], 392, 653, 8, 150);
    drawValue(p3, font, e2[2], 95, 620, 8, 447);
    markYesNo(p3, font, state.hasPets, 177, 274, 586);
    const pet = splitCombined(state.petDetails, 3);
    drawValue(p3, font, pet[0], 210, 565, 8, 335);
    drawValue(p3, font, pet[1], 185, 544, 8, 360);
    drawValue(p3, font, pet[2], 125, 523, 8, 120);
    markYesNo(p3, font, state.waterbed, 211, 318, 431);
    markYesNo(p3, font, state.smokes, 211, 318, 398);
    markYesNo(p3, font, state.ownsRealEstate, 211, 318, 365);
    drawWrapped(p3, font, state.realEstateWhere, 171, 338, 375, 7.5, 1);
    markYesNo(p3, font, state.evicted, 330, 403, 306);
    drawWrapped(p3, font, state.evictedExplain, 141, 282, 405, 7.5, 2);
    markYesNo(p3, font, state.refusedRent, 411, 474, 221);
    drawWrapped(p3, font, state.refusedRentExplain, 141, 198, 405, 7.5, 2);
    markYesNo(p3, font, state.felony, 270, 336, 137);
    drawWrapped(p3, font, state.felonyExplain, 141, 114, 405, 7.5, 2);

    const p4 = pages[3];
    const v1 = splitCombined(state.vehicle1, 3), v2 = splitCombined(state.vehicle2, 3);
    drawValue(p4, font, v1[0], 104, 713, 8, 275); drawValue(p4, font, v1[1], 430, 713, 8, 115); drawValue(p4, font, v1[2], 140, 680, 8, 240);
    drawValue(p4, font, v2[0], 104, 656, 8, 275); drawValue(p4, font, v2[1], 430, 656, 8, 115); drawValue(p4, font, v2[2], 140, 620, 8, 240);
    const relative = splitCombined(state.nearestRelative, 4);
    drawValue(p4, font, relative[0], 69, 568, 8, 475); drawValue(p4, font, relative[1], 75, 536, 8, 470);
    drawValue(p4, font, relative[2], 104, 507, 8, 440); drawValue(p4, font, relative[3], 110, 478, 8, 260);
    const wr1 = splitCombined(state.workRef1, 4), wr2 = splitCombined(state.workRef2, 4);
    drawValue(p4, font, wr1[0], 69, 425, 8, 475); drawValue(p4, font, wr1[1], 64, 396, 8, 480);
    drawValue(p4, font, wr1[2], 75, 367, 8, 470); drawValue(p4, font, wr1[3], 110, 339, 8, 260);
    drawValue(p4, font, wr2[0], 69, 313, 8, 475); drawValue(p4, font, wr2[1], 64, 284, 8, 480);
    drawValue(p4, font, wr2[2], 75, 255, 8, 470); drawValue(p4, font, wr2[3], 110, 227, 8, 260);
    const pr1 = splitCombined(state.personalRef1, 4);
    drawValue(p4, font, pr1[0], 69, 162, 8, 475); drawValue(p4, font, pr1[1], 75, 131, 8, 470); drawValue(p4, font, pr1[2], 104, 103, 8, 440);

    const p5 = pages[4];
    drawValue(p5, font, pr1[3], 110, 752, 8, 260);
    const pr2 = splitCombined(state.personalRef2, 4);
    drawValue(p5, font, pr2[0], 69, 712, 8, 475); drawValue(p5, font, pr2[1], 75, 675, 8, 470);
    drawValue(p5, font, pr2[2], 104, 638, 8, 440); drawValue(p5, font, pr2[3], 110, 600, 8, 260);
    const cl = splitCombined(state.currentLandlord, 3);
    drawValue(p5, font, state.currentStreet, 140, 515, 8, 405); drawValue(p5, font, state.currentCityStateZip, 110, 486, 8, 300);
    drawValue(p5, font, state.currentPhone, 425, 486, 8, 120); drawValue(p5, font, state.currentDates, 435, 351, 8, 110);
    drawValue(p5, font, state.applicantEmail, 145, 452, 8, 400);
    drawValue(p5, font, cl[0], 160, 420, 8, 385); drawValue(p5, font, cl[1], 75, 389, 8, 470); drawValue(p5, font, cl[2], 125, 351, 8, 270);
    const pl = splitCombined(state.priorLandlord, 3);
    drawValue(p5, font, state.priorStreet, 140, 311, 8, 405); drawValue(p5, font, state.priorCityStateZip, 110, 280, 8, 300); drawValue(p5, font, state.priorDates, 435, 205, 8, 110);
    drawValue(p5, font, pl[0], 175, 242, 8, 370); drawValue(p5, font, pl[1], 265, 242, 8, 280); drawValue(p5, font, pl[2], 125, 205, 8, 270);

    const p6 = pages[5];
    if (state.employmentStatus === "Employed") drawValue(p6, font, "X", 211, 718, 9, 10);
    else if (state.employmentStatus === "Retired") drawValue(p6, font, "X", 462, 718, 9, 10);
    else drawValue(p6, font, "X", 277, 718, 9, 10);
    const emp = splitCombined(state.employer, 5);
    drawValue(p6, font, emp[0], 180, 665, 8, 365); drawValue(p6, font, emp[1], 80, 627, 8, 465);
    drawValue(p6, font, emp[2], 110, 589, 8, 275); drawValue(p6, font, emp[3], 150, 550, 8, 210); drawValue(p6, font, emp[4], 490, 550, 8, 55);
    const semp = splitCombined(state.spouseEmployer, 5);
    drawValue(p6, font, semp[0], 210, 569, 8, 335); drawValue(p6, font, semp[1], 80, 542, 8, 465);
    drawValue(p6, font, semp[2], 110, 513, 8, 275); drawValue(p6, font, semp[3], 150, 486, 8, 210); drawValue(p6, font, semp[4], 490, 486, 8, 55);
    const pe = splitCombined(state.priorEmployer, 4), spe = splitCombined(state.spousePriorEmployer, 4);
    drawValue(p6, font, pe[0], 145, 431, 8, 400); drawValue(p6, font, pe[1], 150, 403, 8, 210);
    drawValue(p6, font, pe[2], 80, 376, 8, 465); drawValue(p6, font, pe[3], 110, 348, 8, 275);
    drawValue(p6, font, spe[0], 175, 315, 8, 370); drawValue(p6, font, spe[1], 150, 287, 8, 210);
    drawValue(p6, font, spe[2], 80, 260, 8, 465); drawValue(p6, font, spe[3], 110, 231, 8, 275);
    const bank = splitCombined(state.bankReference, 4);
    drawValue(p6, font, bank[0], 155, 192, 8, 245); drawValue(p6, font, bank[1], 450, 192, 8, 95);
    drawValue(p6, font, bank[2], 80, 163, 8, 300); drawValue(p6, font, bank[3], 455, 163, 8, 90);

    const p7 = pages[6];
    drawValue(p7, font, state.applicantName, 116, 531, 8, 430);
    drawValue(p7, font, state.spouseName, 108, 442, 8, 438);

    const p13 = pages[12];
    drawValue(p13, font, formatDate(state.signedDate), 285, 615, 8, 110);
    if (state.spouseName) drawValue(p13, font, formatDate(state.signedDate), 285, 545, 8, 110);

    const bytes = await pdf.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `River-Garden-Application-${safe(state.applicantName, "Applicant").replace(/[^a-z0-9]+/gi, "-")}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
    status.textContent = "PDF downloaded. Print, review every page, and sign the required lines.";
  } catch (error) {
    console.error(error);
    status.textContent = "The PDF could not be created. Please try again or download the blank packet.";
  }
}

function renderRecommender() {
  const params = new URLSearchParams(location.search);
  const applicant = params.get("applicant") || "";
  const unit = params.get("unit") || "";
  app.innerHTML = `<div class="shell">${header()}${photoBand()}
    <main id="main" class="layout" style="grid-template-columns:minmax(0,760px);justify-content:center">
      <section class="main-card" aria-labelledby="pageTitle">
        <div class="card-head">
          <div class="eyebrow">Recommendation letter</div>
          <h1 id="pageTitle">Help ${escapeHtml(applicant || "this applicant")} without starting from scratch</h1>
          <p>Answer four short prompts. The form will prepare an email addressed directly to Marilu for you to review and send.</p>
          <div class="notice"><strong>Private:</strong><span>Your answers stay in this tab and are used only to create the downloaded PDF.</span></div>
        </div>
        <form id="recommendForm">
          <div class="form-body">
            <div class="field"><label for="recommenderName">Your full name</label><input id="recommenderName" required data-testid="input-recommender-name"></div>
            <div class="field"><label for="recommenderContact">Phone or email</label><input id="recommenderContact" required data-testid="input-recommender-contact"></div>
            <div class="field"><label for="relationship">How do you know the applicant?</label><input id="relationship" required placeholder="Neighbor, colleague, friend…" data-testid="input-relationship"></div>
            <div class="field"><label for="knownYears">How long have you known them?</label><input id="knownYears" required placeholder="For example: 8 years" data-testid="input-known-years"></div>
            <div class="field"><label for="qualities">What qualities make them a responsible resident?</label><textarea id="qualities" required placeholder="Reliability, respect for neighbors, care of property…" data-testid="input-qualities"></textarea></div>
            <div class="field"><label for="confidence">Anything else the Board should know?<span class="optional">optional</span></label><textarea id="confidence" data-testid="input-confidence"></textarea></div>
          </div>
          <div class="card-actions">
            <span></span><button class="button primary" type="submit" data-testid="button-email-letter">Email recommendation to Marilu</button>
          </div>
        </form>
        <div class="completion"><div class="status" id="status" role="status"></div></div>
      </section>
    </main>
    <footer class="footer-note">This is a convenience template, not an official River Garden HOA form. Please review and sign the downloaded letter before returning it.</footer>
  </div>`;
  document.querySelector("#themeToggle").addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    renderRecommender();
  });
  document.querySelector("#recommendForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(["recommenderName", "recommenderContact", "relationship", "knownYears", "qualities", "confidence"].map((key) => [key, document.querySelector(`#${key}`).value]));
    emailRecommendation(values, applicant, unit);
  });
}

function emailRecommendation(values, applicant, unit) {
  const status = document.querySelector("#status");
  const letter = `To the River Garden Board of Directors:\n\nI am pleased to recommend ${applicant || "the applicant"} in connection with the application to lease ${unit || "a unit at River Garden Condominiums"}.\n\nI have known ${applicant || "the applicant"} for ${values.knownYears} as ${values.relationship}.\n\n${values.qualities}\n\n${values.confidence || `Based on my experience, I believe ${applicant || "the applicant"} would be a responsible and respectful resident who will care for the property and community.`}\n\nI recommend ${applicant || "the applicant"} without reservation. Please contact me if additional information would be helpful.\n\nSincerely,\n${values.recommenderName}\n${values.recommenderContact}`;
  status.textContent = "Opening an email addressed to Marilu. Please review it and press Send.";
  window.location.href = `mailto:marilugarbi@pm.me?subject=${encodeURIComponent(`Letter of recommendation for ${applicant || "River Garden applicant"}`)}&body=${encodeURIComponent(letter)}`;
}

if (new URLSearchParams(location.search).get("recommend") === "1") renderRecommender();
else renderStep();
