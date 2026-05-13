# Video Generation Frontend

Single-page frontend for the Modal video generation API.

## Local preview

Open `index.html` directly in a browser, or run a static server:

```bash
python3 -m http.server 5173
```

Then visit:

```text
http://localhost:5173
```

## API contract

The page calls:

```text
POST /v2/generate
GET /status/{job_id}
```

Default endpoint:

```text
https://kathy-q-gogh--ltx-worker-api.modal.run
```

The browser sends the same payload as the Python example, including:

```json
{
  "prompt": "A serene mountain lake at golden hour, camera slowly panning right",
  "duration": 10,
  "height": 720,
  "width": 1280,
  "fps": 25,
  "seed": 42,
  "image_base64": "...",
  "verbose": false
}
```

## CORS

Because this is a browser app, the API must allow CORS for the frontend domain.
For local testing, allow:

```text
http://localhost:5173
```

For production, allow your deployed Vercel or Netlify domain.

## Deploy

### Vercel

Import this folder as a static project.

Settings:

```text
Framework Preset: Other
Build Command: empty
Output Directory: .
```

### Netlify

Drag the project folder into Netlify, or connect the repo.

Settings:

```text
Build command: empty
Publish directory: .
```

## Professional frontend checklist

This version follows the same product pattern used by stronger AI video sites:

- Strong first viewport: brand, outcome-focused headline, and visible media examples.
- Showcase before form: users see output quality before they are asked to upload.
- Prompt templates: example cards and pills fill the prompt field in one click.
- Developer trust: status, job logs, duration, dimensions, FPS, seed, and API flow stay visible.
- Static deployment: no build step is required, so iteration and deployment remain fast.

Next upgrades worth adding:

- Replace external demo media with your own generated clips and reference images.
- Add a backend proxy if the Modal API later needs private auth headers.
- Add a small gallery from completed jobs so users can compare outputs.
- Add presets for aspect ratio, duration, motion type, and quality.
