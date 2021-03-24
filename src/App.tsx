import * as React from "react";
import {
  StorageLocalStorage,
  ValidatorEs4,
  StorageToAsync,
  isErr,
  Document,
} from "earthstar";
import {
  AuthorLabel,
  EarthstarPeer,
  useCurrentAuthor,
  useDocument,
  useStorage,
  useSubscribeToStorages,
} from "react-earthstar";
import {
  EdgeContent,
  findEdgesAsync,
  GraphQuery,
  writeEdge,
} from "earthstar-graph-db";
import { useDebounce } from "use-debounce";
import useDeepCompareEffect from "use-deep-compare-effect";
import { useGesture } from "react-use-gesture";
import { useId } from "@reach/auto-id";

import "./App.css";
import { formatDistance } from "date-fns";

// Hardcoding values for things now
const WORKSPACE_ADDR = "+triplextest.a6udu8ab";
const PUBS = ["https://earthstar-demo-pub-v5-a.glitch.me"];
const TRIPLEX_DIR = "/triplex-v0.0.1";
const BOARD_PATH = `${TRIPLEX_DIR}/board.json`;
const TEST_AUTHOR = {
  address: "@test.bqokp2sykon4qqou6q5sajjea3r3ng3kwg6psbchvlmy4mucimtwa",
  secret: "bzb3boqgppn2tylnzhz6es5lgrtcrwrirryxarvsjezcaloevtjzq",
};

const WorkspaceStorage = new StorageToAsync(
  new StorageLocalStorage([ValidatorEs4], WORKSPACE_ADDR)
);

function App() {
  return (
    <EarthstarPeer
      initWorkspaces={[WorkspaceStorage]}
      initPubs={{ [WORKSPACE_ADDR]: PUBS }}
      initCurrentWorkspace={WORKSPACE_ADDR}
      initCurrentAuthor={TEST_AUTHOR}
      initIsLive={false}
    >
      <Board />
    </EarthstarPeer>
  );
}

// TODO: pull this into react-earthstar

function useEdges<EdgeData>(
  query: GraphQuery,
  workspaceAddress?: string
): (Omit<EdgeContent, "data"> & { data: EdgeData })[] {
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

    findEdgesAsync(storage, { dest, kind, owner, source }).then((edges) => {
      if (!isErr(edges)) {
        setEdges(edges);
      }
    });
  }, [dest, kind, owner, source, storage]);

  // This is really awful because it triggers every single time any document in the storage changes. Need to find a way to subscribe to edges...
  useSubscribeToStorages({
    workspaces: storage ? [storage.workspace] : [],
    onWrite,
  });

  return edges.map((edgeDoc) => JSON.parse(edgeDoc.content));
}

type Position = { x: number; y: number };
type Size = { width: number; height: number };

// Get the coordinates of the top left and bottom right of the board using the document placements within it
// TODO: take doc sizes into account for bottom right corner.
function useBoardCorners(boardPath: string) {
  const placedEdges = useEdges<Position>({
    source: boardPath,
    kind: "PLACED",
  });

  const sizedEdges = useEdges<Size>({
    source: boardPath,
    kind: "SIZED",
  });

  return placedEdges.reduce(
    (acc, edge) => {
      const size = sizedEdges.find((sizedEdge) => sizedEdge.dest === edge.dest);

      return {
        top: Math.min(edge.data.y, acc.top),
        left: Math.min(edge.data.x, acc.left),
        bottom: Math.max(edge.data.y + (size?.data?.height || 0), acc.bottom),
        right: Math.max(edge.data.x + (size?.data?.width || 0), acc.right),
      };
    },
    { top: 0, left: 0, bottom: 0, right: 0 }
  );
}

// Determine what kind of node is at the end of an edge and how to render it
type EdgeRenderType = "text" | "unknown";

// e.g. 'starts with '/lobby' so render a speech bubble
// ends with .midi so render a music player
// is in /todo/ so knows to render todo stuff
function getEdgeRenderType<EdgeData>(
  edge: Omit<EdgeContent, "data"> & EdgeData
): EdgeRenderType {
  if (edge.dest.endsWith(".txt")) {
    return "text";
  }

  return "unknown";
}

function renderEdge<EdgeData>(edge: Omit<EdgeContent, "data"> & EdgeData) {
  switch (getEdgeRenderType(edge)) {
    case "text":
      return (
        <SelectionBox edge={edge}>
          <TextNode edge={edge} />
        </SelectionBox>
      );
    default:
      return (
        <div style={{ border: "2px solid black", borderRadius: "50%" }}></div>
      );
  }
}

