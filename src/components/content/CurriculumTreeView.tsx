import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../lib/redux/hooks/hooks";
import { selectContentProgress } from "../../lib/redux/selectors/contentSelectors";
import {
  getContentSubTopicProgressPercentage,
  setContentProgress,
  type ContentProgressState,
} from "../../lib/redux/slices/contentSlice";
import { categoryOrder, topicOrder } from "./curriculumOrder";

type MarkdownLoader = () => Promise<string>;

type CurriculumFrontmatter = {
  id?: string;
  topic?: string;
  subtopic?: string;
  category?: string;
};

export type CurriculumSubTopicNode = {
  type: "subtopic";
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

export type CurriculumTopicNode = {
  type: "topic";
  id: string;
  title: string;
  path: string;
  children: CurriculumTreeNode[];
  progress: number;
  completed: boolean;
};

export type CurriculumTreeNode = CurriculumTopicNode | CurriculumSubTopicNode;

type CurriculumTreeViewProps = {
  nodes?: CurriculumTreeNode[];
  activeTopicId?: string;
  initialActiveTopicId?: string;
  onTopicSelect?: (topic: CurriculumSubTopicNode) => void;
};

type MutableTopicNode = CurriculumTopicNode & {
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
  const roots: MutableTopicNode[] = [];
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
          (node): node is MutableTopicNode =>
            node.type === "topic" && node.path === folderPath
        );

        if (existingFolder) {
          currentChildren = existingFolder.children;
          return;
        }

        const folderNode: MutableTopicNode = {
          type: "topic",
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
        type: "subtopic",
        id: topicId,
        title: subtopicTitle,
        topic: topicTitle,
        subtopic: subtopicTitle,
        category,
        path: topicPath,
        contentPath,
        loadContentSync: () => markdown,
        loadContent: async () => markdown,
        progress: 0,
        completed: false,
      });
    });

  return applyTopicProgress(sortNodes(roots));
}

function getOrCreateFolder(
  nodes: CurriculumTreeNode[],
  path: string,
  title: string
): MutableTopicNode {
  const existingFolder = nodes.find(
    (node): node is MutableTopicNode =>
      node.type === "topic" && node.path === path
  );

  if (existingFolder) {
    return existingFolder;
  }

  const folderNode: MutableTopicNode = {
    type: "topic",
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

function sortNodes(
  nodes: CurriculumTreeNode[],
  categoryTitle?: string
): CurriculumTreeNode[] {
  return [...nodes]
    .map((node) =>
      node.type === "topic"
        ? {
            ...node,
            children: sortNodes(node.children, categoryTitle ?? node.title),
          }
        : node
    )
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === "topic" ? -1 : 1;
      }

      const orderedComparison = compareConfiguredOrder(
        getNodeOrder(left, categoryTitle),
        getNodeOrder(right, categoryTitle)
      );

      if (orderedComparison !== 0) {
        return orderedComparison;
      }

      return left.title.localeCompare(right.title);
    });
}

function getNodeOrder(node: CurriculumTreeNode, categoryTitle?: string) {
  if (!categoryTitle) {
    return categoryOrder[node.title];
  }

  const categoryTopicOrder = topicOrder[categoryTitle];

  if (!categoryTopicOrder) {
    return undefined;
  }

  return node.type === "topic"
    ? categoryTopicOrder[node.title]
    : categoryTopicOrder[node.topic];
}

function compareConfiguredOrder(
  leftOrder: number | undefined,
  rightOrder: number | undefined
) {
  const leftHasOrder = typeof leftOrder === "number";
  const rightHasOrder = typeof rightOrder === "number";

  if (leftHasOrder && rightHasOrder) {
    return leftOrder - rightOrder;
  }

  if (leftHasOrder) {
    return -1;
  }

  if (rightHasOrder) {
    return 1;
  }

  return 0;
}

