import { writeEdge } from "earthstar-graph-db";
import * as React from "react";
import { useCurrentAuthor, useStorage } from "react-earthstar";
import { SelectionContext } from "./SelectionContext";
import { BoardEdge } from "./types";
import { useEdges } from "./useEdges";

type ImageStyle = "TILED" | "COVER" | "CONTAIN";

const imageStyles: Record<ImageStyle, React.CSSProperties> = {
  TILED: {
    backgroundSize: "auto",
    backgroundRepeat: "repeat",
  },
  CONTAIN: {
    backgroundSize: "contain",
    backgroundRepeat: "no-repeat",
  },
  COVER: {
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
  },
};

export default function ImageNode({ edge }: { edge: BoardEdge }) {
  const storage = useStorage();
  const ref = React.useRef<HTMLDivElement>(null);
  const [currentAuthor] = useCurrentAuthor();
  const { editing } = React.useContext(SelectionContext);

  const [imageStyleEdge] = useEdges<ImageStyle>({
    dest: edge.dest,
    source: edge.source,
    kind: "STYLED_IMAGE_EDGE",
  });

  const imageStyle = imageStyleEdge
    ? imageStyles[imageStyleEdge.data]
    : imageStyles.CONTAIN;

  const imageBase64 = storage.getContent(edge.dest);

  React.useEffect(() => {
    if (ref.current && imageBase64) {
      const image = `url('${imageBase64}')`;
      ref.current.style.backgroundImage = image;
    }
  }, [imageBase64]);

  const setStyle = React.useCallback(
    (style: ImageStyle) => {
      if (!currentAuthor) {
        return;
      }

      writeEdge(storage, currentAuthor, {
        data: style,
        dest: edge.dest,
        source: edge.source,
        kind: "STYLED_IMAGE_EDGE",
        owner: currentAuthor.address,
      });
    },
    [currentAuthor, edge.dest, edge.source, storage]
  );

  if (!imageBase64) {
    return <div>{"❌"}</div>;
  }

  return (
    <div
      ref={ref}
      style={{
        backgroundPosition: "center center",
        height: "100%",
        width: "100%",
        ...imageStyle,
      }}
    >
      {editing ? (
        <div>
          <button onClick={() => setStyle("COVER")}>{"Cover"}</button>
          <button onClick={() => setStyle("CONTAIN")}>{"Contain"}</button>
          <button onClick={() => setStyle("TILED")}>{"Tile"}</button>
        </div>
      ) : null}
    </div>
  );
}
