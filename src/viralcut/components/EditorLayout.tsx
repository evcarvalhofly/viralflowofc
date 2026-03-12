import { AssetsPanel } from "./AssetsPanel";
import { PreviewPanel } from "./PreviewPanel";
import { Timeline } from "./Timeline";
import { EditorHeader } from "./EditorHeader";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

export function EditorLayout() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <EditorHeader />

      <ResizablePanelGroup direction="vertical" className="flex-1 overflow-hidden">
        {/* Main content area */}
        <ResizablePanel defaultSize={65} minSize={40}>
          <ResizablePanelGroup direction="horizontal">
            {/* Assets Panel */}
            <ResizablePanel defaultSize={18} minSize={14} maxSize={30}>
              <AssetsPanel />
            </ResizablePanel>
            <ResizableHandle withHandle />

            {/* Preview Panel */}
            <ResizablePanel defaultSize={82} minSize={40}>
              <PreviewPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Timeline */}
        <ResizablePanel defaultSize={35} minSize={20} maxSize={55}>
          <Timeline />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
