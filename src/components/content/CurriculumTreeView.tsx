import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import { useEffect, useMemo, useState } from "react";

type MarkdownLoader = () => Promise<string>;

type CurriculumFrontmatter = {
  id?: string;
  topic?: string;
  subtopic?: string;
  category?: string;
};

export type CurriculumTopicNode = {
  type: "topic";
  id: string;
  title: string;
  topic: string;
  subtopic: string;
  category: string;
  path: string;
  contentPath: string;
  loadContentSync: () => string;
  loadContent: MarkdownLoader;
  progress: number;
  completed: boolean;
};

export type CurriculumFolderNode = {
  type: "folder";
  id: string;
  title: string;
  path: string;
  children: CurriculumTreeNode[];
  progress: number;
  completed: boolean;
};

export type CurriculumTreeNode = CurriculumFolderNode | CurriculumTopicNode;

type CurriculumTreeViewProps = {
  nodes?: CurriculumTreeNode[];
  activeTopicId?: string;
  initialActiveTopicId?: string;
  onTopicSelect?: (topic: CurriculumTopicNode) => void;
};

type MutableFolderNode = CurriculumFolderNode & {
  children: CurriculumTreeNode[];
};

const V1_CONTENT_ROOT = "/src/contents/v1/";

const markdownModules = import.meta.glob<string>("/src/contents/v1/**/*.md", {
  import: "default",
  query: "?raw",
  eager: true,
});

const specialLabels: Record<string, string> = {
  api: "API",
  aspnet: "ASP.NET",
  cqrs: "CQRS",
  csharp: "C#",
  ddd: "DDD",
  di: "DI",
  dns: "DNS",
  dotnet: ".NET",
  ef: "EF",
  grpc: "gRPC",
  id: "ID",
  ioc: "IoC", 
  iqueryable: "IQueryable",
  jwt: "JWT",
  linq: "LINQ",
  md: "MD",
  mvc: "MVC",
  net: ".NET",
  nhibernate: "NHibernate",
  oop: "OOP",
  sql: "SQL",
  tpl: "TPL",
  tempdata: "TempData",
  viewbag: "ViewBag",
  viewdata: "ViewData",
  viewmodel: "ViewModel",
  vs: "vs",
  webapi: "WebAPI",
};

function buildCurriculumTree(
  modules: Record<string, string>
): CurriculumTreeNode[] {
  const roots: MutableFolderNode[] = [];
  const usedTopicIds = new Set<string>();

  Object.entries(modules)
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([contentPath, markdown]) => {
      const relativePath = contentPath.replace(V1_CONTENT_ROOT, "");
      const segments = relativePath.split("/");
      const markdownFileName = segments.at(-1);

      if (!markdownFileName) {
        return;
      }

      let currentChildren: CurriculumTreeNode[] = roots;
      const folderPathSegments: string[] = [];

      segments.slice(0, -1).forEach((folderSegment) => {
        folderPathSegments.push(folderSegment);
        const folderPath = folderPathSegments.join("/");
        const existingFolder = currentChildren.find(
          (node): node is MutableFolderNode =>
            node.type === "folder" && node.path === folderPath
        );

        if (existingFolder) {
          currentChildren = existingFolder.children;
          return;
        }

        const folderNode: MutableFolderNode = {
          type: "folder",
          id: toNodeId(folderPath),
          title: formatSegmentLabel(folderSegment),
          path: folderPath,
          children: [],
          progress: 0,
          completed: false,
        };

        currentChildren.push(folderNode);
        currentChildren = folderNode.children;
      });

      const topicPath = relativePath.replace(/\.md$/i, "");
      const parentFolderName = segments.at(-2) ?? "v1";
      const frontmatter = parseMarkdownFrontmatter(markdown);
      const category =
        frontmatter.category?.trim() || formatSegmentLabel(parentFolderName);
      const topicTitle =
        frontmatter.topic?.trim() || formatSegmentLabel(parentFolderName);
      const subtopicTitle =
        frontmatter.subtopic?.trim() ||
        frontmatter.topic?.trim() ||
        formatSegmentLabel(markdownFileName.replace(/\.md$/i, ""));
      const fallbackId = slugify(topicPath);
      const topicId = getUniqueTopicId(
        frontmatter.id?.trim() || fallbackId,
        fallbackId,
        usedTopicIds,
        contentPath
      );
      const progress = getPlaceholderTopicProgress(topicPath);
      const physicalFolderPath = folderPathSegments.join("/");
      const topicFolderPath = [physicalFolderPath, slugify(topicTitle)]
        .filter(Boolean)
        .join("/");
      const topicFolder = getOrCreateFolder(
        currentChildren,
        topicFolderPath,
        topicTitle
      );

      topicFolder.children.push({
        type: "topic",
        id: topicId,
        title: subtopicTitle,
        topic: topicTitle,
        subtopic: subtopicTitle,
        category,
        path: topicPath,
        contentPath,
        loadContentSync: () => markdown,
        loadContent: async () => markdown,
        progress,
        completed: progress === 100,
      });
    });

  return applyFolderProgress(sortNodes(roots));
}

