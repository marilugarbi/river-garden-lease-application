import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { steps, requirements } from "./schema.js";
import "./style.css";

const app = document.querySelector("#app");
const state = Object.fromEntries(steps.flatMap((step) => step.fields.map(([key]) => [key, ""])));
let currentStep = 0;
let theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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
  const requiredMark = required ? "" : `<span class="optional">optional / use N/A</span>`;
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
  const attrs = tag === "input" ? `type="${type}" value="${escapeHtml(state[key])}"` : "";
  const content = tag === "textarea" ? escapeHtml(state[key]) : "";
  return `<div class="field">
    <label for="${key}">${label}${requiredMark}</label>
    <${tag} id="${key}" name="${key}" ${attrs} ${required ? "required" : ""} autocomplete="off" data-testid="input-${key}">${content}</${tag}>
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
  return `<header class="topbar">
    <div class="brand">${logo}<span>River Garden Apply</span></div>
    <span class="privacy">Private by design · nothing is uploaded</span>
    <button class="icon-button" id="themeToggle" aria-label="Switch color mode" data-testid="button-theme">
      ${theme === "dark" ? "☀" : "☾"}
    </button>
  </header>`;
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
  app.innerHTML = `<div class="shell">${header()}
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
  const body = `Hello! I’m applying to lease ${state.unitAddress || "a unit"} at River Garden Condominiums. The HOA requires two letters of recommendation. I made a short form so you do not have to write one from scratch: ${link} Thank you!`;
  const emailHref = `mailto:?subject=${encodeURIComponent(`Recommendation for ${state.applicantName || "River Garden applicant"}`)}&body=${encodeURIComponent(body)}`;
  const smsHref = `sms:?&body=${encodeURIComponent(body)}`;
  app.innerHTML = `<div class="shell">${header()}
    <main id="main" class="layout">
      ${rail()}
      <section class="main-card" aria-labelledby="pageTitle">
        <div class="card-head">
          <div class="eyebrow">Ready to assemble</div>
          <h1 id="pageTitle">Review, download, then attach</h1>
          <p>The website can prepare the form, but the HOA still needs signatures, identification, fees, a signed lease, and two recommendation letters.</p>
        </div>
        <div class="completion">
          <div>
            <div class="eyebrow">${percent}% of required answers present</div>
            <div class="progress" aria-label="${percent}% complete"><span style="width:${percent}%"></span></div>
          </div>
          <div class="export-grid">
            <article class="export-panel">
              <h2>Official HOA packet</h2>
              <p>Downloads the original 13 pages with your answers and initials placed on them.</p>
              <button class="button primary" id="downloadHoa" data-testid="button-download-hoa">Download filled PDF</button>
            </article>
            <article class="export-panel">
              <h2>Ask recommenders</h2>
              <p>Send a prefilled link. They answer four short prompts and download a finished letter.</p>
              <button class="button secondary" id="copyRequest" data-testid="button-copy-request">Copy request</button>
              <div class="share-row">
                <a class="button secondary" href="${emailHref}" data-testid="link-email-request">Email</a>
                <a class="button secondary" href="${smsHref}" data-testid="link-text-request">Text</a>
              </div>
            </article>
          </div>
          <div class="status" id="status" role="status" data-testid="status-export"></div>
          <section>
            <h2>Before submitting</h2>
            <ul class="checklist">${requirements.map((item) => `<li>${item}</li>`).join("")}</ul>
          </section>
          <div class="notice"><strong>Confirm first:</strong><span>The packet names Alliant Property Management for fees, but also says Coastal Association Services receives information. Ask management for the current submission address, payment method, fee amounts, and current Sales & Rental Guidelines before sending Social Security numbers or ID copies.</span></div>
        </div>
        <div class="card-actions">
          <button class="button secondary" id="backButton" data-testid="button-edit">Edit answers</button>
          <a class="button secondary" href="/river-garden-application.pdf" download data-testid="link-blank-packet">Blank HOA packet</a>
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
}

function drawValue(page, font, value, x, y, size = 8, maxWidth = 220) {
  const text = safe(value);
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
    drawWrapped(p3, font, state.emergency1, 95, 718, 455, 8, 2);
    drawWrapped(p3, font, state.emergency2, 95, 662, 455, 8, 2);
    markYesNo(p3, font, state.hasPets, 177, 274, 586);
    drawWrapped(p3, font, state.petDetails, 210, 565, 335, 8, 3);
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
    drawValue(p4, font, state.vehicle1, 104, 713, 8, 445);
    drawValue(p4, font, state.vehicle2, 104, 656, 8, 445);
    drawWrapped(p4, font, state.nearestRelative, 69, 548, 480, 7.5, 4);
    drawWrapped(p4, font, state.workRef1, 69, 403, 480, 7.5, 4);
    drawWrapped(p4, font, state.workRef2, 69, 287, 480, 7.5, 4);
    drawWrapped(p4, font, state.personalRef1, 69, 144, 480, 7.5, 3);

    const p5 = pages[4];
    drawWrapped(p5, font, state.personalRef2, 69, 731, 480, 7.5, 4);
    drawWrapped(p5, font, state.currentResidence, 140, 515, 408, 7.5, 3);
    drawWrapped(p5, font, state.currentLandlord, 160, 429, 388, 7.5, 3);
    drawWrapped(p5, font, state.priorResidence, 140, 341, 408, 7.5, 3);
    drawWrapped(p5, font, state.priorLandlord, 170, 253, 378, 7.5, 3);

    const p6 = pages[5];
    drawValue(p6, font, state.employmentStatus, 180, 718, 8, 160);
    drawWrapped(p6, font, state.employer, 150, 665, 395, 7.5, 5);
    drawValue(p6, font, state.spouseEmploymentStatus, 330, 560, 8, 200);
    drawWrapped(p6, font, state.spouseEmployer, 190, 532, 355, 7.5, 5);
    drawWrapped(p6, font, state.priorEmployer, 145, 364, 400, 7.5, 4);
    drawWrapped(p6, font, state.spousePriorEmployer, 175, 246, 370, 7.5, 4);
    drawWrapped(p6, font, state.bankReference, 155, 102, 390, 7.5, 3);

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
  app.innerHTML = `<div class="shell">${header()}
    <main id="main" class="layout" style="grid-template-columns:minmax(0,760px);justify-content:center">
      <section class="main-card" aria-labelledby="pageTitle">
        <div class="card-head">
          <div class="eyebrow">Recommendation letter</div>
          <h1 id="pageTitle">Help ${escapeHtml(applicant || "this applicant")} without starting from scratch</h1>
          <p>Answer four short prompts. A polished letter will download for you to sign and return to the applicant.</p>
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
            <span></span><button class="button primary" type="submit" data-testid="button-download-letter">Download recommendation</button>
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
    await downloadRecommendation(values, applicant, unit);
  });
}

