# JSON Carousel Generator

Paste carousel JSON, preview TikTok/Reels-style 9:16 slides, and render PNGs through MarkupGo.

## Run locally

```bash
npm start
```

Open `http://localhost:3000`.

PNG rendering requires:

```bash
MARKUPGO_API_KEY=your_key_here
```

On Windows PowerShell:

```powershell
$env:MARKUPGO_API_KEY="your_key_here"
npm start
```

## Deploy to Railway

Deploy this `carousel-generator` folder as a Node.js app.

Set this Railway Variable:

```text
MARKUPGO_API_KEY=your_key_here
```

Railway will run:

```bash
npm start
```

The app reads Railway's `PORT` environment variable and binds to `0.0.0.0`. A health check is available at `/health`.

## JSON shape

```json
{
  "handle": "@your_account",
  "background": "background.jpg",
  "slides": [
    {
      "kicker": "就活の話",
      "swipe": true,
      "background": "optional-slide-background.jpg",
      "blocks": [
        { "text": "就活で一番危ないのは、" },
        { "text": "答えを間違えることじゃない。", "em": true },
        { "text": "正解を当てにいって、\n自分の話が消えること。" }
      ]
    }
  ]
}
```

Uploaded slide backgrounds override the common uploaded background. Uploaded backgrounds are embedded as data URLs before sending HTML to MarkupGo, so MarkupGo does not need access to local files.

## PNG rendering

- `Render current PNG` renders the selected slide.
- `Render all PNGs` renders all slides sequentially.
- Generated images appear as preview cards.
- `Download PNG ZIP` downloads all rendered PNGs as `carousel-images.zip`.
