import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { spouseKeys, steps } from "./schema.js";
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

function safe(value, fallback = "") {
  return String(value || fallback).trim();
}

function splitCombined(value, count) {
  const parts = String(value || "").split(",").map((part) => part.trim());
  return Array.from({ length: count }, (_, index) => parts[index] || "");
}

function splitAddress(value) {
  const parts = String(value || "").split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return [String(value || "").trim(), ""];
  return [parts.shift(), parts.join(", ")];
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${month}/${day}/${year}`;
}

function formatMonth(value) {
  if (!value || value === "Present") return value || "";
  const [year, month] = value.split("-");
  return year && month ? `${month}/${year}` : value;
}

function isVisible(key) {
  if (spouseKeys.includes(key)) {
    if (state.hasSpouse !== "Yes") return false;
    if (["spouseEmployerName", "spouseEmployerAddress", "spouseEmployerPhone", "spouseEmployerLength", "spouseEmployerSalary"].includes(key)) return ["Employed", "Retired"].includes(state.spouseEmploymentStatus);
    if (key === "spouseEmploymentUnderFive") return state.spouseEmploymentStatus === "Employed";
    if (["spousePriorEmployerName", "spousePriorEmployerLength", "spousePriorEmployerAddress", "spousePriorEmployerPhone"].includes(key)) return state.spouseEmploymentStatus === "Employed" && state.spouseEmploymentUnderFive === "Yes";
  }
  if (key === "otherOccupantCount") return state.hasOtherOccupants === "Yes";
  if (["occupant1Name", "occupant1Relationship", "occupant1Age"].includes(key)) return state.hasOtherOccupants === "Yes";
  if (["occupant2Name", "occupant2Relationship", "occupant2Age"].includes(key)) return state.hasOtherOccupants === "Yes" && state.otherOccupantCount === "2";
  if (["petDetails", "petAgreement"].includes(key)) return state.hasPets === "Yes";
  if (key === "realEstateWhere") return state.ownsRealEstate === "Yes";
  if (key === "evictedExplain") return state.evicted === "Yes";
  if (key === "refusedRentExplain") return state.refusedRent === "Yes";
  if (key === "felonyExplain") return state.felony === "Yes";
  if (key === "vehicleCount") return state.hasVehicles === "Yes";
  if (["vehicle1Type", "vehicle1Color", "vehicle1Plate"].includes(key)) return state.hasVehicles === "Yes";
  if (["vehicle2Type", "vehicle2Color", "vehicle2Plate"].includes(key)) return state.hasVehicles === "Yes" && state.vehicleCount === "2";
  if (["priorAddress", "priorFrom", "priorTo", "priorLandlordName", "priorLandlordAddress", "priorLandlordPhone"].includes(key)) return state.livedCurrentUnderFive === "Yes";
  if (["employerName", "employerAddress", "employerPhone", "employerLength", "employerSalary"].includes(key)) return ["Employed", "Retired"].includes(state.employmentStatus);
  if (key === "employmentUnderFive") return state.employmentStatus === "Employed";
  if (["priorEmployerName", "priorEmployerLength", "priorEmployerAddress", "priorEmployerPhone"].includes(key)) return state.employmentStatus === "Employed" && state.employmentUnderFive === "Yes";
  return true;
}

function isRequired(field) {
  const [key, , , required] = field;
  if (!isVisible(key)) return false;
  if (required) return true;
  if (spouseKeys.includes(key)) {
    if (["spouseName", "spouseDob", "spouseDl", "spousePhone", "spouseEmail", "spouseEmploymentStatus", "spouseSsn", "spouseSignedDate"].includes(key)) return state.hasSpouse === "Yes";
    if (["spouseEmployerName", "spouseEmployerAddress", "spouseEmployerPhone", "spouseEmployerLength", "spouseEmployerSalary"].includes(key)) return ["Employed", "Retired"].includes(state.spouseEmploymentStatus);
    if (key === "spouseEmploymentUnderFive") return state.spouseEmploymentStatus === "Employed";
    if (["spousePriorEmployerName", "spousePriorEmployerLength", "spousePriorEmployerAddress", "spousePriorEmployerPhone"].includes(key)) return state.spouseEmploymentUnderFive === "Yes";
  }
  if (key === "otherOccupantCount") return state.hasOtherOccupants === "Yes";
  if (["occupant1Name", "occupant1Relationship", "occupant1Age"].includes(key)) return state.hasOtherOccupants === "Yes";
  if (["occupant2Name", "occupant2Relationship", "occupant2Age"].includes(key)) return state.otherOccupantCount === "2";
  if (["petDetails", "petAgreement"].includes(key)) return state.hasPets === "Yes";
  if (key === "realEstateWhere") return state.ownsRealEstate === "Yes";
  if (key === "evictedExplain") return state.evicted === "Yes";
  if (key === "refusedRentExplain") return state.refusedRent === "Yes";
  if (key === "felonyExplain") return state.felony === "Yes";
  if (key === "vehicleCount" || ["vehicle1Type", "vehicle1Color", "vehicle1Plate"].includes(key)) return state.hasVehicles === "Yes";
  if (["vehicle2Type", "vehicle2Color", "vehicle2Plate"].includes(key)) return state.vehicleCount === "2";
  if (["priorAddress", "priorFrom", "priorTo"].includes(key)) return state.livedCurrentUnderFive === "Yes";
  if (["employerName", "employerAddress", "employerPhone", "employerLength", "employerSalary"].includes(key)) return ["Employed", "Retired"].includes(state.employmentStatus);
  if (key === "employmentUnderFive") return state.employmentStatus === "Employed";
  if (["priorEmployerName", "priorEmployerLength", "priorEmployerAddress", "priorEmployerPhone"].includes(key)) return state.employmentUnderFive === "Yes";
  return false;
}

function mapsHref(value) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value || "")}`;
}

