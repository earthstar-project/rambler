import * as React from "react";
import { isErr } from "earthstar";
import { writeEdge } from "earthstar-graph-db";
import { useCurrentAuthor, useStorage } from "react-earthstar";
import { Position, Size } from "./types";

const DocChooserContext = React.createContext({
  boardPath: "",
  size: { width: 0, height: 0 },
  position: { x: 0, y: 0 },
  onDocChosen: (content: string, path: string) => {},
});

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

  const onDocChosen = React.useCallback(
    async (content: string, path: string) => {
      // TODO: Handle existing doc at path

      if (!currentAuthor) {
        return;
      }

      const writeResult = storage.set(currentAuthor, {
        content: content,
        format: "es.4",
        path: path,
      });

      if (isErr(writeResult)) {
        console.error(writeResult);
        return;
      }

      await writeEdge(storage, currentAuthor, {
        owner: "common",
        data: position,
        source: boardPath,
        dest: path,
        kind: "PLACED",
      });

      await writeEdge(storage, currentAuthor, {
        owner: "common",
        data: size,
        source: boardPath,
        dest: path,
        kind: "SIZED",
      });

      onPlacedDoc();
    },
    [boardPath, currentAuthor, onPlacedDoc, size, position, storage]
  );

  if (!currentAuthor) {
    return (
      <div>
        {"You can't add anything to the board without being signed in!"}
      </div>
    );
  }

  return (
    <DocChooserContext.Provider
      value={{
        onDocChosen,
        boardPath,
        position,
        size,
      }}
    >
      <AddTextButton />
      <ImageUploadButton />
      <MusicUploadButton />
    </DocChooserContext.Provider>
  );
}

function AddTextButton() {
  const { onDocChosen, boardPath } = React.useContext(DocChooserContext);

  return (
    <button
      style={{ width: 100 }}
      onClick={async () => {
        onDocChosen("Hello!", `${boardPath}/${Date.now()}.txt`);
      }}
    >
      {"Add a text note here!"}
    </button>
  );
}

function useReadFile() {
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [currentFile, setCurrentFile] = React.useState<null | Blob>(null);
  const [readBlob, setReadBlob] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!currentFile) {
      return;
    }

    const fileReader = new FileReader();

    fileReader.onload = () => {
      setReadBlob(fileReader.result as string);
    };

    fileReader.readAsDataURL(currentFile);
  }, [currentFile]);

  const onChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const firstFile = event.target.files[0];

      setFileName(firstFile.name);

      setCurrentFile(firstFile);
    },
    []
  );

  return { onChange, result: readBlob, fileName };
}

function ImageUploadButton() {
  const { onChange, result, fileName } = useReadFile();
  const [currentAuthor] = useCurrentAuthor();
  const labelRef = React.useRef<HTMLLabelElement | null>(null);
  const { onDocChosen } = React.useContext(DocChooserContext);

  React.useEffect(() => {
    if (!result) {
      return;
    }

    onDocChosen(result, `/images/${currentAuthor?.address}/${fileName}`);
  }, [result, onDocChosen, currentAuthor?.address, fileName]);

  return (
    <div>
      <input
        style={{ visibility: "hidden", position: "absolute" }}
        id={"image-upload-button"}
        type={"file"}
        onChange={onChange}
      />
      <label ref={labelRef} htmlFor={"image-upload-button"}>
        <button
          onClick={() => {
            if (labelRef.current) {
              labelRef.current.click();
            }
          }}
        >
          {"Upload image"}
        </button>
      </label>
    </div>
  );
}

function MusicUploadButton() {
  const { onChange, result, fileName } = useReadFile();
  const [currentAuthor] = useCurrentAuthor();
  const labelRef = React.useRef<HTMLLabelElement | null>(null);
  const { onDocChosen } = React.useContext(DocChooserContext);

  React.useEffect(() => {
    if (!result) {
      return;
    }

    onDocChosen(result, `/music/${currentAuthor?.address}/${fileName}`);
  }, [result, onDocChosen, currentAuthor?.address, fileName]);

  return (
    <div>
      <input
        style={{ visibility: "hidden", position: "absolute" }}
        id={"image-upload-button"}
        type={"file"}
        onChange={onChange}
      />
      <label ref={labelRef} htmlFor={"image-upload-button"}>
        <button
          onClick={() => {
            if (labelRef.current) {
              labelRef.current.click();
            }
          }}
        >
          {"Upload music"}
        </button>
      </label>
    </div>
  );
}