async function downloadRecommendation(values, applicant, unit) {
  const status = document.querySelector("#status");
  status.textContent = "Preparing the recommendation letter…";
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Letter of Recommendation for ${applicant}`);
  pdf.setAuthor(values.recommenderName);
  const page = pdf.addPage([612, 792]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.07, 0.2, 0.18);
  page.drawText("LETTER OF RECOMMENDATION", { x: 54, y: 722, size: 16, font: bold, color: ink });
  page.drawText("River Garden Inc., A Condominium", { x: 54, y: 697, size: 10, font: regular, color: ink });
  page.drawText(new Date().toLocaleDateString(), { x: 480, y: 722, size: 9, font: regular, color: ink });
  const paragraphs = [
    `To the River Garden Board of Directors:`,
    `I am pleased to recommend ${applicant || "the applicant"} in connection with the application to lease ${unit || "a unit at River Garden Condominiums"}.`,
    `I have known ${applicant || "the applicant"} for ${values.knownYears} as ${values.relationship}.`,
    values.qualities,
    values.confidence || `Based on my experience, I believe ${applicant || "the applicant"} would be a responsible and respectful resident who will care for the property and community.`,
    `I recommend ${applicant || "the applicant"} without reservation. Please contact me if additional information would be helpful.`
  ];
  let y = 648;
  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(/\s+/);
    let line = "";
    const lines = [];
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (regular.widthOfTextAtSize(next, 11) < 500) line = next;
      else { lines.push(line); line = word; }
    });
    if (line) lines.push(line);
    lines.forEach((entry) => {
      page.drawText(entry, { x: 54, y, size: 11, font: regular, color: rgb(0.12, 0.14, 0.13) });
      y -= 17;
    });
    y -= 13;
  });
  page.drawText("Sincerely,", { x: 54, y: Math.max(y - 4, 150), size: 11, font: regular, color: ink });
  const sigY = Math.max(y - 65, 95);
  page.drawLine({ start: { x: 54, y: sigY }, end: { x: 300, y: sigY }, thickness: 0.7, color: ink });
  page.drawText(values.recommenderName, { x: 54, y: sigY - 18, size: 10, font: bold, color: ink });
  page.drawText(values.recommenderContact, { x: 54, y: sigY - 34, size: 9, font: regular, color: ink });
  const bytes = await pdf.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Recommendation-${(applicant || "Applicant").replace(/[^a-z0-9]+/gi, "-")}.pdf`;
  link.click();
  URL.revokeObjectURL(link.href);
  status.textContent = "Letter downloaded. Please review, sign, and return it to the applicant.";
}

if (new URLSearchParams(location.search).get("recommend") === "1") renderRecommender();
else renderStep();
