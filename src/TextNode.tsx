import * as React from "react";
import { useDocument } from "react-earthstar";
import { EdgeContent } from "earthstar-graph-db";
import { useDebounce } from "use-debounce";
import { SelectionContext } from "./SelectionContext";

export function TextNode<EdgeData>({
  edge,
}: {
  edge: Omit<EdgeContent, "data"> & EdgeData;
}) {
  const [textDoc, setTextDoc] = useDocument(edge.dest);
  const { editing } = React.useContext(SelectionContext);
  const [textValue, setTextValue] = React.useState(textDoc?.content || "");

  const [debouncedTextValue] = useDebounce(textValue, 1000);

  React.useEffect(() => {
    if (textValue === "" && textDoc?.content) {
      setTextValue(textDoc.content);
    }
  }, [textDoc?.content, debouncedTextValue, textValue]);

  React.useEffect(() => {
    if (debouncedTextValue !== textDoc?.content) {
      setTextDoc(debouncedTextValue);
    }
  }, [setTextDoc, debouncedTextValue, textDoc?.content]);

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
      readOnly={!editing}
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
