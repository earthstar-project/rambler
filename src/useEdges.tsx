import * as React from "react";
import { isErr } from "earthstar";
import { useCurrentAuthor, useStorage } from "react-earthstar";
import {
  EdgeContent,
  findEdges,
  GraphQuery,
  writeEdge,
} from "earthstar-graph-db";
import { BoardEdge, Position, Size } from "./types";

// TODO: pull this into react-earthstar
export function useEdges<EdgeData>(
  query: GraphQuery,
  workspaceAddress?: string
): (Omit<EdgeContent, "data"> & { data: EdgeData; path: string })[] {
  const storage = useStorage(workspaceAddress);

  const [edges, setEdges] = React.useState(() => {
    if (storage) {
      const result = findEdges(storage, query);

      return isErr(result) ? [] : result;
    }

    return [];
  });

  const queryMemo = React.useMemo(
    () => ({
      dest: query.dest,
      source: query.source,
      kind: query.kind,
      owner: query.owner,
    }),
    [query.dest, query.kind, query.owner, query.source]
  );

  React.useEffect(() => {
    const unsubscribe = storage.onWrite.subscribe(() => {
      const result = findEdges(storage, queryMemo);

      const edges = isErr(result) ? [] : result;

      setEdges(edges);
    });

    return unsubscribe;
  }, [queryMemo, storage]);

  // const edges = storage ? findEdges(storage, query) : [];

  if (isErr(edges)) {
    return [];
  }

  return edges.map((edgeDoc) => ({
    path: edgeDoc.path,
    ...JSON.parse(edgeDoc.content),
  }));
}

function hasPosition(edge: EdgeContent): boolean {
  if (
    edge.data &&
    typeof edge.data === "object" &&
    edge.data.hasOwnProperty("x") &&
    edge.data.hasOwnProperty("y") &&
    typeof edge.data.x === "number" &&
    typeof edge.data.y === "number"
  ) {
    return true;
  }

  return false;
}

function getSize(maybeSize: any): Size {
  if (
    maybeSize &&
    typeof maybeSize === "object" &&
    maybeSize.hasOwnProperty("width") &&
    maybeSize.hasOwnProperty("height") &&
    typeof maybeSize.width === "number" &&
    typeof maybeSize.height === "number"
  ) {
    return maybeSize;
  }

  return {
    width: 100,
    height: 70,
  };
}

export function useBoardEdges(boardPath: string): BoardEdge[] {
  const placedEdges = useEdges<Position>({
    source: boardPath,
    kind: "PLACED",
  });

  const sizedEdges = useEdges<Size>({
    source: boardPath,
    kind: "SIZED",
  });

  return placedEdges.filter(hasPosition).map((placedEdge) => {
    const sizedCounterpart = sizedEdges.find(
      (sizedEdge) => sizedEdge.dest === placedEdge.dest
    );

    return {
      source: placedEdge.source,
      dest: placedEdge.dest,
      owner: placedEdge.owner,
      position: placedEdge.data,
      size: getSize(sizedCounterpart?.data),
    };
  });
}

export function useSetBoardEdge(
  edge: BoardEdge
): {
  setPosition: (position: Position) => void;
  setSize: (size: Size) => void;
} {
  const storage = useStorage();
  const [currentAuthor] = useCurrentAuthor();

  const setPosition = React.useCallback(
    async (position: Position) => {
      if (!storage) {
        return;
      }

      if (!currentAuthor) {
        return;
      }

      await writeEdge(storage, currentAuthor, {
        source: edge.source,
        dest: edge.dest,
        owner: edge.owner,
        kind: "PLACED",
        data: position,
      });
    },
    [edge.source, edge.dest, edge.owner, currentAuthor, storage]
  );

  const setSize = React.useCallback(
    async (size: Size) => {
      if (!storage) {
        return;
      }

      if (!currentAuthor) {
        return;
      }

      await writeEdge(storage, currentAuthor, {
        source: edge.source,
        dest: edge.dest,
        owner: edge.owner,
        kind: "SIZED",
        data: size,
      });
    },
    [edge.source, edge.dest, edge.owner, currentAuthor, storage]
  );

  return {
    setSize,
    setPosition,
  };
}
