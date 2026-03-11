export function renderDocsPage(input: {
  title: string;
  specUrl: string;
}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${input.title}</title>
    <script
      type="module"
      src="https://unpkg.com/rapidoc/dist/rapidoc-min.js"
    ></script>
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #f4f2ea;
      }
    </style>
  </head>
  <body>
    <rapi-doc
      spec-url="${input.specUrl}"
      theme="light"
      render-style="read"
      show-header="false"
      allow-authentication="true"
      allow-server-selection="false"
      use-path-in-nav-bar="true"
    ></rapi-doc>
  </body>
</html>`;
}
