---
id: cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security
topic: Web application security threat modeling and attack patterns
subtopic: Cross-Site Scripting, output encoding, dangerous HTML rendering, and content security controls
category: Design & Architecture
---

## Overview

Cross-Site Scripting (XSS) occurs when untrusted data reaches a browser execution context and is interpreted as active HTML, JavaScript, CSS, or a dangerous URL rather than inert text.

An XSS payload runs with the privileges of the affected application's origin. It can:

- Read data visible to the user.
- Perform actions as the user.
- Modify page content.
- Capture form input.
- Access browser storage available to JavaScript.
- Send data to an attacker-controlled endpoint.
- Abuse trusted API calls.

The primary defenses are:

- Use framework rendering that escapes text by default.
- Apply output encoding for the exact browser context.
- Avoid unsafe rendering sinks.
- Sanitize untrusted HTML when rich markup is genuinely required.
- Validate URL protocols and destinations.
- Deploy a strong Content Security Policy (CSP) as defense in depth.
- Consider Trusted Types to constrain DOM injection sinks.

React normally escapes values rendered through JSX:

```tsx
function Comment({ text }: { text: string }) {
  return <p>{text}</p>;
}
```

If `text` contains `<script>`, React renders it as text rather than markup.

React also exposes an explicit escape hatch:

```tsx
<div dangerouslySetInnerHTML={{ __html: content }} />
```

Passing untrusted or unsanitized content to this API can create XSS.

This topic matters in interviews because candidates must reason about data sources, browser contexts, framework guarantees, dangerous sinks, rich-text requirements, and layered controls. Saying "escape user input" is incomplete because the correct defense depends on where the value is inserted.

## Core Concepts

### Sources and Sinks

A **source** supplies data that may be attacker-controlled:

- URL query and fragment values.
- Form fields.
- API responses.
- Database content.
- WebSocket messages.
- `postMessage` data.
- Third-party scripts.
- Markdown or rich-text content.
- Imported files.

A **sink** interprets data in a browser-sensitive way:

- `innerHTML`.
- `outerHTML`.
- `insertAdjacentHTML`.
- `document.write`.
- `eval`.
- `new Function`.
- String arguments to `setTimeout`.
- React `dangerouslySetInnerHTML`.
- Dynamic script URLs.
- Inline event-handler attributes.

XSS occurs when untrusted data reaches an unsafe sink without the correct handling.

### Stored XSS

Stored XSS persists attacker-controlled content and serves it to other users.

Example flow:

```text
Attacker submits profile biography.
Application stores raw HTML.
Administrator opens user profile.
Page injects biography with innerHTML.
Attacker code runs in administrator origin.
```

Stored XSS is especially dangerous because:

- It can affect many users.
- It may target privileged users.
- The database makes the content appear trusted.
- Payloads can remain active for a long time.

Stored data is not automatically safe.

### Reflected XSS

Reflected XSS places request input directly into the response:

```text
/search?q=<attacker-input>
```

If the server renders `q` into HTML without context-correct encoding, a crafted link can execute script when the victim opens it.

Modern single-page applications can also reflect URL data through client rendering.

### DOM-Based XSS

DOM XSS occurs primarily in browser-side code:

```javascript
const message = location.hash.slice(1);
document.querySelector("#message").innerHTML = message;
```

The server response can be static and still vulnerable.

Safe alternative:

```javascript
const message = location.hash.slice(1);
document.querySelector("#message").textContent = message;
```

Client-side routing, URL fragments, `postMessage`, and third-party widgets are common sources.

### Mutation and Client-Side Template XSS

Browser parsing can transform unusual markup into an executable structure. Regex-based HTML filtering may inspect one form while the browser constructs another.

Use a maintained parser-based sanitizer rather than attempting to remove dangerous tags with regular expressions.

### Output Encoding

Output encoding converts characters that have special meaning in one context into a representation treated as data.

HTML text:

```text
< becomes &lt;
> becomes &gt;
& becomes &amp;
```

If input is:

```html
<img src=x onerror=alert(1)>
```

HTML text encoding displays the literal text instead of creating an element.

Encoding should occur near the output sink because the destination context determines the required encoding.

### HTML Text Context

Safe server-rendered template systems normally encode values:

```cshtml
<p>@Model.DisplayName</p>
```

