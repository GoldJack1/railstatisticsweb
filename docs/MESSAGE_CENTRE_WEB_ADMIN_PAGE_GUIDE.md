# Message Centre Web Admin Page Guide

This guide explains how to build a website page where you can:
- create custom messages (with images),
- send/save them into Firestore (the same data source Android uses),
- and view existing messages in a list/detail format similar to the Android app.

---

## 1) Goal and Scope

You want a web admin page with two main capabilities:

1. **Compose + publish messages**
   - Title, preview, body
   - Optional top image
   - Optional content blocks (text + inline images + captions)
   - Publish to Firestore so Android picks them up automatically

2. **Browse existing messages**
   - List page with status and timestamps
   - Click into full detail
   - Optional edit/archive controls

---

## 2) Recommended Architecture

- **Frontend (website admin page):**
  - React / Next.js / Vue (any framework is fine)
  - Firebase Auth (admin-only sign-in)
  - Firebase Storage upload for images
  - Firestore writes/reads for message docs

- **Backend logic:**
  - Existing Firebase Cloud Function (`sendInAppMessagePush`) already triggers OneSignal push when a message becomes published.
  - Website only needs to write the correct Firestore document fields.

---

## 3) Firestore Data Contract (must match app)

Collection:
- `inAppMessages`

Fields used by Android:
- `title` (string, required)
- `body` (string, required)
- `preview` (string, optional but recommended)
- `topImageUrl` (string, optional)
- `contentBlocks` (array, optional)
- `status` (string: `draft` | `published` | `archived`)
- `segment` (string, use `messaging`)
- `deepLinkTarget` (string, use `message_center`)
- `sendPush` (boolean, usually `true`)
- `deleted` (boolean, usually `false`)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

`contentBlocks` formats:
- Text block:
  - `{ "type": "text", "text": "..." }`
- Image block:
  - `{ "type": "image", "imageUrl": "...", "caption": "..." }`

Important:
- Android parses both `imageUrl` and fallback `url`, but use `imageUrl` consistently.
- Android filters on `status == published` and ignores `deleted == true`.

---

## 4) Website Page Structure

Create one admin route, for example:
- `/admin/messages`

Suggested UI sections:

1. **Message list panel (left/top)**
   - Search by title/preview
   - Filter by status (`draft/published/archived`)
   - Sort by `createdAt` desc

2. **Composer panel (right/bottom)**
   - Inputs: title, preview, body, segment, status, sendPush
   - Top image uploader
   - Dynamic content block builder:
     - Add text block
     - Add image block + caption
     - Reorder/remove blocks

3. **Preview panel**
   - Show how message will appear in app detail style (title, top image, paragraphs/images)

4. **Actions**
   - Save Draft
   - Publish Now
   - Archive

---

## 5) Image Upload Flow

Use Firebase Storage for admin-uploaded images:

1. Admin selects image file.
2. Upload to Storage path, e.g.:
   - `message-centre/{yyyy}/{mm}/{uuid}-{filename}`
3. Get download URL (`https://...`) and store in Firestore field:
   - `topImageUrl` or `contentBlocks[i].imageUrl`

You can also store `gs://` references, but download URLs are easiest for web preview and cross-platform display.

---

## 6) Publish Flow and Push Notifications

Your existing Cloud Function sends push when:
- `status == "published"`
- `segment == "messaging"`
- `sendPush != false`
- `pushSentAt` is not already set

So to publish from web:
- write/update Firestore doc with:
  - `status: "published"`
  - `segment: "messaging"`
  - `sendPush: true`

That is enough to trigger OneSignal fan-out through the existing function.

---

## 7) Web “View Messages” Experience (Android-like)

For web viewing, mimic app behavior:

- **List page:**
  - query messages (include status filters)
  - display card title + preview
  - optional unread simulation for web admins (not required for Android parity)

- **Detail page:**
  - render title + body
  - render top image full-width
  - render content blocks in order
  - support text + image + caption blocks

Suggested route:
- `/admin/messages/[messageId]`

---

## 8) Security (Critical)

Do **not** allow public writes.

Minimum security model:
- Firebase Auth required
- Only users with `admin` custom claim can create/update/archive messages

### Firestore rules (example pattern)

```text
match /inAppMessages/{messageId} {
  allow read: if request.auth != null && request.auth.token.admin == true;
  allow create, update, delete: if request.auth != null && request.auth.token.admin == true;
}
```

### Storage rules (example pattern)

```text
match /message-centre/{allPaths=**} {
  allow read: if request.auth != null && request.auth.token.admin == true;
  allow write: if request.auth != null && request.auth.token.admin == true;
}
```

If you also need non-admin website readers, split paths/rules accordingly.

---

## 9) Validation Rules in Web Form

Enforce before write:
- title required, min length > 0
- body required, min length > 0
- status in allowed enum
- segment default `messaging`
- each text block has non-empty `text`
- each image block has valid URL

Auto-fill if omitted:
- `preview = body.slice(0, 120)`
- `deepLinkTarget = "message_center"`
- `deleted = false`
- timestamps

---

## 10) Suggested Document Write Payload

```json
{
  "title": "Service quality update",
  "preview": "We deployed reliability improvements this evening.",
  "body": "Long-form message body...",
  "topImageUrl": "https://firebasestorage.googleapis.com/...",
  "contentBlocks": [
    { "type": "text", "text": "First paragraph..." },
    {
      "type": "image",
      "imageUrl": "https://firebasestorage.googleapis.com/...",
      "caption": "Optional image caption"
    },
    { "type": "text", "text": "Second paragraph..." }
  ],
  "status": "published",
  "segment": "messaging",
  "deepLinkTarget": "message_center",
  "sendPush": true,
  "deleted": false,
  "createdAt": "<serverTimestamp>",
  "updatedAt": "<serverTimestamp>"
}
```

---

## 11) Edit and Archive Behavior

Recommended admin actions:
- **Edit draft**: update fields, keep `status=draft`
- **Publish**: set `status=published`, `sendPush=true`
- **Archive**: set:
  - `status=archived`
  - `deleted=true`
  - `updatedAt=serverTimestamp`

This aligns with Android filtering logic and existing repository behavior.

---

## 12) QA Checklist

After building the page, verify:

1. Create draft -> appears in admin list, not in Android list.
2. Publish message -> appears in Android Message Centre.
3. Message with top image + inline images -> all render correctly in Android detail page.
4. Push sends when published and segment is `messaging`.
5. Archive message -> hidden from Android list.
6. Unauthorized/non-admin user cannot write.

---

## 13) Nice-to-Have Enhancements

- Scheduled publish (`publishAt`) with Cloud Scheduler/Function
- Preview modes (mobile frame, dark mode)
- Reusable templates/snippets for common announcements
- Character counters and estimated read time
- Audit trail (`createdBy`, `updatedBy`, `changeNotes`)

---

## 14) Implementation Order (Recommended)

1. Set up admin auth + rules
2. Build message list read view
3. Build composer for text-only messages
4. Add image upload + top image
5. Add dynamic content blocks
6. Add publish/archive actions
7. Add preview panel
8. Run end-to-end QA with Android app