function applyTopicProgress(nodes: CurriculumTreeNode[]): CurriculumTreeNode[] {
  return nodes.map((node) => {
    if (node.type === "subtopic") {
      return node;
    }

    const children = applyTopicProgress(node.children);
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

function applyProgressFromState(
  nodes: CurriculumTreeNode[],
  progressState: ContentProgressState
): CurriculumTreeNode[] {
  return nodes.map((node) => {
    if (node.type === "subtopic") {
      const progress = getSubTopicProgressFromState(progressState, node);

      return {
        ...node,
        progress,
        completed: progress === 100,
      };
    }

    const children = applyProgressFromState(node.children, progressState);
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

function getSubTopicProgressFromState(
  progressState: ContentProgressState,
  subtopic: CurriculumSubTopicNode
) {
  return getContentSubTopicProgressPercentage(
    progressState[subtopic.category]?.[subtopic.topic]?.[subtopic.subtopic]
  );
}

function getTreeProgress(nodes: CurriculumTreeNode[]) {
  if (nodes.length === 0) {
    return 0;
  }

  return Math.round(
    nodes.reduce((total, node) => total + node.progress, 0) / nodes.length
  );
}

export function collectSubTopicNodes(
  nodes: CurriculumTreeNode[]
): CurriculumSubTopicNode[] {
  return nodes.flatMap((node) =>
    node.type === "subtopic" ? [node] : collectSubTopicNodes(node.children)
  );
}

function getAncestorTopicIds(
  nodes: CurriculumTreeNode[],
  subtopicId: string,
  ancestors: string[] = []
): string[] {
  for (const node of nodes) {
    if (node.type === "subtopic") {
      if (node.id === subtopicId || node.path === subtopicId) {
        return ancestors;
      }

      continue;
    }

    const result = getAncestorTopicIds(node.children, subtopicId, [
      ...ancestors,
      node.id,
    ]);

    if (result.length > 0) {
      return result;
    }
  }

  return [];
}

function getAncestorTopicIdsForTopic(
  nodes: CurriculumTreeNode[],
  topicId: string,
  ancestors: string[] = []
): string[] {
  for (const node of nodes) {
    if (node.type === "subtopic") {
      continue;
    }

    if (node.id === topicId) {
      return ancestors;
    }

    const result = getAncestorTopicIdsForTopic(node.children, topicId, [
      ...ancestors,
      node.id,
    ]);

    if (result.length > 0) {
      return result;
    }
  }

  return [];
}

function findInitialSubTopicId(
  nodes: CurriculumTreeNode[],
  requestedSubTopicId?: string
) {
  const subtopics = collectSubTopicNodes(nodes);

  if (requestedSubTopicId) {
    const matchingSubTopic = subtopics.find(
      (subtopic) =>
        subtopic.id === requestedSubTopicId ||
        subtopic.path === requestedSubTopicId ||
        subtopic.id.endsWith(`/${requestedSubTopicId}`) ||
        subtopic.path.endsWith(`/${requestedSubTopicId}`)
    );

    if (matchingSubTopic) {
      return matchingSubTopic.id;
    }
  }

  const dependencyInjectionSubTopic = subtopics.find((subtopic) =>
    subtopic.path.endsWith("dependency-injection-and-ioc")
  );

  return dependencyInjectionSubTopic?.id ?? subtopics[0]?.id ?? "";
}

export function getFirstCurriculumSubTopic() {
  return collectSubTopicNodes(generatedCurriculumTree)[0];
}

export function findCurriculumSubTopicById(subtopicId: string) {
  return collectSubTopicNodes(generatedCurriculumTree).find(
    (subtopic) => subtopic.id === subtopicId
  );
}

export function getCurriculumSubTopicNavigation(subtopicId: string) {
  const subtopics = collectSubTopicNodes(generatedCurriculumTree);
  const subtopicIndex = subtopics.findIndex(
    (subtopic) => subtopic.id === subtopicId
  );

  if (subtopicIndex === -1) {
    return {
      previousSubTopic: undefined,
      nextSubTopic: undefined,
    };
  }

  return {
    previousSubTopic: subtopics[subtopicIndex - 1],
    nextSubTopic: subtopics[subtopicIndex + 1],
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
  const dispatch = useAppDispatch();
  const progressState = useAppSelector(selectContentProgress);
  const progressNodes = useMemo(
    () => applyProgressFromState(nodes, progressState),
    [nodes, progressState]
  );
  const totalProgress = getTreeProgress(progressNodes);
  const initialTopicId = useMemo(
    () =>
      findInitialSubTopicId(
        progressNodes,
        activeTopicId ?? initialActiveTopicId
      ),
    [activeTopicId, initialActiveTopicId, progressNodes]
  );
  const [internalActiveTopicId, setInternalActiveTopicId] =
    useState(initialTopicId);
  const selectedTopicId = activeTopicId ?? internalActiveTopicId;
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    () => new Set(getAncestorTopicIds(progressNodes, initialTopicId))
  );

  useEffect(() => {
    setExpandedFolderIds(
      new Set(getAncestorTopicIds(progressNodes, selectedTopicId))
    );
  }, [progressNodes, selectedTopicId]);

  const toggleFolder = (folder: CurriculumTopicNode) => {
    setExpandedFolderIds((current) => {
      const ancestorFolderIds = getAncestorTopicIdsForTopic(
        progressNodes,
        folder.id
      );

      if (current.has(folder.id)) {
        return new Set(ancestorFolderIds);
      }

      return new Set([...ancestorFolderIds, folder.id]);
    });
  };

  const selectTopic = (topic: CurriculumSubTopicNode) => {
    setInternalActiveTopicId(topic.id);
    onTopicSelect?.(topic);
  };

  const resetTotalProgress = () => {
    dispatch(setContentProgress({}));
  };

  return (
    <div className="border-b theme-ide-divider p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="gleeple-heading text-[10px] font-semibold uppercase tracking-[0.18em] theme-subtle">
          Total Progress: {totalProgress}%
        </h2>
        <button
          aria-label="Reset curriculum progress"
          className="theme-ide-hover flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm theme-subtle transition-colors hover:text-[var(--color-on-surface)]"
          onClick={resetTotalProgress}
          title="Reset curriculum progress"
          type="button"
        >
          <RestartAltOutlinedIcon sx={{ fontSize: 16 }} />
        </button>
      </div>

      <div className="space-y-1">
        {progressNodes.map((node) => (
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
  onSelectTopic: (topic: CurriculumSubTopicNode) => void;
  onToggleFolder: (folder: CurriculumTopicNode) => void;
};

function TreeNodeRow({
  node,
  depth,
  activeTopicId,
  expandedFolderIds,
  onSelectTopic,
  onToggleFolder,
}: TreeNodeRowProps) {
  if (node.type === "subtopic") {
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
        <span className="flex min-w-0 flex-1 items-start gap-1.5">
          <InsertDriveFileOutlinedIcon
            className={`mt-0.5 shrink-0 ${
              isActive ? "theme-accent" : "theme-muted"
            }`}
            sx={{ fontSize: 15 }}
          />
          <span className="gleeple-code min-w-0 flex-1 whitespace-normal break-words text-sm font-medium leading-5">
            {node.title}
          </span>
        </span>

        {node.completed ? (
          <CheckCircleOutlineIcon
            className="shrink-0 text-emerald-400"
            sx={{ fontSize: 14 }}
          />
        ) :  <span
        className={`gleeple-heading text-[10px] font-semibold ${
          node.completed ? "text-emerald-400" : "theme-subtle"
        }`}
      >
        {node.progress}%
      </span>}
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