Razor encodes the value for HTML text.

Avoid bypass helpers:

```cshtml
@Html.Raw(Model.DisplayName)
```

unless the value is trusted sanitized HTML intended for rendering.

### HTML Attribute Context

Place untrusted values only inside quoted attribute values and let the framework encode them:

```tsx
<input value={displayName} readOnly />
```

Avoid dynamic attribute names:

```html
<div [ATTACKER-CONTROLLED-NAME]="value">
```

Some attributes are dangerous regardless of ordinary encoding:

- `onclick`.
- `onerror`.
- `onload`.
- `style` in unsafe construction.
- `srcdoc`.

Do not build event-handler code from strings.

### JavaScript Context

Do not insert untrusted data directly into executable script:

```html
<script>
  const name = '[UNTRUSTED]';
</script>
```

HTML encoding is not JavaScript-string encoding.

Prefer serializing data as JSON and loading it through a non-executable channel:

```html
<script type="application/json" id="page-data">
  {"displayName":"..."}
</script>
```

Then parse the text. Ensure the server serializer safely handles characters that could terminate the script element, or deliver the data through an API.

In React, pass values as props and state rather than generating JavaScript source.

### CSS Context

Avoid placing untrusted values into raw CSS:

```html
<style>
  .profile { background: [UNTRUSTED]; }
</style>
```

Use typed style properties with allowlisted values:

```tsx
const color = allowedColors.has(requestedColor)
  ? requestedColor
  : "black";

return <span style={{ color }}>Name</span>;
```

CSS can trigger network requests, conceal UI, or create browser-specific injection risks. Keep user control narrow.

### URL Context

HTML attribute encoding alone does not make a URL safe.

Dangerous:

```tsx
<a href={userProvidedUrl}>Visit</a>
```

React escapes the attribute text, but the URL can still use a dangerous or unwanted scheme.

Validate protocol and destination:

```ts
function toSafeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value, window.location.origin);

    if (url.protocol !== "https:" &&
        url.protocol !== "http:") {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}
```

For redirects and external links, consider an allowlist of origins.

Avoid:

- `javascript:`.
- Unexpected `data:` URLs.
- User-controlled script sources.
- Protocol-relative URLs when policy requires HTTPS.

### Dangerous Contexts

Some contexts should not receive untrusted strings even after ordinary encoding:

- Directly inside `<script>`.
- Directly inside `<style>`.
- HTML comments.
- Tag or attribute names.
- Inline event handlers.
- Code passed to `eval` or `new Function`.
- String-built URLs in CSS.

Redesign the code to avoid the context.

### React's Default Escaping

React escapes text and ordinary attribute values:

```tsx
const payload = `<img src=x onerror="alert(1)">`;

return <div title={payload}>{payload}</div>;
```

The string is not parsed as HTML.

This guarantee applies when using React's normal JSX rendering. It does not protect:

- `dangerouslySetInnerHTML`.
- Direct DOM manipulation.
- Unsafe third-party components.
- Dangerous URL schemes.
- Script generation.
- Compromised dependencies.

### dangerouslySetInnerHTML

React's raw HTML API maps to the browser's HTML parsing behavior:

```tsx
function Article({ html }: { html: string }) {
  return (
    <article
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

Safe use requires that `html` be:

- Fully trusted static content, or
- Sanitized by a maintained HTML sanitizer using an explicit policy.

Do not scatter raw-render calls throughout the codebase. Centralize them behind a reviewed component.

### A Centralized Safe-HTML Component

```tsx
import DOMPurify from "dompurify";
import { useMemo } from "react";

type SafeRichTextProps = {
  untrustedHtml: string;
};

export function SafeRichText({
  untrustedHtml,
}: SafeRichTextProps) {
  const sanitizedHtml = useMemo(
    () => DOMPurify.sanitize(untrustedHtml, {
      USE_PROFILES: { html: true },
    }),
    [untrustedHtml],
  );

  return (
    <div
      dangerouslySetInnerHTML={{
        __html: sanitizedHtml,
      }}
    />
  );
}
```

The actual policy should be narrower than "all HTML" when possible.

Sanitization output must not be modified through unsafe string operations afterward.

### Encoding Versus Sanitization

Use **encoding** when content should display as text:

```text
Input: <strong>Hello</strong>
Display: <strong>Hello</strong>
```

Use **sanitization** when selected HTML formatting should render:

```text
Input: <strong>Hello</strong>
Display: Hello in bold
```

Sanitization parses HTML and removes or rewrites unsafe:

- Elements.
- Attributes.
- URLs.
- Namespaces.
- CSS.

Do not decode sanitized output or concatenate unsanitized fragments afterward.

### Sanitizer Policy

Define what the product actually needs:

```text
Allowed elements:
  p, br, strong, em, ul, ol, li, a

