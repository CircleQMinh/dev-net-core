import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  loadContentRouteData,
  resolveCurriculumContentPath,
} from "./loadContentRouteData.mjs";

const manifestPath = fileURLToPath(
  new URL("./curriculumSeoManifest.generated.json", import.meta.url)
);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const firstEntry = manifest.entries[0];

test("loads welcome Markdown without a topic id", () => {
  const routeData = loadContentRouteData();

  assert.equal(routeData.kind, "welcome");
  assert.match(routeData.markdown, /# Welcome/);
});

test("loads topic Markdown and serializable metadata", () => {
  const routeData = loadContentRouteData(firstEntry.id);

  assert.equal(routeData.kind, "topic");
  assert.equal(routeData.topic.id, firstEntry.id);
  assert.equal(routeData.topic.canonicalPath, firstEntry.canonicalPath);
  assert.match(routeData.markdown, /## Overview/);
});

test("returns not-found data for unknown or invalid topic ids", () => {
  assert.deepEqual(loadContentRouteData("missing-topic"), {
    kind: "not-found",
    topicId: "missing-topic",
  });
  assert.deepEqual(loadContentRouteData("../outside"), {
    kind: "not-found",
    topicId: "../outside",
  });
});

test("rejects content paths outside the curriculum root", () => {
  assert.throws(
    () => resolveCurriculumContentPath("src/contents/resources/welcome.md"),
    /under/
  );
  assert.throws(
    () => resolveCurriculumContentPath("../../package.json"),
    /under/
  );
});
