import * as React from "react";
import { useCurrentAuthor, useStorage } from "react-earthstar";
import { useDebounce } from "use-debounce";
import { SelectionContext } from "./SelectionContext";
import { BoardEdge } from "./types";

export function TextNode({ edge }: { edge: BoardEdge }) {
  const storage = useStorage();
  const [currentAuthor] = useCurrentAuthor();

  const textDoc = storage?.getDocument(edge.dest);

  const { editing } = React.useContext(SelectionContext);
  const [textValue, setTextValue] = React.useState(textDoc?.content || "");

  const [debouncedTextValue] = useDebounce(textValue, 1000);

  React.useEffect(() => {
    if (debouncedTextValue !== textDoc?.content && currentAuthor && storage) {
      storage.set(currentAuthor, {
        content: debouncedTextValue,
        path: edge.dest,
        format: "es.4",
      });
    }
  }, [debouncedTextValue, textDoc?.content, storage, currentAuthor, edge.dest]);

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
      }}
      readOnly={!currentAuthor || !editing}
      value={textValue}
      onChange={(e) => {
        if (!editing) {
          return;
        }

        setTextValue(e.target.value);
      }}
    />
  );
}
