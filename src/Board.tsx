import * as React from "react";
import { isErr } from "earthstar";
import { useStorage } from "react-earthstar";
import { EdgeContent, writeEdge } from "earthstar-graph-db";
import { useGesture } from "react-use-gesture";
import { WORKSPACE_ADDR, TEST_AUTHOR, BOARD_PATH } from "./constants";
import { useEdges } from "./useEdges";
import { TextNode } from "./TextNode";
import { SelectionBox } from "./SelectionBox";
import { Position, Size } from "./types";

// Get the coordinates of the top left and bottom right of the board using the document placements within it
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
// board component which manages the virtual canvas space
export function Board() {
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

          writeEdge(storage, TEST_AUTHOR, {
            owner: "common",
            data: { width: 100, height: 100 },
            source: BOARD_PATH,
            dest: docPath,
            kind: "SIZED",
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

        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            transform: `translate(${-viewX}px, ${-viewY}px)`,
          }}
        >
          {edges.map((edge) => (
            <div
              key={edge.dest}
              style={{
                top: edge.data.y,
                left: edge.data.x,
                position: "fixed",
              }}
            >
              {renderEdge(edge)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