function nextDeltasWithKeys(
  prevDeltas: { deltaX: number; deltaY: number },
  set: Set<string>
): { deltaX: number; deltaY: number } {
  const next = Array.from(set).reduce(({ deltaX, deltaY }, key) => {
    switch (key) {
      case "ArrowUp":
        return {
          deltaX,
          deltaY: deltaY - 1,
        };
      case "ArrowRight":
        return {
          deltaX: deltaX + 1,
          deltaY,
        };
      case "ArrowDown":
        return {
          deltaX,
          deltaY: deltaY + 1,
        };
      case "ArrowLeft":
        return {
          deltaX: deltaX - 1,
          deltaY,
        };
      default:
        return {
          deltaX,
          deltaY,
        };
    }
  }, prevDeltas);

  if (!set.has("ArrowUp") && !set.has("ArrowDown")) {
    next.deltaY = next.deltaY / 1.5;
  }

  if (!set.has("ArrowLeft") && !set.has("ArrowRight")) {
    next.deltaX = next.deltaX / 1.5;
  }

  return next;
}

function clampDelta(delta: number) {
  if (Math.abs(delta) < 1) {
    return 0;
  }

  if (Math.abs(delta) > 24) {
    return delta < 0 ? -24 : 24;
  }

  return delta;
}

function useTraversalEvents(
  setX: React.Dispatch<React.SetStateAction<number>>,
  setY: React.Dispatch<React.SetStateAction<number>>
) {
  const ref = React.useRef<HTMLDivElement>(null);

  const [keysPressed, setKeysPressed] = React.useState<Set<string>>(new Set());
  const [keyDeltaX, setKeyDeltaX] = React.useState(0);
  const [keyDeltaY, setKeyDeltaY] = React.useState(0);

  const onKeyDown = React.useCallback(
    (keyEvent: KeyboardEvent) => {
      const keys = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", " "];

      const { key } = keyEvent;

      if (!keys.includes(key)) {
        return;
      }

      if (keysPressed.has(key)) {
        return;
      }

      if (keyEvent.target !== document.body) {
        return;
      }

      keyEvent.preventDefault();

      setKeysPressed((prev) => {
        return new Set(prev).add(key);
      });
    },
    [keysPressed]
  );

  const onKeyUp = React.useCallback(
    (keyEvent: KeyboardEvent) => {
      const keys = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", " "];

      const { key } = keyEvent;

      if (!keys.includes(key)) {
        return;
      }

      keyEvent.preventDefault();

      if (!keysPressed.has(key)) {
        return;
      }

      setKeysPressed((prev) => {
        prev.delete(key);

        return new Set(prev);
      });
    },
    [keysPressed]
  );

  React.useEffect(() => {
    const target = document;

    if (target) {
      target.addEventListener("keydown", onKeyDown, false);
      target.addEventListener("keyup", onKeyUp, false);
    }

    return () => {
      target?.removeEventListener("keydown", onKeyDown);
      target?.removeEventListener("keyup", onKeyUp);
    };
  }, [onKeyDown, onKeyUp]);

  React.useEffect(() => {
    const next = nextDeltasWithKeys(
      { deltaX: keyDeltaX, deltaY: keyDeltaY },
      keysPressed
    );

    const finalX = clampDelta(next.deltaX);
    const finalY = clampDelta(next.deltaY);

    requestAnimationFrame(() => {
      setX((prev) => Math.round(prev + keyDeltaX));
      setY((prev) => Math.round(prev + keyDeltaY));

      setKeyDeltaX(finalX);
      setKeyDeltaY(finalY);
    });
  }, [keysPressed, keyDeltaX, keyDeltaY, setX, setY]);

  useGesture(
    {
      onDrag: (drag) => {
        const [x, y] = drag.delta;

        drag.event.preventDefault();

        requestAnimationFrame(() => {
          setX((prev) => prev - x);
          setY((prev) => prev - y);
        });
      },
      onWheel: (wheel) => {
        const [x, y] = wheel.delta;

        requestAnimationFrame(() => {
          setX((prev) => prev + x);
          setY((prev) => prev + y);
        });
      },
    },
    {
      domTarget: ref,
    }
  );

  return ref;
}