function getOrCreateFolder(
  nodes: CurriculumTreeNode[],
  path: string,
  title: string
): MutableFolderNode {
  const existingFolder = nodes.find(
    (node): node is MutableFolderNode =>
      node.type === "folder" && node.path === path
  );

  if (existingFolder) {
    return existingFolder;
  }

  const folderNode: MutableFolderNode = {
    type: "folder",
    id: toNodeId(path),
    title,
    path,
    children: [],
    progress: 0,
    completed: false,
  };

  nodes.push(folderNode);

  return folderNode;
}

function sortNodes(nodes: CurriculumTreeNode[]): CurriculumTreeNode[] {
  return [...nodes]
    .map((node) =>
      node.type === "folder"
        ? { ...node, children: sortNodes(node.children) }
        : node
    )
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === "folder" ? -1 : 1;
      }

      return left.title.localeCompare(right.title);
    });
}

function applyFolderProgress(nodes: CurriculumTreeNode[]): CurriculumTreeNode[] {
  return nodes.map((node) => {
    if (node.type === "topic") {
      return node;
    }

    const children = applyFolderProgress(node.children);
    const progress =
      children.length === 0
        ? 0
        : Math.round(
            children.reduce((total, child) => total + child.progress, 0) /
              children.length
          );

    return {
      ...node,
      children,
      progress,
      completed: children.length > 0 && children.every((child) => child.completed),
    };
  });
}

export function collectTopicNodes(
  nodes: CurriculumTreeNode[]
): CurriculumTopicNode[] {
  return nodes.flatMap((node) =>
    node.type === "topic" ? [node] : collectTopicNodes(node.children)
  );
}

function getAncestorFolderIds(
  nodes: CurriculumTreeNode[],
  topicId: string,
  ancestors: string[] = []
): string[] {
  for (const node of nodes) {
    if (node.type === "topic") {
      if (node.id === topicId || node.path === topicId) {
        return ancestors;
      }

      continue;
    }

    const result = getAncestorFolderIds(node.children, topicId, [
      ...ancestors,
      node.id,
    ]);

    if (result.length > 0) {
      return result;
    }
  }

  return [];
}

function getAncestorFolderIdsForFolder(
  nodes: CurriculumTreeNode[],
  folderId: string,
  ancestors: string[] = []
): string[] {
  for (const node of nodes) {
    if (node.type === "topic") {
      continue;
    }

    if (node.id === folderId) {
      return ancestors;
    }

    const result = getAncestorFolderIdsForFolder(node.children, folderId, [
      ...ancestors,
      node.id,
    ]);

    if (result.length > 0) {
      return result;
    }
  }

  return [];
}

function findInitialTopicId(
  nodes: CurriculumTreeNode[],
  requestedTopicId?: string
) {
  const topics = collectTopicNodes(nodes);

  if (requestedTopicId) {
    const matchingTopic = topics.find(
      (topic) =>
        topic.id === requestedTopicId ||
        topic.path === requestedTopicId ||
        topic.id.endsWith(`/${requestedTopicId}`) ||
        topic.path.endsWith(`/${requestedTopicId}`)
    );

    if (matchingTopic) {
      return matchingTopic.id;
    }
  }

  const dependencyInjectionTopic = topics.find((topic) =>
    topic.path.endsWith("dependency-injection-and-ioc")
  );

  return dependencyInjectionTopic?.id ?? topics[0]?.id ?? "";
}

export function getFirstCurriculumTopic() {
  return collectTopicNodes(generatedCurriculumTree)[0];
}

