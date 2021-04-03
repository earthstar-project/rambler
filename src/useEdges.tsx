import * as React from "react";
import { isErr, Document } from "earthstar";
import {
  useCurrentAuthor,
  useStorage,
  useSubscribeToStorages,
} from "react-earthstar";
import {
  EdgeContent,
  findEdgesAsync,
  GraphQuery,
  writeEdge,
} from "earthstar-graph-db";
import useDeepCompareEffect from "use-deep-compare-effect";
import { BoardEdge, Position, Size } from "./types";
import { BoardContext } from "./BoardStore";

// TODO: pull this into react-earthstar
export function useEdges<EdgeData>(
  query: GraphQuery,
  workspaceAddress?: string
): (Omit<EdgeContent, "data"> & { data: EdgeData; path: string })[] {
  const storage = useStorage(workspaceAddress);

  const [edges, setEdges] = React.useState<Document[]>([]);

  useDeepCompareEffect(() => {
    let ignore = false;

    if (!storage) {
      return;
    }

    findEdgesAsync(storage, query).then((edges) => {
      if (!isErr(edges) && !ignore) {
        setEdges(edges);
      }
    });

    return () => {
      ignore = true;
    };
  }, [storage, query]);

  const { dest, kind, owner, source } = query;

  const onWrite = React.useCallback(() => {
    if (!storage) {
      return;
    }

    // TODO: this is a real horror...
    findEdgesAsync(storage, { dest, kind, owner, source }).then((edges) => {
      if (!isErr(edges)) {
        setEdges(edges);
      }
    });
  }, [dest, kind, owner, source, storage]);

  useSubscribeToStorages({
    workspaces: storage ? [storage.workspace] : [],
    onWrite,
  });

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

export function useBoardEdge(
  boardPath: string,
  destPath: string
): {
  edge: BoardEdge | undefined;
  setPosition: (position: Position) => void;
  setSize: (size: Size) => void;
} {
  const storage = useStorage();
  const [currentAuthor] = useCurrentAuthor();

  const [firstPlacedEdge] = useEdges<Position>({
    source: boardPath,
    dest: destPath,
    kind: "PLACED",
  });

  const [firstSizedEdge] = useEdges<Size>({
    source: boardPath,
    dest: destPath,
    kind: "SIZED",
  });

  const {
    optimisticPositions,
    optimisticSizes,
    setOptimisticPosition,
    setOptimisticSize,
  } = React.useContext(BoardContext);

  const setPosition = React.useCallback(
    async (position: Position) => {
      if (!storage) {
        return;
      }

      if (!currentAuthor) {
        return;
      }

      setOptimisticPosition(destPath, position);

      await writeEdge(storage, currentAuthor, {
        source: boardPath,
        dest: destPath,
        owner: firstPlacedEdge?.owner,
        kind: "PLACED",
        data: position,
      });

      setOptimisticPosition(destPath, null);
    },
    [
      boardPath,
      currentAuthor,
      storage,
      firstPlacedEdge?.owner,
      destPath,
      setOptimisticPosition,
    ]
  );

  const setSize = React.useCallback(
    async (size: Size) => {
      if (!storage) {
        return;
      }

      if (!currentAuthor) {
        return;
      }

      setOptimisticSize(destPath, size);

      await writeEdge(storage, currentAuthor, {
        source: boardPath,
        dest: destPath,
        owner: firstPlacedEdge?.owner,
        kind: "SIZED",
        data: size,
      });

      setOptimisticSize(destPath, null);
    },
    [
      boardPath,
      currentAuthor,
      storage,
      firstPlacedEdge?.owner,
      destPath,
      setOptimisticSize,
    ]
  );

  const optimisticPosition = optimisticPositions.get(destPath);
  const optimisticSize = optimisticSizes.get(destPath);

  return {
    edge:
      firstPlacedEdge && hasPosition(firstPlacedEdge)
        ? {
            source: firstPlacedEdge.source,
            dest: firstPlacedEdge.dest,
            owner: firstPlacedEdge.owner,
            position: optimisticPosition || firstPlacedEdge.data,
            size: optimisticSize || getSize(firstSizedEdge?.data),
          }
        : undefined,
    setSize,
    setPosition,
  };
}