function fieldHtml(field) {
  const [key, label, type, required, options] = field;
  if (!isVisible(key)) return "";
  const requiredNow = isRequired(field);
  const requiredMark = requiredNow ? "" : `<span class="optional">optional / leave blank</span>`;
  if (type === "yesno") {
    return `<fieldset class="field choice-field">
      <legend>${label}</legend>
      <div class="yesno">
        ${["Yes", "No"].map((option) => `<label><input type="radio" name="${key}" value="${option}" ${state[key] === option ? "checked" : ""} ${requiredNow ? "required" : ""} data-live-field data-testid="input-${key}-${option.toLowerCase()}"><span>${option}</span></label>`).join("")}
      </div>
      <span class="error-text" id="error-${key}" role="alert"></span>
    </fieldset>`;
  }
  if (type === "agreement") {
    return `<div class="pet-warning">
      <strong>Pet requirements</strong>
      <p>Two pets maximum, no heavier than 25 lbs unless they are emotional support animals. Evidence will be required with the application.</p>
      <label class="agreement"><input id="${key}" name="${key}" type="checkbox" ${state[key] === "Yes" ? "checked" : ""} ${requiredNow ? "required" : ""} data-testid="input-${key}"><span>Agree</span></label>
      <span class="error-text" id="error-${key}" role="alert"></span>
    </div>`;
  }
  if (type === "select") {
    return `<div class="field">
      <label for="${key}">${label}${requiredMark}</label>
      <select id="${key}" name="${key}" ${requiredNow ? "required" : ""} data-live-field data-testid="input-${key}">
        <option value="">Choose one</option>
        ${options.map((option) => `<option value="${option}" ${state[key] === option ? "selected" : ""}>${option}</option>`).join("")}
      </select>
      <span class="error-text" id="error-${key}" role="alert"></span>
    </div>`;
  }
  const tag = type === "textarea" ? "textarea" : "input";
  const inputType = ["address", "presentOrMonth"].includes(type) ? "text" : type;
  const addressAttrs = type === "address" ? `data-google-address="${key}" autocomplete="street-address"` : "";
  const initialsLimit = key === "initials" ? 'maxlength="6"' : "";
  const attrs = tag === "input" ? `type="${inputType}" value="${escapeHtml(state[key])}" ${addressAttrs} ${initialsLimit}` : "";
  const content = tag === "textarea" ? escapeHtml(state[key]) : "";
  return `<div class="field">
    <label for="${key}">${label}${requiredMark}</label>
    <${tag} id="${key}" name="${key}" ${attrs} ${requiredNow ? "required" : ""} ${type === "presentOrMonth" ? `placeholder="Present or MM/YYYY"` : ""} data-testid="input-${key}">${content}</${tag}>
    ${type === "address" ? `<a class="map-verify" href="${mapsHref(state[key])}" target="_blank" rel="noopener" data-address-link="${key}" aria-disabled="${state[key] ? "false" : "true"}">Check this address in Google Maps</a>` : ""}
    <span class="error-text" id="error-${key}" role="alert"></span>
  </div>`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function saveVisibleFields() {
  steps[currentStep].fields.forEach(([key]) => {
    const input = document.querySelector(`#${key}`) || document.querySelector(`[name="${key}"]:checked`);
    if (!input) return;
    state[key] = input.type === "checkbox" ? (input.checked ? "Yes" : "") : input.value;
  });
}

function clearHiddenFields() {
  steps.flatMap((step) => step.fields).forEach(([key]) => {
    if (!isVisible(key)) state[key] = "";
  });
}

function validateStep() {
  saveVisibleFields();
  let valid = true;
  steps[currentStep].fields.forEach((field) => {
    const [key] = field;
    if (!isVisible(key)) return;
    const error = document.querySelector(`#error-${key}`);
    if (isRequired(field) && !state[key].trim()) {
      error.textContent = "This answer is required by the application.";
      valid = false;
    } else {
      error.textContent = "";
    }
  });
  if (currentStep === 0 && state.hasSpouse && state.hasOtherOccupants) {
    const expected = 1 + (state.hasSpouse === "Yes" ? 1 : 0) + (state.hasOtherOccupants === "Yes" ? Number(state.otherOccupantCount || 0) : 0);
    const error = document.querySelector("#error-peopleCount");
    if (Number(state.peopleCount) !== expected) {
      error.textContent = `This should be ${expected} based on the household answers below.`;
      valid = false;
    }
  }
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
  document.querySelectorAll("[data-live-field]").forEach((input) => input.addEventListener("change", () => {
    saveVisibleFields();
    clearHiddenFields();
    renderStep();
  }));
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
  const requiredKeys = steps.flatMap((step) => step.fields.filter((field) => isRequired(field)).map((field) => field[0]));
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
                <h2>Pay $216 per adult applicant</h2>
                <p>Each adult applicant pays $216, which includes the $150 application fee and the $66 credit and criminal background check fee. A married couple pays one combined $216 fee. Send payment via Cash App or Venmo to <strong>@mascottproperties</strong>.</p>
              </div>
            </li>
          </ol>
          <div class="status" id="status" role="status" data-testid="status-export"></div>
          <div class="deadline-note">Allow 30 days for the Board to review your application before you plan on moving in.</div>
        </div>
        <div class="card-actions">
          <button class="button secondary" id="backButton" data-testid="button-edit">Back to application</button>
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
  document.querySelectorAll("[data-address-link]").forEach((link) => {
    const input = document.querySelector(`#${link.dataset.addressLink}`);
    const updateLink = () => {
      const value = input?.value.trim() || "";
      link.href = mapsHref(value);
      link.setAttribute("aria-disabled", value ? "false" : "true");
    };
    input?.addEventListener("input", updateLink);
    link.addEventListener("click", (event) => {
      if (!input?.value.trim()) {
        event.preventDefault();
        input?.focus();
      }
    });
    updateLink();
  });
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
        if (place.formatted_address) input.dispatchEvent(new Event("input", { bubbles: true }));
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
  const text = safe(value, "");
  if (!text) return;
  const words = text.split(/\s+/);
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
    drawValue(p1, font, state.applicantName, 338, 420, 8, 210);
    drawValue(p1, font, state.applicantSsn, 34, 380, 8, 230);
    drawValue(p1, font, formatDate(state.applicantDob), 338, 380, 8, 170);
    drawValue(p1, font, formatDate(state.signedDate), 34, 341, 8, 180);
    drawValue(p1, font, state.spouseName, 338, 301, 8, 210);
    drawValue(p1, font, state.spouseSsn, 34, 249, 8, 230);
    drawValue(p1, font, formatDate(state.spouseDob), 338, 249, 8, 170);
    drawValue(p1, font, formatDate(state.spouseSignedDate), 34, 208, 8, 180);

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
    drawValue(p2, font, state.occupant1Name, 68, 193, 7.5, 220);
    drawValue(p2, font, state.occupant1Relationship, 295, 193, 7.5, 190);
    drawValue(p2, font, state.occupant1Age, 520, 193, 7.5, 35);
    drawValue(p2, font, state.occupant2Name, 68, 164, 7.5, 220);
    drawValue(p2, font, state.occupant2Relationship, 295, 164, 7.5, 190);
    drawValue(p2, font, state.occupant2Age, 520, 164, 7.5, 35);
    drawValue(p2, font, state.ownerName, 152, 129, 8, 395);
    drawValue(p2, font, state.realtor, 207, 101, 8, 340);

    const p3 = pages[2];
    drawValue(p3, font, state.emergency1Name, 105, 721, 8, 250);
    drawValue(p3, font, state.emergency1Phone, 392, 721, 8, 150);
    drawValue(p3, font, state.emergency1Address, 118, 694, 8, 425);
    drawValue(p3, font, state.emergency2Name, 105, 666, 8, 250);
    drawValue(p3, font, state.emergency2Phone, 392, 666, 8, 150);
    drawValue(p3, font, state.emergency2Address, 118, 639, 8, 425);
    markYesNo(p3, font, state.hasPets, 177, 274, 607);
    const pet = splitCombined(state.petDetails, 3);
    drawValue(p3, font, pet[0], 220, 592, 8, 325);
    drawValue(p3, font, pet[1], 185, 577, 8, 360);
    drawValue(p3, font, pet[2], 125, 562, 8, 120);
    markYesNo(p3, font, state.waterbed, 211, 318, 455);
    markYesNo(p3, font, state.smokes, 211, 318, 427);
    markYesNo(p3, font, state.ownsRealEstate, 211, 318, 399);
    drawWrapped(p3, font, state.realEstateWhere, 171, 370, 375, 7.5, 1);
    markYesNo(p3, font, state.evicted, 330, 403, 343);
    drawWrapped(p3, font, state.evictedExplain, 141, 324, 405, 7.5, 2);
    markYesNo(p3, font, state.refusedRent, 411, 474, 274);
    drawWrapped(p3, font, state.refusedRentExplain, 141, 255, 405, 7.5, 2);
    markYesNo(p3, font, state.felony, 270, 350, 204);
    drawWrapped(p3, font, state.felonyExplain, 141, 186, 405, 7.5, 2);

    const p4 = pages[3];
    drawValue(p4, font, state.vehicle1Type, 104, 713, 8, 275); drawValue(p4, font, state.vehicle1Color, 430, 713, 8, 115); drawValue(p4, font, state.vehicle1Plate, 140, 680, 8, 240);
    drawValue(p4, font, state.vehicle2Type, 104, 656, 8, 275); drawValue(p4, font, state.vehicle2Color, 430, 656, 8, 115); drawValue(p4, font, state.vehicle2Plate, 140, 620, 8, 240);
    drawValue(p4, font, state.relativeName, 73, 568, 8, 471); drawValue(p4, font, state.relativeAddress, 84, 536, 8, 461);
    drawValue(p4, font, state.relativeRelationship, 108, 507, 8, 436); drawValue(p4, font, state.relativePhone, 115, 478, 8, 255);
    drawValue(p4, font, state.workRef1Name, 73, 425, 8, 471); drawValue(p4, font, state.workRef1Title, 68, 396, 8, 476);
    drawValue(p4, font, state.workRef1Address, 84, 367, 8, 461); drawValue(p4, font, state.workRef1Phone, 115, 339, 8, 255);
    drawValue(p4, font, state.workRef2Name, 73, 313, 8, 471); drawValue(p4, font, state.workRef2Title, 68, 284, 8, 476);
    drawValue(p4, font, state.workRef2Address, 84, 255, 8, 461); drawValue(p4, font, state.workRef2Phone, 115, 227, 8, 255);
    drawValue(p4, font, state.personalRef1Name, 73, 162, 8, 471); drawValue(p4, font, state.personalRef1Address, 84, 131, 8, 461); drawValue(p4, font, state.personalRef1Relationship, 108, 103, 8, 436);

    const p5 = pages[4];
    drawValue(p5, font, state.personalRef1Phone, 115, 752, 8, 255);
    drawValue(p5, font, state.personalRef2Name, 73, 716, 8, 471); drawValue(p5, font, state.personalRef2Address, 84, 691, 8, 461);
    drawValue(p5, font, state.personalRef2Relationship, 108, 664, 8, 436); drawValue(p5, font, state.personalRef2Phone, 115, 637, 8, 255);
    const currentAddress = splitAddress(state.currentAddress);
    drawValue(p5, font, currentAddress[0], 155, 525, 8, 390); drawValue(p5, font, currentAddress[1], 115, 498, 8, 295);
    drawValue(p5, font, state.currentPhone, 430, 498, 8, 115);
    drawValue(p5, font, state.applicantEmail, 150, 452, 8, 395);
    drawValue(p5, font, state.currentLandlordName, 165, 442, 8, 380); drawValue(p5, font, state.currentLandlordAddress, 84, 417, 8, 461); drawValue(p5, font, state.currentLandlordPhone, 125, 389, 8, 270);
    drawValue(p5, font, formatMonth(state.currentFrom), 445, 389, 8, 65); drawValue(p5, font, "Present", 522, 389, 8, 35);
    const priorAddress = splitAddress(state.priorAddress);
    drawValue(p5, font, priorAddress[0], 140, 358, 8, 405); drawValue(p5, font, priorAddress[1], 110, 330, 8, 430);
    drawValue(p5, font, state.priorLandlordName, 175, 301, 8, 150); drawValue(p5, font, state.priorLandlordAddress, 325, 301, 8, 220); drawValue(p5, font, state.priorLandlordPhone, 125, 276, 8, 270);
    drawValue(p5, font, formatMonth(state.priorFrom), 445, 276, 8, 65); drawValue(p5, font, formatMonth(state.priorTo), 522, 276, 8, 35);

    const p6 = pages[5];
    if (state.employmentStatus === "Employed") { drawValue(p6, font, "X", 211, 718, 9, 10); drawValue(p6, font, "X", 535, 718, 9, 10); }
    else if (state.employmentStatus === "Retired") { drawValue(p6, font, "X", 287, 718, 9, 10); drawValue(p6, font, "X", 462, 718, 9, 10); }
    else { drawValue(p6, font, "X", 287, 718, 9, 10); drawValue(p6, font, "X", 535, 718, 9, 10); }
    drawValue(p6, font, state.employerName, 180, 665, 8, 365); drawValue(p6, font, state.employerAddress, 80, 627, 8, 465);
    drawValue(p6, font, state.employerPhone, 110, 589, 8, 275); drawValue(p6, font, state.employerLength, 150, 550, 8, 210); drawValue(p6, font, state.employerSalary, 490, 550, 8, 55);
    drawValue(p6, font, state.spouseEmployerName, 210, 569, 8, 335); drawValue(p6, font, state.spouseEmployerAddress, 80, 542, 8, 465);
    drawValue(p6, font, state.spouseEmployerPhone, 110, 513, 8, 275); drawValue(p6, font, state.spouseEmployerLength, 150, 486, 8, 210); drawValue(p6, font, state.spouseEmployerSalary, 490, 486, 8, 55);
    drawValue(p6, font, state.priorEmployerName, 145, 431, 8, 400); drawValue(p6, font, state.priorEmployerLength, 150, 403, 8, 210);
    drawValue(p6, font, state.priorEmployerAddress, 80, 376, 8, 465); drawValue(p6, font, state.priorEmployerPhone, 110, 348, 8, 275);
    drawValue(p6, font, state.spousePriorEmployerName, 175, 315, 8, 370); drawValue(p6, font, state.spousePriorEmployerLength, 150, 287, 8, 210);
    drawValue(p6, font, state.spousePriorEmployerAddress, 80, 260, 8, 465); drawValue(p6, font, state.spousePriorEmployerPhone, 110, 231, 8, 275);
    drawValue(p6, font, state.bankName, 160, 192, 8, 240); drawValue(p6, font, state.bankPhone, 450, 192, 8, 95);
    drawValue(p6, font, state.bankAddress, 85, 163, 8, 295); drawValue(p6, font, state.bankHowLong, 455, 163, 8, 90);

    const p7 = pages[6];
    drawValue(p7, font, state.applicantName, 116, 564, 8, 430);
    drawValue(p7, font, state.spouseName, 108, 479, 8, 438);

    const p13 = pages[12];
    drawValue(p13, font, formatDate(state.signedDate), 285, 632, 8, 110);
    if (state.spouseName) drawValue(p13, font, formatDate(state.spouseSignedDate), 285, 562, 8, 110);

    const bytes = await pdf.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `River-Garden-Application-${safe(state.applicantName, "Applicant").replace(/[^a-z0-9]+/gi, "-")}.pdf`;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 60000);
    status.textContent = "PDF downloaded. This page will stay open so you can return to the application, review answers, and make changes.";
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