export function findCurriculumTopicById(topicId: string) {
  return collectTopicNodes(generatedCurriculumTree).find(
    (topic) => topic.id === topicId
  );
}

export function getCurriculumTopicNavigation(topicId: string) {
  const topics = collectTopicNodes(generatedCurriculumTree);
  const topicIndex = topics.findIndex((topic) => topic.id === topicId);

  if (topicIndex === -1) {
    return {
      previousTopic: undefined,
      nextTopic: undefined,
    };
  }

  return {
    previousTopic: topics[topicIndex - 1],
    nextTopic: topics[topicIndex + 1],
  };
}

export function getMarkdownBody(markdown: string) {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\s*/, "").trim();
}

function parseMarkdownFrontmatter(markdown: string): CurriculumFrontmatter {
  const frontmatterMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const frontmatterBody = frontmatterMatch?.[1];

  if (!frontmatterBody) {
    return {};
  }

  return frontmatterBody.split(/\r?\n/).reduce<CurriculumFrontmatter>(
    (frontmatter, line) => {
      const separatorIndex = line.indexOf(":");

      if (separatorIndex === -1) {
        return frontmatter;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim());

      if (
        key === "id" ||
        key === "topic" ||
        key === "subtopic" ||
        key === "category"
      ) {
        frontmatter[key] = value;
      }

      return frontmatter;
    },
    {}
  );
}

function getUniqueTopicId(
  requestedId: string,
  fallbackId: string,
  usedTopicIds: Set<string>,
  contentPath: string
) {
  if (!usedTopicIds.has(requestedId)) {
    usedTopicIds.add(requestedId);
    return requestedId;
  }

  let duplicateIndex = 2;
  let uniqueId = `${requestedId}--${fallbackId}`;

  while (usedTopicIds.has(uniqueId)) {
    uniqueId = `${requestedId}--${fallbackId}-${duplicateIndex}`;
    duplicateIndex += 1;
  }

  usedTopicIds.add(uniqueId);
  console.warn(
    `Duplicate curriculum topic id "${requestedId}" found in v1 content. ` +
      `Using "${uniqueId}" for ${contentPath}.`
  );

  return uniqueId;
}

function getPlaceholderTopicProgress(path: string) {
  const hash = hashString(path);

  if (hash % 7 === 0) {
    return 100;
  }

  return 18 + (hash % 70);
}

function hashString(value: string) {
  return value.split("").reduce((hash, character) => {
    return (hash * 31 + character.charCodeAt(0)) % 1009;
  }, 17);
}

function toNodeId(path: string) {
  return path
    .replace(/\\/g, "/")
    .replace(/\.md$/i, "")
    .toLowerCase();
}

