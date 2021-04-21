import * as React from "react";
import { useStorage } from "react-earthstar";
import { BoardEdge } from "./types";
import MP3Tag from "mp3tag.js";
import { useSpring } from "react-spring";

function base64ToArrayBuffer(base64: string) {
  var binary_string = window.atob(base64);
  var len = binary_string.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export default function AudioNode({ edge }: { edge: BoardEdge }) {
  const storage = useStorage();

  const audioData = storage.getContent(edge.dest);
  const [albumArt, setAlbumArt] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [volume, setVolume] = React.useState(0);
  useSpring({
    from: {
      volume,
    },
    to: {
      volume: volume === 0 ? 1 : 0,
    },
    config: {
      duration: 500,
    },

    onChange: (value) => {
      if (!audioRef.current) {
        return;
      }

      audioRef.current.volume = (value.value.volume as any) as number;
    },
  });

  React.useEffect(() => {
    if (!audioData) {
      return;
    }
    const mp3tag = new MP3Tag(base64ToArrayBuffer(audioData.split(",")[1]));
    mp3tag.read();

    if (mp3tag.tags && mp3tag.tags.v2 && mp3tag.tags.v2.APIC.length > 0) {
      const content = new Uint8Array(mp3tag.tags.v2.APIC[0].data);

      const blob = new Blob([content.buffer], {
        type: mp3tag.tags.v2.APIC.format,
      });

      const contentURL = URL.createObjectURL(blob);

      setAlbumArt(contentURL);
    }
  }, [audioData]);

  if (!audioData) {
    return <div>{"Argh!"}</div>;
  }

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
        transition: "250ms all",
        filter: volume === 0 ? "none" : "grayscale(100%)",
        overflow: "hidden",
      }}
      onDoubleClick={() => {
        setVolume((prev) => (prev === 0 ? 1 : 0));
      }}
    >
      {albumArt ? (
        <img
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            objectFit: "contain",
            height: "100%",
            width: "100%",
            pointerEvents: "none",
          }}
          src={albumArt}
        />
      ) : null}
      <audio
        ref={audioRef}
        style={{ visibility: "hidden" }}
        src={audioData}
        controls
        autoPlay
        loop
      />
    </div>
  );
}
