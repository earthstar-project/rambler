import { isErr } from "earthstar";
import { writeEdge } from "earthstar-graph-db";
import { useCurrentAuthor, useStorage } from "react-earthstar";
import { Position, Size } from "./types";

export default function DocChooser({
  boardPath,
  position,
  size,
  onPlacedDoc,
}: {
  boardPath: string;
  position: Position;
  size: Size;
  onPlacedDoc: () => void;
}) {
  const storage = useStorage();
  const [currentAuthor] = useCurrentAuthor();

  if (!currentAuthor) {
    return (
      <div>
        {"You can't add anything to the board without being signed in!"}
      </div>
    );
  }

  return (
    <button
      style={{ width: 100 }}
      onClick={async () => {
        if (!storage) {
          return;
        }

        const docPath = `/notes/${Date.now()}.txt`;

        const writeResult = await storage?.set(currentAuthor, {
          content: "Hello there!",
          format: "es.4",
          path: docPath,
        });

        if (isErr(writeResult)) {
          console.error(writeResult);
          return;
        }

        await writeEdge(storage, currentAuthor, {
          owner: "common",
          data: position,
          source: boardPath,
          dest: docPath,
          kind: "PLACED",
        });

        await writeEdge(storage, currentAuthor, {
          owner: "common",
          data: size,
          source: boardPath,
          dest: docPath,
          kind: "SIZED",
        });

        onPlacedDoc();
      }}
    >
      {"Add a text note here!"}
    </button>
  );
}
