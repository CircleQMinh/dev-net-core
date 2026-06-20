import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  findCurriculumSubTopicById,
  getFirstCurriculumSubTopic,
  getMarkdownBody,
  type CurriculumSubTopicNode,
} from "../components/content/CurriculumTreeView";
import { LeftContentPanel } from "../components/content/LeftContentPanel";
import { MainContent } from "../components/content/MainContent";
import { RightContentPanel } from "../components/content/RightContentPanel";
import { removeCommonInterviewQuestionsSection } from "../components/content/markdown";
import welcomeMarkdown from "../contents/resources/welcome.md?raw";
import { useAppDispatch, useAppSelector } from "../lib/redux/hooks/hooks";
import { selectSelectedContentTopicId } from "../lib/redux/selectors/contentSelectors";
import { setSelectedTopicId } from "../lib/redux/slices/contentSlice";

const welcomeContent = getMarkdownBody(welcomeMarkdown);

type LoadedContentState = {
  error: string;
  markdown: string;
  topicId?: string;
};

export default function Content() {
  const { topicId } = useParams<{ topicId?: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const selectedTopicId = useAppSelector(selectSelectedContentTopicId);
  const isWelcomeContent = !topicId;
  const firstTopic = getFirstCurriculumSubTopic();
  const selectedTopic = topicId ? findCurriculumSubTopicById(topicId) : undefined;
  const routeSelectedTopicId = selectedTopic?.id;
  const [loadedContent, setLoadedContent] = useState<LoadedContentState>({
    error: "",
    markdown: "",
  });
  const selectedContent =
    selectedTopic && loadedContent.topicId === selectedTopic.id
      ? loadedContent
      : undefined;

  useEffect(() => {
    if (isWelcomeContent) {
      if (selectedTopicId !== undefined) {
        dispatch(setSelectedTopicId(undefined));
      }

      return;
    }

    if (routeSelectedTopicId && selectedTopicId !== routeSelectedTopicId) {
      dispatch(setSelectedTopicId(routeSelectedTopicId));
    }
  }, [
    dispatch,
    isWelcomeContent,
    routeSelectedTopicId,
    selectedTopicId,
  ]);

  useEffect(() => {
    let isCancelled = false;

    if (!selectedTopic) {
      return;
    }

    selectedTopic
      .loadContent()
      .then((markdown) => {
        if (!isCancelled) {
          setLoadedContent({
            error: "",
            markdown,
            topicId: selectedTopic.id,
          });
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setLoadedContent({
            error: "Unable to load this topic.",
            markdown: "",
            topicId: selectedTopic.id,
          });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedTopic]);

  const selectTopic = (topic: CurriculumSubTopicNode) => {
    if (selectedTopicId !== topic.id) {
      dispatch(setSelectedTopicId(topic.id));
    }

    navigate(`/content/${topic.id}/`);
  };

  if (isWelcomeContent) {
    return (
      <ContentLayout
        isWelcomeContent
        markdown={welcomeContent}
        onTopicSelect={selectTopic}
        selectedTopic={undefined}
      />
    );
  }

  if (!firstTopic) {
    return (
      <ContentLayout
        isWelcomeContent={false}
        markdown=""
        onTopicSelect={() => undefined}
        selectedTopic={undefined}
      />
    );
  }

  if (!selectedTopic) {
    return <Navigate replace to={`/content/${firstTopic.id}/`} />;
  }

  return (
    <ContentLayout
      isWelcomeContent={false}
      markdown={
        selectedContent?.error ||
        (selectedContent?.markdown
          ? getMarkdownBody(selectedContent.markdown)
          : "Loading content...")
      }
      onTopicSelect={selectTopic}
      selectedTopic={selectedTopic}
    />
  );
}

type ContentLayoutProps = {
  isWelcomeContent: boolean;
  markdown: string;
  selectedTopic?: CurriculumSubTopicNode;
  onTopicSelect: (topic: CurriculumSubTopicNode) => void;
};

function ContentLayout({
  isWelcomeContent,
  markdown,
  selectedTopic,
  onTopicSelect,
}: ContentLayoutProps) {
  const navigationMarkdown = removeCommonInterviewQuestionsSection(markdown);
  const showInterviewPractice =
    !isWelcomeContent && (selectedTopic?.questionCount ?? 0) > 0;

  return (
    <div className="theme-page mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[1440px] pt-[80px]">
      <LeftContentPanel
        activeTopicId={selectedTopic?.id}
        isWelcomeContent={isWelcomeContent}
        onTopicSelect={onTopicSelect}
      />
      <MainContent markdown={markdown} topic={selectedTopic} />
      <RightContentPanel
        markdown={navigationMarkdown}
        showInterviewPractice={showInterviewPractice}
        topic={selectedTopic}
      />
    </div>
  );
}
