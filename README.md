# River Garden Apply

A privacy-first, static web application that guides prospective tenants through the River Garden Inc. lease application and writes their answers onto the original 13-page PDF.

## What it does

- Breaks the application into six manageable steps.
- Keeps all personal information in browser memory only.
- Generates a completed copy of the HOA packet locally in the browser.
- Creates prefilled email and text requests for recommenders.
- Gives recommenders a short form that generates a finished recommendation letter.
- Shows the required attachments, fees, signatures, and timing before submission.

## Privacy model

There is no database, account, analytics script, or application server. Answers are not saved or transmitted. Closing or refreshing the tab clears them. Applicants should store and transmit downloaded PDFs securely because the application contains sensitive personal information.

## Local development

```bash
npm install
npm run dev
```

## GitHub Pages

The included GitHub Actions workflow builds and deploys the site after a push to `main`. In the repository settings, select **GitHub Actions** as the Pages source.

## Important

This is a convenience tool based on the River Garden Inc. lease application dated September 2023. It is not an official HOA portal or legal advice. Confirm current fees, payment methods, submission instructions, management contact, and Sales & Rental Guidelines before collecting applications.
