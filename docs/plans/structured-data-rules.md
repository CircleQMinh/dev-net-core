# DEV_NET_CORE Structured Data Rules

This note defines the rules DEV_NET_CORE must follow when implementing and
validating structured data. It is the implementation guardrail for Task 8 of
the SEO improvement plan.

## Purpose

Structured data should help search engines understand content that is already
visible on the page. It must not introduce claims, entities, dates, authorship,
ratings, or other facts that the page does not support.

Valid structured data can make a page eligible for enhanced search features,
but it does not guarantee that Google will display a rich result.

## General Rules

- Use JSON-LD.
- Structured data must accurately represent the main visible page content.
- Put structured data only on the page that it describes.
- Use the most specific Google-supported schema type that accurately describes
  the page.
- Do not mark up hidden, irrelevant, misleading, or incomplete information.
- Do not invent author, publisher, publication date, modification date, rating,
  review, FAQ, organization, or ownership information.
- Do not emit properties with empty, `null`, or `undefined` values.
- Do not emit structured data on invalid, Not Found, or `noindex` routes.
- Do not block an indexable structured-data page through `robots.txt`.
- Treat successful validation as a correctness check, not a promise of a rich
  result.

## Approved Initial Types

### Homepage

Use one `WebSite` object on `/`.

Initial properties:

- `@context`
- `@type`
- `name`
- `url`
- `description`

The URL must be the canonical production URL:

```txt
https://www.dev-net-core.com/
```

Do not add an `Organization`, publisher, owner, or alternate site name until
the corresponding identity is explicitly defined and supported by visible
site content.

### Content Topics

Use one `Article` object on each valid `/content/:topicId/` page because these
routes contain the long-form educational content for a curriculum topic.

Initial properties:

- `@context`
- `@type`
- `headline`
- `description`
- `url`

Build these values from the same Markdown frontmatter, generated manifest, and
shared metadata builder used for title, description, and canonical metadata.
The Article URL must exactly match the page's canonical trailing-slash URL.

Omit these properties until their values are verified and visible:

- `author`
- `publisher`
- `datePublished`
- `dateModified`
- `image`

The default Open Graph image is a site-wide branding fallback. Do not use it as
an Article image unless it is determined to be genuinely representative of the
specific article. A future topic-specific image must be crawlable, indexable,
and relevant to the marked-up content.

## Deferred Types

Do not add the following types during the initial implementation:

- `FAQPage`
- `QAPage`
- `Course`
- `HowTo`
- `Review`
- `AggregateRating`
- `Person`
- `Organization`
- `BreadcrumbList`

These types require a separate content and eligibility review. The presence of
interview questions in Markdown does not by itself justify FAQ, Q&A, rating, or
review markup.

## Ownership and Consistency

Structured data must follow the existing metadata source-of-truth chain:

```txt
Markdown frontmatter
  -> generated curriculum/SEO manifest
  -> shared SEO metadata builder
  -> pre-rendered source HTML
  -> React route metadata
```

The shared metadata builder should produce the JSON-LD data. The SEO postbuild
pipeline must inject it into pre-rendered source HTML. The React SEO component
may mirror the same object after hydration, but it must not maintain a separate
hardcoded version.

Differences between pre-rendered JSON-LD and hydrated JSON-LD are bugs.

## Validation Checklist

Before deployment:

- Parse every generated JSON-LD block as JSON.
- Confirm each page contains only the intended structured-data objects.
- Confirm every structured-data value matches visible page content.
- Confirm each URL is absolute, canonical, and uses the trailing-slash format.
- Confirm invalid and `noindex` pages have no structured data.
- Confirm pre-rendered sitemap routes contain JSON-LD in source HTML.
- Run representative pages through Google's Rich Results Test.
- Run representative JSON-LD through Schema.org's Schema Markup Validator.
- Remove or defer any property that cannot be verified.

Representative validation routes:

```txt
/
/content/async-and-await-semantics-in-csharp/
/content/not-a-real-topic/
/practice/async-and-await-semantics-in-csharp/
```

## References

- [Google: General structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Google: Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Google: Rich Results Test](https://search.google.com/test/rich-results)
- [Schema.org: Article](https://schema.org/Article)
- [Schema.org: WebSite](https://schema.org/WebSite)
- [Schema.org: Schema Markup Validator](https://validator.schema.org/)
