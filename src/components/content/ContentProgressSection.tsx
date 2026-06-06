import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import { Button } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../lib/redux/hooks/hooks";
import { selectContentProgress } from "../../lib/redux/selectors/contentSelectors";
import {
  getContentSubTopicProgressPercentage,
  setSubTopicProgress,
} from "../../lib/redux/slices/contentSlice";
import type { CurriculumSubTopicNode } from "./CurriculumTreeView";

type ContentProgressSectionProps = {
  topic?: CurriculumSubTopicNode;
};

export function ContentProgressSection({
  topic,
}: ContentProgressSectionProps) {
  const dispatch = useAppDispatch();
  const progressState = useAppSelector(selectContentProgress);
  const topicProgress = topic
    ? progressState[topic.category]?.[topic.topic]?.[topic.subtopic]
    : undefined;
  const topicProgressPercentage =
    getContentSubTopicProgressPercentage(topicProgress);

  const resetTopicProgress = () => {
    if (!topic) {
      return;
    }

    dispatch(
      setSubTopicProgress({
        category: topic.category,
        topic: topic.topic,
        subtopic: topic.subtopic,
        totalQuestion: topicProgress?.totalQuestion ?? 0,
        completedQuestion: [],
      })
    );
  };

  return (
    <section className="space-y-4">
      <div className="theme-progress-track h-1.5 overflow-hidden rounded-full">
        <div
          className="theme-progress-fill h-full"
          style={{ width: `${topicProgressPercentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="gleeple-code text-xs theme-text">
          Practice Progress: {topicProgressPercentage}%
        </span>
        <Button
          disabled={!topic}
          onClick={resetTopicProgress}
          size="small"
          startIcon={<RestartAltOutlinedIcon sx={{ fontSize: 14 }} />}
          sx={{
            borderColor: "var(--color-card-border)",
            color: "var(--color-subtle-text)",
            fontSize: 12,
            minWidth: 0,
            px: 1.5,
            py: 0.5,
          }}
          variant="outlined"
        >
          Reset
        </Button>
      </div>
    </section>
  );
}