Allowed attributes:
  a[href], a[title]

Allowed protocols:
  https, http
```

Avoid permitting:

- Scriptable elements.
- Inline event handlers.
- `style` unless sanitized with a strong CSS policy.
- `iframe` unless tightly controlled.
- SVG and MathML unless required and tested.
- Arbitrary `data:` URLs.

Patch sanitizer dependencies regularly because browser behavior and bypass techniques evolve.

### Markdown

Markdown is not automatically safe.

A Markdown pipeline may:

- Allow raw HTML.
- Generate unsafe links.
- Use plugins that produce HTML.
- Permit embedded images or iframes.

Safer approaches:

- Disable raw HTML.
- Sanitize generated HTML.
- Validate links and images.
- Allowlist plugins.
- Keep parser and sanitizer updated.
- Test representative malicious inputs.

Do not assume escaping Markdown input before parsing produces safe rendered HTML.

### Rich-Text Editors

Rich-text content can be stored as:

- Sanitized HTML.
- Original HTML plus sanitization on every render.
- A structured document model rendered by controlled components.

A structured model can reduce raw HTML risk:

```json
{
  "type": "paragraph",
  "children": [
    {
      "type": "text",
      "text": "Hello",
      "bold": true
    }
  ]
}
```

Still validate document structure, allowed links, embeds, size, and nesting.

Sanitizing on output can benefit from current sanitizer rules, while sanitizing before storage prevents unsafe content from spreading to other consumers. High-risk systems may do both.

### Safe DOM Sinks

Prefer APIs that treat input as text:

```javascript
element.textContent = untrusted;
input.value = untrusted;
element.setAttribute("data-label", untrusted);
```

`setAttribute` is not safe for every attribute. Attribute names and URL-bearing attributes require policy.

Avoid:

```javascript
element.innerHTML = untrusted;
element.outerHTML = untrusted;
element.insertAdjacentHTML("beforeend", untrusted);
document.write(untrusted);
```

### DOM Construction

Construct elements with typed DOM APIs:

```javascript
const link = document.createElement("a");
link.textContent = label;

const safeUrl = toSafeHttpUrl(destination);
if (safeUrl !== null) {
  link.href = safeUrl;
}
```

This avoids parsing a concatenated HTML string.

### Template Literals Do Not Encode

JavaScript template literals only concatenate:

```javascript
container.innerHTML =
  `<p>${untrustedComment}</p>`;
```

They provide no XSS protection.

The same applies to server-side string interpolation.

### JSON APIs and XSS

JSON responses are not HTML, but they can contribute to XSS when:

- A client inserts fields into an unsafe sink.
- The server returns an incorrect content type.
- JSON is embedded unsafely in an HTML script.
- A callback or JSONP response executes as script.

Use:

```http
Content-Type: application/json
X-Content-Type-Options: nosniff
```

The frontend must still render data safely.

### Content Security Policy

CSP tells the browser which content sources and execution mechanisms are permitted.

A strict nonce-based starting point:

```http
Content-Security-Policy:
  default-src 'none';
  script-src 'nonce-{RANDOM}' 'strict-dynamic';
  object-src 'none';
  base-uri 'none';
  frame-ancestors 'none';
  form-action 'self';
  connect-src 'self' https://api.example.com;
  img-src 'self' data:;
  style-src 'self';
