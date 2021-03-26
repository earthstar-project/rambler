import * as React from "react";
import { isErr } from "earthstar";
import {
    useCurrentAuthor,
    useStorage
} from "react-earthstar";
import { findEdgesAsync } from "earthstar-graph-db";


export function useUnlinkDocFromBoard(docPath: string, boardPath: string) {
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
