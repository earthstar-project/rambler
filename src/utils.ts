import * as React from "react";
import { isErr } from "earthstar";
import { useCurrentAuthor, useStorage } from "react-earthstar";
import { findEdges } from "earthstar-graph-db";

export function usePrevious<ValueType>(
  value: ValueType
): ValueType | undefined {
  const ref = React.useRef<ValueType>();

  React.useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

export function useUnlinkDocFromBoard(docPath: string, boardPath: string) {
  const storage = useStorage();
  const [currentAuthor] = useCurrentAuthor();

  return React.useCallback( () => {
    if (!storage || !currentAuthor) {
      return;
    }

    const placedResult =  findEdges(storage, {
      source: boardPath,
      dest: docPath,
      kind: "PLACED",
    });

    const sizedResult =  findEdges(storage, {
      source: boardPath,
      dest: docPath,
      kind: "PLACED",
    });

    if (!isErr(placedResult)) {
      const [placedEdge] = placedResult;

      storage.set(currentAuthor, {
        content: "",
        path: placedEdge.path,
        format: "es.4",
      });
    }

    if (!isErr(sizedResult)) {
      const [sizedEdge] = sizedResult;

      storage.set(currentAuthor, {
        content: "",
        path: sizedEdge.path,
        format: "es.4",
      });
    }
  }, [storage, boardPath, docPath, currentAuthor]);
}