function useUnlinkDocFromBoard(docPath: string, boardPath: string) {
  const storage = useStorage();
  const [currentAuthor] = useCurrentAuthor();

  return React.useCallback(async () => {
    if (!storage || !currentAuthor) {
      return;
    }

    const placedResult = await findEdgesAsync(storage, {
      source: boardPath,
      dest: docPath,
      kind: "PLACED",
    });

    const sizedResult = await findEdgesAsync(storage, {
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

// board component which manages the virtual canvas space
function Board() {
  const storage = useStorage(WORKSPACE_ADDR);

  const [viewX, setViewX] = React.useState(0);
  const [viewY, setViewY] = React.useState(0);

  const edges = useEdges<Position>({
    source: BOARD_PATH,
    kind: "PLACED",
  });

  const boardCorners = useBoardCorners(BOARD_PATH);

  //const canvasRef = React.useRef<HTMLDivElement>(null);

  const canvasRef = useTraversalEvents(setViewX, setViewY);

  // the size of the board as determined by its placed contents
  const intrinsicWidth = boardCorners.right - boardCorners.left;
  const intrinsicHeight = boardCorners.bottom - boardCorners.top;

  // want to add the difference between board edges and viewport edges
  const viewportTopEdge = viewY;
  const viewportLeftEdge = viewX;
  const viewportBottomEdge =
    (canvasRef.current?.getBoundingClientRect().height || 0) + viewY;
  const viewportRightEdge =
    (canvasRef.current?.getBoundingClientRect().width || 0) + viewX;

  const topBoardEdgeDifference = boardCorners.top - viewportTopEdge;
  const leftBoardEdgeDifference = boardCorners.left - viewportLeftEdge;
  const rightBoardEdgeDifference = viewportRightEdge - boardCorners.right;
  const bottomBoardEdgeDifference = viewportBottomEdge - boardCorners.bottom;

  const boardWidth =
    Math.max(leftBoardEdgeDifference, 0) +
    intrinsicWidth +
    Math.max(rightBoardEdgeDifference, 0);
  const boardHeight =
    Math.max(topBoardEdgeDifference, 0) +
    intrinsicHeight +
    Math.max(bottomBoardEdgeDifference, 0);

  React.useEffect(() => {
    if (canvasRef.current && viewX === 0 && viewY === 0) {
      canvasRef.current.scrollTop = Math.abs(boardCorners.top);
      canvasRef.current.scrollLeft = Math.abs(boardCorners.left);
    }
  }, [boardCorners.top, boardCorners.left, viewX, viewY, canvasRef]);

  return (
    <div>
      <div
        ref={canvasRef}
        id={"canvas"}
        style={{
          position: "relative",
          background: "#eaeaea",
          height: "100vh",
          width: "100vw",
          overflow: "auto",
          touchAction: "none",
        }}
        onDoubleClick={async (clickEvent) => {
          if (!storage) {
            return;
          }

          const {
            left,
            top,
          } = clickEvent.currentTarget.getBoundingClientRect();

          const x = clickEvent.clientX - left;
          const y = clickEvent.clientY - top;

          const translatedX = x + viewX;
          const translatedY = y + viewY;

          const docPath = `/notes/${Date.now()}.txt`;

          const writeResult = await storage?.set(TEST_AUTHOR, {
            content: "Hello there!",
            format: "es.4",
            path: docPath,
          });

          if (isErr(writeResult)) {
            console.error(writeResult);
            return;
          }

          writeEdge(storage, TEST_AUTHOR, {
            owner: "common",
            data: { x: translatedX, y: translatedY },
            source: BOARD_PATH,
            dest: docPath,
            kind: "PLACED",
          });
        }}
      >
        <div
          id={"board"}
          style={{
            background: "#eaeaea",
            pointerEvents: "none",
            width: boardWidth,
            height: boardHeight,
          }}
        ></div>
        <div
          style={{ position: "fixed", top: 0, left: 0 }}
        >{`x: ${viewX} y: ${viewY}`}</div>
        {/* TODO: We know how much of the board the user can see, and the sizes
        and positions of each doc - let's only render what is within the bounds
        of the viewport! */}
        {/* TODO: transform all of the nodes at once, rather than individually*/}
        {edges.map((edge) => (
          <div
            key={edge.dest}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              transform: `translate(${edge.data.x - viewX}px, ${
                edge.data.y - viewY
              }px)`,
            }}
          >
            {renderEdge(edge)}
          </div>
        ))}
      </div>
    </div>
  );
}

type SelectionState = "hovered" | "blurred" | "focused" | "editing";
type DragOperation =
  | "none"
  | "n-resize"
  | "ne-resize"
  | "e-resize"
  | "se-resize"
  | "s-resize"
  | "sw-resize"
  | "w-resize"
  | "nw-resize"
  | "move";

function dragOperationFromRelativePositions(positions: {
  top: number;
  left: number;
  right: number;
  bottom: number;
}): DragOperation {
  const matches = {
    top: Math.abs(positions.top) < 5,
    left: Math.abs(positions.left) < 5,
    bottom: Math.abs(positions.bottom) < 5,
    right: Math.abs(positions.right) < 5,
  };

  if (matches.top && matches.left) {
    return "nw-resize";
  }

  if (matches.top && matches.right) {
    return "ne-resize";
  }

  if (matches.bottom && matches.left) {
    return "sw-resize";
  }

  if (matches.bottom && matches.right) {
    return "se-resize";
  }

  if (matches.top) {
    return "n-resize";
  }

  if (matches.right) {
    return "e-resize";
  }

  if (matches.bottom) {
    return "s-resize";
  }

  if (matches.left) {
    return "w-resize";
  }

  return "move";
}

function resize(
  kind: Exclude<DragOperation, "move" | "none">,
  originalSize: { width: number; height: number },
  resizeDelta: { x: number; y: number }
): {
  relativeX: number;
  relativeY: number;
  width: number;
  height: number;
} {
  // TODO: clamp operations so that height and width cannot go below 10
  if (kind === "n-resize") {
    return {
      relativeX: 0,
      relativeY: resizeDelta.y,
      width: originalSize.width,
      height: originalSize.height - resizeDelta.y,
    };
  }

  if (kind === "ne-resize") {
    return {
      relativeX: 0,
      relativeY: resizeDelta.y,
      width: originalSize.width + resizeDelta.x,
      height: originalSize.height - resizeDelta.y,
    };
  }

  if (kind === "e-resize") {
    return {
      relativeX: 0,
      relativeY: 0,
      width: originalSize.width + resizeDelta.x,
      height: originalSize.height,
    };
  }

  if (kind === "se-resize") {
    return {
      relativeX: 0,
      relativeY: 0,
      width: originalSize.width + resizeDelta.x,
      height: originalSize.height + resizeDelta.y,
    };
  }

  if (kind === "s-resize") {
    return {
      relativeX: 0,
      relativeY: 0,
      width: originalSize.width,
      height: originalSize.height + resizeDelta.y,
    };
  }

  if (kind === "sw-resize") {
    return {
      relativeX: 0 + resizeDelta.x,
      relativeY: 0,
      width: originalSize.width - resizeDelta.x,
      height: originalSize.height + resizeDelta.y,
    };
  }

  if (kind === "w-resize") {
    return {
      relativeX: 0 + resizeDelta.x,
      relativeY: 0,
      width: originalSize.width - resizeDelta.x,
      height: originalSize.height,
    };
  }

  if (kind === "nw-resize") {
    return {
      relativeX: 0 + resizeDelta.x,
      relativeY: 0 + resizeDelta.y,
      width: originalSize.width - resizeDelta.x,
      height: originalSize.height - resizeDelta.y,
    };
  }

  return {
    relativeX: 0,
    relativeY: 0,
    width: originalSize.width,
    height: originalSize.height,
  };
}

function getCursorFromDragOperation(
  operation: DragOperation,
  active: boolean
): string {
  switch (operation) {
    case "move":
      return active ? "grabbing" : "auto";
    case "n-resize":
    case "s-resize":
      return "ns-resize";
    case "w-resize":
    case "e-resize":
      return "ew-resize";
    case "nw-resize":
    case "se-resize":
      return "nwse-resize";
    case "ne-resize":
    case "sw-resize":
      return "nesw-resize";

    default:
      return "auto";
  }
}

const SelectionContext = React.createContext({
  editing: false,
});

function SelectionBox({
  edge,
  children,
}: {
  edge: EdgeContent;
  children: React.ReactNode;
}) {
  const storage = useStorage();
  const [currentAuthor] = useCurrentAuthor();
  const [state, setState] = React.useState<SelectionState>("blurred");
  const [dragOperation, setDragOperation] = React.useState<DragOperation>(
    "none"
  );
  const ref = React.useRef<HTMLDivElement>(null);

  const [placedEdge] = useEdges<Position>({
    source: edge.source,
    dest: edge.dest,
    kind: "PLACED",
  });
  const [sizedEdge] = useEdges<Size>({
    source: edge.source,
    dest: edge.dest,
    kind: "SIZED",
  });

  const id = useId();

  const documentOnClick = React.useCallback(
    (event: Event) => {
      if (state === "blurred") {
        return;
      }

      if ((event.target as Element)?.closest(`#selection-${id}`)) {
        return;
      }

      setState("blurred");
    },
    [state, id]
  );

  const [tempTransform, setTempTransform] = React.useState({ x: 0, y: 0 });
  const [tempResize, setTempResize] = React.useState<null | Size>(null);
  const [tempSizeReference, setTempSizeReference] = React.useState({
    width: 0,
    height: 0,
  });

  const [
    predictedDragOperation,
    setPredictedDragOperation,
  ] = React.useState<DragOperation>("none");

  const unlinkDoc = useUnlinkDocFromBoard(edge.dest, edge.source);

  const onKeyDown = React.useCallback(
    (keyEvent: KeyboardEvent) => {
      const keys = ["Backspace", "Delete"];

      const { key } = keyEvent;

      if (!keys.includes(key)) {
        return;
      }

      if (state === "focused") {
        keyEvent.preventDefault();
        unlinkDoc();
      }
    },
    [unlinkDoc, state]
  );

  React.useEffect(() => {
    document.addEventListener("click", documentOnClick);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("click", documentOnClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [documentOnClick, onKeyDown]);

  const [destDoc] = useDocument(edge.dest);

  useGesture(
    {
      onDragStart: (dragEvent) => {
        if (state === "editing") {
          setDragOperation("none");
          return;
        }

        if (state === "blurred" || state === "hovered") {
          setState("focused");
        }

        const [initialX, initialY] = dragEvent.initial;
        const { top, bottom, left, right } = (dragEvent.event
          .target as Element).getBoundingClientRect();

        const relativePositions = {
          top: top - initialY,
          bottom: bottom - initialY,
          left: left - initialX,
          right: right - initialX,
        };

        const nextDragOperation = dragOperationFromRelativePositions(
          relativePositions
        );

        if (
          nextDragOperation !== "move" &&
          nextDragOperation !== "none" &&
          ref.current
        ) {
          const { width, height } = ref.current.getBoundingClientRect();
          setTempSizeReference({ width, height });
        }

        setDragOperation(() => nextDragOperation);
      },
      onMove: (moveEvent) => {
        if (state !== "focused" && dragOperation === "none") {
          return;
        }

        const [x, y] = moveEvent.xy;
        const { top, bottom, left, right } = (moveEvent.event
          .target as Element).getBoundingClientRect();

        const relativePositions = {
          top: top - y,
          bottom: bottom - y,
          left: left - x,
          right: right - x,
        };

        const nextDragOperation = dragOperationFromRelativePositions(
          relativePositions
        );

        setPredictedDragOperation(nextDragOperation);
      },
      onHover: (hoverEvent) => {
        if (hoverEvent.hovering === false) {
          setPredictedDragOperation("none");
        }

        setState((prev) => {
          if (!hoverEvent.hovering && prev === "hovered") {
            setState("blurred");
          }

          if (hoverEvent.hovering && prev === "blurred") {
            setState("hovered");
          }

          return prev;
        });
      },
      onDrag: (dragEvent) => {
        dragEvent.event.preventDefault();
        dragEvent.event.stopPropagation();

        const [x, y] = dragEvent.delta;

        if (dragOperation !== "move" && dragOperation !== "none") {
          const [x, y] = dragEvent.movement;

          const { height, width, relativeX, relativeY } = resize(
            dragOperation,
            tempSizeReference,
            { x, y }
          );

          requestAnimationFrame(() => {
            setTempTransform({
              x: relativeX,
              y: relativeY,
            });
            setTempResize({ height, width });
          });
        }

        if (dragOperation === "move") {
          requestAnimationFrame(() => {
            setTempTransform((prev) => ({
              x: prev.x + x,
              y: prev.y + y,
            }));
          });
        }
      },
      onDragEnd: async () => {
        if (!storage || !currentAuthor) {
          return;
        }

        if (dragOperation === "move") {
          await writeEdge(storage, currentAuthor, {
            dest: edge.dest,
            source: edge.source,
            kind: "PLACED",
            owner: "common",
            data: {
              x: placedEdge?.data.x + tempTransform.x,
              y: placedEdge?.data.y + tempTransform.y,
            },
          });
        }

        // TODO: isDragOperation helper
        if (dragOperation !== "move" && dragOperation !== "none") {
          await writeEdge(storage, currentAuthor, {
            dest: edge.dest,
            source: edge.source,
            kind: "PLACED",
            owner: "common",
            data: {
              x: placedEdge?.data.x + tempTransform.x,
              y: placedEdge?.data.y + tempTransform.y,
            },
          });
          await writeEdge(storage, currentAuthor, {
            dest: edge.dest,
            source: edge.source,
            kind: "SIZED",
            owner: "common",
            data: tempResize,
          });
        }

        requestAnimationFrame(() => {
          setTempSizeReference({ width: 0, height: 0 });
          setTempTransform({ x: 0, y: 0 });
          setTempResize(null);
        });

        setDragOperation("none");
      },
    },
    { domTarget: ref }
  );

  const destDocDate = new Date(destDoc ? destDoc.timestamp / 1000 : Date.now());

  return (
    <div
      style={{
        position: "relative",
        transform: `translate(${tempTransform.x}px, ${tempTransform.y}px)`,
      }}
    >
      {state !== "blurred" ? (
        <div
          style={{
            position: "absolute",
            color: "rebeccapurple",
            left: 0,
            top: -12,
            right: 0,
            fontSize: 10,

            whiteSpace: "nowrap",
          }}
        >
          <div style={{ marginRight: "1ch" }}>{edge.dest}</div>
        </div>
      ) : null}
      <div
        ref={ref}
        onDoubleClick={(event) => {
          event.stopPropagation();
          setState((prev) => (prev === "focused" ? "editing" : prev));
        }}
        id={`selection-${id}`}
        style={{
          cursor:
            dragOperation !== "none"
              ? getCursorFromDragOperation(dragOperation, true)
              : getCursorFromDragOperation(predictedDragOperation, false),
          overflow: "auto",
          width: tempResize
            ? tempResize.width
            : sizedEdge?.data?.width || "auto",
          height: tempResize
            ? tempResize.height
            : sizedEdge?.data?.height || "auto",

          borderWidth: 1,
          borderStyle: state === "hovered" ? "dashed" : "solid",
          borderColor:
            state === "hovered"
              ? "rebeccapurple"
              : state === "blurred"
              ? "transparent"
              : state === "focused"
              ? "rebeccapurple"
              : "green",
        }}
      >
        <SelectionContext.Provider value={{ editing: state === "editing" }}>
          <div style={{ pointerEvents: state === "editing" ? "auto" : "none" }}>
            {children}
          </div>
        </SelectionContext.Provider>
      </div>
      {state !== "blurred" ? (
        <div
          style={{
            position: "absolute",
            color: "rebeccapurple",
            left: 0,
            bottom: -12,
            right: 0,
            fontSize: 10,
            display: "flex",
            justifyContent: "flex-end",
            whiteSpace: "nowrap",
          }}
        >
          <span>
            <b>
              <AuthorLabel address={destDoc?.author || ""} />
            </b>{" "}
            {formatDistance(destDocDate, new Date(), {
              addSuffix: true,
            })}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function TextNode<EdgeData>({
  edge,
}: {
  edge: Omit<EdgeContent, "data"> & EdgeData;
}) {
  const [textDoc, setTextDoc] = useDocument(edge.dest);
  const { editing } = React.useContext(SelectionContext);
  const [textValue, setTextValue] = React.useState(textDoc?.content || "");

  const [debouncedTextValue] = useDebounce(textValue, 1000);

  React.useEffect(() => {
    if (textDoc?.content && textDoc.content !== textValue) {
      setTextValue(textDoc.content);
    }
  }, [textDoc?.content]);

  React.useEffect(() => {
    setTextDoc(debouncedTextValue);
  }, [setTextDoc, debouncedTextValue]);

  return (
    <textarea
      style={{
        background: "white",
        padding: 10,
        width: "calc(100% - 20px)",
        height: "calc(100% - 20px)",
        border: "none",
        resize: "none",
        fontSize: "1em",
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

export default App;
