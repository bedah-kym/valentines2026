# Valentines 2026 - Architecture Document

> **Purpose:** This document ensures any AI or developer can understand and continue this project consistently.

## Overview

A romantic proposal web app where users pick a persona, write messages, share a link, and recipients experience an interactive reveal.

**Stack:** Node.js + Express + SQLite + EJS + HTMX + Vanilla CSS

**Target:** Oracle Cloud Free Tier (1GB RAM, 1 OCPU)

---

## Directory Structure

```
valentines2026/
├── public/
│   ├── css/
│   │   └── style.css           # Global styles + animations
│   └── js/
│       └── app.js              # Minimal JS, HTMX loaded via CDN
├── views/
│   ├── layout.ejs              # Base HTML template
│   ├── index.ejs               # Landing page (persona picker)
│   ├── create/
│   │   ├── fortune.ejs         # Fortune Cookie creation form
│   │   ├── achievement.ejs     # Achievement creation form
│   │   └── letter.ejs          # Vintage Letter creation form
│   ├── view/
│   │   ├── fortune.ejs         # Fortune Cookie recipient view
│   │   ├── achievement.ejs     # Achievement recipient view
│   │   └── letter.ejs          # Vintage Letter recipient view
│   └── partials/
│       ├── header.ejs
│       └── footer.ejs
├── db/
│   └── database.sqlite         # SQLite database file
├── server.js                   # Express entry point
├── db.js                       # Database setup and queries
├── routes/
│   ├── pages.js                # Page routes (GET)
│   └── api.js                  # API routes (POST)
├── package.json
├── .env.example
├── ARCHITECTURE.md             # This file
└── PROGRESS.md                 # Development log
```

---

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unique_id TEXT UNIQUE NOT NULL,
  persona TEXT NOT NULL CHECK(persona IN ('fortune', 'achievement', 'letter')),
  sender_name TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  content TEXT NOT NULL,  -- JSON string
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  viewed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_unique_id ON proposals(unique_id);
```

**Content JSON Examples:**

```json
// Fortune Cookie
{
  "messages": ["You light up my day", "Your smile is magic", ...],
  "finalProposal": "Will you be my Valentine?"
}

// Achievement
{
  "achievements": [
    {"title": "First Date Hero", "desc": "Survived awkward silence", "tier": "bronze"},
    ...
  ],
  "finalProposal": "Will you be my Valentine?"
}

// Letter
{
  "letter": "My dearest...",
  "sealColor": "red",
  "signature": "Forever yours"
}
```

---

## Routes

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/` | `pages.home` | Landing page with persona picker |
| GET | `/create/:persona` | `pages.createForm` | Creation form for persona |
| POST | `/api/create` | `api.create` | Create proposal, return unique_id |
| GET | `/v/:id` | `pages.view` | Recipient experience |
| POST | `/api/respond/:id` | `api.respond` | Accept/Reject proposal |
| GET | `/success/:id` | `pages.success` | Shows status to creator |

---

## Personas

### 1. Fortune Cookie 🥠
- **Create:** 5-8 text inputs for messages + final proposal
- **View:** Animated cookies on a plate. Click to crack, message unfurls. Golden cookie at end.

### 2. Achievement Unlocked 🏆
- **Create:** 5-10 achievements (title + description + tier dropdown)
- **View:** Xbox-style notifications slide in. XP bar fills. Legendary unlock at end.

### 3. Vintage Love Letter 💌
- **Create:** Textarea for letter body + seal color picker + signature
- **View:** Envelope with wax seal. Click to break, letter unfolds, text animates.

---

## Design System

### Colors
```css
--burgundy: #722F37;
--rose-gold: #B76E79;
--soft-pink: #FFE4E1;
--cream: #FFF8F0;
--gold: #D4AF37;
--dark: #1a1a1a;
```

### Fonts
- **Headings:** Playfair Display (serif, romantic)
- **Body:** Inter (clean, readable)
- **Letter:** Dancing Script (handwriting)

### Animations
- CSS keyframes only (no Canvas)
- `@keyframes float` - Floating hearts
- `@keyframes crack` - Cookie crack
- `@keyframes slideIn` - Achievement notification
- `@keyframes unseal` - Wax seal break
- `@keyframes unfold` - Letter unfold
- `@keyframes confetti` - Celebration

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `server.js` | Express app setup, middleware, route mounting |
| `db.js` | SQLite connection, query helpers |
| `routes/pages.js` | All GET routes rendering EJS |
| `routes/api.js` | All POST routes returning JSON |
| `public/css/style.css` | All styles, CSS variables, animations |
| `public/js/app.js` | Minimal JS for interactions not handled by HTMX |

---

## Conventions

1. **IDs:** Use `nanoid(10)` for unique_id generation
2. **Validation:** Server-side only (no complex client validation)
3. **Error Handling:** Try-catch in routes, render error page
4. **Security:** Sanitize all user input before storing/rendering
5. **Mobile First:** Design for 375px width first

---

## Deployment

```bash
# Install
npm install --production

# Run
node server.js
# OR with PM2
pm2 start server.js --name valentine

# Environment
cp .env.example .env
# Edit PORT if needed (default 3000)
```

---

## AI Handoff Checklist

When picking up this project:
1. Read `ARCHITECTURE.md` (this file)
2. Read `PROGRESS.md` for current status
3. Check `task.md` in brain folder for checklist
4. Continue from last logged step
5. Log your work in `PROGRESS.md` before ending
