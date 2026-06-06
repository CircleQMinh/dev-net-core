The purpose of these markers is to make the questions easy for the React app to parse, filter, and extract by difficulty level.

Required structure:

```md
## Common Interview Questions

<!-- interview-questions:start -->

### Beginner

<!-- question-group:start:beginner -->

#### [Question text]

<!-- question:start:[topic-slug]-beginner-q01 -->
<!-- question-id:[topic-slug]-beginner-q01 -->
<!-- question-level:beginner -->

##### Expected Answer

[Detailed expected answer]

##### Key Points to Mention

- [Key point]
- [Key point]
- [Key point]

<!-- question:end:[topic-slug]-beginner-q01 -->

<!-- question-group:end:beginner -->

### Intermediate

<!-- question-group:start:intermediate -->

#### [Question text]

<!-- question:start:[topic-slug]-intermediate-q01 -->
<!-- question-id:[topic-slug]-intermediate-q01 -->
<!-- question-level:intermediate -->

##### Expected Answer

[Detailed expected answer]

##### Key Points to Mention

- [Key point]
- [Key point]
- [Key point]

<!-- question:end:[topic-slug]-intermediate-q01 -->

<!-- question-group:end:intermediate -->

### Advanced

<!-- question-group:start:advanced -->

#### [Question text]

<!-- question:start:[topic-slug]-advanced-q01 -->
<!-- question-id:[topic-slug]-advanced-q01 -->
<!-- question-level:advanced -->

##### Expected Answer

[Detailed expected answer]

##### Key Points to Mention

- [Key point]
- [Key point]
- [Key point]

<!-- question:end:[topic-slug]-advanced-q01 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
```

Rules for the marker style:

1. Always place `<!-- interview-questions:start -->` immediately after the `## Common Interview Questions` heading.
2. Always close the full section with `<!-- interview-questions:end -->`.
3. Group questions under exactly these difficulty headings:

   * `### Beginner`
   * `### Intermediate`
   * `### Advanced`
4. Wrap each difficulty group with matching group markers:

   * `<!-- question-group:start:beginner -->`
   * `<!-- question-group:end:beginner -->`
   * `<!-- question-group:start:intermediate -->`
   * `<!-- question-group:end:intermediate -->`
   * `<!-- question-group:start:advanced -->`
   * `<!-- question-group:end:advanced -->`
5. Each question must use a predictable question ID format:

```md
[topic-slug]-[level]-q[number]
```

Example:

```md
nullable-reference-types-beginner-q01
nullable-reference-types-intermediate-q03
nullable-reference-types-advanced-q02
```

6. Use lowercase kebab-case for topic slugs.
7. Use two-digit question numbers: `q01`, `q02`, `q03`, etc.
8. Restart numbering within each difficulty group.
9. Every question must include:

   * A visible question heading using `####`
   * `<!-- question:start:... -->`
   * `<!-- question-id:... -->`
   * `<!-- question-level:... -->`
   * `##### Expected Answer`
   * `##### Key Points to Mention`
   * `<!-- question:end:... -->`
10. The value in `question:start`, `question-id`, and `question:end` must match exactly.
11. The `question-level` value must be one of:

* `beginner`
* `intermediate`
* `advanced`

12. Do not wrap marker comments in code blocks in the actual markdown file.
13. Do not remove, rename, or reorder the marker format unless explicitly asked.
14. Keep each difficulty group independently extractable by the React app.
15. Do not add extra main sections outside the required markdown structure.
16. Preserve clean markdown formatting so the file is readable both by humans and by the parser.
