import * as React from "react";
import {
  StorageLocalStorage,
  ValidatorEs4,
  StorageToAsync,
  isErr,
  Document,
} from "earthstar";
import {
  EarthstarPeer,
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
import useResizeObserver from "use-resize-observer";
import useDeepCompareEffect from "use-deep-compare-effect";
import { useDebounce } from "use-debounce";

import "./App.css";

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
        bottom: Math.max(edge.data.y + (size?.data.height || 0), acc.bottom),
        right: Math.max(edge.data.x + (size?.data.width || 0), acc.right),
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
      return <TextNode edge={edge} />;
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
    next.deltaY = next.deltaY / 1.1;
  }

  if (!set.has("ArrowLeft") && !set.has("ArrowRight")) {
    next.deltaX = next.deltaX / 1.1;
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

  const onWheel = React.useCallback(
    (wheelEvent: WheelEvent) => {
      const { deltaX, deltaY } = wheelEvent;

      requestAnimationFrame(() => {
        setX((prev) => prev + deltaX);
        setY((prev) => prev + deltaY);
      });
    },
    [setX, setY]
  );

  const [keysPressed, setKeysPressed] = React.useState<Set<string>>(new Set());
  const [isGrabbing, setIsGrabbing] = React.useState(false);
  const [prevDragPoint, setDragPoint] = React.useState<{
    x: number;
    y: number;
  } | null>(null);
  const [keyDeltaX, setKeyDeltaX] = React.useState(0);
  const [keyDeltaY, setKeyDeltaY] = React.useState(0);

  const onKeyDown = React.useCallback(
    (keyEvent: KeyboardEvent) => {
      const keys = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", " "];

      const { key } = keyEvent;

      if (!keys.includes(key)) {
        return;
      }

      keyEvent.preventDefault();

      if (keysPressed.has(key)) {
        return;
      }

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

  const onMouseMove = React.useCallback(
    (mouseEvent: MouseEvent) => {
      if (!isGrabbing) {
        return;
      }

      if (!prevDragPoint) {
        return;
      }

      requestAnimationFrame(() => {
        const diffX = mouseEvent.screenX - prevDragPoint.x;
        const diffY = mouseEvent.screenY - prevDragPoint.y;

        setDragPoint({
          x: prevDragPoint.x + diffX,
          y: prevDragPoint.y + diffY,
        });

        setX((prev) => prev - diffX);
        setY((prev) => prev - diffY);
      });
    },
    [setX, setY, isGrabbing, prevDragPoint]
  );

  const onMouseDown = React.useCallback(
    (clickEvent: MouseEvent) => {
      if (!keysPressed.has(" ")) {
        return;
      }

      setIsGrabbing(true);
      setDragPoint({ x: clickEvent.screenX, y: clickEvent.screenY });
    },
    [keysPressed]
  );

  const onMouseUp = React.useCallback(() => {
    setIsGrabbing(false);
    setDragPoint(null);
  }, []);

  React.useEffect(() => {
    const el = ref.current;

    el?.addEventListener("wheel", onWheel);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      el?.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onWheel, onKeyDown, onKeyUp, onMouseMove, onMouseDown, onMouseUp]);

  React.useEffect(() => {
    if (ref.current && keysPressed.has(" ")) {
      ref.current.style.cursor = "grab";
    }

    if (ref.current && keysPressed.has(" ") && isGrabbing) {
      ref.current.style.cursor = "grabbing";
    }

    if (ref.current && !isGrabbing && !keysPressed.has(" ")) {
      ref.current.style.cursor = "auto";
    }
  }, [keysPressed, isGrabbing]);

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

  return ref;
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
        }}
        onClick={async (clickEvent) => {
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

          const docPath = `${TRIPLEX_DIR}/${Date.now()}.txt`;

          const writeResult = await storage?.set(TEST_AUTHOR, {
            content: "Hello!",
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

// a component for rendering a text node. extremely wip.
function TextNode<EdgeData>({
  edge,
}: {
  edge: Omit<EdgeContent, "data"> & EdgeData;
}) {
  const storage = useStorage();
  const [textDoc] = useDocument(edge.dest);
  const { ref, height, width } = useResizeObserver();

  // TODO: pull out all this sizing behaviour into a hook/component that can be used on many components
  const [sizedEdge] = useEdges<Size>({
    source: edge.source,
    dest: edge.dest,
    kind: "SIZED",
  });

  const [debouncedHeight] = useDebounce(height, 1000);
  const [debouncedWidth] = useDebounce(width, 1000);

  React.useEffect(() => {
    if (!storage) {
      return;
    }

    if (!debouncedHeight || !debouncedWidth) {
      return;
    }

    if (
      debouncedHeight === sizedEdge?.data.height &&
      debouncedWidth === sizedEdge?.data.width
    ) {
      return;
    }

    writeEdge(storage, TEST_AUTHOR, {
      data: { width: debouncedWidth, height: debouncedHeight },
      dest: edge.dest,
      source: edge.source,
      kind: "SIZED",
      owner: "common",
    });
  }, [
    debouncedHeight,
    debouncedWidth,
    edge.dest,
    edge.source,
    storage,
    sizedEdge?.data.height,
    sizedEdge?.data.width,
  ]);

  // TODO: We know how much of the board the user can see, and the sizes and positions of each doc - let's only render what is within the bounds of the viewport!
  return (
    <div
      ref={ref}
      style={{
        background: "white",
        resize: "both",
        overflow: "auto",
        width: sizedEdge?.data.width || "auto",
        height: sizedEdge?.data.height || "auto",
      }}
    >
      {textDoc?.content}
    </div>
  );
}

export default App;
