import { Routes, Route } from "react-router-dom";
import { ProjectsPage } from "@/viralcut/components/ProjectsPage";
import { EditorLayout } from "@/viralcut/components/EditorLayout";

export default function ViralCut() {
  return (
    <Routes>
      <Route index element={<ProjectsPage />} />
      <Route path="editor/:projectId" element={<EditorLayout />} />
    </Routes>
  );
}
