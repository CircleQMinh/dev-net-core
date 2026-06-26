# DEV_NET_CORE

DEV_NET_CORE is a developer-focused interview preparation website built for software engineers who want structured, realistic, and practical technical interview preparation.

Website: https://www.dev-net-core.com/
Repository: https://github.com/CircleQMinh/dev-net-core

The project focuses on helping developers prepare for modern engineering interviews through organized learning content, topic-based practice questions, and simulation-style interview sessions. Instead of relying on random trivia or gamified distractions, DEV_NET_CORE is designed around clear explanations, realistic interview questions, and practical concepts that appear in real-world software engineering work.

## What DEV_NET_CORE Provides

DEV_NET_CORE includes a structured curriculum covering key software engineering areas such as .NET, C#, ASP.NET Core, Entity Framework, API design, authentication and security, SQL, React, TypeScript, Azure, system design, architecture, testing, performance, and production-readiness topics.

The website is organized around three main learning flows:

### Content

The Content section provides topic-based learning material written in Markdown. Each topic is structured to explain the core concepts, practical usage, common mistakes, trade-offs, and interview expectations.

The goal is to help users understand not only what a concept is, but also why it matters in real applications and how to explain it clearly during an interview.

### Practice

The Practice section turns the curriculum content into focused interview question sessions. Questions are grouped by difficulty level, such as Beginner, Intermediate, and Advanced, allowing users to review a topic progressively.

Users can move through questions, reveal expected answers, track completion, and revisit weak areas across the curriculum.

### Simulation

The Simulation section provides a mock interview-style experience. Users can select focus areas, choose a difficulty level, configure the number of questions, answer questions in a session, and review their performance afterward.

This feature is designed to help users practice under a more realistic interview flow, improve answer structure, and identify areas that need more review.

## Project Goals

The main goals of DEV_NET_CORE are:

* Provide a structured roadmap for software engineering interview preparation.
* Help developers prepare for both fundamental and advanced technical questions.
* Focus on practical knowledge used in real engineering teams.
* Support self-paced study through content, practice, and simulation flows.
* Make interview preparation clearer, more organized, and less overwhelming.

## Tech Stack

DEV_NET_CORE is built with:

* React
* TypeScript
* Vite
* React Router
* Redux Toolkit
* Material UI
* Tailwind CSS
* Markdown-based content
* Generated curriculum manifest for organizing topics and questions

## Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build the project:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

The project generates its curriculum manifest before development and production builds, allowing Markdown content to be used as the source for learning topics, practice questions, and simulation questions.