```

Generate a cryptographically random nonce for every response and apply it only to trusted script elements.

CSP is defense in depth. It does not replace safe rendering and sanitization.

### Why unsafe-inline Weakens CSP

```text
script-src 'self' 'unsafe-inline'
```

allows inline scripts and event handlers, removing an important protection against injected markup.

Prefer:

- External scripts.
- Per-response nonces.
- Static script hashes.
- `strict-dynamic` where supported and appropriate.

Avoid `unsafe-eval`, which permits text-to-code mechanisms used by some libraries and attacks.

### CSP Nonces

A nonce must be:

- Random.
- Unpredictable.
- Unique per response.
- Applied only to developer-trusted scripts.

Do not write middleware that automatically adds the nonce to every script tag after rendering. It could bless attacker-injected tags.

HTML responses with per-request nonces need cache behavior that does not reuse a nonce across users or responses.

### Hash-Based CSP

Static inline scripts can use hashes:

```http
Content-Security-Policy:
  script-src 'sha256-BASE64_HASH' 'strict-dynamic';
  object-src 'none';
  base-uri 'none'
```

Any content change, including whitespace, changes the hash. Hashes fit static generated pages; nonces often fit dynamic server rendering.

### CSP Report-Only Deployment

Start with:

```http
Content-Security-Policy-Report-Only: ...
```

Collect and analyze violations before enforcement.

Then:

- Remove unnecessary sources.
- Fix inline scripts.
- Filter noisy reports.
- Deploy an enforced policy.
- Continue testing stricter report-only changes.

Reports are attacker-controlled input and may contain sensitive URLs. Validate, rate-limit, and protect the reporting endpoint.

### Important CSP Directives

- `default-src`: fallback for fetch directives.
- `script-src`: script sources and execution policy.
- `style-src`: stylesheet sources.
- `connect-src`: `fetch`, XHR, WebSocket, and related connections.
- `img-src`: image sources.
- `font-src`: font sources.
- `object-src 'none'`: disables plugin objects.
- `base-uri 'none'`: prevents injected base-URL changes.
- `frame-ancestors`: controls which sites may frame the page.
- `form-action`: controls form destinations.
- `upgrade-insecure-requests`: upgrades HTTP subresource requests.

Directives do not all inherit from `default-src`; understand each directive's fallback behavior.

### Trusted Types

Trusted Types can require selected DOM injection sinks to accept typed trusted values instead of ordinary strings.

Policy concept:

```javascript
const policy = trustedTypes.createPolicy(
  "sanitized-html",
  {
    createHTML: (input) =>
      DOMPurify.sanitize(input),
  },
);

element.innerHTML =
  policy.createHTML(untrustedHtml);
```

Enforcement:

```http
Content-Security-Policy:
  require-trusted-types-for 'script';
  trusted-types sanitized-html
```

Benefits:

- Centralizes raw HTML creation.
- Turns many unsafe assignments into runtime failures.
- Makes dangerous sinks easier to audit.

It is defense in depth and requires browser-support and library-compatibility planning.

### Subresource Integrity

Subresource Integrity (SRI) allows a browser to verify an external script or stylesheet against a cryptographic hash:

```html
<script
  src="https://cdn.example.com/library.js"
  integrity="sha384-..."
  crossorigin="anonymous">
</script>
```

SRI helps if a CDN resource is unexpectedly modified. It does not protect scripts intentionally loaded without an integrity value or compromised first-party code.

### Third-Party Scripts

Third-party JavaScript executes with the page's origin privileges.

Reduce risk by:

- Loading fewer third parties.
- Reviewing ownership and update behavior.
- Using CSP source controls.
- Applying SRI for immutable resources.
- Isolating content in sandboxed iframes.
- Limiting available data.
- Monitoring changes and failures.

Consent tools and tag managers can expand the script supply chain and need the same scrutiny.

### iframe Sandboxing

For untrusted active documents:

```html
<iframe
  sandbox
  src="https://content.example.net/document">
</iframe>
```

Add only required sandbox permissions.

Combining `allow-scripts` and `allow-same-origin` for same-origin content can substantially weaken isolation. Prefer a separate origin for hostile content.

### Cookie Flags

`HttpOnly` prevents JavaScript from directly reading a cookie:

```http
Set-Cookie:
  session=...;
  Secure;
  HttpOnly;
  SameSite=Lax
