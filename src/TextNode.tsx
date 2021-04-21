import * as React from "react";
import { useCurrentAuthor, useStorage } from "react-earthstar";
import { useDebounce } from "use-debounce";
import { SelectionContext } from "./SelectionContext";
import { BoardEdge } from "./types";

export function TextNode({ edge }: { edge: BoardEdge }) {
  const storage = useStorage();
  const [currentAuthor] = useCurrentAuthor();

  const textContent = storage?.getContent(edge.dest);

  const { editing } = React.useContext(SelectionContext);

  return (
    <textarea
      style={{
        background: "transparent",
        padding: 0,
        margin: 0,
        width: "100%",
        height: "100%",
        border: "none",
        resize: "none",
        fontSize: "1em",
        overflow: "hidden",
        overscrollBehavior: "none",
        touchAction: "none",
        pointerEvents: editing ? "auto" : "none",
      }}
      readOnly={!currentAuthor || !editing}
      value={textContent}
      onChange={(e) => {
        if (!editing) {
          return;
        }

        if (!currentAuthor) {
          return;
        }

        storage.set(currentAuthor, {
          content: e.target.value,
          path: edge.dest,
          format: "es.4",
        });
      }}
    />
  );
}
