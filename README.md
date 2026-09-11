# Chromium PDF Renderer for n8n

Vercel serverless endpoint that converts trusted HTML/CSS to an A4 PDF with Chromium.

## Deploy
1. Create a GitHub repository and upload these files.
2. Import it into Vercel.
3. Deploy with Node.js defaults.
4. The endpoint will be:
   `https://YOUR-DOMAIN.vercel.app/api/render`

POST JSON:
`{"html":"<!doctype html>...</html>","filename":"product.pdf"}`

Response: `application/pdf`.

## n8n
HTTP Request:
- POST
- URL: `https://YOUR-DOMAIN.vercel.app/api/render`
- Send Body: on
- Content Type: JSON
- JSON Body:
`={{ JSON.stringify({ html: $json.fullHtml, filename: $json.filename }) }}`
- Response Format: File
- Output Property Name: `data`

For public production use, add API authentication before exposing the endpoint to arbitrary users.
