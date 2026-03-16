import { Box, Button, ButtonGroup, Paper } from "@mui/material";
import SideTreeView from "../components/SideTreeView";
import { knowledgeItems } from "../shared/knowledgeIndex";
import { KnowledgeMarkdown } from "../components/KnowledgeMarkdown";
import { useEffect, useRef, useState } from "react";
import type { KnowledgeItem } from "../shared/knowledgeBase";
import { useParams } from "react-router-dom";
import { baseRepoName } from "../shared/types";
export default function Home() {
  const { "*": splat } = useParams();
  const initTopic = splat
    ? knowledgeItems.find((q) => q.id == splat)
    : knowledgeItems[0];
  const [currentTopic, setCurrentTopic] = useState(
    initTopic ?? knowledgeItems[0]
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  const updateUrl = (item: KnowledgeItem) => {
    setCurrentTopic(item);
    window.history.pushState({}, "", baseRepoName + "/home/" + item.id);
  };

  const nextTopic = () =>{
    const nextIndex = knowledgeItems.indexOf(currentTopic) + 1
    if(knowledgeItems.length > nextIndex){
      updateUrl(knowledgeItems[nextIndex])
    }
  }
  const prevTopic = () =>{
    const prevIndex = knowledgeItems.indexOf(currentTopic) - 1
    if(prevIndex >= 0){
      updateUrl(knowledgeItems[prevIndex])
    }
  }

  useEffect(() => {
    containerRef.current?.scrollTo({
      top: 0,
      behavior: "auto", // or "smooth"
    });
  }, [currentTopic.bodyMarkdown]);
  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        maxWidth: "100%",
      }}
    >
      {/* Page Header */}
      <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        Interview Prep
      </Box>

      {/* Content Area */}
      <Box>
        <Box
          sx={{
            flex: 1,
            display: "flex",
            gap: 2,
            p: 2,
            flexDirection: { xs: "column", md: "row" },
          }}
        >
          <Paper
            sx={{
              width: { xs: "100%", md: "30%" },
              display: { xs: "block", md: "block" },
              p: 2,
              maxHeight: { xs: "30vh", md: "90vh" },
              overflow: "auto",
            }}
          >
            <SideTreeView
              selected={currentTopic}
              items={knowledgeItems}
              onChange={updateUrl}
            ></SideTreeView>
          </Paper>

          <Paper
            ref={containerRef}
            sx={{
              flex: 1,
              p: 2,
              maxHeight: { xs: "60vh", md: "90vh" },
              overflow: "auto",
            }}
          >
            <KnowledgeMarkdown markdown={currentTopic.bodyMarkdown} />
          </Paper>
        </Box>
        <ButtonGroup variant="contained" aria-label="Basic button group" sx={{display: 'flex',justifyContent:'center'}}>
          <Button  onClick={()=>{prevTopic()}}sx={{marginRight: '5px'}}>Prev Topic</Button>
          <Button  onClick={()=>{nextTopic()}} sx={{marginLeft: '5px'}}>Next Topic</Button>
        </ButtonGroup>
      </Box>
    </Box>
  );
}
