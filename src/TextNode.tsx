import * as React from "react";
import { useDocument } from "react-earthstar";
import { useDebounce } from "use-debounce";
import { SelectionContext } from "./SelectionContext";
import { BoardEdge } from "./types";

export function TextNode({ edge }: { edge: BoardEdge }) {
  const [textDoc, setTextDoc] = useDocument(edge.dest);
  const { editing } = React.useContext(SelectionContext);
  const [textValue, setTextValue] = React.useState(textDoc?.content || "");

  const [debouncedTextValue] = useDebounce(textValue, 1000);

  const hasInitialised = React.useRef(false);

  React.useEffect(() => {
    if (textValue === "" && textDoc?.content && !hasInitialised.current) {
      setTextValue(textDoc.content);
      hasInitialised.current = true;
    }
  }, [textDoc?.content, textValue]);

  React.useEffect(() => {
    let ignore = false;

    if (
      debouncedTextValue !== textDoc?.content &&
      !ignore &&
      hasInitialised.current
    ) {
      setTextDoc(debouncedTextValue);
    }

    return () => {
      ignore = true;
    };
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