```

It reduces one consequence of XSS but does not stop attacker script from:

- Calling same-origin APIs.
- Reading page data.
- Capturing keystrokes.
- Modifying transactions.

Cookie flags are not XSS prevention.

### Input Validation

Validation helps enforce:

- Length.
- Character sets.
- Structure.
- Business requirements.

It is not the primary XSS defense. Legitimate names can contain punctuation, and attackers can use many encodings and contexts.

Use validation for expected data, then apply correct output handling at every sink.

### Why Global HTTP Encoding Interceptors Fail

One interceptor cannot choose the correct encoding for:

- HTML text.
- HTML attributes.
- JavaScript strings.
- CSS.
- URLs.
- JSON.

Encoding too early can cause:

- Double encoding.
- Broken display.
- Values decoded before a later unsafe sink.
- A false sense of security.

Prefer framework auto-escaping and sink-specific handling.

### Server-Side Rendering and Hydration

SSR applications embed initial data into HTML. Avoid concatenating raw JSON into script:

```html
<script>
  window.initialState = [UNTRUSTED JSON];
</script>
```

Prefer framework-supported serialization that escapes script-closing sequences, or fetch data separately.

Hydration mismatches and custom serialization deserve security review because data crosses from server output into browser execution.

### postMessage

Treat messages as untrusted:

```javascript
window.addEventListener("message", (event) => {
  if (event.origin !== "https://trusted.example") {
    return;
  }

  const message = parseMessage(event.data);
  output.textContent = message.text;
});
```

Validate:

- `origin`.
- Message schema.
- Expected source window where relevant.

Do not place message data into `innerHTML`.

### Testing XSS Defenses

Test:

- Stored, reflected, and DOM-based sources.
- JSX text rendering.
- Raw HTML components.
- Markdown and rich-text output.
- URLs and redirects.
- Error messages.
- Search-result highlighting.
- Third-party widget inputs.
- CSP enforcement and reporting.
- Trusted Types compatibility.

Use:

- Unit tests for sanitization policy.
- Component tests.
- Browser integration tests.
- Static analysis for dangerous sinks.
- Dependency scanning.
- Dynamic security testing.
- Manual review for complex browser flows.

Do not rely only on a small list of payload strings.

### Reviewing React Code

Search for:

```text
dangerouslySetInnerHTML
innerHTML
outerHTML
insertAdjacentHTML
document.write
eval
new Function
javascript:
srcdoc
```

For every raw HTML sink, identify:

- Data source.
- Sanitization point.
- Sanitizer configuration.
- Whether output is modified afterward.
- CSP and Trusted Types behavior.
- Tests and ownership.

### Common Mistakes

- Encoding input once when it enters the system.
- Using HTML encoding for JavaScript or URL contexts.
- Assuming stored database content is trusted.
- Relying solely on React's default escaping while using raw DOM APIs.
- Passing API or CMS content to `dangerouslySetInnerHTML`.
- Using regex to sanitize HTML.
- Allowing arbitrary URL schemes.
- Trusting Markdown output without configuration and sanitization.
- Modifying HTML after sanitization.
- Using `unsafe-inline` in CSP without understanding the loss of protection.
- Reusing CSP nonces.
- Adding nonces automatically to every script tag.
- Treating CSP as the primary XSS fix.
- Assuming `HttpOnly` prevents XSS.
- Logging CSP reports without treating them as untrusted.
- Allowing outdated sanitizer dependencies.

### Best Practices

- Keep untrusted data in framework-managed text and attribute contexts.
- Prefer `textContent` and DOM construction over HTML parsing.
- Avoid dangerous script, style, comment, and tag-name contexts.
- Centralize and review all raw HTML rendering.
- Sanitize intentional rich HTML with a maintained parser-based library.
- Use a narrow allowlist of elements, attributes, and URL schemes.
- Validate link protocols and external destinations.
- Disable raw HTML in Markdown unless required.
- Deploy a strict nonce- or hash-based CSP.
- Roll out CSP with report-only monitoring before enforcement.
- Consider Trusted Types for large browser applications.
- Minimize and isolate third-party JavaScript.
- Patch frontend frameworks, parsers, and sanitizers.
- Test stored, reflected, and DOM-based flows.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### What is Cross-Site Scripting?

<!-- question:start:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-beginner-q01 -->
<!-- question-id:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

XSS occurs when attacker-controlled data is interpreted as active browser content in a trusted application's origin. The script can read page data, make same-origin requests, capture input, or alter transactions. Common forms are stored, reflected, and DOM-based XSS.

##### Key Points to Mention

- The issue is unsafe data reaching an execution sink.
- Stored XSS persists and affects later viewers.
- DOM XSS can exist without a dynamic server response.
- Context-correct output handling is the primary defense.

<!-- question:end:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-beginner-q01 -->

#### Does React automatically prevent XSS?

<!-- question:start:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-beginner-q02 -->
<!-- question-id:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-beginner-q02 -->
<!-- question-level:beginner -->

##### Expected Answer

React escapes strings rendered as normal JSX children and ordinary attribute values, so markup is treated as text. It does not protect uses of `dangerouslySetInnerHTML`, direct DOM manipulation, unsafe URL schemes, generated JavaScript, vulnerable third-party components, or compromised dependencies. Developers must preserve the framework's safe rendering path.

##### Key Points to Mention

- Normal `{value}` rendering is escaped.
- Raw HTML bypasses that protection.
- Attribute encoding does not validate URL protocols.
- Framework security depends on avoiding escape hatches.

<!-- question:end:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-beginner-q02 -->

#### What is the difference between output encoding and HTML sanitization?

<!-- question:start:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-beginner-q03 -->
<!-- question-id:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-beginner-q03 -->
<!-- question-level:beginner -->

##### Expected Answer

Encoding turns special characters into a representation displayed as text and is appropriate when markup should not render. Sanitization parses intentionally allowed HTML and removes unsafe elements, attributes, URLs, and other content. Use a maintained parser-based sanitizer when users must create rich text.

##### Key Points to Mention

- Encoding depends on output context.
- Sanitization intentionally preserves selected markup.
- Regex is not a reliable HTML sanitizer.
- Do not modify sanitized HTML unsafely afterward.

<!-- question:end:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-beginner-q03 -->

#### What is Content Security Policy?

<!-- question:start:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-beginner-q04 -->
<!-- question-id:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-beginner-q04 -->
<!-- question-level:beginner -->

##### Expected Answer

CSP is an HTTP response policy that restricts which scripts, styles, connections, frames, and other resources a browser may use. A strict policy based on nonces or hashes can make many XSS vulnerabilities harder to exploit. CSP is defense in depth and does not replace escaping, safe sinks, or sanitization.

##### Key Points to Mention

- Deliver CSP through the response header.
- Avoid `unsafe-inline` and `unsafe-eval`.
- Nonces must be random and unique per response.
- Use report-only mode during rollout.

<!-- question:end:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### Why must output encoding match the browser context?

<!-- question:start:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-intermediate-q01 -->
<!-- question-id:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

HTML text, attributes, JavaScript strings, CSS, and URLs have different parsers and metacharacters. HTML encoding a value that is inserted into JavaScript or used as a URL does not necessarily make it safe. Prefer APIs that avoid executable contexts, and otherwise use the encoder and validation appropriate to the exact sink.

##### Key Points to Mention

- Encoding is output-context specific.
- Some contexts should never receive untrusted strings.
- URL schemes require validation in addition to attribute encoding.
- Encode close to the sink to avoid double or incorrect encoding.

<!-- question:end:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-intermediate-q01 -->

#### How would you safely render user-authored rich text in React?

<!-- question:start:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-intermediate-q02 -->
<!-- question-id:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-intermediate-q02 -->
<!-- question-level:intermediate -->

##### Expected Answer

Define a narrow allowed formatting policy and sanitize the HTML with a maintained parser-based sanitizer. Centralize `dangerouslySetInnerHTML` in one reviewed component, pass only sanitizer output, validate URL schemes, avoid modifying the result afterward, and keep the sanitizer patched. Add CSP and potentially Trusted Types as defense in depth.

##### Key Points to Mention

- Raw HTML should be exceptional and centralized.
- Allow only product-required elements and attributes.
- Test stored payloads and sanitizer configuration.
- Markdown output also needs safe configuration.

<!-- question:end:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-intermediate-q02 -->

#### Why does HttpOnly not solve XSS?

<!-- question:start:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-intermediate-q03 -->
<!-- question-id:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-intermediate-q03 -->
<!-- question-level:intermediate -->

##### Expected Answer

`HttpOnly` prevents JavaScript from directly reading a session cookie, reducing cookie theft. An injected script still runs in the trusted origin and can make authenticated API requests, read page data, modify transactions, and capture input. Cookie flags limit some impact but do not prevent script execution.

##### Key Points to Mention

- Browser requests automatically include the cookie.
- XSS can act as the user without stealing the cookie.
- Use `Secure` and `SameSite` for their separate purposes.
- Eliminate unsafe rendering and deploy layered browser controls.

<!-- question:end:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-intermediate-q03 -->

#### How should a team roll out a strict CSP?

<!-- question:start:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-intermediate-q04 -->
<!-- question-id:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-intermediate-q04 -->
<!-- question-level:intermediate -->

##### Expected Answer

Inventory scripts and unsafe inline behavior, refactor inline event handlers and eval-like code, then deploy a nonce- or hash-based policy in `Content-Security-Policy-Report-Only`. Analyze violations, update legitimate dependencies, and move to enforcement gradually. Keep reporting and test policy behavior in real browsers.

##### Key Points to Mention

- Generate a new unpredictable nonce per response.
- Do not automatically nonce every rendered script.
- Set `object-src` and `base-uri` restrictively.
- Treat reports as untrusted, potentially sensitive input.

<!-- question:end:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### How would you review a React application for DOM-based XSS?

<!-- question:start:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-advanced-q01 -->
<!-- question-id:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

Inventory untrusted sources such as URL values, messages, API data, and stored content, then search for unsafe sinks including `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML`, script generation, and dangerous URLs. Trace each source-to-sink path, review sanitizer policy and post-processing, and test in a browser. Also inspect third-party components that accept HTML or render templates.

##### Key Points to Mention

- DOM XSS can occur entirely client-side.
- Static scanning needs data-flow and manual review.
- Safe JSX can become unsafe after direct DOM manipulation.
- Include SSR serialization and hydration paths.

<!-- question:end:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-advanced-q01 -->

#### What problem do Trusted Types solve?

<!-- question:start:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-advanced-q02 -->
<!-- question-id:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-advanced-q02 -->
<!-- question-level:advanced -->

##### Expected Answer

Trusted Types can require dangerous DOM sinks to receive approved typed values instead of arbitrary strings. A small set of reviewed policies creates trusted HTML or script-related values, often after sanitization. This centralizes escape hatches and turns accidental raw assignments into runtime failures. It is defense in depth and must be rolled out with browser and library compatibility in mind.

##### Key Points to Mention

- Enforce it through CSP.
- Keep policy creation narrow.
- A permissive policy defeats the protection.
- It complements rather than replaces safe rendering.

<!-- question:end:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-advanced-q02 -->

#### How should untrusted Markdown or rich content be stored and rendered?

<!-- question:start:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-advanced-q03 -->
<!-- question-id:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-advanced-q03 -->
<!-- question-level:advanced -->

##### Expected Answer

Prefer a structured content model or Markdown configuration that disables raw HTML. Validate document structure and URL schemes, generate HTML through controlled renderers, and sanitize before insertion. Consider retaining the original source and sanitizing on output so current policies apply, while also sanitizing before storage when other consumers might render it unsafely. Version the policy and plan resanitization.

##### Key Points to Mention

- Storage does not establish trust.
- Plugins and custom renderers expand the attack surface.
- Sanitizer updates may require rerendering old content.
- Use a separate sandboxed origin for highly untrusted active content.

<!-- question:end:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-advanced-q03 -->

#### How do CSP, sanitization, framework escaping, and cookie flags work together?

<!-- question:start:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-advanced-q04 -->
<!-- question-id:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-advanced-q04 -->
<!-- question-level:advanced -->

##### Expected Answer

Framework escaping keeps ordinary values inert, context-specific handling protects exceptional sinks, and sanitization permits a controlled subset of rich HTML. CSP restricts what can execute if an injection mistake remains. Cookie flags reduce selected consequences such as direct session-cookie theft. Each layer addresses a different part of the attack and none should be treated as a universal substitute.

##### Key Points to Mention

- Primary prevention happens at the sink.
- CSP is a browser-enforced second layer.
- `HttpOnly` limits impact but injected code can still act as the user.
- Layered controls provide resilience against implementation mistakes.

<!-- question:end:cross-site-scripting-output-encoding-dangerous-html-rendering-and-content-security-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
