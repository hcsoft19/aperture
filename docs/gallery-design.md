# Clinic collection

The staff home shows a private, organization-scoped results collection. It loads 12 items at a time using a stable created-at/UUID cursor. A visible Load more button works alongside optional continuous scrolling. Details open in an accessible native dialog without discarding filters, loaded cards, or scroll position; a dedicated result URL is also available.

Classification belongs to the treatment: category, procedure/type, product/drug, body area, and photography protocol. Patient gender is optional, explicitly recorded, and never inferred from a photograph. Upload-date filters use the storage upload timestamp, distinct from session capture dates. Filters run on the server, and facet choices are clinic-scoped.

Dental and body protocols are versioned database records. A treatment chooses a protocol for new sessions; existing sessions retain their stored protocol. Original photographs remain immutable. Thumbnails are private, non-cacheable derivatives.

## Hosted demonstration collection

14 licensed reference cases use 16 Wikimedia Commons original images, alongside the existing synthetic clinical comparison. They cover dental care, surgical and nonsurgical nose procedures, facelift, and body contouring. Sources and licenses are recorded in `gallery-image-sources.json` and shown in result details. Product names appear only where the source identifies them. Demographic fields remain unrecorded. Demo dates are illustrative, not source treatment dates.

Reference cases live in a separate staff-only table and private storage paths, outside patient charts and patient sharing. Composite source plates remain intact. These examples must not be presented as this clinic's work. Image bytes are not committed. RLS and application authorization both enforce clinic access.

## Completed sessions before comparisons

Completed treatments with uploaded photographs now appear in Home even without a saved comparison. One latest-session preview represents a treatment until comparison entries exist. The treatment and completed-session pages display every uploaded view, and staff photo previews use a private clinic-scoped endpoint. Releasing a session controls patient access, not staff photo visibility.

Capture defaults to follow-up when a baseline exists, and treatment pages link to an existing follow-up draft. Completing a follow-up creates private, unaligned comparisons for matching baseline views, preferring the baseline explicitly selected during capture. Existing comparisons and their sharing state are preserved. No after image is invented for a baseline-only case. The transaction-scoped regression test is `tests/database/completed-session-gallery.sql`.
