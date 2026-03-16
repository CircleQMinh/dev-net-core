import { Box } from "@mui/material";
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import type { KnowledgeItem } from "../shared/knowledgeBase";
import { useState } from "react";


export interface SideTreeViewProps{
    selected: KnowledgeItem
    items: KnowledgeItem[]
    onChange: (item: KnowledgeItem)=> void
}

export default function SideTreeView({selected,items,onChange}:SideTreeViewProps)  {
    

    const categories = ["Design & Architecture", "Azure", ".NET", "React", "SQL"];
    const [expandedItems, setExpandedItems] = useState<string[]>([selected.category ?? categories]);

    const handleExpandedItemsChange = (
      _: React.SyntheticEvent | null,
      itemIds: string[],
    ) => {
      setExpandedItems(itemIds);
    };
  
    const handleClick = (id: string) => {
      const item = items.find(q=>q.id === id)
      if(item){
        onChange(item)
      }
    };


    const dotnetItems = items.filter(q=>q.category === categories[0])
    const DotnetTreeItems = () =>{
        return (
            <>
                {dotnetItems.map((v)=> <TreeItem key={v.id} itemId={v.id} label={v.topic} onClick={()=>{handleClick(v.id)}}></TreeItem>)}
            </>
        )
    }
    const architectureItems = items.filter(q=>q.category === categories[1])
    const ArchitectureTreeItems = () =>{
        return (
            <>
                {architectureItems.map((v)=> <TreeItem key={v.id} itemId={v.id} label={v.topic} onClick={()=>{handleClick(v.id)}}></TreeItem>)}
            </>
        )
    }

    const sqlItems = items.filter(q=>q.category === categories[2])
    const SQLTreeItems = () =>{
        return (
            <>
                {sqlItems.map((v)=> <TreeItem key={v.id} itemId={v.id} label={v.topic} onClick={()=>{handleClick(v.id)}}></TreeItem>)}
            </>
        )
    }

    const reactItems = items.filter(q=>q.category === categories[3])
    const ReactTreeItems = () =>{
        return (
            <>
                {reactItems.map((v)=> <TreeItem key={v.id} itemId={v.id} label={v.topic} onClick={()=>{handleClick(v.id)}}></TreeItem>)}
            </>
        )
    }

    const azureItems = items.filter(q=>q.category === categories[4])
    const AzureTreeItems = () =>{
        return (
            <>
                {azureItems.map((v)=> <TreeItem key={v.id} itemId={v.id} label={v.topic} onClick={()=>{handleClick(v.id)}}></TreeItem>)}
            </>
        )
    }



    return (
      <>
        <Box sx={{ minHeight: 352, minWidth: 250 }}>
          <SimpleTreeView selectedItems={selected.id} 
          expandedItems={expandedItems}
          onExpandedItemsChange={handleExpandedItemsChange}
          sx={{
                "& .MuiTreeItem-content.Mui-focused": {
                backgroundColor: "transparent",
                },
                "& .MuiTreeItem-content.Mui-selected.Mui-focused": {
                backgroundColor: "transparent",
                },
            }}>
            {categories.map((v,i) => {
              return (
                <TreeItem key={i} itemId={v} label={v} >
                  {v === categories[0] && <DotnetTreeItems/>}
                  {v === categories[1] && <ArchitectureTreeItems/>}
                  {v === categories[2] && <SQLTreeItems/>}
                  {v === categories[3] && <ReactTreeItems/>}
                  {v === categories[4] && <AzureTreeItems/>}

                </TreeItem>
              );
            })}
          </SimpleTreeView>
        </Box>
      </>
    );
}