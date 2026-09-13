# JSON Carousel Generator

Open `generator.html` in a browser, paste carousel JSON, and generate TikTok/Reels-style 9:16 slide HTML.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Deploy to Railway

Deploy this `carousel-generator` folder as a Node.js app.

Railway will run:

```bash
npm start
```

The app reads Railway's `PORT` environment variable and binds to `0.0.0.0`, so no extra port setting is needed. A health check is available at `/health`.

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

`slide.background` overrides the root `background`. If no background is set, the generated HTML uses a built-in fallback background.

## PNG export

1. Use `generator.html` to download the ZIP.
2. Extract `slide_XX.html` files into `carousel-generator/generated/`.
3. Put referenced background images in the same folder.
4. Run:

```bash
npm install
npm run export:png
```

If Playwright says Chromium is missing, run:

```bash
npx playwright install chromium
```

PNGs are written to `carousel-generator/png/` at 1080 x 1920.
