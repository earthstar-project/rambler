import * as React from "react";
import { useGesture } from "react-use-gesture";
import { usePopper } from "react-popper";
import { useBoardEdges } from "./useEdges";
import { TextNode } from "./TextNode";
import { SelectionBox } from "./SelectionBox";
import { BoardEdge, Position, Size } from "./types";
import DocChooser from "./DocChooser";
import ImageNode from "./ImageNode";

// Get the coordinates of the top left and bottom right of the board using the document placements within it
function getBoardCorners(edges: BoardEdge[]) {
  return edges.reduce(
    (acc, edge) => {
      return {
        top: Math.min(edge.position.y, acc.top),
        left: Math.min(edge.position.x, acc.left),
        bottom: Math.max(edge.position.y + edge.size.height, acc.bottom),
        right: Math.max(edge.position.x + edge.size.width, acc.right),
      };
    },
    { top: 0, left: 0, bottom: 0, right: 0 }
  );
}

const imageExtensions = ["gif", "jpg", "png", "jpeg"];

// Determine what kind of node is at the end of an edge and how to render it
type EdgeRenderType = "image" | "text" | "unknown";
// e.g. 'starts with '/lobby' so render a speech bubble
// ends with .midi so render a music player
// is in /todo/ so knows to render todo stuff
function getEdgeRenderType(edge: BoardEdge): EdgeRenderType {
  if (edge.dest.endsWith(".txt")) {
    return "text";
  }

  if (imageExtensions.includes(edge.dest.split(".").pop() || "")) {
    return "image";
  }

  return "unknown";
}
function renderEdge(edge: BoardEdge) {
  switch (getEdgeRenderType(edge)) {
    case "text":
      return (
        <SelectionBox key={edge.dest} edge={edge}>
          <TextNode edge={edge} />
        </SelectionBox>
      );
    case "image":
      return (
        <SelectionBox key={edge.dest} edge={edge}>
          <ImageNode edge={edge} />
        </SelectionBox>
      );
    default:
      return (
        <div style={{ border: "2px solid black", borderRadius: "50%" }}>
          {edge.dest}
        </div>
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

type BoardOperation = "idle" | "dragging" | "placing-doc" | "choosing-doc";

// board component which manages the virtual canvas space
export function Board({ boardPath }: { boardPath: string }) {
  const [viewX, setViewX] = React.useState(0);
  const [viewY, setViewY] = React.useState(0);

  const canvasRef = React.useRef<HTMLDivElement>(null);

  const [keysPressed, setKeysPressed] = React.useState<Set<string>>(new Set());
  const [keyDeltaX, setKeyDeltaX] = React.useState(0);
  const [keyDeltaY, setKeyDeltaY] = React.useState(0);

  const [operation, setOperation] = React.useState<BoardOperation>("idle");

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

  const documentOnMouseDown = React.useCallback(
    (event: Event) => {
      const isDocChooserClick = !!(event.target as Element)?.closest(
        `#doc-chooser`
      );
      const isTentativePlacement = !!(event.target as Element)?.closest(
        `#tentative-placement`
      );

      if (
        isTentativePlacement ||
        isDocChooserClick ||
        operation !== "choosing-doc"
      ) {
        return;
      }

      setOperation("idle");
      setCreatingArea(null);
    },
    [operation]
  );

  React.useEffect(() => {
    const target = document;

    if (target) {
      target.addEventListener("mousedown", documentOnMouseDown, false);
      target.addEventListener("keydown", onKeyDown, false);
      target.addEventListener("keyup", onKeyUp, false);
    }

    return () => {
      target?.removeEventListener("mousedown", documentOnMouseDown);
      target?.removeEventListener("keydown", onKeyDown);
      target?.removeEventListener("keyup", onKeyUp);
    };
  }, [onKeyDown, onKeyUp, documentOnMouseDown]);

  React.useEffect(() => {
    requestAnimationFrame(() => {
      const next = nextDeltasWithKeys(
        { deltaX: keyDeltaX, deltaY: keyDeltaY },
        keysPressed
      );

      const finalX = clampDelta(next.deltaX);
      const finalY = clampDelta(next.deltaY);

      setViewX((prev) => Math.round(prev + keyDeltaX));
      setViewY((prev) => Math.round(prev + keyDeltaY));

      setKeyDeltaX(finalX);
      setKeyDeltaY(finalY);
    });
  }, [keysPressed, keyDeltaX, keyDeltaY]);

  const startCreateTimeout = React.useRef<NodeJS.Timeout | undefined>();
  const [creatingArea, setCreatingArea] = React.useState<null | {
    position: Position;
    size: Size;
  }>(null);

  useGesture(
    {
      onDragStart: (drag) => {
        drag.event.preventDefault();
        drag.event.stopPropagation();
        if (operation === "choosing-doc") {
          return;
        }

        setCreatingArea(null);
        startCreateTimeout.current = setTimeout(() => {
          setOperation("placing-doc");
        }, 500);
        setOperation("dragging");
      },
      onDrag: (drag) => {
        drag.event.preventDefault();
        drag.event.stopPropagation();

        const [movementX, movementY] = drag.movement;

        if ((movementX > 4 || movementY > 4) && startCreateTimeout.current) {
          clearTimeout(startCreateTimeout.current);
        }

        if (operation === "dragging") {
          requestAnimationFrame(() => {
            const [x, y] = drag.delta;

            setViewX((prev) => prev - x);
            setViewY((prev) => prev - y);
          });
        }

        if (operation === "placing-doc") {
          const { left, top } = (drag.event
            .currentTarget as Element).getBoundingClientRect();
          requestAnimationFrame(() => {
            const [initialX, initialY] = drag.initial;

            const translatedX = initialX - left + viewX;
            const translatedY = initialY - top + viewY;

            const [width, height] = drag.movement;

            setCreatingArea({
              position: { x: translatedX, y: translatedY },
              size: {
                width,
                height,
              },
            });
          });
        }
      },
      onDragEnd: () => {
        if (startCreateTimeout.current) {
          clearTimeout(startCreateTimeout.current);
        }

        if (operation === "choosing-doc") {
          return;
        }

        setOperation((prev) => {
          if (prev === "placing-doc") {
            return "choosing-doc";
          }

          return "idle";
        });
      },
      onWheel: (wheel) => {
        requestAnimationFrame(() => {
          const [x, y] = wheel.delta;
          setViewX((prev) => prev + x);
          setViewY((prev) => prev + y);
        });
      },
    },
    {
      domTarget: canvasRef,
    }
  );

  const edges = useBoardEdges(boardPath);
  const boardCorners = getBoardCorners(edges);

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

  const [
    creatingBoxEl,
    setCreatingBoxEl,
  ] = React.useState<HTMLDivElement | null>(null);
  const [chooserEl, setChooserBoxEl] = React.useState<HTMLDivElement | null>(
    null
  );
  const [arrowEl, setArrowEl] = React.useState<HTMLDivElement | null>(null);

  const { styles: popperStyles, attributes: popperAttributes } = usePopper(
    creatingBoxEl,
    chooserEl,
    {
      modifiers: [{ name: "arrow", options: { element: arrowEl } }],
    }
  );

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
          cursor:
            operation === "placing-doc"
              ? "crosshair"
              : operation === "dragging"
              ? "grabbing"
              : "auto",
          WebkitUserSelect: "none",
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
                top: edge.position.y,
                left: edge.position.x,
                position: "fixed",
              }}
            >
              {renderEdge(edge)}
            </div>
          ))}
          {creatingArea ? (
            <div
              id={"tentative-placement"}
              ref={setCreatingBoxEl}
              style={{
                border: "1px solid white",
                top: creatingArea.position.y,
                left: creatingArea.position.x,
                width: creatingArea.size.width,
                height: creatingArea.size.height,
                background: "rgba(255,255,255, 0.4)",
                borderRadius: 1,
                position: "fixed",
                touchAction: "none",
              }}
            ></div>
          ) : null}
          {operation === "choosing-doc" && creatingArea ? (
            <div
              id={"doc-chooser"}
              ref={setChooserBoxEl}
              style={popperStyles.popper}
              {...popperAttributes.popper}
            >
              <DocChooser
                boardPath={boardPath}
                position={creatingArea.position}
                size={creatingArea.size}
                onPlacedDoc={() => {
                  setCreatingArea(null);
                  setOperation("idle");
                }}
              />
              <div
                ref={setArrowEl}
                style={popperStyles.arrow}
                {...popperAttributes.arrow}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