function slugify(value: string) {
  return (
    value
      .replace(/\\/g, "/")
      .replace(/\.md$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "topic"
  );
}

function formatSegmentLabel(segment: string) {
  return segment
    .replace(/\.md$/i, "")
    .replace(/([a-z])(\d)/gi, "$1 $2")
    .split(/[-_\s.]+/)
    .filter(Boolean)
    .map((word) => {
      const lowerWord = word.toLowerCase();

      if (specialLabels[lowerWord]) {
        return specialLabels[lowerWord];
      }

      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

function stripWrappingQuotes(value: string) {
  const firstCharacter = value.at(0);
  const lastCharacter = value.at(-1);

  if (
    value.length >= 2 &&
    ((firstCharacter === `"` && lastCharacter === `"`) ||
      (firstCharacter === "'" && lastCharacter === "'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export const generatedCurriculumTree = buildCurriculumTree(markdownModules);

export function CurriculumTreeView({
  nodes = generatedCurriculumTree,
  activeTopicId,
  initialActiveTopicId,
  onTopicSelect,
}: CurriculumTreeViewProps) {
  const initialTopicId = useMemo(
    () => findInitialTopicId(nodes, activeTopicId ?? initialActiveTopicId),
    [activeTopicId, initialActiveTopicId, nodes]
  );
  const [internalActiveTopicId, setInternalActiveTopicId] =
    useState(initialTopicId);
  const selectedTopicId = activeTopicId ?? internalActiveTopicId;
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    () => new Set(getAncestorFolderIds(nodes, initialTopicId))
  );

  useEffect(() => {
    setExpandedFolderIds(new Set(getAncestorFolderIds(nodes, selectedTopicId)));
  }, [nodes, selectedTopicId]);

  const toggleFolder = (folder: CurriculumFolderNode) => {
    setExpandedFolderIds((current) => {
      const ancestorFolderIds = getAncestorFolderIdsForFolder(nodes, folder.id);

      if (current.has(folder.id)) {
        return new Set(ancestorFolderIds);
      }

      return new Set([...ancestorFolderIds, folder.id]);
    });
  };

  const selectTopic = (topic: CurriculumTopicNode) => {
    setInternalActiveTopicId(topic.id);
    onTopicSelect?.(topic);
  };

  return (
    <div className="border-b theme-ide-divider p-4">
      <h2 className="gleeple-heading mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] theme-subtle">
        Curriculum
      </h2>

      <div className="space-y-1">
        {nodes.map((node) => (
          <TreeNodeRow
            activeTopicId={selectedTopicId}
            depth={0}
            expandedFolderIds={expandedFolderIds}
            key={node.id}
            node={node}
            onSelectTopic={selectTopic}
            onToggleFolder={toggleFolder}
          />
        ))}
      </div>
    </div>
  );
}

type TreeNodeRowProps = {
  node: CurriculumTreeNode;
  depth: number;
  activeTopicId: string;
  expandedFolderIds: Set<string>;
  onSelectTopic: (topic: CurriculumTopicNode) => void;
  onToggleFolder: (folder: CurriculumFolderNode) => void;
};

function TreeNodeRow({
  node,
  depth,
  activeTopicId,
  expandedFolderIds,
  onSelectTopic,
  onToggleFolder,
}: TreeNodeRowProps) {
  if (node.type === "topic") {
    const isActive = activeTopicId === node.id;

    return (
      <button
        className={`flex w-full cursor-pointer items-start justify-between gap-2 border-r-2 py-1 pr-2 text-left transition-colors ${
          isActive
            ? "theme-ide-active"
            : "border-transparent theme-muted theme-ide-hover"
        }`}
        onClick={() => onSelectTopic(node)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        title={node.contentPath}
        type="button"
      >
        <span className="gleeple-code min-w-0 flex-1 whitespace-normal break-words text-sm font-medium leading-5">
          {node.title}
        </span>

        {node.completed ? (
          <CheckCircleOutlineIcon
            className="shrink-0 text-emerald-400"
            sx={{ fontSize: 14 }}
          />
        ) : null}
      </button>
    );
  }

  const isExpanded = expandedFolderIds.has(node.id);
  const FolderIcon = isExpanded ? FolderOpenOutlinedIcon : FolderOutlinedIcon;
  const ToggleIcon = isExpanded ? ExpandMoreIcon : ChevronRightIcon;

  return (
    <div>
      <button
        aria-expanded={isExpanded}
        className="theme-ide-hover flex w-full cursor-pointer items-start justify-between gap-2 rounded-sm py-1 pr-2 text-left transition-colors"
        onClick={() => onToggleFolder(node)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        type="button"
      >
        <span className="flex min-w-0 flex-1 items-start gap-1.5">
          <ToggleIcon
            className="mt-0.5 shrink-0 theme-muted"
            sx={{ fontSize: 16 }}
          />
          <FolderIcon
            className={
              isExpanded
                ? "mt-0.5 shrink-0 theme-accent"
                : "mt-0.5 shrink-0 theme-muted"
            }
            sx={{ fontSize: 16 }}
          />
          <span className="gleeple-code min-w-0 flex-1 whitespace-normal break-words text-sm leading-5 theme-text">
            {node.title}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1 pt-0.5">
          <span
            className={`gleeple-heading text-[10px] font-semibold ${
              node.completed ? "text-emerald-400" : "theme-subtle"
            }`}
          >
            {node.progress}%
          </span>
          {node.completed ? (
            <CheckCircleOutlineIcon
              className="text-emerald-400"
              sx={{ fontSize: 12 }}
            />
          ) : null}
        </span>
      </button>

      {isExpanded ? (
        <div className="border-l theme-ide-divider">
          {node.children.map((child) => (
            <TreeNodeRow
              activeTopicId={activeTopicId}
              depth={depth + 1}
              expandedFolderIds={expandedFolderIds}
              key={child.id}
              node={child}
              onSelectTopic={onSelectTopic}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
