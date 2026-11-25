# UST35 · Campus Memories

A 3D map of the HKUST Clear Water Bay campus with a read-only gallery of campus memories, built for the university's 35th anniversary. Served as a static site on GitHub Pages.

## Updating memories (administrators)

1. Add the photo to `public/memories/` (JPG, PNG or WebP).
2. Add an entry to `public/data/memories.json`:
   ```json
   { "id": "unique-id", "title": "Sundial Piazza", "story": "…", "date": "2024-09-01",
     "point": { "x": 0, "y": 0, "z": 0, "name": "Sundial Piazza" }, "photo": "memories/your-photo.jpg" }
   ```
   `point` is a Three.js world coordinate on the model (copy one from an existing entry near the same spot).
3. Commit to `main`. The GitHub Actions workflow rebuilds and redeploys the site.

To hide a memory, delete its entry from `memories.json`; Git history keeps the old version.

## Development

```bash
npm install
npm run dev       # local dev server
npm run build     # typecheck + static build into dist/
```

The 3D campus is a concept-level procedural reconstruction, not a survey model.
