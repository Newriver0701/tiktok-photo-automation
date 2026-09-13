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
  "background": "background.jpg",
  "slides": [
    {
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

## Prompt for ChatGPT

Copy this into ChatGPT when you want it to create the JSON text:

```text
あなたはTikTok/Instagramリール用の縦型カルーセル投稿の構成作家です。

以下のテーマから、読みやすく刺さるカルーセル投稿の文章を作り、指定JSON形式だけで出力してください。

テーマ：
ここにテーマを書く

出力ルール：
- JSONだけを返してください。
- Markdown、コードフェンス、説明文、前置き、後書きは禁止です。
- slidesは8枚にしてください。
- 1枚あたりblocksは2〜4個にしてください。
- 1ブロックは短く、スマホで読みやすい長さにしてください。
- 強調したい1ブロックだけ em: true を付けてもOKです。
- 改行したい場合は text 内に \n を入れてください。
- handle、kicker、counter、ページ番号は入れないでください。
- backgroundは "background.jpg" にしてください。
- 1枚目だけ swipe: true を付けてください。
- 文章は自然な日本語にしてください。
- 説教っぽくしすぎず、共感→気づき→具体→まとめの流れにしてください。

必ずこのJSON形式で返してください：
{
  "background": "background.jpg",
  "slides": [
    {
      "swipe": true,
      "blocks": [
        { "text": "1枚目の文章" },
        { "text": "強調したい文章", "em": true },
        { "text": "改行したい場合は\nこう書く" }
      ]
    },
    {
      "blocks": [
        { "text": "2枚目の文章" },
        { "text": "2枚目の文章" }
      ]
    }
  ]
}
```
